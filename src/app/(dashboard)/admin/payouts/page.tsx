export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { MetricsPayoutsManager } from "@/components/forms/MetricsPayoutsManager";
import type { SessionUser } from "@/types";

const PAGE_SIZE = 20;
const USER_STATUSES = ["ACTIVE", "INACTIVE", "BANNED", "DELETED"] as const;
const INVOICE_STATUSES = ["DRAFT", "SENT", "PAID", "SKIPPED", "OVERDUE", "CANCELLED"] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

// Текущий месяц в формате YYYY-MM-DD (период активности по умолчанию)
function currentMonthPeriod() {
  const now = new Date();
  return {
    start: `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-01`,
    end: `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`,
  };
}

function parsePeriodDate(raw: string, fallback: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T00:00:00Z`) : new Date(`${fallback}T00:00:00Z`);
}

export default async function AdminPayoutsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  if ((session.user as SessionUser).type !== "ROOT") {
    redirect("/admin");
  }

  const sp = await searchParams;
  const get = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const tabRaw = get("tab");
  const tab = tabRaw === "history" ? "history" : tabRaw === "activity" ? "activity" : "rates";

  // ── Вкладка «Ставки и счета» ──
  const q = (get("q") || "").trim();
  const page = Math.max(1, parseInt(get("page") || "1", 10) || 1);
  const status = (USER_STATUSES as readonly string[]).includes(get("status") || "")
    ? get("status")!
    : "";
  const sort = get("sort") === "name" ? "name" : "created";
  const pending = get("pending") === "1";

  const where: Prisma.UserWhereInput = { type: "COMPANY" };
  if (q) {
    where.OR = [
      { username: { contains: q } },
      { email: { contains: q } },
      { profile: { nick: { contains: q } } },
      { profile: { firstName: { contains: q } } },
      { profile: { lastName: { contains: q } } },
      { ownedCompany: { name: { contains: q } } },
    ];
  }
  if (status) where.status = status;

  // Пользователей-компаний немного — выгружаем всех и считаем дельты в JS
  const users = await prisma.user.findMany({
    where,
    include: {
      profile: { select: { nick: true, firstName: true, lastName: true } },
      ownedCompany: { include: { metrics: true } },
      payoutRate: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const rows = users.map((u) => {
    const m = u.ownedCompany?.metrics;
    const r = u.payoutRate;
    const metric = (views: number, paid: number) => ({
      views,
      paid,
      delta: Math.max(0, views - paid),
    });
    return {
      userId: u.id,
      username: u.username,
      email: u.email,
      status: u.status,
      companyName: u.ownedCompany?.name ?? null,
      createdAt: u.createdAt.toISOString(),
      metrics: {
        phone: metric(m?.phoneViews ?? 0, r?.phonePaidViews ?? 0),
        email: metric(m?.emailViews ?? 0, r?.emailPaidViews ?? 0),
        website: metric(m?.websiteViews ?? 0, r?.websitePaidViews ?? 0),
        rating: metric(m?.ratingViews ?? 0, r?.ratingPaidViews ?? 0),
        reviews: metric(m?.reviewsViews ?? 0, r?.reviewsPaidViews ?? 0),
      },
      prices: {
        phonePrice: r?.phonePrice.toNumber() ?? 0,
        emailPrice: r?.emailPrice.toNumber() ?? 0,
        websitePrice: r?.websitePrice.toNumber() ?? 0,
        ratingPrice: r?.ratingPrice.toNumber() ?? 0,
        reviewsPrice: r?.reviewsPrice.toNumber() ?? 0,
      },
    };
  });

  const filtered = pending
    ? rows.filter((r) => Object.values(r.metrics).some((m) => m.delta > 0))
    : rows;
  const sorted = [...filtered].sort((a, b) =>
    sort === "name"
      ? (a.companyName || a.username).localeCompare(b.companyName || b.username, "ru")
      : b.createdAt.localeCompare(a.createdAt),
  );
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageRows = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ── Вкладка «Активность» ──
  const aq = (get("aq") || "").trim();
  const apage = Math.max(1, parseInt(get("apage") || "1", 10) || 1);
  const astatus = (USER_STATUSES as readonly string[]).includes(get("astatus") || "")
    ? get("astatus")!
    : "ACTIVE";
  const asort = get("asort") === "name" ? "name" : "created";
  const apending = get("apending") === "1";

  const monthPeriod = currentMonthPeriod();
  const astartRaw = get("astart") || monthPeriod.start;
  const aendRaw = get("aend") || monthPeriod.end;
  const astart = parsePeriodDate(astartRaw, monthPeriod.start);
  const aend = parsePeriodDate(aendRaw, monthPeriod.end);
  const aendExclusive = new Date(aend.getTime() + DAY_MS);

  // Право на выплату за активность: у карточки есть владелец (компания
  // зарегистрировалась сама) — ownedCompany is not null
  const aWhere: Prisma.UserWhereInput = { type: "COMPANY", ownedCompany: { isNot: null } };
  if (aq) {
    aWhere.OR = [
      { username: { contains: aq } },
      { email: { contains: aq } },
      { profile: { nick: { contains: aq } } },
      { profile: { firstName: { contains: aq } } },
      { profile: { lastName: { contains: aq } } },
      { ownedCompany: { name: { contains: aq } } },
    ];
  }
  if (astatus) aWhere.status = astatus;

  const aUsers = await prisma.user.findMany({
    where: aWhere,
    include: {
      ownedCompany: { select: { id: true, name: true } },
      activityPayoutRate: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const activityRows = await Promise.all(
    aUsers.map(async (u) => {
      const companyId = u.ownedCompany!.id;
      const [newProducts, newReviews] = await Promise.all([
        prisma.product.count({
          where: { companyId, createdAt: { gte: astart, lt: aendExclusive } },
        }),
        prisma.review.count({
          where: { companyId, createdAt: { gte: astart, lt: aendExclusive } },
        }),
      ]);
      // Дни нахождения на платформе в периоде — с момента регистрации аккаунта
      const presenceStart = new Date(Math.max(astart.getTime(), u.createdAt.getTime()));
      const presenceDays =
        presenceStart.getTime() < aendExclusive.getTime()
          ? Math.floor((aendExclusive.getTime() - presenceStart.getTime()) / DAY_MS)
          : 0;
      const r = u.activityPayoutRate;
      return {
        userId: u.id,
        username: u.username,
        status: u.status,
        companyName: u.ownedCompany!.name,
        newProducts,
        newReviews,
        presenceDays,
        prices: {
          productPrice: r?.productPrice.toNumber() ?? 0,
          reviewPrice: r?.reviewPrice.toNumber() ?? 0,
          presencePrice: r?.presencePrice.toNumber() ?? 0,
        },
        billedUntil: r?.billedUntil ? r.billedUntil.toISOString() : null,
      };
    }),
  );

  const aFiltered = apending
    ? activityRows.filter((r) => r.newProducts > 0 || r.newReviews > 0)
    : activityRows;
  const activitySorted =
    asort === "name"
      ? [...aFiltered].sort((a, b) =>
          (a.companyName || a.username).localeCompare(b.companyName || b.username, "ru"),
        )
      : aFiltered;
  const activityTotal = activitySorted.length;
  const activityTotalPages = Math.max(1, Math.ceil(activityTotal / PAGE_SIZE));
  const activityPageRows = activitySorted.slice((apage - 1) * PAGE_SIZE, apage * PAGE_SIZE);

  // ── Вкладка «История выплат» ──
  const hq = (get("hq") || "").trim();
  const hpage = Math.max(1, parseInt(get("hpage") || "1", 10) || 1);
  const hstatus = (INVOICE_STATUSES as readonly string[]).includes(get("hstatus") || "")
    ? get("hstatus")!
    : "";
  const hsort = get("hsort") === "asc" ? "asc" : "desc";

  const hWhere: Prisma.InvoiceWhereInput = { kind: { in: ["PAYOUT", "ACTIVITY"] } };
  if (hq) {
    hWhere.OR = [
      { number: { contains: hq } },
      { user: { username: { contains: hq } } },
      { user: { ownedCompany: { name: { contains: hq } } } },
    ];
  }
  if (hstatus) hWhere.status = hstatus;

  const [invoices, invoiceTotal] = await Promise.all([
    prisma.invoice.findMany({
      where: hWhere,
      include: {
        user: { select: { username: true, ownedCompany: { select: { name: true } } } },
      },
      orderBy: hsort === "asc" ? { date: "asc" } : { date: "desc" },
      skip: (hpage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.invoice.count({ where: hWhere }),
  ]);

  const historyRows = invoices.map((i) => ({
    id: i.id,
    number: i.number,
    kind: i.kind,
    username: i.user.username,
    companyName: i.user.ownedCompany?.name ?? null,
    date: i.date.toISOString(),
    dueDate: i.dueDate.toISOString(),
    status: i.status,
    total: i.total.toNumber(),
  }));
  const historyTotalPages = Math.max(1, Math.ceil(invoiceTotal / PAGE_SIZE));

  return (
    <div className="container-page py-8">
      <h1 className="text-3xl font-bold mb-2">Учёт метрик и выплаты</h1>
      <p className="text-muted-foreground mb-6">
        Индивидуальные ставки и счета на выплату: монетизация просмотров и активность компаний
      </p>
      <MetricsPayoutsManager
        tab={tab}
        rows={pageRows}
        total={total}
        page={page}
        totalPages={totalPages}
        initialQuery={{ q, status, sort, pending }}
        activityRows={activityPageRows}
        activityTotal={activityTotal}
        activityPage={apage}
        activityTotalPages={activityTotalPages}
        activityQuery={{ q: aq, status: astatus, sort: asort, pending: apending, start: astartRaw, end: aendRaw }}
        historyRows={historyRows}
        historyTotal={invoiceTotal}
        historyPage={hpage}
        historyTotalPages={historyTotalPages}
        historyQuery={{ q: hq, status: hstatus, sort: hsort }}
      />
    </div>
  );
}
