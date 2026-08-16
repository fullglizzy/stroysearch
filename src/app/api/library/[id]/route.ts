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

  const { id } = await params;
  const userId = (session.user as SessionUser).id;
  const userType = (session.user as SessionUser).type;
  const isModerator = MODERATOR_TYPES.includes(userType);

  const body = await request.json();

  const doc = await prisma.libraryDocument.findUnique({
    where: { id },
    select: { id: true, userId: true, title: true, isApproved: true },
  });
  if (!doc) return NextResponse.json({ error: "Документ не найден" }, { status: 404 });

  // Режим модератора: смена статуса публикации (+ причина при снятии)
  if (typeof body.isApproved === "boolean") {
    if (!isModerator) return NextResponse.json({ error: "Нет прав" }, { status: 403 });

    if (doc.isApproved === body.isApproved) {
      return NextResponse.json({ success: true });
    }

    const moderatorNote =
      typeof body.moderatorNote === "string" && body.moderatorNote.trim()
        ? body.moderatorNote.trim()
        : null;

    await prisma.libraryDocument.update({
      where: { id },
      data: {
        isApproved: body.isApproved,
        moderatorNote: body.isApproved ? null : moderatorNote,
      },
    });

    const owner = await prisma.user.findUnique({
      where: { id: doc.userId },
      select: { type: true },
    });
    await notifyUser({
      userId: doc.userId,
      type: "MODERATION",
      title: body.isApproved ? "Документ опубликован" : "Документ снят с публикации",
      message: body.isApproved
        ? `Документ «${doc.title}» прошёл модерацию и опубликован в библиотеке.`
        : `Документ «${doc.title}» снят с публикации модератором.${
            moderatorNote ? ` Причина: ${moderatorNote}` : ""
          }`,
      link: `${cabinetHome(owner?.type)}/library`,
    });

    return NextResponse.json({ success: true });
  }

  // Режим владельца: редактирование названия/цены/категории
  if (doc.userId !== userId) {
    return NextResponse.json({ error: "Нет прав" }, { status: 403 });
  }

  const data: {
    title?: string;
    coinPrice?: number;
    treeItemId?: string | null;
    isApproved?: boolean;
    moderatorNote?: string | null;
  } = {};

  if (typeof body.title === "string" && body.title.trim()) {
    if (body.title.trim().length > 255) {
      return NextResponse.json({ error: "Название должно быть не более 255 символов" }, { status: 400 });
    }
    data.title = body.title.trim();
  }
  if (typeof body.coinPrice === "number" && Number.isFinite(body.coinPrice)) {
    if (body.coinPrice < 0 || body.coinPrice > 100) {
      return NextResponse.json({ error: "Цена должна быть от 0 до 100 монет" }, { status: 400 });
    }
    data.coinPrice = Math.round(body.coinPrice);
  }
  if (body.treeItemId !== undefined) {
    if (body.treeItemId !== null && typeof body.treeItemId !== "string") {
      return NextResponse.json({ error: "Некорректный классификатор" }, { status: 400 });
    }
    data.treeItemId = body.treeItemId;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Нет изменений" }, { status: 400 });
  }

  // Правка опубликованного документа отправляет его на повторную модерацию
  if (doc.isApproved) {
    data.isApproved = false;
    data.moderatorNote = null;
  }

  await prisma.libraryDocument.update({ where: { id }, data });

  return NextResponse.json({ success: true, requiresModeration: doc.isApproved });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const { id } = await params;

  const doc = await prisma.libraryDocument.findUnique({
    where: { id },
    select: { userId: true, deletedAt: true },
  });
  if (!doc || doc.deletedAt) {
    return NextResponse.json({ error: "Документ не найден" }, { status: 404 });
  }

  const userId = (session.user as SessionUser).id;
  const userType = (session.user as SessionUser).type;
  if (!MODERATOR_TYPES.includes(userType) && doc.userId !== userId) {
    return NextResponse.json({ error: "Нет прав" }, { status: 403 });
  }

  await prisma.libraryDocument.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
