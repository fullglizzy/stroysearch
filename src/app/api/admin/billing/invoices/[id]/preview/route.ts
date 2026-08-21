import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/types";
import {
  countViews,
  endOfDay,
  hiddenPeriodsByCompany,
  docTemplateLines,
  DEFAULT_BILLING_TEMPLATES,
  type BillingInvoiceTemplates,
} from "@/lib/billing";

const ADMIN_TYPES = ["SUPER", "ROOT"];

// Предпросмотр перевыставления: счётчики просмотров, интервалы скрытия и
// шаблоны строк для нового счёта за период [periodFrom исходного счёта,
// выбранная дата]. Ничего не записывает в БД — сумма пересчитывается на
// клиенте по введённым ставкам.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  if (!ADMIN_TYPES.includes((session.user as SessionUser).type as string)) {
    return NextResponse.json({ error: "Нет прав" }, { status: 403 });
  }

  const { id } = await params;

  const { searchParams } = new URL(request.url);
  const dateRaw = searchParams.get("date");
  let date: Date = new Date();
  if (dateRaw) {
    date = new Date(dateRaw);
    if (Number.isNaN(date.getTime())) {
      return NextResponse.json({ error: "Некорректная дата" }, { status: 400 });
    }
  }
  const to = endOfDay(date);
  if (to.getTime() > endOfDay(new Date()).getTime()) {
    return NextResponse.json({ error: "Нельзя выставить счёт за будущую дату" }, { status: 400 });
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    select: {
      id: true,
      kind: true,
      periodFrom: true,
      user: { select: { ownedCompany: { select: { id: true } } } },
    },
  });
  if (!invoice || invoice.kind !== "BILLING") {
    return NextResponse.json({ error: "Счёт не найден" }, { status: 404 });
  }
  const companyId = invoice.user.ownedCompany?.id ?? null;
  if (!companyId) {
    return NextResponse.json({ error: "У счёта нет компании" }, { status: 400 });
  }

  // Новый счёт покроет период с начала периода исходного счёта до даты
  const from = invoice.periodFrom;
  if (!from || from.getTime() > to.getTime()) {
    return NextResponse.json({ period: null, counts: null, hiddenIntervals: [], templates: null });
  }

  const [counts, hidden] = await Promise.all([
    countViews(companyId, from, to),
    hiddenPeriodsByCompany([companyId]),
  ]);

  const tplRows = await docTemplateLines("billing_invoice");
  const templates: BillingInvoiceTemplates = { ...DEFAULT_BILLING_TEMPLATES };
  for (const row of tplRows) {
    if (row.code === "maintenance" || row.code === "views") {
      templates[row.code] = row.description;
    }
  }

  return NextResponse.json({
    period: { from, to },
    counts,
    hiddenIntervals: hidden.get(companyId) ?? [],
    templates,
  });
}
