import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { roundWalletBalance } from "@/lib/money";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
    }

    const userId = session.user.id;
    const { id: confId } = await params;

    const conf = await prisma.conference.findUnique({
      where: { id: confId },
      select: { id: true, title: true, coinPrice: true, organizerId: true, status: true },
    });
    if (!conf) {
      return NextResponse.json({ error: "Конференция не найдена" }, { status: 404 });
    }

    // Платить можно только за одобренную конференцию
    if (conf.status !== "APPROVED") {
      return NextResponse.json(
        { error: "Конференция ещё не одобрена модератором" },
        { status: 400 },
      );
    }

    // Организатор не покупает билет на свою конференцию
    if (conf.organizerId === userId) {
      return NextResponse.json({ success: true, alreadyJoined: true });
    }

    // Check existing
    const existing = await prisma.conferenceParticipant.findUnique({
      where: { conferenceId_userId: { conferenceId: confId, userId } },
    });
    if (existing) {
      return NextResponse.json({ success: true, alreadyJoined: true });
    }

    // Вся экономика входа — в одной транзакции, включая начисление организатору
    await prisma.$transaction(async (tx) => {
      if (conf.coinPrice > 0) {
        // Атомарное списание с проверкой баланса
        const debit = await tx.wallet.updateMany({
          where: { userId, balance: { gte: conf.coinPrice } },
          data: { balance: { decrement: conf.coinPrice } },
        });
        if (debit.count === 0) {
          throw new Error("Недостаточно монет");
        }

        const buyerWallet = await tx.wallet.findUnique({ where: { userId } });
        await roundWalletBalance(tx, userId);

        await tx.transaction.create({
          data: {
            userId,
            type: "CONFERENCE_ENTRY",
            amount: -conf.coinPrice,
            balanceAfter: buyerWallet?.balance.toDecimalPlaces(2) ?? 0,
            description: `Вход на конференцию: ${conf.title}`,
            metadata: JSON.stringify({ conferenceId: confId }),
          },
        });

        // Начисление организатору — внутри той же транзакции
        const orgWallet = await tx.wallet.upsert({
          where: { userId: conf.organizerId },
          update: { balance: { increment: conf.coinPrice } },
          create: { userId: conf.organizerId, balance: conf.coinPrice },
        });
        await roundWalletBalance(tx, conf.organizerId);
        await tx.transaction.create({
          data: {
            userId: conf.organizerId,
            type: "CONFERENCE_ORGANIZER",
            amount: conf.coinPrice,
            balanceAfter: orgWallet.balance.toDecimalPlaces(2),
            description: `Доход от конференции: ${conf.title}`,
            metadata: JSON.stringify({ conferenceId: confId, buyerId: userId }),
          },
        });
      }

      await tx.conferenceParticipant.create({
        data: { conferenceId: confId, userId },
      });
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    if (e instanceof Error && e.message === "Недостаточно монет") {
      return NextResponse.json({ error: "Недостаточно монет" }, { status: 400 });
    }
    return NextResponse.json({ error: "Не удалось войти на конференцию" }, { status: 500 });
  }
}
