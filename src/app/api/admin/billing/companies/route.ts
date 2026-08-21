import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/types";
import { logAdminAction } from "@/lib/audit";
import { markOverdueInvoices, countViews } from "@/lib/billing";

const ADMIN_TYPES = ["SUPER", "ROOT"];
const PER_PAGE_OPTIONS = [25, 50, 100];

type SqlRow = {
  id: string;
  debt: number;
  overdueCount: number;
  invoiceCount: number;
};

/** Экранирование символов LIKE, чтобы % и _ в поиске не работали как маски */
function likeParam(v: string): string {
  return v.replace(/[\\%_]/g, (m) => `\\${m}`).toLowerCase();
}

// Список компаний для вкладки «Компании»: сводка по каждой компании с долгом,
// оплатой, последним счётом и невыставленным периодом. Серверная пагинация,
// поиск и фильтры — в SQL (таблица рассчитана на тысячи компаний).
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  if (!ADMIN_TYPES.includes((session.user as SessionUser).type as string)) {
    return NextResponse.json({ error: "Нет прав" }, { status: 403 });
  }

  // Просрочка отмечается автоматически — иначе долги и «Не платит» устаревают
  await markOverdueInvoices();

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();
  const status = searchParams.get("status") || "";
  const pays = searchParams.get("pays") || ""; // "" | "pays" | "nopays"
  const hasOwner = searchParams.get("hasOwner") || ""; // "" | "yes" | "no"
  const sort = searchParams.get("sort") || "debt";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const perPageRaw = parseInt(searchParams.get("perPage") || "50", 10);
  const perPage = PER_PAGE_OPTIONS.includes(perPageRaw) ? perPageRaw : 50;

  // Агрегаты по счетам владельца: долг (неоплаченное), просрочка, всего счетов.
  // CAST AS REAL — иначе SQLite отдаёт сумму как INTEGER/BigInt и дробные суммы ломаются.
  const debtSql = `IFNULL(CAST((SELECT SUM(i.total) FROM invoices i WHERE i.kind = 'BILLING' AND i.userId = c.ownerUserId AND i.status IN ('DRAFT','SENT','OVERDUE')) AS REAL), 0)`;
  const overdueSql = `(SELECT COUNT(*) FROM invoices i WHERE i.kind = 'BILLING' AND i.userId = c.ownerUserId AND i.status = 'OVERDUE')`;
  const invoiceCountSql = `(SELECT COUNT(*) FROM invoices i WHERE i.kind = 'BILLING' AND i.userId = c.ownerUserId)`;

  const where: string[] = [];
  const params: (string | number)[] = [];
  if (q) {
    where.push(`(c.searchText LIKE ? ESCAPE '\\' OR u.username LIKE ? ESCAPE '\\' OR u.email LIKE ? ESCAPE '\\')`);
    params.push(`%${likeParam(q)}%`, `%${likeParam(q)}%`, `%${likeParam(q)}%`);
  }
  if (status) {
    where.push(`IFNULL(b.status, 'INACTIVE') = ?`);
    params.push(status);
  }
  if (pays === "pays" || pays === "nopays") {
    where.push(`c.ownerUserId IS NOT NULL AND ${invoiceCountSql} > 0`);
    if (pays === "pays") {
      where.push(`${debtSql} <= 0 AND ${overdueSql} = 0`);
    } else {
      where.push(`(${debtSql} > 0 OR ${overdueSql} > 0)`);
    }
  }
  if (hasOwner === "yes") where.push("c.ownerUserId IS NOT NULL");
  if (hasOwner === "no") where.push("c.ownerUserId IS NULL");

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const orderBySql: Record<string, string> = {
    debt: `${debtSql} DESC, c.name ASC`,
    debtAsc: `${debtSql} ASC, c.name ASC`,
    name: "c.name ASC",
    nameDesc: "c.name DESC",
    registeredAt: "c.createdAt DESC",
    registeredAtAsc: "c.createdAt ASC",
  };
  const orderSql = orderBySql[sort] ?? orderBySql.debt;

  const baseFrom = `FROM companies c
    LEFT JOIN users u ON u.id = c.ownerUserId
    LEFT JOIN company_billing b ON b.companyId = c.id`;

  const [countRows, rows] = await Promise.all([
    prisma.$queryRawUnsafe<{ n: number }[]>(
      `SELECT COUNT(*) AS n ${baseFrom} ${whereSql}`,
      ...params,
    ),
    prisma.$queryRawUnsafe<SqlRow[]>(
      `SELECT c.id, ${debtSql} AS debt, ${overdueSql} AS overdueCount, ${invoiceCountSql} AS invoiceCount
       ${baseFrom} ${whereSql}
       ORDER BY ${orderSql}
       LIMIT ? OFFSET ?`,
      ...params,
      perPage,
      (page - 1) * perPage,
    ),
  ]);

  const total = Number(countRows[0]?.n ?? 0);

  // Агрегаты из raw-запросов приходят как BigInt/Decimal — приводим к числам
  const pageRows = rows.map((r) => ({
    id: r.id,
    debt: Number(r.debt),
    overdueCount: Number(r.overdueCount),
    invoiceCount: Number(r.invoiceCount),
  }));
  const ids = pageRows.map((r) => r.id);

  // Ставки по умолчанию — для панели тарифа над таблицей (пустое поле = дефолт)
  const config = await prisma.billingConfig.findUniqueOrThrow({ where: { id: "default" } });

  const companies = await prisma.company.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      inn: true,
      name: true,
      createdAt: true,
      ownerUserId: true,
      ownerUser: { select: { id: true, username: true, email: true, status: true } },
      billing: {
        select: {
          status: true,
          hiddenReason: true,
          billingStartedAt: true,
          billedThrough: true,
          maintenanceFee: true,
          phonePrice: true,
          emailPrice: true,
          websitePrice: true,
          reviewsPrice: true,
          ratingPrice: true,
          monthlyCap: true,
        },
      },
      metrics: true,
    },
  });

  const ownerIds = companies
    .map((c) => c.ownerUserId)
    .filter((x): x is string => !!x);

  // Просмотры, которые попадут в следующий счёт: события после водяной отметки
  // (или с начала биллинга). null — биллинг не начат.
  const now = new Date();
  const pendingViewsById = new Map<string, number | null>();
  await Promise.all(
    companies.map(async (c) => {
      const b = c.billing;
      if (!b?.billingStartedAt) {
        pendingViewsById.set(c.id, null);
        return;
      }
      const from = b.billedThrough
        ? new Date(new Date(b.billedThrough).getTime() + 1)
        : new Date(b.billingStartedAt);
      if (from.getTime() > now.getTime()) {
        pendingViewsById.set(c.id, 0);
        return;
      }
      const counts = await countViews(c.id, from, now);
      pendingViewsById.set(c.id, Object.values(counts).reduce((s, n) => s + n, 0));
    }),
  );

  const [lastInvoices, noteCounts] = await Promise.all([
    ownerIds.length > 0
      ? prisma.invoice.findMany({
          where: { kind: "BILLING", userId: { in: ownerIds } },
          orderBy: { createdAt: "desc" },
          take: Math.max(50, ownerIds.length * 5),
          select: { userId: true, number: true, status: true, total: true, createdAt: true },
        })
      : Promise.resolve([]),
    prisma.companyNote.groupBy({
      by: ["companyId"],
      where: { companyId: { in: ids } },
      _count: { id: true },
    }),
  ]);

  const lastByOwner = new Map<string, { number: string; status: string; total: number; createdAt: Date }>();
  for (const i of lastInvoices) {
    if (!lastByOwner.has(i.userId)) {
      lastByOwner.set(i.userId, { number: i.number, status: i.status, total: i.total.toNumber(), createdAt: i.createdAt });
    }
  }
  const notesById = new Map(noteCounts.map((g) => [g.companyId, g._count.id]));

  const list = pageRows
    .map((r) => {
      const c = companies.find((x) => x.id === r.id);
      if (!c) return null;
      const billing = c.billing;
      const hasOwner = !!c.ownerUserId;
      const paysValue =
        !hasOwner || r.invoiceCount === 0
          ? null
          : r.debt > 0 || r.overdueCount > 0
            ? false
            : true;
      return {
        id: c.id,
        inn: c.inn,
        name: c.name,
        registeredAt: c.createdAt,
        owner: c.ownerUser
          ? { id: c.ownerUser.id, username: c.ownerUser.username, email: c.ownerUser.email, status: c.ownerUser.status }
          : null,
        billing: billing
          ? {
              status: billing.status,
              hiddenReason: billing.hiddenReason,
              billingStartedAt: billing.billingStartedAt,
              billedThrough: billing.billedThrough,
              maintenanceFee: billing.maintenanceFee?.toNumber() ?? null,
              phonePrice: billing.phonePrice?.toNumber() ?? null,
              emailPrice: billing.emailPrice?.toNumber() ?? null,
              websitePrice: billing.websitePrice?.toNumber() ?? null,
              reviewsPrice: billing.reviewsPrice?.toNumber() ?? null,
              ratingPrice: billing.ratingPrice?.toNumber() ?? null,
              monthlyCap: billing.monthlyCap?.toNumber() ?? null,
            }
          : null,
        metrics: c.metrics
          ? {
              phoneViews: c.metrics.phoneViews,
              emailViews: c.metrics.emailViews,
              websiteViews: c.metrics.websiteViews,
              reviewsViews: c.metrics.reviewsViews,
              ratingViews: c.metrics.ratingViews,
            }
          : null,
        debt: r.debt,
        pays: paysValue,
        pendingViews: pendingViewsById.get(c.id) ?? null,
        lastInvoice: c.ownerUserId ? lastByOwner.get(c.ownerUserId) ?? null : null,
        notesCount: notesById.get(c.id) ?? 0,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  // Порядок страницы сохраняем из SQL-запроса (сортировка по долгу и т.п.)
  list.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));

  return NextResponse.json({
    companies: list,
    defaults: {
      maintenanceFee: config.maintenanceFee.toNumber(),
      phoneViewPrice: config.phoneViewPrice.toNumber(),
      emailViewPrice: config.emailViewPrice.toNumber(),
      websiteViewPrice: config.websiteViewPrice.toNumber(),
      reviewsViewPrice: config.reviewsViewPrice.toNumber(),
      ratingViewPrice: config.ratingViewPrice.toNumber(),
    },
    total,
    page,
    perPage,
  });
}

