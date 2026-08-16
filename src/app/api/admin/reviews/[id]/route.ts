import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/types";
import { logAdminAction } from "@/lib/audit";

const MODERATOR_TYPES = ["MODERATOR", "EDITOR", "SUPER", "ROOT"];

// Скрытие/восстановление отзыва модератором
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  if (!MODERATOR_TYPES.includes((session.user as SessionUser).type)) {
    return NextResponse.json({ error: "Нет прав" }, { status: 403 });
  }

  const { id } = await params;
  let body: { action?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный формат запроса" }, { status: 400 });
  }

  if (body.action !== "hide" && body.action !== "restore") {
    return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
  }

  const review = await prisma.review.findUnique({ where: { id }, select: { id: true } });
  if (!review) return NextResponse.json({ error: "Отзыв не найден" }, { status: 404 });

  await prisma.review.update({
    where: { id },
    data: { status: body.action === "hide" ? "HIDDEN" : "ACTIVE" },
  });

  const admin = session.user as SessionUser;
  await logAdminAction({
    adminId: admin.id,
    adminName: admin.username,
    action: "review",
    entityType: "review",
    entityId: id,
    payload: { action: body.action },
  });

  return NextResponse.json({ success: true });
}
