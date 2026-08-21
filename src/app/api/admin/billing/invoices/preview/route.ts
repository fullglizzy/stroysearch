import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/types";
import {
  countViewsBatch,
  effectiveRates,
  buildBillingItems,
  endOfDay,
  hiddenPeriodsByCompany,
  docTemplateLines,
  DEFAULT_BILLING_TEMPLATES,
  type BillingInvoiceTemplates,
} from "@/lib/billing";

const ADMIN_TYPES = ["SUPER", "ROOT"];

// Предпросмотр счетов ДО их создания: для каждой ACTIVE-компании с владельцем
// считаем невыставленный период до выбранной даты (по умолчанию — сегодня),
// позиции (абонплата + просмотры) и итоговую сумму. Ничего не записывает в БД.
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  if (!ADMIN_TYPES.includes((session.user as SessionUser).type)) {
    return NextResponse.json({ error: "Нет прав" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const periodToRaw = searchParams.get("periodTo");
  let periodTo: Date = new Date();
  if (periodToRaw) {
    periodTo = new Date(periodToRaw);
    if (Number.isNaN(periodTo.getTime())) {
      return NextResponse.json({ error: "Некорректная дата окончания периода" }, { status: 400 });
    }
  }
  const to = endOfDay(periodTo);

  const config = await prisma.billingConfig.findUniqueOrThrow({ where: { id: "default" } });
  const tplRows = await docTemplateLines("billing_invoice");
  const templates: BillingInvoiceTemplates = { ...DEFAULT_BILLING_TEMPLATES };
  for (const row of tplRows) {
    if (row.code === "maintenance" || row.code === "views") {
      templates[row.code] = row.description;
    }
  }
  const billings = await prisma.companyBilling.findMany({
    where: { status: "ACTIVE", company: { ownerUserId: { not: null } } },
    include: { company: { select: { name: true, ownerUser: { select: { username: true } } } } },
    orderBy: { companyId: "asc" },
  });

  const companies: {
    companyId: string;
    companyName: string;
    owner: string | null;
    period: { from: Date; to: Date };
    items: { description: string; quantity: number; unitPrice: number; total: number }[];
    viewsByMetric: Record<string, number>;
    maintenanceDays: number;
    capDiscount: number;
    subtotal: number;
    total: number;
    hasViews: boolean;
  }[] = [];
  const skipped: { companyId: string; companyName: string; reason: string }[] = [];

  // Сначала собираем невыставленные периоды всех компаний
  const candidates: { b: (typeof billings)[number]; from: Date }[] = [];
  for (const b of billings) {
    const from = b.billedThrough ? new Date(b.billedThrough.getTime() + 1) : b.billingStartedAt;
    if (!from || from.getTime() > to.getTime()) {
      skipped.push({ companyId: b.companyId, companyName: b.company.name, reason: "Нет периода для выставления" });
      continue;
    }
    candidates.push({ b, from });
  }

  // Метрики и интервалы скрытия считаем пакетно — пара запросов вместо
  // по запросу на компанию (таблица рассчитана на тысячи компаний)
  const countsById = await countViewsBatch(
    candidates.map((c) => ({ companyId: c.b.companyId, from: c.from, to })),
  );
  const hiddenById = await hiddenPeriodsByCompany(candidates.map((c) => c.b.companyId));

  for (const { b, from } of candidates) {
    const period = { from, to };
    const rates = effectiveRates(b, config);
    const counts = countsById.get(b.companyId) ?? { phone: 0, email: 0, website: 0, reviews: 0, rating: 0 };
    const computation = buildBillingItems(rates, period.from, period.to, counts, templates, hiddenById.get(b.companyId) ?? []);

    if (computation.subtotal <= 0) {
      skipped.push({ companyId: b.companyId, companyName: b.company.name, reason: "Нет суммы к оплате за период" });
      continue;
    }

    companies.push({
      companyId: b.companyId,
      companyName: b.company.name,
      owner: b.company.ownerUser?.username ?? null,
      period: { from: period.from, to: period.to },
      items: computation.items,
      viewsByMetric: counts,
      maintenanceDays: computation.maintenanceDays,
      capDiscount: computation.capDiscount,
      subtotal: computation.subtotal,
      total: computation.total,
      hasViews: Object.values(counts).some((v) => v > 0),
    });
  }

  const total = Math.round(companies.reduce((s, c) => s + c.total, 0) * 100) / 100;

  return NextResponse.json({
    periodTo: to,
    companies,
    skipped,
    total,
  });
}
