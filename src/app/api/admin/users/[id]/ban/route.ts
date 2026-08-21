import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/types";
import { notifyUser, cabinetHome } from "@/lib/notifications";
import { sendMail, buildBanEmail } from "@/lib/mailer";
import { logAdminAction } from "@/lib/audit";

/**
 * Бан пользователя с причиной. Доступно только SUPER и ROOT.
 * Нельзя банить себя и ROOT-аккаунты.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const admin = session.user as SessionUser;
  if (!["SUPER", "ROOT"].includes(admin.type)) {
    return NextResponse.json({ error: "Нет прав" }, { status: 403 });
  }

  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "Некорректный идентификатор пользователя" }, { status: 400 });
  }

  let body: { reason?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный формат запроса" }, { status: 400 });
  }

  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  if (!reason || reason.length > 500) {
    return NextResponse.json(
      { error: "Укажите причину бана (до 500 символов)" },
      { status: 400 },
    );
  }

  if (id === admin.id) {
    return NextResponse.json({ error: "Нельзя забанить самого себя" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, type: true, username: true, email: true },
  });
  if (!target) {
    return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
  }
  if (target.type === "ROOT") {
    return NextResponse.json({ error: "Нельзя забанить root-аккаунт" }, { status: 403 });
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id },
      data: { status: "BANNED" },
    }),
    prisma.userServiceFields.upsert({
      where: { userId: id },
      update: { banReason: reason },
      create: { userId: id, banReason: reason },
    }),
    prisma.banLog.create({
      data: { userId: id, adminId: admin.id, action: "BAN", reason },
    }),
  ]);

  // Уведомляем забаненного с причиной и пишем в журнал аудита
  await notifyUser({
    userId: id,
    type: "SUPPORT",
    title: "Аккаунт заблокирован",
    message: `Ваш аккаунт заблокирован модератором. Причина: ${reason}`,
    link: cabinetHome(target.type),
  });
  // Письмо о блокировке (отключено без POSTAL_API_URL/POSTAL_API_KEY)
  await sendMail(buildBanEmail(target.email, { username: target.username, reason }));
  await logAdminAction({
    adminId: admin.id,
    adminName: admin.username,
    action: "ban",
    entityType: "user",
    entityId: id,
    payload: { username: target.username, reason },
  });

  return NextResponse.json({ success: true });
}
