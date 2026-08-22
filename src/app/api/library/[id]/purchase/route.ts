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
    const { id: docId } = await params;

    const doc = await prisma.libraryDocument.findUnique({
      where: { id: docId },
      select: { id: true, title: true, coinPrice: true, userId: true, isApproved: true, deletedAt: true },
    });
    if (!doc) {
      return NextResponse.json({ error: "Документ не найден" }, { status: 404 });
    }
    // Покупать можно только одобренные и не удалённые документы
    if (!doc.isApproved || doc.deletedAt) {
      return NextResponse.json({ error: "Документ недоступен" }, { status: 404 });
    }

    // Check if already purchased
    const existing = await prisma.documentPurchase.findUnique({
      where: { documentId_userId: { documentId: docId, userId } },
    });
    if (existing) {
      return NextResponse.json({ success: true, alreadyPurchased: true });
    }

    // Вся экономика покупки — в одной транзакции: списание, запись,
    // история и начисление продавцу. При сбое откатывается всё.
    const result = await prisma.$transaction(async (tx) => {
      // Атомарное списание с проверкой баланса
      const debit = await tx.wallet.updateMany({
        where: { userId, balance: { gte: doc.coinPrice } },
        data: { balance: { decrement: doc.coinPrice } },
      });
      if (debit.count === 0) {
        throw new Error("Недостаточно монет");
      }

      const buyerWallet = await tx.wallet.findUnique({ where: { userId } });
      await roundWalletBalance(tx, userId);

      await tx.documentPurchase.create({
        data: { documentId: docId, userId },
      });
      await tx.libraryDocument.update({
        where: { id: docId },
        data: { purchasesCount: { increment: 1 } },
      });
      await tx.transaction.create({
        data: {
          userId,
          type: "DOCUMENT_PURCHASE",
          amount: -doc.coinPrice,
          balanceAfter: buyerWallet?.balance.toDecimalPlaces(2) ?? 0,
          description: `Покупка документа: ${doc.title}`,
          metadata: JSON.stringify({ documentId: docId }),
        },
      });

      // Credit seller (своя покупка продавцу не начисляется)
      if (doc.userId !== userId) {
        const sellerWallet = await tx.wallet.upsert({
          where: { userId: doc.userId },
          update: { balance: { increment: doc.coinPrice } },
          create: { userId: doc.userId, balance: doc.coinPrice },
        });
        await roundWalletBalance(tx, doc.userId);
        await tx.transaction.create({
          data: {
            userId: doc.userId,
            type: "DOCUMENT_SALE",
            amount: doc.coinPrice,
            balanceAfter: sellerWallet.balance.toDecimalPlaces(2),
            description: `Продажа документа: ${doc.title}`,
            metadata: JSON.stringify({ documentId: docId, buyerId: userId }),
          },
        });
      }
      return true;
    });

    return NextResponse.json({ success: true, purchased: result });
  } catch (e) {
    if (e instanceof Error && e.message === "Недостаточно монет") {
      return NextResponse.json({ error: "Недостаточно монет" }, { status: 400 });
    }
    return NextResponse.json({ error: "Не удалось приобрести документ" }, { status: 500 });
  }
}
