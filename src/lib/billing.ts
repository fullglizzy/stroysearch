import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notifications";

export const VIEW_METRICS = ["phone", "email", "website", "reviews", "rating"] as const;
export type ViewMetric = (typeof VIEW_METRICS)[number];

export const METRIC_LABELS: Record<ViewMetric, string> = {
  phone: "телефон",
  email: "эл.почта",
  website: "сайт",
  reviews: "отзывы",
  rating: "рейтинг",
};

export type BillingRow = {
  maintenanceFee: Prisma.Decimal | null;
  phonePrice: Prisma.Decimal | null;
  emailPrice: Prisma.Decimal | null;
  websitePrice: Prisma.Decimal | null;
  reviewsPrice: Prisma.Decimal | null;
  ratingPrice: Prisma.Decimal | null;
  monthlyCap: Prisma.Decimal | null;
};

export type BillingConfigRow = {
  maintenanceFee: Prisma.Decimal;
  phoneViewPrice: Prisma.Decimal;
  emailViewPrice: Prisma.Decimal;
  websiteViewPrice: Prisma.Decimal;
  reviewsViewPrice: Prisma.Decimal;
  ratingViewPrice: Prisma.Decimal;
  invoiceDueDays: number;
};

export interface BillingRates {
  maintenanceFee: number;
  phonePrice: number;
  emailPrice: number;
  websitePrice: number;
  reviewsPrice: number;
  ratingPrice: number;
  monthlyCap: number;
  invoiceDueDays: number;
}

/** Индивидуальные ставки компании с фолбэком на значения по умолчанию из конфига */
export function effectiveRates(billing: BillingRow | null, config: BillingConfigRow): BillingRates {
  const pick = (v: Prisma.Decimal | null | undefined, fallback: Prisma.Decimal) =>
    v !== null && v !== undefined ? v.toNumber() : fallback.toNumber();
  return {
    maintenanceFee: pick(billing?.maintenanceFee, config.maintenanceFee),
    phonePrice: pick(billing?.phonePrice, config.phoneViewPrice),
    emailPrice: pick(billing?.emailPrice, config.emailViewPrice),
    websitePrice: pick(billing?.websitePrice, config.websiteViewPrice),
    reviewsPrice: pick(billing?.reviewsPrice, config.reviewsViewPrice),
    ratingPrice: pick(billing?.ratingPrice, config.ratingViewPrice),
    // Потолок — только индивидуальный для компании; общего лимита в настройках нет
    monthlyCap: billing?.monthlyCap != null ? billing.monthlyCap.toNumber() : 0,
    invoiceDueDays: config.invoiceDueDays,
  };
}

/** Последний момент суток — водяная отметка и граница периода включительно */
export function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

