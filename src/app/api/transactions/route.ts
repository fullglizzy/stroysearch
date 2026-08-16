import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { SessionUser } from "@/types";

const PAGE_SIZE = 20;

// Пагинированный список операций текущего пользователя с фильтром по типу.
// Начальную порцию страница получает из серверного рендера,
// остальное догружается кнопкой «Показать ещё».
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const userId = (session.user as SessionUser).id;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const type = (searchParams.get("type") || "").trim();

  const where: Prisma.TransactionWhereInput = { userId };
  if (type) where.type = type;

  const transactions = await prisma.transaction.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  return NextResponse.json({
    transactions: transactions.map((t) => ({
      id: t.id,
      type: t.type,
      amount: t.amount.toNumber(),
      description: t.description,
      createdAt: t.createdAt,
    })),
    hasMore: transactions.length === PAGE_SIZE,
  });
}
