import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reviewSchema } from "@/lib/validators";
import { roundWalletBalance } from "@/lib/money";
import { notifyUser, cabinetHome } from "@/lib/notifications";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");
    const targetId = searchParams.get("targetId");

    const where = companyId
      ? { companyId }
      : targetId
        ? { targetId, companyId: null }
        : null;

    if (!where) {
      return NextResponse.json({ error: "Укажите companyId или targetId" }, { status: 400 });
    }

    const reviews = await prisma.review.findMany({
      where,
      include: {
        author: {
          select: {
            username: true,
            profile: { select: { nick: true } },
          },
        },
        criteria: {
          orderBy: { criteriaIndex: "asc" },
          select: { criteriaIndex: true, score: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      reviews: reviews.map((r) => ({
        id: r.id,
        authorNick: r.author.profile?.nick || r.author.username,
        comment: r.comment,
        weightedAverage: r.weightedAverage,
        createdAt: r.createdAt,
        criteria: r.criteria.map((c) => ({ criteriaIndex: c.criteriaIndex, score: c.score })),
      })),
    });
  } catch {
    return NextResponse.json({ error: "Не удалось загрузить отзывы" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
    }

    const userId = (session.user as any).id;

    // Отзывы могут оставлять только активные пользователи
    const author = await prisma.user.findUnique({
      where: { id: userId },
      select: { status: true },
    });
    if (!author || author.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Ваш аккаунт не активен — оставлять отзывы нельзя" },
        { status: 403 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Некорректный формат запроса" }, { status: 400 });
    }

    const parsed = reviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { targetId, companyId, comment, signatureType, criteria } = parsed.data;

    // Отзыв о компании хранится с привязкой к владельцу компании (Review.target → User).
    // Если владельца нет, целью становится пользователь, добавивший компанию в базу.
    let resolvedTargetId = targetId;
    let resolvedCompanyId: string | null = companyId ?? null;

    if (companyId) {
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: { id: true, ownerUserId: true, addedById: true },
      });
      if (!company) {
        return NextResponse.json({ error: "Компания не найдена" }, { status: 404 });
      }
      // Свою компанию (которой владеешь) отзывать нельзя, но компанию,
      // которую пользователь добавил в базу, отзывать можно.
      if (company.ownerUserId === userId) {
        return NextResponse.json(
          { error: "Нельзя оставить отзыв о своей компании" },
          { status: 400 },
        );
      }
      const target = company.ownerUserId ?? company.addedById;
      if (!target) {
        return NextResponse.json(
          { error: "Компания не привязана к пользователю — отзыв невозможен" },
          { status: 400 },
        );
      }
      resolvedTargetId = target;
      resolvedCompanyId = company.id;
    } else {
      if (targetId === userId) {
        return NextResponse.json({ error: "Нельзя оставить отзыв о себе" }, { status: 400 });
      }
      const targetUser = await prisma.user.findUnique({
        where: { id: targetId },
        select: { status: true },
      });
      if (!targetUser || targetUser.status !== "ACTIVE") {
        return NextResponse.json(
          { error: "Пользователь, которому адресован отзыв, не найден" },
          { status: 404 },
        );
      }
    }

    // Calculate weighted average
    const sum = criteria.reduce((acc, c) => acc + c.score, 0);
    const weightedAverage = sum / criteria.length;

    let updated = false;

    await prisma.$transaction(async (tx) => {
      // Check if user already reviewed this target.
      // companyId учитывается, чтобы разные компании без владельца
      // (добавленные одним пользователем) не затирали отзывы друг друга.
      const existing = await tx.review.findFirst({
        where: {
          authorId: userId,
          targetId: resolvedTargetId,
          companyId: resolvedCompanyId,
        },
      });

      const data = {
        comment,
        signatureType,
        weightedAverage,
        companyId: resolvedCompanyId,
        criteria: {
          create: criteria.map((c) => ({
            criteriaIndex: c.criteriaIndex,
            score: c.score,
          })),
        },
      };

      if (existing) {
        // Update existing review
        await tx.reviewCriteria.deleteMany({ where: { reviewId: existing.id } });
        await tx.review.update({
          where: { id: existing.id },
          data,
        });
        updated = true;
      } else {
        await tx.review.create({
          data: {
            authorId: userId,
            targetId: resolvedTargetId,
            ...data,
          },
        });

        // Award coins for review
        const billingConfig = await tx.billingConfig.findUnique({ where: { id: "default" } });
        const coinReward = billingConfig?.reviewCoins ? billingConfig.reviewCoins.toNumber() : 1;

        const wallet = await tx.wallet.findUnique({ where: { userId } });
        if (wallet) {
          await tx.wallet.update({
            where: { userId },
            data: { balance: { increment: coinReward } },
          });
          await roundWalletBalance(tx, userId);
          await tx.transaction.create({
            data: {
              userId,
              type: "REVIEW",
              amount: coinReward,
              balanceAfter: wallet.balance.plus(coinReward).toDecimalPlaces(2),
              description: `Начисление за отзыв`,
              metadata: JSON.stringify({ targetId: resolvedTargetId }),
            },
          });
        }
      }
    });

    // Уведомляем получателя только о новом отзыве (обновление существующего — без шума)
    if (!updated) {
      const target = await prisma.user.findUnique({
        where: { id: resolvedTargetId },
        select: { type: true },
      });
      await notifyUser({
        userId: resolvedTargetId,
        type: "REVIEW",
        title: "Новый отзыв",
        message: "О вас оставили новый отзыв на платформе.",
        link: `${cabinetHome(target?.type)}/reviews`,
      });
    }

    return NextResponse.json({ success: true, updated });
  } catch {
    return NextResponse.json(
      { error: "Не удалось опубликовать отзыв. Попробуйте ещё раз" },
      { status: 500 },
    );
  }
}
