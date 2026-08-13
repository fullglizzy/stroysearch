import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Публичная проверка бана: POST { username } → { banned, reason? }.
 * Используется страницей логина, чтобы показать причину блокировки.
 */
export async function POST(request: Request) {
  let body: { username?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный формат запроса" }, { status: 400 });
  }

  const username = typeof body?.username === "string" ? body.username.trim() : "";
  if (!username) {
    return NextResponse.json({ error: "username обязателен" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { username },
    select: { status: true, serviceFields: { select: { banReason: true } } },
  });

  if (!user || user.status !== "BANNED") {
    return NextResponse.json({ banned: false });
  }

  return NextResponse.json({
    banned: true,
    reason: user.serviceFields?.banReason || "Причина не указана",
  });
}
