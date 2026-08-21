import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/types";
import {
  countViews,
  effectiveRates,
  buildBillingItems,
  nextBillingPeriod,
  endOfDay,
  docTemplateLines,
  DEFAULT_BILLING_TEMPLATES,
  type BillingInvoiceTemplates,
} from "@/lib/billing";

const ADMIN_TYPES = ["SUPER", "ROOT"];

// Предпросмотр счетов ДО их создания: для каждой ACTIVE-компании с владельцем
// считаем период, позиции (абонплата + просмотры) и итоговую сумму.
// Ничего не записывает в БД.
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
  let periodTo: Date | null = null;
  if (periodToRaw) {
    periodTo = new Date(periodToRaw);
    if (Number.isNaN(periodTo.getTime())) {
      return NextResponse.json({ error: "Некорректная дата окончания периода" }, { status: 400 });
    }
  }

  const config = await prisma.billingConfig.findUniqueOrThrow({ where: { id: "default" } });
  const tplRows = await docTemplateLines("billing_invoice");
  const templates: BillingInvoiceTemplates = { ...DEFAULT_BILLING_TEMPLATES };
  for (const row of tplRows) {
    if (row.code === "maintenance" || row.code === "views" || row.code === "cap") {
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
    capApplied: boolean;
    subtotal: number;
    hasViews: boolean;
  }[] = [];
  const skipped: { companyId: string; companyName: string; reason: string }[] = [];

  for (const b of billings) {
    let period: { from: Date; to: Date } | null = null;
    if (periodTo) {
      const from = b.billedThrough ? new Date(b.billedThrough.getTime() + 1) : b.billingStartedAt;
      if (from) period = { from, to: endOfDay(periodTo) };
    } else {
      period = nextBillingPeriod(b);
    }

    if (!period || period.from.getTime() > period.to.getTime()) {
      skipped.push({ companyId: b.companyId, companyName: b.company.name, reason: "Период уже выставлен — невыставленных дней нет" });
      continue;
    }

    // Постоплата: предпросмотр только для завершённых периодов
    if (period.to.getTime() >= Date.now()) {
      skipped.push({
        companyId: b.companyId,
        companyName: b.company.name,
        reason: "Период ещё не завершён — счёт будет доступен после окончания месяца",
      });
      continue;
    }

    const rates = effectiveRates(b, config);
    const counts = await countViews(b.companyId, period.from, period.to);
    const computation = buildBillingItems(rates, period.from, period.to, counts, templates);

    companies.push({
      companyId: b.companyId,
      companyName: b.company.name,
      owner: b.company.ownerUser?.username ?? null,
      period: { from: period.from, to: period.to },
      items: computation.items,
      viewsByMetric: counts,
      maintenanceDays: computation.maintenanceDays,
      capApplied: computation.capApplied,
      subtotal: computation.subtotal,
      hasViews: Object.values(counts).some((v) => v > 0),
    });
  }

  const total = Math.round(companies.reduce((s, c) => s + c.subtotal, 0) * 100) / 100;

  return NextResponse.json({
    periodTo: periodTo ? endOfDay(periodTo) : null,
    companies,
    skipped,
    total,
  });
}
