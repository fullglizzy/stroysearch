import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/types";
import { notifyUser, cabinetHome } from "@/lib/notifications";

const MODERATOR_TYPES = ["MODERATOR", "EDITOR", "SUPER", "ROOT"];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const userType = (session.user as SessionUser).type;
  if (!MODERATOR_TYPES.includes(userType)) {
    return NextResponse.json({ error: "Нет прав" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { status, moderatorNote } = body;

  const conf = await prisma.conference.findUnique({
    where: { id },
    select: { id: true, title: true, organizerId: true, organizer: { select: { type: true } } },
  });
  if (!conf) return NextResponse.json({ error: "Конференция не найдена" }, { status: 404 });

  await prisma.conference.update({
    where: { id },
    data: { status, moderatorNote },
  });

  const statusText: Record<string, { title: string; message: string }> = {
    APPROVED: {
      title: "Конференция одобрена",
      message: `Ваша конференция «${conf.title}» одобрена и опубликована.`,
    },
    REJECTED: {
      title: "Конференция отклонена",
      message: `Ваша конференция «${conf.title}» отклонена модератором.${
        moderatorNote ? ` Причина: ${moderatorNote}` : ""
      }`,
    },
    CANCELLED: {
      title: "Конференция отменена",
      message: `Ваша конференция «${conf.title}» отменена.`,
    },
  };

  const text = statusText[status];
  if (text) {
    await notifyUser({
      userId: conf.organizerId,
      type: "MODERATION",
      title: text.title,
      message: text.message,
      link: `${cabinetHome(conf.organizer?.type)}/conferences`,
    });
  }

  return NextResponse.json({ success: true });
}
