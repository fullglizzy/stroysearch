import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { supportTicketSchema } from "@/lib/validators";

const ADMIN_TYPES = ["MODERATOR", "EDITOR", "SUPER", "ROOT"];

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
    }

    const userType = (session.user as any).type as string;
    const isAdmin = ADMIN_TYPES.includes(userType);
    const { searchParams } = new URL(request.url);
    const all = searchParams.get("all") === "1";

    if (all && !isAdmin) {
      return NextResponse.json({ error: "Нет прав" }, { status: 403 });
    }

    const userId = (session.user as any).id as string;
    const tickets = await prisma.supportTicket.findMany({
      where: all ? {} : { userId },
      include: {
        messages: { select: { id: true, isStaff: true, createdAt: true } },
      },
      orderBy: [{ isResolved: "asc" }, { updatedAt: "desc" }],
    });

    return NextResponse.json({
      tickets: tickets.map((t) => ({
        id: t.id,
        subject: t.subject,
        email: t.email,
        isResolved: t.isResolved,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        replyCount: t.messages.length,
        hasUnread: t.messages.some(
          (m) => m.isStaff && (!t.userLastReadAt || m.createdAt > t.userLastReadAt),
        ),
      })),
    });
  } catch {
    return NextResponse.json({ error: "Не удалось загрузить обращения" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Некорректный формат запроса" }, { status: 400 });
    }

    const parsed = supportTicketSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      );
    }

    // Гости обязаны оставить контакты для связи — без них поддержка не сможет ответить
    if (!session?.user) {
      if (!parsed.data.email) {
        return NextResponse.json({ error: "Укажите email для связи" }, { status: 400 });
      }
      if (!parsed.data.phone) {
        return NextResponse.json({ error: "Укажите телефон для связи" }, { status: 400 });
      }
    }

    // Email берём из аккаунта (если авторизован); у гостей — из формы
    const ticket = await prisma.supportTicket.create({
      data: {
        email: session?.user?.email || parsed.data.email || "",
        phone: parsed.data.phone || null,
        inn: parsed.data.inn || null,
        subject: parsed.data.subject,
        message: parsed.data.message,
        userId: session?.user ? (session.user as any).id : null,
      },
    });

    return NextResponse.json({ success: true, id: ticket.id });
  } catch {
    return NextResponse.json({ error: "Не удалось отправить обращение" }, { status: 500 });
  }
}
