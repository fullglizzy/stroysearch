import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Счета на выплату текущего пользователя (страница «Выплаты» в ЛК компании).
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;

  const invoices = await prisma.invoice.findMany({
    where: { userId, kind: "PAYOUT" },
    orderBy: { date: "desc" },
    select: {
      id: true,
      number: true,
      date: true,
      dueDate: true,
      status: true,
      total: true,
      sentAt: true,
      paidAt: true,
    },
  });

  return NextResponse.json({
    invoices: invoices.map((i) => ({
      ...i,
      total: i.total.toNumber(),
    })),
  });
}
