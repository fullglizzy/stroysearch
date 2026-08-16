import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/types";

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
  if (typeof body.isApproved !== "boolean") {
    return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
  }

  const doc = await prisma.libraryDocument.findUnique({ where: { id }, select: { id: true } });
  if (!doc) return NextResponse.json({ error: "Документ не найден" }, { status: 404 });

  await prisma.libraryDocument.update({
    where: { id },
    data: { isApproved: body.isApproved },
  });

  return NextResponse.json({ success: true });
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
