import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/types";

// Жалоба на отзыв — отправляется модераторам
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const userId = (session.user as SessionUser).id;
  const { id } = await params;

  const review = await prisma.review.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!review) return NextResponse.json({ error: "Отзыв не найден" }, { status: 404 });
  if (review.status === "HIDDEN") {
    return NextResponse.json({ error: "Отзыв уже скрыт" }, { status: 400 });
  }

  let body: { reason?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный формат запроса" }, { status: 400 });
  }

  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!reason || reason.length > 500) {
    return NextResponse.json({ error: "Укажите причину (до 500 символов)" }, { status: 400 });
  }

  await prisma.reviewReport.create({
    data: { reviewId: id, userId, reason },
  });

  return NextResponse.json({ success: true });
}