/** Границы календарного месяца, содержащего дату */
export function monthBounds(d: Date): { start: Date; end: Date } {
  return {
    start: new Date(d.getFullYear(), d.getMonth(), 1),
    end: endOfDay(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
  };
}

export interface BillingPeriod {
  from: Date;
  to: Date;
}

/**
 * Следующий невыставленный период: от водяной отметки (или старта биллинга)
 * до конца календарного месяца этой отметки. Период всегда цельный
 * (календарный месяц или его хвост при старте) и выставляется ПОСЛЕ
 * завершения — постоплата: ничего «вперёд» не продаётся.
 */
export function nextBillingPeriod(billing: {
  billingStartedAt: Date | null;
  billedThrough: Date | null;
}): BillingPeriod | null {
  if (!billing.billingStartedAt) return null;
  const from = billing.billedThrough
    ? new Date(billing.billedThrough.getTime() + 1)
    : billing.billingStartedAt;
  const to = endOfDay(new Date(from.getFullYear(), from.getMonth() + 1, 0));
  if (from.getTime() > to.getTime()) return null;
  return { from, to };
}

/** Период завершён — по нему можно выставлять счёт (постоплата) */
export function isPeriodCompleted(period: BillingPeriod, now: Date = new Date()): boolean {
  return period.to.getTime() < now.getTime();
}

/** Количество просмотров по каждой метрике за период (по журналу событий) */
export async function countViews(
  companyId: string,
  from: Date,
  to: Date,
): Promise<Record<ViewMetric, number>> {
  const counts: Record<ViewMetric, number> = { phone: 0, email: 0, website: 0, reviews: 0, rating: 0 };
  const groups = await prisma.companyViewEvent.groupBy({
    by: ["metric"],
    where: { companyId, createdAt: { gt: from, lte: to } },
    _count: { metric: true },
  });
  for (const g of groups) {
    if (g.metric in counts) counts[g.metric as ViewMetric] = g._count.metric;
  }
  return counts;
}

export interface BillingItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface BillingComputation {
  items: BillingItemInput[];
  maintenanceDays: number;
  maintenanceFee: number;
  viewsCost: number;
  capApplied: boolean;
  viewsByMetric: Record<ViewMetric, number>;
  subtotal: number;
}

// ─────────────────────────── Шаблоны строк документов ───────────────────────────

/** Тексты строк счёта за обслуживание и просмотры (редактируются в настройках) */
export interface BillingInvoiceTemplates {
  maintenance: string;
  views: string;
  cap: string;
}

export const DEFAULT_BILLING_TEMPLATES: BillingInvoiceTemplates = {
  maintenance: "Абонентская плата за использование платформы ({period})",
  views: "Плата за просмотры контактов: {metric} ({period})",
  cap: "Плата за просмотры контактов ({period}; {breakdown}; применён лимит счёта)",
};

/** Тексты строк акта об оказанных услугах */
export const DEFAULT_ACT_LINES = ["Услуги платформы за период {period} по счёту {invoice}"];

/** Тексты строк счёта на покупку монет */
export const DEFAULT_COIN_LINES = [
  "Предоставление права использования функционала платформы ЕНЦПР (Лицензионное вознаграждение)",
  "Объем прав: {count} {units} ({coins})",
];

/** Подстановка плейсхолдеров {ключ} в текст строки документа */
export function renderDocTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? vars[key] : match));
}

/** Строки шаблона документа из БД (enabled, по порядку), с фолбэком на значения по умолчанию */
export async function docTemplateLines(
  docKind: "billing_invoice" | "service_act" | "coin_invoice",
): Promise<{ code: string; description: string }[]> {
  const rows = await prisma.docTemplateLine.findMany({
    where: { docKind, enabled: true },
    orderBy: { sortOrder: "asc" },
    select: { code: true, description: true },
  });
  return rows;
}

/**
 * Позиции счёта за период: абонентская плата (пропорционально дням) +
 * плата за просмотры по ставкам. Сумма просмотров ограничивается
 * индивидуальным потолком компании (monthlyCap) — защита от накрутки.
 * Тексты строк берутся из шаблонов (настраиваются в админке).
 */
export function buildBillingItems(
  rates: BillingRates,
  from: Date,
  to: Date,
  counts: Record<ViewMetric, number>,
  templates: BillingInvoiceTemplates = DEFAULT_BILLING_TEMPLATES,
): BillingComputation {
  const periodLabel = `${from.toLocaleDateString("ru-RU")} — ${to.toLocaleDateString("ru-RU")}`;
  const items: BillingItemInput[] = [];

  const daysInMonth = new Date(from.getFullYear(), from.getMonth() + 1, 0).getDate();
  const maintenanceDays = Math.min(
    Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1),
    daysInMonth,
  );
  const maintenanceFee = rates.maintenanceFee > 0
    ? Math.round((rates.maintenanceFee * (maintenanceDays / daysInMonth)) * 100) / 100
    : 0;
  if (maintenanceFee > 0) {
    items.push({
      description: renderDocTemplate(templates.maintenance, {
        period: periodLabel,
        days: String(maintenanceDays),
        fee: maintenanceFee.toLocaleString("ru-RU", { maximumFractionDigits: 2 }),
      }),
      quantity: 1,
      unitPrice: maintenanceFee,
      total: maintenanceFee,
    });
  }

  const priceByMetric: Record<ViewMetric, number> = {
    phone: rates.phonePrice,
    email: rates.emailPrice,
    website: rates.websitePrice,
    reviews: rates.reviewsPrice,
    rating: rates.ratingPrice,
  };

  let viewsCost = 0;
  const perMetric: { metric: ViewMetric; count: number; unitPrice: number }[] = [];
  for (const metric of VIEW_METRICS) {
    const count = counts[metric] || 0;
    const unitPrice = priceByMetric[metric];
    if (count > 0 && unitPrice > 0) {
      perMetric.push({ metric, count, unitPrice });
      viewsCost += count * unitPrice;
    }
  }

  const capApplied = rates.monthlyCap > 0 && viewsCost > rates.monthlyCap;
  if (viewsCost > 0) {
    if (capApplied) {
      const breakdown = perMetric
        .map((m) => `${METRIC_LABELS[m.metric]}: ${m.count}`)
        .join(", ");
      items.push({
        description: renderDocTemplate(templates.cap, {
          period: periodLabel,
          breakdown,
          cap: String(rates.monthlyCap),
        }),
        quantity: 1,
        unitPrice: rates.monthlyCap,
        total: rates.monthlyCap,
      });
      viewsCost = rates.monthlyCap;
    } else {
      for (const m of perMetric) {
        const total = Math.round(m.count * m.unitPrice * 100) / 100;
        items.push({
          description: renderDocTemplate(templates.views, {
            metric: METRIC_LABELS[m.metric],
            count: String(m.count),
            price: String(m.unitPrice),
            period: periodLabel,
          }),
          quantity: m.count,
          unitPrice: m.unitPrice,
          total,
        });
      }
    }
  }

  const subtotal = Math.round(items.reduce((s, i) => s + i.total, 0) * 100) / 100;
  return { items, maintenanceDays, maintenanceFee, viewsCost, capApplied, viewsByMetric: counts, subtotal };
}

