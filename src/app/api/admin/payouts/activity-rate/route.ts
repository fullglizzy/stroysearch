import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const PRICE_FIELDS = ["productPrice", "reviewPrice", "presencePrice"] as const;

/**
 * Сохранение ставок за активность (₽ за товар, ₽ за отзыв, ₽ за день
 * нахождения на платформе) для пользователя. Только ROOT.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }
  if ((session.user as { type?: string }).type !== "ROOT") {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный формат запроса" }, { status: 400 });
  }

  const b = (body ?? {}) as Record<string, unknown>;
  const userId = typeof b.userId === "string" ? b.userId : "";
  if (!userId) {
    return NextResponse.json({ error: "Не указан пользователь" }, { status: 400 });
  }

  const data: Record<string, number> = {};
  for (const field of PRICE_FIELDS) {
    const value = b[field];
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      return NextResponse.json({ error: `Некорректное значение поля ${field}` }, { status: 400 });
    }
    data[field] = Math.round(value * 100) / 100;
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) {
    return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
  }

  await prisma.activityPayoutRate.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data },
  });

  return NextResponse.json({ success: true });
}
