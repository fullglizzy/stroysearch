import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ADMIN_TYPES = ["MODERATOR", "EDITOR", "SUPER", "ROOT"];

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
      include: { items: true },
    });
    if (!invoice) {
      return NextResponse.json({ error: "Счёт не найден" }, { status: 404 });
    }
    if (invoice.status === "PAID") {
      return NextResponse.json({ error: "Счёт уже оплачен" }, { status: 400 });
    }

    const coins = invoice.items.reduce((sum, item) => sum + item.quantity, 0);

    const updated = await prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.update({
        where: { id: invoice.id },
        data: { status: "PAID", paidAt: new Date(), sentAt: invoice.sentAt ?? new Date() },
      });

      const wallet = await tx.wallet.findUnique({ where: { userId: invoice.userId } });
      if (wallet) {
        await tx.wallet.update({
          where: { userId: invoice.userId },
          data: { balance: { increment: coins } },
        });
        await tx.transaction.create({
          data: {
            userId: invoice.userId,
            type: "INVOICE_PAID",
            amount: coins,
            balanceAfter: wallet.balance + coins,
            description: `Пополнение по счёту ${inv.number}`,
          },
        });
      }

      const msg = await tx.supportMessage.create({
        data: {
          ticketId: id,
          authorId: adminId,
          isStaff: true,
          message: `Счёт №${inv.number} оплачен. Начислено ${coins} монет.`,
        },
      });
      await tx.supportTicket.update({
        where: { id },
        data: { updatedAt: new Date(), isResolved: true },
      });
      return { invoice: inv, message: msg };
    });

    return NextResponse.json({
      success: true,
      invoice: {
        id: updated.invoice.id,
        number: updated.invoice.number,
        status: updated.invoice.status,
        total: updated.invoice.total,
        sentAt: updated.invoice.sentAt,
        paidAt: updated.invoice.paidAt,
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
  } catch {
    return NextResponse.json({ error: "Не удалось отметить оплату" }, { status: 500 });
  }
}