/** Сквозная нумерация документов: СЧ-2026-001, АКТ-2026-001 */
export async function nextDocumentNumber(
  tx: Prisma.TransactionClient,
  prefix: "invoice" | "act",
): Promise<string> {
  const year = new Date().getFullYear();
  const key = `${prefix}-${year}`;
  const seq = await tx.numberSequence.upsert({
    where: { key },
    update: { value: { increment: 1 } },
    create: { key, value: 1 },
  });
  return `${prefix === "invoice" ? "СЧ" : "АКТ"}-${year}-${String(seq.value).padStart(3, "0")}`;
}

/**
 * Формирует черновой счёт за период для компании-владельца и сдвигает
 * водяную отметку. Вызывается внутри транзакции.
 */
export async function createBillingInvoice(
  tx: Prisma.TransactionClient,
  input: {
    companyId: string;
    userId: string;
    periodFrom: Date;
    periodTo: Date;
    discount?: number;
    config: BillingConfigRow;
    billing: BillingRow & { monthlyCap: Prisma.Decimal | null };
  },
) {
  const rates = effectiveRates(input.billing, input.config);
  const counts = await countViews(input.companyId, input.periodFrom, input.periodTo);

  // Тексты строк счёта — из шаблонов (настройки), с фолбэком на стандартные
  const tplRows = await docTemplateLines("billing_invoice");
  const templates: BillingInvoiceTemplates = { ...DEFAULT_BILLING_TEMPLATES };
  for (const row of tplRows) {
    if (row.code === "maintenance" || row.code === "views" || row.code === "cap") {
      templates[row.code] = row.description;
    }
  }

  const computation = buildBillingItems(rates, input.periodFrom, input.periodTo, counts, templates);

  const discount = Math.min(
    computation.subtotal,
    Math.max(0, Math.round((input.discount ?? 0) * 100) / 100),
  );
  const total = Math.round((computation.subtotal - discount) * 100) / 100;

  const number = await nextDocumentNumber(tx, "invoice");
  const dueDays = rates.invoiceDueDays;

  const invoice = await tx.invoice.create({
    data: {
      userId: input.userId,
      number,
      date: new Date(),
      dueDate: new Date(Date.now() + dueDays * 24 * 60 * 60 * 1000),
      status: "DRAFT",
      kind: "BILLING",
      subtotal: computation.subtotal,
      limit: rates.monthlyCap,
      discount,
      total,
      periodFrom: input.periodFrom,
      periodTo: endOfDay(input.periodTo),
      billedThrough: endOfDay(input.periodTo),
      items: {
        create: computation.items.map((i) => ({
          description: i.description,
          quantity: i.quantity,
          unitPrice: new Prisma.Decimal(i.unitPrice),
          total: new Prisma.Decimal(i.total),
        })),
      },
    },
  });

  await tx.companyBilling.update({
    where: { companyId: input.companyId },
    data: { billedThrough: endOfDay(input.periodTo) },
  });

  return invoice;
}

/** Просрочка: все нефинальные счета с истёкшим сроком оплаты */
export async function markOverdueInvoices(): Promise<number> {
  const res = await prisma.invoice.updateMany({
    where: {
      status: { in: ["DRAFT", "SENT"] },
      dueDate: { lt: new Date() },
    },
    data: { status: "OVERDUE" },
  });
  return res.count;
}

