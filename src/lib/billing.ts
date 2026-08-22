import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notifications";
import { sendMailBatch, buildInvoiceEmail, type EmailItem } from "@/lib/mailer";

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
  monthlyCap: Prisma.Decimal | null;
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
    // Потолок: индивидуальный компании, иначе глобальный из настроек (0 = без потолка)
    monthlyCap: billing?.monthlyCap != null
      ? billing.monthlyCap.toNumber()
      : config.monthlyCap != null
        ? config.monthlyCap.toNumber()
        : 0,
    invoiceDueDays: config.invoiceDueDays,
  };
}

/** Последний момент суток — водяная отметка и граница периода включительно */
export function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
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

/**
 * Счётчики просмотров сразу для многих компаний — для массовых операций.
 * Один запрос на чанк компаний вместо по запросу на компанию: у каждой
 * компании свои границы периода (JOIN по интервалам). COUNT из raw-запроса
 * приходит как BigInt — приводим к числу.
 */
export async function countViewsBatch(
  ranges: { companyId: string; from: Date; to: Date }[],
): Promise<Map<string, Record<ViewMetric, number>>> {
  const result = new Map<string, Record<ViewMetric, number>>();
  for (const r of ranges) {
    result.set(r.companyId, { phone: 0, email: 0, website: 0, reviews: 0, rating: 0 });
  }
  // 3 параметра на компанию; чанк с запасом против лимита переменных SQLite
  const CHUNK = 200;
  for (let i = 0; i < ranges.length; i += CHUNK) {
    const chunk = ranges.slice(i, i + CHUNK);
    const values: string[] = [];
    const params: (string | Date)[] = [];
    for (const r of chunk) {
      if (values.length > 0) values.push(" UNION ALL ");
      values.push("SELECT ? AS companyId, ? AS periodFrom, ? AS periodTo");
      params.push(r.companyId, r.from, r.to);
    }
    const rows = await prisma.$queryRawUnsafe<{ companyId: string; metric: string; cnt: bigint | number }[]>(
      `SELECT e.companyId, e.metric, COUNT(*) AS cnt
       FROM company_view_events e
       JOIN (${values.join("")}) r
         ON e.companyId = r.companyId AND e.createdAt > r.periodFrom AND e.createdAt <= r.periodTo
       GROUP BY e.companyId, e.metric`,
      ...params,
    );
    for (const row of rows) {
      const c = result.get(row.companyId);
      if (c && row.metric in c) c[row.metric as ViewMetric] = Number(row.cnt);
    }
  }
  return result;
}

/** Интервалы скрытия контактов по компаниям — одним запросом */
export async function hiddenPeriodsByCompany(
  companyIds: string[],
): Promise<Map<string, { from: Date; to: Date | null }[]>> {
  const map = new Map<string, { from: Date; to: Date | null }[]>();
  if (companyIds.length === 0) return map;
  const rows = await prisma.billingHiddenPeriod.findMany({
    where: { companyId: { in: companyIds } },
    select: { companyId: true, from: true, to: true },
  });
  for (const r of rows) {
    const arr = map.get(r.companyId) ?? [];
    arr.push({ from: r.from, to: r.to });
    map.set(r.companyId, arr);
  }
  return map;
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
  /** Скидка по потолку: разница между суммой позиций и потолком счёта */
  capDiscount: number;
  viewsByMetric: Record<ViewMetric, number>;
  subtotal: number;
  /** К оплате: сумма позиций минус скидка по потолку */
  total: number;
}

// ─────────────────────────── Шаблоны строк документов ───────────────────────────

/** Тексты строк счёта за обслуживание и просмотры (редактируются в настройках) */
export interface BillingInvoiceTemplates {
  maintenance: string;
  views: string;
}

