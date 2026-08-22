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
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const userId = session.user.id;
    const { id: giftId } = await params;

    const gift = await prisma.gift.findUnique({
      where: { id: giftId },
      select: { id: true, name: true, coinPrice: true, limit: true, deletedAt: true },
    });
    if (!gift || gift.limit <= 0 || gift.deletedAt) {
      return NextResponse.json(
        { error: "Подарок недоступен" },
        { status: 404 },
      );
    }

    // Вся операция — в одной транзакции с условными обновлениями
    await prisma.$transaction(async (tx) => {
      const debit = await tx.wallet.updateMany({
        where: { userId, balance: { gte: gift.coinPrice } },
        data: { balance: { decrement: gift.coinPrice } },
      });
      if (debit.count === 0) {
        throw new Error("Недостаточно монет");
      }

      // Атомарно забираем «штуку» из лимита — защита от одновременных выдач
      const stock = await tx.gift.updateMany({
        where: { id: giftId, limit: { gt: 0 } },
        data: { limit: { decrement: 1 } },
      });
      if (stock.count === 0) {
        throw new Error("Подарок недоступен");
      }

      await tx.giftClaim.create({
        data: { giftId, userId },
      });

      const wallet = await tx.wallet.findUnique({ where: { userId } });
      await roundWalletBalance(tx, userId);
      await tx.transaction.create({
        data: {
          userId,
          type: "GIFT_CLAIM",
          amount: -gift.coinPrice,
          balanceAfter: wallet?.balance.toDecimalPlaces(2) ?? 0,
          description: `Получение подарка: ${gift.name}`,
          metadata: JSON.stringify({ giftId }),
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    if (e instanceof Error && e.message === "Недостаточно монет") {
      return NextResponse.json({ error: "Недостаточно монет" }, { status: 400 });
    }
    if (e instanceof Error && e.message === "Подарок недоступен") {
      return NextResponse.json({ error: "Подарок недоступен" }, { status: 404 });
    }
    return NextResponse.json({ error: "Не удалось получить подарок" }, { status: 500 });
  }
}
