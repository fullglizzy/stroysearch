import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

const DAY_MS = 24 * 60 * 60 * 1000;

function parseDate(v: unknown): Date | null {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/**
 * Формирование счёта на выплату за активность компании за период.
 *
 * Право на выплату: компания зарегистрировалась сама (у карточки есть владелец)
 * и аккаунт владельца активен (ACTIVE). Активность — нахождение на платформе
 * (дни), добавленные товары и полученные отзывы за выбранный период.
 *
 * Период не должен пересекаться с уже выставленным (billedUntil) — защита
 * от повторного выставления. Только ROOT.
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
  const startDate = parseDate(b.startDate);
  const endDate = parseDate(b.endDate);
  if (!userId) {
    return NextResponse.json({ error: "Не указан пользователь" }, { status: 400 });
  }
  if (!startDate || !endDate) {
    return NextResponse.json({ error: "Некорректные даты периода (ожидается YYYY-MM-DD)" }, { status: 400 });
  }
  if (startDate.getTime() > endDate.getTime()) {
    return NextResponse.json({ error: "Дата начала периода позже даты окончания" }, { status: 400 });
  }

  const productPrice = typeof b.productPrice === "number" && Number.isFinite(b.productPrice) && b.productPrice >= 0
    ? Math.round(b.productPrice * 100) / 100
    : NaN;
  const reviewPrice = typeof b.reviewPrice === "number" && Number.isFinite(b.reviewPrice) && b.reviewPrice >= 0
    ? Math.round(b.reviewPrice * 100) / 100
    : NaN;
  const presencePrice = typeof b.presencePrice === "number" && Number.isFinite(b.presencePrice) && b.presencePrice >= 0
    ? Math.round(b.presencePrice * 100) / 100
    : NaN;
  if (Number.isNaN(productPrice) || Number.isNaN(reviewPrice) || Number.isNaN(presencePrice)) {
    return NextResponse.json({ error: "Некорректные ставки" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      status: true,
      createdAt: true,
      ownedCompany: { select: { id: true } },
      activityPayoutRate: { select: { billedUntil: true } },
    },
  });
  if (!user || !user.ownedCompany) {
    return NextResponse.json(
      { error: "Компания должна быть зарегистрирована на платформе (у карточки должен быть владелец)" },
      { status: 400 },
    );
  }
  if (user.status !== "ACTIVE") {
    return NextResponse.json(
      { error: "Аккаунт компании не активен — выплата за активность не положена" },
      { status: 400 },
    );
  }

  // Период не должен пересекаться с уже выставленным: начинаем со следующего дня
  const billedUntil = user.activityPayoutRate?.billedUntil ?? null;
  const effectiveStart = billedUntil
    ? new Date(Math.max(startDate.getTime(), billedUntil.getTime() + DAY_MS))
    : startDate;
  if (effectiveStart.getTime() > endDate.getTime()) {
    return NextResponse.json(
      { error: "Период уже был выставлен ранее — выберите более поздний период" },
      { status: 400 },
    );
  }

  const windowStart = effectiveStart;
  const windowEnd = new Date(endDate.getTime() + DAY_MS - 1); // конец последнего дня периода

  const companyId = user.ownedCompany.id;
  const [productCount, reviewCount] = await Promise.all([
    prisma.product.count({
      where: { companyId, createdAt: { gte: windowStart, lte: windowEnd } },
    }),
    prisma.review.count({
      where: { companyId, createdAt: { gte: windowStart, lte: windowEnd } },
    }),
  ]);

  const items: { description: string; quantity: number; unitPrice: number; total: number }[] = [];

  // Нахождение на платформе: дни считаем с момента регистрации аккаунта
  // (раньше компания не могла «находиться» на платформе)
  const presenceStart = new Date(Math.max(windowStart.getTime(), user.createdAt.getTime()));
  const presenceDays =
    presenceStart.getTime() <= endDate.getTime()
      ? Math.floor((endDate.getTime() - presenceStart.getTime()) / DAY_MS) + 1
      : 0;
  if (presenceDays > 0 && presencePrice > 0) {
    items.push({
      description: `Активность: нахождение на платформе (${presenceDays} дн. × ${presencePrice.toFixed(2)} ₽)`,
      quantity: presenceDays,
      unitPrice: presencePrice,
      total: round2(presenceDays * presencePrice),
    });
  }

  if (productCount > 0 && productPrice > 0) {
    items.push({
      description: `Активность: товары (${productCount} × ${productPrice.toFixed(2)} ₽)`,
      quantity: productCount,
      unitPrice: productPrice,
      total: round2(productCount * productPrice),
    });
  }
  if (reviewCount > 0 && reviewPrice > 0) {
    items.push({
      description: `Активность: отзывы (${reviewCount} × ${reviewPrice.toFixed(2)} ₽)`,
      quantity: reviewCount,
      unitPrice: reviewPrice,
      total: round2(reviewCount * reviewPrice),
    });
  }
  if (items.length === 0) {
    return NextResponse.json(
      { error: "Нет активности за выбранный период (или все ставки равны нулю)" },
      { status: 400 },
    );
  }

  const total = round2(items.reduce((s, i) => s + i.total, 0));

  const invoice = await prisma.$transaction(async (tx) => {
    const created = await tx.invoice.create({
      data: {
        userId,
        number: `INV-ACTIVITY-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
        date: new Date(),
        dueDate: new Date(Date.now() + 5 * DAY_MS),
        kind: "ACTIVITY",
        subtotal: total,
        limit: 0,
        total,
        items: {
          create: items.map((i) => ({
            description: i.description,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            total: i.total,
          })),
        },
      },
    });

    // Сохраняем ставки и «водяной знак» периода, чтобы не выставить его повторно
    await tx.activityPayoutRate.upsert({
      where: { userId },
      update: { productPrice, reviewPrice, presencePrice, billedUntil: endDate },
      create: { userId, productPrice, reviewPrice, presencePrice, billedUntil: endDate },
    });

    return created;
  });

  return NextResponse.json({ success: true, id: invoice.id, number: invoice.number, total });
}