// «Применить для всех»: сбрасывает индивидуальные расценки всех компаний —
// все переходят на глобальные расценки из настроек. Опционально устанавливает
// всем компаниям одинаковый потолок счёта (monthlyCap: null — без потолка).
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    if (!ADMIN_TYPES.includes((session.user as SessionUser).type as string)) {
      return NextResponse.json({ error: "Нет прав" }, { status: 403 });
    }
    const adminId = (session.user as SessionUser).id as string;
    const adminUsername = (session.user as SessionUser).username as string | undefined;

    let body: { action?: unknown; monthlyCap?: unknown };
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    if (body.action !== "resetRates") {
      return NextResponse.json({ error: "Некорректное действие" }, { status: 400 });
    }

    const data: Record<string, unknown> = {
      maintenanceFee: null,
      phonePrice: null,
      emailPrice: null,
      websitePrice: null,
      reviewsPrice: null,
      ratingPrice: null,
    };

    // Потолок: отсутствие поля — не трогаем; null — снимаем всем; число — ставим всем
    if ("monthlyCap" in body) {
      if (body.monthlyCap === null) {
        data.monthlyCap = null;
      } else {
        const v = Number(body.monthlyCap);
        if (!Number.isFinite(v) || v < 0) {
          return NextResponse.json({ error: "Некорректный потолок счёта" }, { status: 400 });
        }
        data.monthlyCap = Math.round(v * 100) / 100;
      }
    }

    const res = await prisma.companyBilling.updateMany({ data });

    await logAdminAction({
      adminId,
      adminName: adminUsername ?? adminId,
      action: "billing",
      entityType: "company",
      entityId: undefined,
      payload: { action: "resetRates", updated: res.count, monthlyCap: data.monthlyCap ?? "unchanged" },
    });

    return NextResponse.json({ success: true, updated: res.count });
  } catch {
    return NextResponse.json({ error: "Не удалось применить расценки" }, { status: 500 });
  }
}
