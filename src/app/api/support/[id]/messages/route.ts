import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyUser, cabinetHome } from "@/lib/notifications";
import { sendMail, buildSupportReplyEmail } from "@/lib/mailer";
import { isRecord, readString } from "@/lib/validators";

const ADMIN_TYPES = ["MODERATOR", "EDITOR", "SUPER", "ROOT"];

interface AttachmentInput {
  url: string;
  name: string;
}

function parseAttachments(raw: unknown): AttachmentInput[] | null {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw) || raw.length > 10) return null;
  const result: AttachmentInput[] = [];
  for (const item of raw) {
    if (!isRecord(item)) return null;
    const url = readString(item, "url");
    const name = readString(item, "name");
    if (!url.startsWith("/uploads/") || name.length === 0 || name.length > 255) {
      return null;
    }
    result.push({ url, name });
  }
  return result;
}

export async function POST(
  request: Request,
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

    let body: { message?: unknown; files?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Некорректный формат запроса" }, { status: 400 });
    }

    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (message.length > 5000) {
      return NextResponse.json({ error: "Сообщение должно быть не более 5000 знаков" }, { status: 400 });
    }

    const attachments = parseAttachments(body.files);
    if (attachments === null) {
      return NextResponse.json({ error: "Некорректный список файлов" }, { status: 400 });
    }
    if (!message && attachments.length === 0) {
      return NextResponse.json({ error: "Сообщение не может быть пустым" }, { status: 400 });
    }

    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
      select: { userId: true, user: { select: { type: true, email: true } } },
    });
    if (!ticket) {
      return NextResponse.json({ error: "Обращение не найдено" }, { status: 404 });
    }
    if (!isAdmin && ticket.userId !== userId) {
      return NextResponse.json({ error: "Нет доступа к обращению" }, { status: 403 });
    }

    const created = await prisma.$transaction(async (tx) => {
      const messageRow = await tx.supportMessage.create({
        data: {
          ticketId: id,
          authorId: userId,
          isStaff: isAdmin,
          message,
          attachments: JSON.stringify(attachments),
        },
      });
      // поднимаем тикет в списке
      await tx.supportTicket.update({
        where: { id },
        data: { updatedAt: new Date() },
      });
      return messageRow;
    });

    // Уведомляем автора обращения, когда отвечает поддержка
    if (isAdmin && ticket.userId) {
      await notifyUser({
        userId: ticket.userId,
        type: "SUPPORT",
        title: "Ответ поддержки",
        message: message
          ? `Служба поддержки ответила: «${message.length > 140 ? `${message.slice(0, 140)}…` : message}»`
          : "Служба поддержки отправила сообщение в ваше обращение.",
        link: `${cabinetHome(ticket.user?.type)}/support?ticket=${id}`,
      });
      // Дублируем ответ письмом (отключено без POSTAL_API_URL/POSTAL_API_KEY)
      if (ticket.user?.email) {
        await sendMail(
          buildSupportReplyEmail(ticket.user.email, {
            message: message || "Служба поддержки отправила сообщение в ваше обращение.",
            ticketId: id,
            cabinetBase: cabinetHome(ticket.user.type),
          }),
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: {
        id: created.id,
        message: created.message,
        isStaff: created.isStaff,
        createdAt: created.createdAt,
        authorName: session.user.username || null,
        attachments,
      },
    });
  } catch {
    return NextResponse.json({ error: "Не удалось отправить сообщение" }, { status: 500 });
  }
}
