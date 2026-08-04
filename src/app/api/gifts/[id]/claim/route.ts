import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const userId = (session.user as any).id;
  const { id: giftId } = await params;

  const gift = await prisma.gift.findUnique({ where: { id: giftId } });
  if (!gift || gift.limit <= 0) {
    return NextResponse.json(
      { error: "Подарок недоступен" },
      { status: 404 },
    );
  }

  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet || wallet.balance < gift.coinPrice) {
    return NextResponse.json(
      { error: "Недостаточно монет" },
      { status: 400 },
    );
  }

  await prisma.$transaction([
    prisma.wallet.update({
      where: { userId },
      data: { balance: { decrement: gift.coinPrice } },
    }),
    prisma.gift.update({
      where: { id: giftId },
      data: { limit: { decrement: 1 } },
    }),
    prisma.giftClaim.create({
      data: { giftId, userId },
    }),
    prisma.transaction.create({
      data: {
        userId,
        type: "GIFT_RECEIVE",
        amount: -gift.coinPrice,
        balanceAfter: wallet.balance - gift.coinPrice,
        description: `Получение подарка: ${gift.name}`,
        metadata: JSON.stringify({ giftId }),
      },
    }),
  ]);

  return NextResponse.json({ success: true });
}
