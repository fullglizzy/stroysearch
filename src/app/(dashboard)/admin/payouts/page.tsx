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

  const tab = get("tab") === "history" ? "history" : "rates";

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

  // ── Вкладка «История выплат» ──
  const hq = (get("hq") || "").trim();
  const hpage = Math.max(1, parseInt(get("hpage") || "1", 10) || 1);
  const hstatus = (INVOICE_STATUSES as readonly string[]).includes(get("hstatus") || "")
    ? get("hstatus")!
    : "";
  const hsort = get("hsort") === "asc" ? "asc" : "desc";

  const hWhere: Prisma.InvoiceWhereInput = { kind: "PAYOUT" };
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
        Индивидуальные ставки (₽ за 1 просмотр) и счета на выплату для компаний
      </p>
      <MetricsPayoutsManager
        tab={tab}
        rows={pageRows}
        total={total}
        page={page}
        totalPages={totalPages}
        initialQuery={{ q, status, sort, pending }}
        historyRows={historyRows}
        historyTotal={invoiceTotal}
        historyPage={hpage}
        historyTotalPages={historyTotalPages}
        historyQuery={{ q: hq, status: hstatus, sort: hsort }}
      />
    </div>
  );
}