export const DEFAULT_BILLING_TEMPLATES: BillingInvoiceTemplates = {
  maintenance: "Абонентская плата за использование платформы ({period})",
  views: "Плата за просмотры контактов: {metric} ({period})",
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
 * плата за просмотры по ставкам. Потолок компании (monthlyCap) ограничивает
 * итоговую сумму счёта: излишек становится общей скидкой по счёту.
 * Дни скрытия контактов (санкция) исключаются из абонентской платы.
 * Тексты строк берутся из шаблонов (настраиваются в админке).
 */
export function buildBillingItems(
  rates: BillingRates,
  from: Date,
  to: Date,
  counts: Record<ViewMetric, number>,
  templates: BillingInvoiceTemplates = DEFAULT_BILLING_TEMPLATES,
  /** Интервалы скрытия контактов: оплачиваемое время периода минус они */
  hiddenIntervals: { from: Date; to: Date | null }[] = [],
): BillingComputation {
  const periodLabel = `${from.toLocaleDateString("ru-RU")} — ${to.toLocaleDateString("ru-RU")}`;
  const items: BillingItemInput[] = [];

  const daysInMonth = new Date(from.getFullYear(), from.getMonth() + 1, 0).getDate();
  // Оплачиваемое время = период минус дни скрытия; открытый интервал (to = null)
  // длится до конца периода
  let billableMs = to.getTime() - from.getTime();
  for (const h of hiddenIntervals) {
    const overlap = Math.min((h.to ?? to).getTime(), to.getTime()) - Math.max(h.from.getTime(), from.getTime());
    if (overlap > 0) billableMs -= overlap;
  }
  // floor + 1 — календарные дни включительно (период всегда «день начала — конец дня»);
  // 0 — весь период пришёлся на скрытие, абонплата не начисляется
  const maintenanceDays = billableMs <= 0 ? 0 : Math.max(1, Math.floor(billableMs / 86_400_000) + 1);
  const maintenanceFee = rates.maintenanceFee > 0 && maintenanceDays > 0
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

  // Просмотры всегда идут построчно по метрикам — потолок не заменяет строки
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

  const subtotal = Math.round(items.reduce((s, i) => s + i.total, 0) * 100) / 100;

  // Потолок ограничивает итоговую сумму счёта (абонплата + просмотры):
  // разница становится общей скидкой — пишется в счёте над итогом и вычитается
  const capDiscount = rates.monthlyCap > 0 && subtotal > rates.monthlyCap
    ? Math.round((subtotal - rates.monthlyCap) * 100) / 100
    : 0;
  const total = Math.round((subtotal - capDiscount) * 100) / 100;

  return { items, maintenanceDays, maintenanceFee, viewsCost, capDiscount, viewsByMetric: counts, subtotal, total };
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
 * Формирует счёт за период для компании-владельца и сдвигает
 * водяную отметку. Вызывается внутри транзакции. Счёт датируется концом
 * периода (выбранной администратором датой), срок оплаты — от неё же.
 * По умолчанию счёт создаётся сразу выставленным (SENT).
 */
export async function createBillingInvoice(
  tx: Prisma.TransactionClient,
  input: {
    companyId: string;
    userId: string;
    periodFrom: Date;
    periodTo: Date;
    config: BillingConfigRow;
    billing: BillingRow & { monthlyCap: Prisma.Decimal | null };
    /** Частичные ставки поверх тарифа компании — для перевыставления с другими расценками */
    ratesOverride?: Partial<BillingRates>;
    /** Готовые счётчики просмотров за период (чтобы не считать повторно при массовой генерации) */
    counts?: Record<ViewMetric, number>;
    /** false — создать черновик (DRAFT) вместо выставленного счёта */
    send?: boolean;
  },
) {
  const rates = { ...effectiveRates(input.billing, input.config), ...input.ratesOverride };
  const counts = input.counts ?? (await countViews(input.companyId, input.periodFrom, input.periodTo));

  // Тексты строк счёта — из шаблонов (настройки), с фолбэком на стандартные
  const tplRows = await docTemplateLines("billing_invoice");
  const templates: BillingInvoiceTemplates = { ...DEFAULT_BILLING_TEMPLATES };
  for (const row of tplRows) {
    if (row.code === "maintenance" || row.code === "views") {
      templates[row.code] = row.description;
    }
  }

  // Дни скрытия контактов не тарифицируются абонентской платой
  const hiddenIntervals = (await hiddenPeriodsByCompany([input.companyId])).get(input.companyId) ?? [];

  const computation = buildBillingItems(
    rates,
    input.periodFrom,
    input.periodTo,
    counts,
    templates,
    hiddenIntervals,
  );

  // Скидка по потолку: излишек над потолком счёта вычитается из итога
  // и пишется в счёте отдельной строкой над итогом
  const discount = computation.capDiscount;
  const total = computation.total;

  const number = await nextDocumentNumber(tx, "invoice");
  const dueDays = rates.invoiceDueDays;
  // Срок оплаты — от даты счёта, но не раньше сегодня: перевыставленный счёт
  // за прошлый период не должен сразу становиться просроченным
  const dueBase = input.periodTo.getTime() > Date.now() ? input.periodTo : new Date();

  const invoice = await tx.invoice.create({
    data: {
      userId: input.userId,
      number,
      // Счёт датируется выбранной администратором датой (концом периода)
      date: input.periodTo,
      dueDate: new Date(dueBase.getTime() + dueDays * 24 * 60 * 60 * 1000),
      // Выставленный счёт компания сразу видит в кабинете; черновик — только для особых случаев
      status: input.send === false ? "DRAFT" : "SENT",
      sentAt: input.send === false ? undefined : new Date(),
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
 * (или только для перечисленных) за невыставленный период до выбранной
 * даты (по умолчанию — до сегодня). Используется админкой: массовая
 * кнопка и индивидуальное выставление из попапа компании.
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
    include: {
      company: {
        select: { name: true, ownerUserId: true, ownerUser: { select: { email: true } } },
      },
    },
    orderBy: { companyId: "asc" },
  });

  const periodTo = endOfDay(input.periodTo ?? new Date());

  // Тексты строк счёта — из шаблонов (настройки), общие для всех компаний
  const tplRows = await docTemplateLines("billing_invoice");
  const templates: BillingInvoiceTemplates = { ...DEFAULT_BILLING_TEMPLATES };
  for (const row of tplRows) {
    if (row.code === "maintenance" || row.code === "views") {
      templates[row.code] = row.description;
    }
  }

  const created: GenerationResult["created"] = [];
  const skipped: GenerationResult["skipped"] = [];
  // Письма о выставленных счетах — отправляются пакетом после формирования
  const mails: EmailItem[] = [];

  // Сначала собираем периоды всех компаний-кандидатов
  const candidates: { b: (typeof billings)[number]; ownerId: string; from: Date }[] = [];
  for (const b of billings) {
    const ownerId = b.company.ownerUserId;
    if (!ownerId) {
      skipped.push({ companyId: b.companyId, companyName: b.company.name, reason: "Нет владельца" });
      continue;
    }
    // Период: всё, что накопилось с прошлого счёта, до выбранной даты
    const from = b.billedThrough ? new Date(b.billedThrough.getTime() + 1) : b.billingStartedAt;
    if (!from || from.getTime() > periodTo.getTime()) {
      skipped.push({ companyId: b.companyId, companyName: b.company.name, reason: "Нет периода для выставления" });
      continue;
    }
    candidates.push({ b, ownerId, from });
  }

  // Метрики и интервалы скрытия считаем пакетно — пара запросов вместо
  // по запросу на компанию (таблица рассчитана на тысячи компаний)
  const countsById = await countViewsBatch(
    candidates.map((c) => ({ companyId: c.b.companyId, from: c.from, to: periodTo })),
  );
  const hiddenById = await hiddenPeriodsByCompany(candidates.map((c) => c.b.companyId));

  for (const { b, ownerId, from } of candidates) {
    // Считаем заранее, чтобы не создавать пустые счета (счётчик и позиции передаём готовыми)
    const rates = effectiveRates(b, config);
    const counts = countsById.get(b.companyId) ?? { phone: 0, email: 0, website: 0, reviews: 0, rating: 0 };
    const computation = buildBillingItems(
      rates,
      from,
      periodTo,
      counts,
      templates,
      hiddenById.get(b.companyId) ?? [],
    );
    if (computation.subtotal <= 0) {
      skipped.push({ companyId: b.companyId, companyName: b.company.name, reason: "Нет суммы к оплате за период" });
      continue;
    }

    const invoice = await prisma.$transaction((tx) =>
      createBillingInvoice(tx, {
        companyId: b.companyId,
        userId: ownerId,
        periodFrom: from,
        periodTo,
        config,
        billing: b,
        counts,
      }),
    );

    await notifyUser({
      userId: ownerId,
      type: "INVOICE",
      title: "Выставлен счёт",
      message: `Счёт ${invoice.number} за период ${from.toLocaleDateString("ru-RU")} — ${periodTo.toLocaleDateString("ru-RU")} на сумму ${invoice.total.toNumber().toLocaleString("ru-RU")} ₽ выставлен. Срок оплаты — ${invoice.dueDate.toLocaleDateString("ru-RU")}.`,
      link: "/company/finances",
    });

    if (b.company.ownerUser?.email) {
      mails.push(
        buildInvoiceEmail(b.company.ownerUser.email, {
          companyName: b.company.name,
          number: invoice.number,
          total: invoice.total.toNumber(),
          periodLabel: `${from.toLocaleDateString("ru-RU")} — ${periodTo.toLocaleDateString("ru-RU")}`,
          dueDate: invoice.dueDate,
        }),
      );
    }

    created.push({
      companyId: b.companyId,
      companyName: b.company.name,
      invoiceNumber: invoice.number,
      total: invoice.total.toNumber(),
    });
  }

  // Письма о счетах — одним пакетом (отключено без POSTAL_API_URL/POSTAL_API_KEY)
  await sendMailBatch(mails);

  return { created, skipped };
}
