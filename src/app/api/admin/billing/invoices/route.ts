import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/types";
import { logAdminAction } from "@/lib/audit";
import { generateBillingInvoices, markOverdueInvoices, endOfDay } from "@/lib/billing";

const ADMIN_TYPES = ["SUPER", "ROOT"];
const PER_PAGE_OPTIONS = [25, 50, 100];

/** Экранирование символов LIKE, чтобы % и _ в поиске не работали как маски */
function escapeLike(v: string): string {
  return v.replace(/[\\%_]/g, (m) => `\\${m}`);
}

// Список счетов биллинга с фильтрами и серверной пагинацией
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  if (!ADMIN_TYPES.includes((session.user as SessionUser).type as string)) {
    return NextResponse.json({ error: "Нет прав" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "";
  const q = (searchParams.get("q") || "").trim();
  const qLower = q.toLowerCase();
  const digits = q.replace(/\D/g, "");
  const month = searchParams.get("month") || "";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const perPageRaw = parseInt(searchParams.get("perPage") || "50", 10);
  const perPage = PER_PAGE_OPTIONS.includes(perPageRaw) ? perPageRaw : 50;

  // Просрочка отмечается автоматически: счета с истёкшим сроком переходят
  // в OVERDUE сами, санкцию за неуплату администратор применяет вручную.
  await markOverdueInvoices();

  // Фильтр по месяцу даты счёта (YYYY-MM) — дата равна выбранной админом дате
  // выставления; периоды могут пересекать месяцы, поэтому фильтруем по date
  let periodFilter: Prisma.InvoiceWhereInput = {};
  if (/^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split("-").map(Number);
    const monthStart = new Date(y, m - 1, 1);
    const monthEnd = new Date(y, m, 0, 23, 59, 59, 999);
    periodFilter = { date: { gte: monthStart, lte: monthEnd } };
  }

  // Поиск: номер счёта (точный регистр или только цифры), логин владельца,
  // название компании через searchText (кириллица в нижнем регистре)
  const or: Prisma.InvoiceWhereInput[] = [];
  if (q) {
    or.push({ number: { contains: escapeLike(q) } });
    if (digits) or.push({ number: { contains: escapeLike(digits) } });
    or.push({ user: { username: { contains: escapeLike(qLower) } } });
    or.push({ user: { ownedCompany: { searchText: { contains: escapeLike(qLower) } } } });
  }

  const where: Prisma.InvoiceWhereInput = {
    kind: "BILLING",
    ...(status ? { status } : {}),
    ...periodFilter,
    ...(or.length ? { OR: or } : {}),
  };

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id: true,
        number: true,
        date: true,
        dueDate: true,
        status: true,
        subtotal: true,
        discount: true,
        total: true,
        periodFrom: true,
        periodTo: true,
        sentAt: true,
        paidAt: true,
        createdAt: true,
        user: { select: { username: true, ownedCompany: { select: { id: true, name: true } } } },
        act: { select: { id: true, number: true, date: true } },
      },
    }),
    prisma.invoice.count({ where }),
  ]);

  return NextResponse.json({
    invoices: invoices.map((i) => ({
      id: i.id,
      number: i.number,
      date: i.date,
      dueDate: i.dueDate,
      status: i.status,
      subtotal: i.subtotal.toNumber(),
      discount: i.discount.toNumber(),
      total: i.total.toNumber(),
      periodFrom: i.periodFrom,
      periodTo: i.periodTo,
      sentAt: i.sentAt,
      paidAt: i.paidAt,
      createdAt: i.createdAt,
      username: i.user.username,
      company: i.user.ownedCompany ? { id: i.user.ownedCompany.id, name: i.user.ownedCompany.name } : null,
      act: i.act ? { id: i.act.id, number: i.act.number, date: i.act.date } : null,
    })),
    total,
    page,
    perPage,
  });
}

// Формирование счетов: одна компания (companyId) или все ACTIVE (companyIds/без списка)
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

    let body: { companyId?: unknown; companyIds?: unknown; periodTo?: unknown };
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    let companyIds: string[] | undefined;
    if (typeof body.companyId === "string" && body.companyId) {
      companyIds = [body.companyId];
    } else if (Array.isArray(body.companyIds)) {
      companyIds = body.companyIds.filter((x): x is string => typeof x === "string" && !!x);
    }

    let periodTo: Date | undefined;
    if (typeof body.periodTo === "string" && body.periodTo) {
      periodTo = new Date(body.periodTo);
      if (Number.isNaN(periodTo.getTime())) {
        return NextResponse.json({ error: "Некорректная дата окончания периода" }, { status: 400 });
      }
      if (periodTo.getTime() > endOfDay(new Date()).getTime()) {
        return NextResponse.json({ error: "Нельзя выставить счёт за будущую дату" }, { status: 400 });
      }
    }

    const result = await generateBillingInvoices({ companyIds, periodTo });

    await logAdminAction({
      adminId,
      adminName: adminUsername ?? adminId,
      action: "billing",
      entityType: "invoice",
      entityId: undefined,
      payload: { companyIds: companyIds ?? null, periodTo: periodTo ?? null, created: result.created.map((c) => c.invoiceNumber), skipped: result.skipped.length },
    });

    return NextResponse.json({ success: true, ...result });
  } catch {
    return NextResponse.json({ error: "Не удалось сформировать счета" }, { status: 500 });
  }
}
