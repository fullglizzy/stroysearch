import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const userId = (session.user as any).id;
  const { id: docId } = await params;

  const doc = await prisma.libraryDocument.findUnique({ where: { id: docId } });
  if (!doc) {
    return NextResponse.json({ error: "Документ не найден" }, { status: 404 });
  }

  // Check if already purchased
  const existing = await prisma.documentPurchase.findUnique({
    where: { documentId_userId: { documentId: docId, userId } },
  });
  if (existing) {
    return NextResponse.json({ success: true, alreadyPurchased: true });
  }

  // Check balance
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet || wallet.balance < doc.coinPrice) {
    return NextResponse.json({ error: "Недостаточно монет" }, { status: 400 });
  }

  // Perform purchase
  await prisma.$transaction([
    prisma.wallet.update({
      where: { userId },
      data: { balance: { decrement: doc.coinPrice } },
    }),
    prisma.documentPurchase.create({
      data: { documentId: docId, userId },
    }),
    prisma.libraryDocument.update({
      where: { id: docId },
      data: { purchasesCount: { increment: 1 } },
    }),
    prisma.transaction.create({
      data: {
        userId,
        type: "DOCUMENT_PURCHASE",
        amount: -doc.coinPrice,
        balanceAfter: wallet.balance - doc.coinPrice,
        description: `Покупка документа: ${doc.title}`,
        metadata: JSON.stringify({ documentId: docId }),
      },
    }),
  ]);

  // Credit seller
  if (doc.userId !== userId) {
    const sellerWallet = await prisma.wallet.upsert({
      where: { userId: doc.userId },
      update: { balance: { increment: doc.coinPrice } },
      create: { userId: doc.userId, balance: doc.coinPrice },
    });

    await prisma.transaction.create({
      data: {
        userId: doc.userId,
        type: "DOCUMENT_SALE",
        amount: doc.coinPrice,
        balanceAfter: sellerWallet.balance,
        description: `Продажа документа: ${doc.title}`,
        metadata: JSON.stringify({ documentId: docId }),
      },
    });
  }

  return NextResponse.json({ success: true });
}
