import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ADMIN_TYPES = ["MODERATOR", "EDITOR", "SUPER", "ROOT"];

function parseJsonArray(val: string): { url: string; name: string }[] {
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed)
      ? parsed.filter(
          (a) => a && typeof a.url === "string" && typeof a.name === "string",
        )
      : [];
  } catch {
    return [];
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
    }

    const { id } = await params;
    const userId = session.user.id;
    const userType = session.user.type;
    const isAdmin = ADMIN_TYPES.includes(userType);

    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
      include: {
        user: { select: { username: true } },
        messages: {
          include: { author: { select: { username: true } } },
          orderBy: { createdAt: "asc" },
        },
        invoice: { include: { items: true } },
      },
    });

    if (!ticket) {
      return NextResponse.json({ error: "Обращение не найдено" }, { status: 404 });
    }
    if (!isAdmin && ticket.userId !== userId) {
      return NextResponse.json({ error: "Нет доступа к обращению" }, { status: 403 });
    }

    // Отмечаем обращение прочитанным
    await prisma.supportTicket.update({
      where: { id },
      data: isAdmin
        ? { adminLastReadAt: new Date() }
        : { userLastReadAt: new Date() },
    });

    return NextResponse.json({
      ticket: {
        id: ticket.id,
        subject: ticket.subject,
        email: ticket.email,
        phone: ticket.phone,
        inn: ticket.inn,
        isResolved: ticket.isResolved,
        createdAt: ticket.createdAt,
        message: ticket.message,
        userName: ticket.user?.username || null,
      },
      invoice: ticket.invoice
        ? {
            id: ticket.invoice.id,
            number: ticket.invoice.number,
            status: ticket.invoice.status,
            total: ticket.invoice.total,
            coins: ticket.invoice.items.reduce((s, i) => s + i.quantity, 0),
            sentAt: ticket.invoice.sentAt,
            paidAt: ticket.invoice.paidAt,
          }
        : null,
      messages: ticket.messages.map((m) => ({
        id: m.id,
        message: m.message,
        isStaff: m.isStaff,
        createdAt: m.createdAt,
        authorName: m.author?.username || null,
        attachments: parseJsonArray(m.attachments),
      })),
    });
  } catch {
    return NextResponse.json({ error: "Не удалось загрузить обращение" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
    }

    const userType = session.user.type;
    if (!ADMIN_TYPES.includes(userType)) {
      return NextResponse.json({ error: "Нет прав" }, { status: 403 });
    }

    const { id } = await params;
    let body: { isResolved?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Некорректный формат запроса" }, { status: 400 });
    }
    if (typeof body.isResolved !== "boolean") {
      return NextResponse.json({ error: "isResolved обязателен" }, { status: 400 });
    }

    const ticket = await prisma.supportTicket.update({
      where: { id },
      data: { isResolved: body.isResolved },
    });

    return NextResponse.json({ success: true, isResolved: ticket.isResolved });
  } catch {
    return NextResponse.json({ error: "Не удалось обновить обращение" }, { status: 500 });
  }
}
