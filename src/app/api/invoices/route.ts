import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Список счетов текущего пользователя (для раздела «Счета» в финансах)
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const userId = (session.user as any).id;

  const invoices = await prisma.invoice.findMany({
    where: { userId },
    orderBy: { date: "desc" },
    select: {
      id: true,
      number: true,
      date: true,
      dueDate: true,
      status: true,
      total: true,
    },
  });

  return NextResponse.json({
    invoices: invoices.map((i) => ({
      id: i.id,
      number: i.number,
      date: i.date,
      dueDate: i.dueDate,
      status: i.status,
      total: i.total.toNumber(),
    })),
  });
}
