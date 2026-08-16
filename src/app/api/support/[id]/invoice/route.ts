import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { roundWalletBalance } from "@/lib/money";
import { notifyUser, cabinetHome } from "@/lib/notifications";

const ADMIN_TYPES = ["SUPER", "ROOT"];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
    }

    const userType = (session.user as any).type as string;
    if (!ADMIN_TYPES.includes(userType)) {
      return NextResponse.json({ error: "Нет прав" }, { status: 403 });
    }

    const { id } = await params;
    const adminId = (session.user as any).id as string;

    let body: { action?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Некорректный формат запроса" }, { status: 400 });
    }
    if (body.action !== "pay") {
      return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { ticketId: id },
      include: { items: true, user: { select: { type: true } } },
    });
    if (!invoice) {
      return NextResponse.json({ error: "Счёт не найден" }, { status: 404 });
    }
    if (invoice.status === "PAID") {
      return NextResponse.json({ error: "Счёт уже оплачен" }, { status: 400 });
    }

    const coins = invoice.items.reduce((sum, item) => sum + item.quantity, 0);

    const updated = await prisma.$transaction(async (tx) => {
      // Атомарная защита от двойного начисления: переход разрешён только из неоплаченного состояния
      const inv = await tx.invoice.updateMany({
        where: { id: invoice.id, status: { not: "PAID" } },
        data: { status: "PAID", paidAt: new Date(), sentAt: invoice.sentAt ?? new Date() },
      });
      if (inv.count === 0) {
        throw new Error("Счёт уже оплачен");
      }

      const wallet = await tx.wallet.findUnique({ where: { userId: invoice.userId } });
      if (wallet) {
        await tx.wallet.update({
          where: { userId: invoice.userId },
          data: { balance: { increment: coins } },
        });
        await roundWalletBalance(tx, invoice.userId);
        await tx.transaction.create({
          data: {
            userId: invoice.userId,
            type: "INVOICE_PAID",
            amount: coins,
            balanceAfter: wallet.balance.plus(coins).toDecimalPlaces(2),
            description: `Пополнение по счёту ${invoice.number}`,
          },
        });
      }

      const msg = await tx.supportMessage.create({
        data: {
          ticketId: id,
          authorId: adminId,
          isStaff: true,
          message: `Счёт №${invoice.number} оплачен. Начислено ${coins} монет.`,
        },
      });
      await tx.supportTicket.update({
        where: { id },
        data: { updatedAt: new Date(), isResolved: true },
      });
      return { invoice: inv, message: msg };
    });

    // Уведомляем покупателя о начислении монет
    await notifyUser({
      userId: invoice.userId,
      type: "INVOICE",
      title: "Счёт оплачен",
      message: `Счёт №${invoice.number} оплачен. Начислено ${coins} монет.`,
      link: `${cabinetHome(invoice.user?.type)}/finances`,
    });

    return NextResponse.json({
      success: true,
      invoice: {
        id: invoice.id,
        number: invoice.number,
        status: "PAID",
        total: invoice.total,
        sentAt: invoice.sentAt ?? new Date(),
        paidAt: new Date(),
      },
      message: {
        id: updated.message.id,
        message: updated.message.message,
        isStaff: true,
        createdAt: updated.message.createdAt,
        authorName: (session.user as any).username || null,
        attachments: [],
      },
    });
  } catch (e) {
    if (e instanceof Error && e.message === "Счёт уже оплачен") {
      return NextResponse.json({ error: "Счёт уже оплачен" }, { status: 400 });
    }
    return NextResponse.json({ error: "Не удалось отметить оплату" }, { status: 500 });
  }
}
