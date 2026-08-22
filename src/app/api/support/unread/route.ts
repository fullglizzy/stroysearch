import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ADMIN_TYPES = ["MODERATOR", "EDITOR", "SUPER", "ROOT"];

/**
 * Количество непрочитанных сообщений в обращениях:
 * - у пользователя — ответы поддержки после последнего прочтения;
 * - у админа — сообщения пользователей после последнего прочтения.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
    }

    const userType = session.user.type;
    const isAdmin = ADMIN_TYPES.includes(userType);
    const userId = session.user.id;

    const tickets = await prisma.supportTicket.findMany({
      where: isAdmin ? {} : { userId },
      include: {
        messages: { select: { id: true, isStaff: true, createdAt: true } },
      },
    });

    const count = tickets.reduce((acc, t) => {
      const lastRead = isAdmin ? t.adminLastReadAt : t.userLastReadAt;
      const unread = t.messages.some(
        (m) => m.isStaff !== isAdmin && (!lastRead || m.createdAt > lastRead),
      );
      return acc + (unread ? 1 : 0);
    }, 0);

    return NextResponse.json({ count });
  } catch {
    return NextResponse.json({ error: "Не удалось загрузить счётчик" }, { status: 500 });
  }
}
