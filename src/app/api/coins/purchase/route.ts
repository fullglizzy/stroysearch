import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

const PURCHASE_SUBJECT = "Покупка монет";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
    }

    const userId = (session.user as any).id as string;
    const email = session.user.email || "";

    let body: { amount?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Некорректный формат запроса" }, { status: 400 });
    }

    const amount = Number(body.amount);
    if (!Number.isInteger(amount) || amount < 1 || amount > 10000) {
      return NextResponse.json({ error: "Укажите целое количество монет от 1 до 10000" }, { status: 400 });
    }

    const billing = await prisma.billingConfig.findUnique({ where: { id: "default" } });
    const coinPrice = billing?.coinPriceRub ? billing.coinPriceRub.toNumber() : 100;
    const total = Math.round(amount * coinPrice * 100) / 100;

    // Контроль месячного лимита: учитываем все неотменённые счета текущего месяца
    const monthLimit = billing?.maxMonthlyLimit ? billing.maxMonthlyLimit.toNumber() : 1000;
    if (monthLimit > 0) {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const monthlyAgg = await prisma.invoice.aggregate({
        where: {
          userId,
          date: { gte: monthStart },
          status: { not: "CANCELLED" },
        },
        _sum: { total: true },
      });
      const already = monthlyAgg._sum.total ? monthlyAgg._sum.total.toNumber() : 0;
      if (already + total > monthLimit) {
        return NextResponse.json(
          { error: `Превышен месячный лимит покупок (${monthLimit} ₽). Доступно: ${Math.max(0, monthLimit - already)} ₽` },
          { status: 400 },
        );
      }
    }

    const number = `INV-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

    const result = await prisma.$transaction(async (tx) => {
      // Заявка падает в систему тикетов
      const ticket = await tx.supportTicket.create({
        data: {
          userId,
          email,
          subject: PURCHASE_SUBJECT,
          message: `Заявка на покупку ${amount} монет на сумму ${total} ₽.`,
        },
      });

      const invoice = await tx.invoice.create({
        data: {
          userId,
          number,
          date: new Date(),
          dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          subtotal: total,
          limit: monthLimit,
          total,
          ticketId: ticket.id,
          items: {
            create: [
              {
                description: `Покупка ${amount} монет`,
                quantity: amount,
                unitPrice: coinPrice,
                total,
              },
            ],
          },
        },
      });

      return { ticketId: ticket.id, invoiceId: invoice.id, total };
    });

    return NextResponse.json({ success: true, ...result });
  } catch {
    return NextResponse.json({ error: "Не удалось создать заявку на покупку" }, { status: 500 });
  }
}
