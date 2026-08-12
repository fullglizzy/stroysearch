import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { roundWalletBalance } from "@/lib/money";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const body = await request.json();
    const { targetUsername, amount } = body;

    if (!targetUsername || typeof targetUsername !== "string") {
      return NextResponse.json({ error: "Укажите получателя" }, { status: 400 });
    }

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ error: "Некорректная сумма" }, { status: 400 });
    }

    // Find target user by username or INN
    const target = await prisma.user.findFirst({
      where: {
        OR: [
          { username: targetUsername },
          { profile: { inn: targetUsername } },
        ],
      },
      select: { id: true, username: true },
    });

    if (!target) {
      return NextResponse.json({ error: "Получатель не найден" }, { status: 404 });
    }

    if (target.id === userId) {
      return NextResponse.json(
        { error: "Нельзя перевести монеты самому себе" },
        { status: 400 },
      );
    }

    // Весь перевод — в одной транзакции
    await prisma.$transaction(async (tx) => {
      // Атомарное списание с проверкой баланса
      const debit = await tx.wallet.updateMany({
        where: { userId, balance: { gte: parsedAmount } },
        data: { balance: { decrement: parsedAmount } },
      });
      if (debit.count === 0) {
        throw new Error("Недостаточно монет");
      }

      const senderWallet = await tx.wallet.findUnique({ where: { userId } });
      await roundWalletBalance(tx, userId);
      await tx.transaction.create({
        data: {
          userId,
          type: "GIFT_SEND",
          amount: -parsedAmount,
          balanceAfter: senderWallet?.balance.toDecimalPlaces(2) ?? 0,
          description: `Перевод пользователю ${target.username}`,
          metadata: JSON.stringify({ targetUserId: target.id }),
        },
      });

      // Кошелёк получателя создаётся при необходимости
      const targetWallet = await tx.wallet.upsert({
        where: { userId: target.id },
        update: { balance: { increment: parsedAmount } },
        create: { userId: target.id, balance: parsedAmount },
      });
      await roundWalletBalance(tx, target.id);
      await tx.transaction.create({
        data: {
          userId: target.id,
          type: "GIFT_RECEIVE",
          amount: parsedAmount,
          balanceAfter: targetWallet.balance.toDecimalPlaces(2),
          description: `Получение от пользователя ${(session.user as any).username}`,
          metadata: JSON.stringify({ fromUserId: userId }),
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    if (e instanceof Error && e.message === "Недостаточно монет") {
      return NextResponse.json({ error: "Недостаточно монет" }, { status: 400 });
    }
    return NextResponse.json({ error: "Не удалось выполнить перевод" }, { status: 500 });
  }
}
