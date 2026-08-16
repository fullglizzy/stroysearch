import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/types";
import { logAdminAction } from "@/lib/audit";

/**
 * Разбан пользователя. Доступно только SUPER и ROOT.
 */
export async function POST(
  _request: Request,
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

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!target) {
    return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id },
      data: { status: "ACTIVE" },
    }),
    prisma.userServiceFields.upsert({
      where: { userId: id },
      update: { banReason: null },
      create: { userId: id },
    }),
    prisma.banLog.create({
      data: { userId: id, adminId: admin.id, action: "UNBAN" },
    }),
  ]);

  await logAdminAction({
    adminId: admin.id,
    adminName: admin.username,
    action: "unban",
    entityType: "user",
    entityId: id,
  });

  return NextResponse.json({ success: true });
}
