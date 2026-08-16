import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notifications";

/**
 * Отметка счёта на выплату как выплаченного (DRAFT → PAID).
 * Баланс монет не меняется — выплата по реквизитам вне платформы.
 * Только ROOT.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }
  if ((session.user as { type?: string }).type !== "ROOT") {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный формат запроса" }, { status: 400 });
  }

  const invoiceId = (body as { invoiceId?: unknown } | null)?.invoiceId;
  if (typeof invoiceId !== "string" || !invoiceId) {
    return NextResponse.json({ error: "Не указан счёт" }, { status: 400 });
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { id: true, number: true, userId: true, kind: true, status: true, sentAt: true },
  });
  if (!invoice || (invoice.kind !== "PAYOUT" && invoice.kind !== "ACTIVITY")) {
    return NextResponse.json({ error: "Счёт на выплату не найден" }, { status: 404 });
  }
  if (invoice.status === "PAID") {
    return NextResponse.json({ error: "Счёт уже выплачен" }, { status: 400 });
  }

  // Атомарная смена статуса: нельзя выплатить дважды
  await prisma.invoice.updateMany({
    where: { id: invoice.id, status: { not: "PAID" } },
    data: {
      status: "PAID",
      paidAt: new Date(),
      sentAt: invoice.sentAt ?? new Date(),
    },
  });

  // Уведомляем компанию о произведённой выплате
  await notifyUser({
    userId: invoice.userId,
    type: "PAYOUT",
    title: "Выплата произведена",
    message: `Счёт №${invoice.number} отмечен как выплаченный.`,
    link: "/company/payouts",
  });

  return NextResponse.json({ success: true });
}
