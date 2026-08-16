import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/types";

const EDITABLE_STATUSES = ["PENDING", "REJECTED", "APPROVED"];

/**
 * Организатор:
 * - action=cancel — отмена конференции (PENDING/APPROVED);
 * - поля конференции — редактирование с возвратом на модерацию.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const userId = (session.user as SessionUser).id;
  const { id } = await params;

  const conf = await prisma.conference.findUnique({
    where: { id },
    select: { organizerId: true, status: true },
  });
  if (!conf) return NextResponse.json({ error: "Конференция не найдена" }, { status: 404 });
  if (conf.organizerId !== userId) {
    return NextResponse.json({ error: "Действие доступно только организатору" }, { status: 403 });
  }

  const body = await request.json();

  // Отмена
  if (body.action === "cancel") {
    if (conf.status !== "PENDING" && conf.status !== "APPROVED") {
      return NextResponse.json(
        { error: "Конференцию в этом статусе нельзя отменить" },
        { status: 400 },
      );
    }
    await prisma.conference.update({
      where: { id },
      data: { status: "CANCELLED" },
    });
    return NextResponse.json({ success: true });
  }

  // Редактирование
  if (!EDITABLE_STATUSES.includes(conf.status)) {
    return NextResponse.json(
      { error: "Отменённую конференцию нельзя редактировать" },
      { status: 400 },
    );
  }

  const data: Record<string, unknown> = {};
  if (typeof body.title === "string" && body.title.trim()) {
    if (body.title.trim().length > 511) {
      return NextResponse.json({ error: "Название должно быть не более 511 символов" }, { status: 400 });
    }
    data.title = body.title.trim();
  }
  if (typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    const d = new Date(`${body.date}T00:00:00Z`);
    if (!Number.isNaN(d.getTime())) data.date = d;
  }
  if (typeof body.time === "string" && /^\d{2}:\d{2}$/.test(body.time)) {
    data.time = body.time;
  }
  if (typeof body.description === "string" && body.description.trim()) {
    if (body.description.trim().length > 2500) {
      return NextResponse.json({ error: "Описание должно быть не более 2500 символов" }, { status: 400 });
    }
    data.description = body.description.trim();
  }
  if (body.treeItemId !== undefined) {
    data.treeItemId = body.treeItemId || null;
  }
  if (typeof body.coinPrice === "number" && Number.isFinite(body.coinPrice) && body.coinPrice >= 0) {
    data.coinPrice = Math.round(body.coinPrice);
  }
  if (typeof body.isPublic === "boolean") {
    data.isPublic = body.isPublic;
  }
  if (body.connectionLink !== undefined) {
    data.connectionLink = typeof body.connectionLink === "string" && body.connectionLink.trim()
      ? body.connectionLink.trim()
      : null;
  }
  if (body.logoUrl !== undefined) {
    data.logoUrl = body.logoUrl || null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Нет изменений" }, { status: 400 });
  }

  // Любое изменение возвращает конференцию на модерацию
  data.status = "PENDING";
  data.moderatorNote = null;

  await prisma.conference.update({ where: { id }, data });

  return NextResponse.json({ success: true, requiresModeration: true });
}
