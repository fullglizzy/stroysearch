import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Список счетов текущего пользователя (для раздела «Счета» в финансах).
// Счета биллинга (kind: BILLING) компания видит в единой вкладке «Финансы».
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const userId = session.user.id;

  const invoices = await prisma.invoice.findMany({
    where: { userId, kind: "PURCHASE" },
    orderBy: { date: "desc" },
    select: {
      id: true,
      number: true,
      date: true,
      dueDate: true,
      status: true,
      total: true,
      ticketId: true,
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
      ticketId: i.ticketId,
    })),
  });
}
