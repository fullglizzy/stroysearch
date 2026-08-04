import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reviewSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const userId = (session.user as any).id;
  const body = await request.json();
  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { targetId, companyId, comment, signatureType, criteria } = parsed.data;

  // Calculate weighted average
  const sum = criteria.reduce((acc, c) => acc + c.score, 0);
  const weightedAverage = sum / criteria.length;

  // Check if user already reviewed this target
  const existing = await prisma.review.findFirst({
    where: { authorId: userId, targetId },
  });

  let review;
  if (existing) {
    // Update existing review
    await prisma.reviewCriteria.deleteMany({ where: { reviewId: existing.id } });
    review = await prisma.review.update({
      where: { id: existing.id },
      data: {
        comment,
        signatureType,
        weightedAverage,
        companyId: companyId || null,
        criteria: {
          create: criteria.map((c) => ({
            criteriaIndex: c.criteriaIndex,
            score: c.score,
          })),
        },
      },
    });
  } else {
    review = await prisma.review.create({
      data: {
        authorId: userId,
        targetId,
        companyId: companyId || null,
        comment,
        signatureType,
        weightedAverage,
        criteria: {
          create: criteria.map((c) => ({
            criteriaIndex: c.criteriaIndex,
            score: c.score,
          })),
        },
      },
    });

    // Award coins for review
    const billingConfig = await prisma.billingConfig.findUnique({ where: { id: "default" } });
    const coinReward = billingConfig?.reviewCoins ?? 1;

    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (wallet) {
      await prisma.wallet.update({
        where: { userId },
        data: { balance: { increment: coinReward } },
      });
      await prisma.transaction.create({
        data: {
          userId,
          type: "REVIEW",
          amount: coinReward,
          balanceAfter: wallet.balance + coinReward,
          description: `Начисление за отзыв`,
          metadata: JSON.stringify({ reviewId: review.id }),
        },
      });
    }
  }

  return NextResponse.json({ success: true, id: review.id });
}
