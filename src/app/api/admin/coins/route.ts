import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const userType = (session.user as any).type as string;
  if (!["SUPER", "ROOT"].includes(userType)) {
    return NextResponse.json({ error: "Нет прав" }, { status: 403 });
  }

  const body = await request.json();
  const { userId, amount } = body;

  if (!userId || !amount) {
    return NextResponse.json(
      { error: "userId и amount обязательны" },
      { status: 400 },
    );
  }

  const wallet = await prisma.wallet.upsert({
    where: { userId },
    update: { balance: { increment: amount } },
    create: { userId, balance: amount },
  });

  await prisma.transaction.create({
    data: {
      userId,
      type: "MODERATOR_ADD",
      amount,
      balanceAfter: wallet.balance,
      description: "Ручное зачисление модератором",
    },
  });

  return NextResponse.json({ success: true, balance: wallet.balance });
}
