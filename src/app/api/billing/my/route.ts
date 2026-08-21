import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/types";
import {
  countViews,
  effectiveRates,
  buildBillingItems,
  endOfDay,
  hiddenPeriodsByCompany,
} from "@/lib/billing";

// Финансы компании: тариф, невыставленные просмотры, счета и акты — вкладка «Финансы»
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  const userId = (session.user as SessionUser).id as string;
  const userType = (session.user as SessionUser).type as string;

  const company = await prisma.company.findFirst({
    where: { ownerUserId: userId },
    select: {
      id: true,
      inn: true,
      name: true,
      billing: true,
      metrics: true,
    },
  });

  if (!company) {
    if (userType === "COMPANY") {
      return NextResponse.json({ error: "Компания не найдена" }, { status: 404 });
    }
    // Обычный участник: только его счета (за монеты)
    const invoices = await prisma.invoice.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        number: true,
        kind: true,
        date: true,
        dueDate: true,
        status: true,
        total: true,
        createdAt: true,
      },
    });
    return NextResponse.json({
      company: null,
      billing: null,
      period: null,
      preview: null,
      invoices: invoices.map((i) => ({
        id: i.id,
        number: i.number,
        kind: i.kind,
        date: i.date,
        dueDate: i.dueDate,
        status: i.status,
        total: i.total.toNumber(),
        createdAt: i.createdAt,
      })),
      acts: [],
      metrics: null,
    });
  }

  const config = await prisma.billingConfig.findUniqueOrThrow({ where: { id: "default" } });
  const billing = company.billing;
  const rates = effectiveRates(billing, config);
  // Предпросмотр предстоящего счёта: всё, что войдёт в него с прошлого
  // счёта до сегодня (дату выставления выбирает администратор)
  let period: { from: Date; to: Date } | null = null;
  if (billing) {
    const from = billing.billedThrough
      ? new Date(billing.billedThrough.getTime() + 1)
      : billing.billingStartedAt;
    const to = endOfDay(new Date());
    if (from && from.getTime() <= to.getTime()) period = { from, to };
  }

  let preview: Awaited<ReturnType<typeof buildBillingItems>> | null = null;
  if (period) {
    const counts = await countViews(company.id, period.from, period.to);
    // Дни скрытия контактов не тарифицируются абонентской платой
    const hiddenIntervals = (await hiddenPeriodsByCompany([company.id])).get(company.id) ?? [];
    preview = buildBillingItems(rates, period.from, period.to, counts, undefined, hiddenIntervals);
  }

  const [invoices, acts] = await Promise.all([
    prisma.invoice.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        number: true,
        kind: true,
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
        act: { select: { number: true, date: true } },
      },
    }),
    prisma.serviceAct.findMany({
      where: { invoice: { userId } },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        number: true,
        date: true,
        total: true,
        invoice: { select: { number: true, periodFrom: true, periodTo: true } },
      },
    }),
  ]);

  return NextResponse.json({
    company: { id: company.id, inn: company.inn, name: company.name },
    billing: billing
      ? {
          status: billing.status,
          maintenanceFee: billing.maintenanceFee?.toNumber() ?? null,
          phonePrice: billing.phonePrice?.toNumber() ?? null,
          emailPrice: billing.emailPrice?.toNumber() ?? null,
          websitePrice: billing.websitePrice?.toNumber() ?? null,
          reviewsPrice: billing.reviewsPrice?.toNumber() ?? null,
          ratingPrice: billing.ratingPrice?.toNumber() ?? null,
          monthlyCap: billing.monthlyCap?.toNumber() ?? null,
          billingStartedAt: billing.billingStartedAt,
          billedThrough: billing.billedThrough,
          hiddenReason: billing.hiddenReason,
        }
      : null,
    defaults: {
      maintenanceFee: config.maintenanceFee.toNumber(),
      phoneViewPrice: config.phoneViewPrice.toNumber(),
      emailViewPrice: config.emailViewPrice.toNumber(),
      websiteViewPrice: config.websiteViewPrice.toNumber(),
      reviewsViewPrice: config.reviewsViewPrice.toNumber(),
      ratingViewPrice: config.ratingViewPrice.toNumber(),
    },
    period: period ? { from: period.from, to: period.to } : null,
    preview: preview
      ? {
          items: preview.items,
          maintenanceDays: preview.maintenanceDays,
          viewsCost: preview.viewsCost,
          capDiscount: preview.capDiscount,
          subtotal: preview.subtotal,
          total: preview.total,
        }
      : null,
    invoices: invoices.map((i) => ({
      id: i.id,
      number: i.number,
      kind: i.kind,
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
      act: i.act ? { number: i.act.number, date: i.act.date } : null,
    })),
    acts: acts.map((a) => ({
      id: a.id,
      number: a.number,
      date: a.date,
      total: a.total.toNumber(),
      invoiceNumber: a.invoice.number,
      periodFrom: a.invoice.periodFrom,
      periodTo: a.invoice.periodTo,
    })),
    metrics: company.metrics
      ? {
          phoneViews: company.metrics.phoneViews,
          emailViews: company.metrics.emailViews,
          websiteViews: company.metrics.websiteViews,
          reviewsViews: company.metrics.reviewsViews,
          ratingViews: company.metrics.ratingViews,
        }
      : null,
  });
}
