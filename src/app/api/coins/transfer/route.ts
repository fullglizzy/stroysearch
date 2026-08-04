import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const userId = (session.user as any).id;
  const body = await request.json();
  const { targetUsername, amount } = body;

  if (!targetUsername || !amount || amount <= 0) {
    return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
  }

  // Find target user by username or INN
  const target = await prisma.user.findFirst({
    where: {
      OR: [
        { username: targetUsername },
        { profile: { inn: targetUsername } },
      ],
    },
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

  // Check balance
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet || wallet.balance < amount) {
    return NextResponse.json({ error: "Недостаточно монет" }, { status: 400 });
  }

  // Perform transfer
  await prisma.$transaction([
    prisma.wallet.update({
      where: { userId },
      data: { balance: { decrement: amount } },
    }),
    prisma.wallet.update({
      where: { userId: target.id },
      data: { balance: { increment: amount } },
    }),
    prisma.transaction.create({
      data: {
        userId,
        type: "GIFT_SEND",
        amount: -amount,
        balanceAfter: wallet.balance - amount,
        description: `Перевод пользователю ${target.username}`,
        metadata: JSON.stringify({ targetUserId: target.id }),
      },
    }),
  ]);

  const targetWallet = await prisma.wallet.findUnique({
    where: { userId: target.id },
  });

  await prisma.transaction.create({
    data: {
      userId: target.id,
      type: "GIFT_RECEIVE",
      amount,
      balanceAfter: targetWallet!.balance,
      description: `Получение от пользователя ${(session.user as any).username}`,
      metadata: JSON.stringify({ fromUserId: userId }),
    },
  });

  return NextResponse.json({ success: true });
}
