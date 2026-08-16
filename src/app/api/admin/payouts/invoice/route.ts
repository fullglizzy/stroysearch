import { NextResponse } from "next/server";
import crypto from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notifications";
import { logAdminAction } from "@/lib/audit";

const METRICS = [
  { price: "phonePrice", paid: "phonePaidViews", views: "phoneViews", label: "Просмотры: телефон" },
  { price: "emailPrice", paid: "emailPaidViews", views: "emailViews", label: "Просмотры: email" },
  { price: "websitePrice", paid: "websitePaidViews", views: "websiteViews", label: "Просмотры: сайт" },
  { price: "ratingPrice", paid: "ratingPaidViews", views: "ratingViews", label: "Просмотры: рейтинг" },
  { price: "reviewsPrice", paid: "reviewsPaidViews", views: "reviewsViews", label: "Просмотры: отзывы" },
] as const;

/**
 * Формирование счёта на выплату по метрикам компании пользователя.
 * В счёт попадают только «новые» просмотры (сверх уже выставленных ранее).
 * Только ROOT.
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

  const userId = (body as { userId?: unknown } | null)?.userId;
  if (typeof userId !== "string" || !userId) {
    return NextResponse.json({ error: "Не указан пользователь" }, { status: 400 });
  }

  const company = await prisma.company.findFirst({
    where: { ownerUserId: userId },
    include: { metrics: true },
  });
  if (!company) {
    return NextResponse.json({ error: "У пользователя нет компании" }, { status: 400 });
  }
  const metrics = company.metrics;
  if (!metrics) {
    return NextResponse.json({ error: "У компании нет метрик просмотров" }, { status: 400 });
  }

  const rate = await prisma.metricsPayoutRate.findUnique({ where: { userId } });

  // Позиции счёта: только метрики с новыми просмотрами и ценой больше нуля
  const items = METRICS.map((m) => {
    const views = metrics[m.views];
    const paid = rate?.[m.paid] ?? 0;
    const price = rate?.[m.price].toNumber() ?? 0;
    const delta = Math.max(0, views - paid);
    return {
      m,
      description: `${m.label} (${delta} × ${price.toFixed(2)} ₽)`,
      quantity: delta,
      unitPrice: price,
      total: Math.round(delta * price * 100) / 100,
      billed: delta > 0 && price > 0,
    };
  }).filter((i) => i.billed);

  if (items.length === 0) {
    return NextResponse.json(
      { error: "Нет новых просмотров для выставления счёта (или все цены равны 0)" },
      { status: 400 },
    );
  }

  const total = Math.round(items.reduce((s, i) => s + i.total, 0) * 100) / 100;

  const invoice = await prisma.$transaction(async (tx) => {
    const created = await tx.invoice.create({
      data: {
        userId,
        number: `INV-PAYOUT-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
        date: new Date(),
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        kind: "PAYOUT",
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

    // Поднимаем «водяные знаки» только по метрикам, вошедшим в счёт
    const paidUpdate: Record<string, number> = {};
    for (const i of items) {
      paidUpdate[i.m.paid] = metrics[i.m.views];
    }
    await tx.metricsPayoutRate.upsert({
      where: { userId },
      update: paidUpdate,
      create: { userId, ...paidUpdate },
    });

    return created;
  });

  // Уведомляем компанию о выставленном счёте
  await notifyUser({
    userId,
    type: "PAYOUT",
    title: "Выставлен счёт на выплату",
    message: `Сформирован счёт №${invoice.number} на ${total} ₽ за просмотры контактов компании.`,
    link: "/company/payouts",
  });

  const admin = session.user as { id: string; username: string };
  await logAdminAction({
    adminId: admin.id,
    adminName: admin.username,
    action: "payout",
    entityType: "invoice",
    entityId: invoice.id,
    payload: { number: invoice.number, total },
  });

  return NextResponse.json({ success: true, id: invoice.id, number: invoice.number, total });
}