/**
 * Просрочка с уведомлениями: счета DRAFT/SENT с истёкшим сроком переводятся
 * в OVERDUE, владельцы получают уведомление. Используется кнопкой
 * «Пометить просроченными» в админке и ежемесячным кроном.
 */
export async function markOverdueWithNotifications(): Promise<number> {
  const candidates = await prisma.invoice.findMany({
    where: { status: { in: ["DRAFT", "SENT"] }, dueDate: { lt: new Date() } },
    select: { id: true, number: true, userId: true, total: true, kind: true },
  });
  if (candidates.length === 0) return 0;

  await prisma.invoice.updateMany({
    where: { id: { in: candidates.map((i) => i.id) } },
    data: { status: "OVERDUE" },
  });

  for (const inv of candidates) {
    await notifyUser({
      userId: inv.userId,
      type: "INVOICE",
      title: "Счёт просрочен",
      message: `Счёт ${inv.number} на сумму ${inv.total.toNumber().toLocaleString("ru-RU")} ₽ просрочен. Оплатите его, чтобы избежать ограничений.`,
      link: inv.kind === "BILLING" ? "/company/finances" : "/account/finances",
    });
  }

  return candidates.length;
}

export interface GenerationResult {
  created: { companyId: string; companyName: string; invoiceNumber: string; total: number }[];
  skipped: { companyId: string; companyName: string; reason: string }[];
}

/**
 * Пакетное формирование счетов: для всех ACTIVE-компаний с владельцем
 * (или только для перечисленных) за невыставленный период.
 * Используется админкой (кнопка «Сформировать») и ежемесячным кроном.
 */
export async function generateBillingInvoices(input: {
  companyIds?: string[];
  periodTo?: Date;
}): Promise<GenerationResult> {
  const config = await prisma.billingConfig.findUniqueOrThrow({ where: { id: "default" } });
  const where: Prisma.CompanyBillingWhereInput = {
    status: "ACTIVE",
    company: { ownerUserId: { not: null } },
  };
  if (input.companyIds) where.companyId = { in: input.companyIds };

  const billings = await prisma.companyBilling.findMany({
    where,
    include: { company: { select: { name: true, ownerUserId: true } } },
    orderBy: { companyId: "asc" },
  });

  const created: GenerationResult["created"] = [];
  const skipped: GenerationResult["skipped"] = [];

  for (const b of billings) {
    const ownerId = b.company.ownerUserId;
    if (!ownerId) {
      skipped.push({ companyId: b.companyId, companyName: b.company.name, reason: "Нет владельца" });
      continue;
    }

    let period: BillingPeriod | null;
    if (input.periodTo) {
      const from = b.billedThrough ? new Date(b.billedThrough.getTime() + 1) : b.billingStartedAt;
      period = from ? { from, to: endOfDay(input.periodTo) } : null;
    } else {
      period = nextBillingPeriod(b);
    }
    if (!period || period.from.getTime() > period.to.getTime()) {
      skipped.push({ companyId: b.companyId, companyName: b.company.name, reason: "Нет периода для выставления" });
      continue;
    }

    // Постоплата: счёт формируется только за завершённый период
    if (!isPeriodCompleted(period)) {
      skipped.push({
        companyId: b.companyId,
        companyName: b.company.name,
        reason: "Период ещё не завершён — счёт будет доступен после окончания месяца",
      });
      continue;
    }

    const invoice = await prisma.$transaction((tx) =>
      createBillingInvoice(tx, {
        companyId: b.companyId,
        userId: ownerId,
        periodFrom: period.from,
        periodTo: period.to,
        config,
        billing: b,
      }),
    );

    await notifyUser({
      userId: ownerId,
      type: "INVOICE",
      title: "Сформирован счёт",
      message: `Сформирован счёт ${invoice.number} за период ${period.from.toLocaleDateString("ru-RU")} — ${period.to.toLocaleDateString("ru-RU")} на сумму ${invoice.total.toNumber().toLocaleString("ru-RU")} ₽.`,
      link: "/company/finances",
    });

    created.push({
      companyId: b.companyId,
      companyName: b.company.name,
      invoiceNumber: invoice.number,
      total: invoice.total.toNumber(),
    });
  }

  return { created, skipped };
}
