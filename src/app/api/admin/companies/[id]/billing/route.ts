import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/types";
import { logAdminAction } from "@/lib/audit";
import { notifyUser } from "@/lib/notifications";
import { sendMail, buildContactsHiddenEmail } from "@/lib/mailer";
import {
  countViews,
  effectiveRates,
  buildBillingItems,
  endOfDay,
  hiddenPeriodsByCompany,
  markOverdueInvoices,
  docTemplateLines,
  DEFAULT_BILLING_TEMPLATES,
  type BillingInvoiceTemplates,
} from "@/lib/billing";

const ADMIN_TYPES = ["SUPER", "ROOT"];
const RATE_FIELDS = [
  "maintenanceFee",
  "phonePrice",
  "emailPrice",
  "websitePrice",
  "reviewsPrice",
  "ratingPrice",
  "monthlyCap",
] as const;
const STATUSES = ["INACTIVE", "ACTIVE", "HIDDEN"] as const;

// Карточка биллинга компании: тариф, владелец, невыставленный период до
// выбранной даты (query ?date=, по умолчанию — сегодня) и его предпросмотр
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

  // Просрочка отмечается автоматически — статусы счетов в попапе актуальны
  await markOverdueInvoices();

  // Дата, до которой считается сумма к оплате (невыставленный период заканчивается ей)
  const { searchParams } = new URL(request.url);
  const dateRaw = searchParams.get("date");
  let to = endOfDay(new Date());
  if (dateRaw) {
    const d = new Date(dateRaw);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: "Некорректная дата" }, { status: 400 });
    }
    to = endOfDay(d);
  }

  const [company, config, tplRows] = await Promise.all([
    prisma.company.findUnique({
      where: { id },
      select: {
        id: true,
        inn: true,
        name: true,
        kpp: true,
        legalAddress: true,
        phone: true,
        email: true,
        website: true,
        createdAt: true,
        ownerUserId: true,
        ownerUser: {
          select: {
            id: true,
            username: true,
            email: true,
            status: true,
            createdAt: true,
            serviceFields: { select: { banReason: true } },
          },
        },
        billing: true,
        metrics: true,
      },
    }),
    prisma.billingConfig.findUniqueOrThrow({ where: { id: "default" } }),
    docTemplateLines("billing_invoice"),
  ]);

  if (!company) {
    return NextResponse.json({ error: "Компания не найдена" }, { status: 404 });
  }

  const billing = company.billing;
  const rates = effectiveRates(billing, config);
  const templates: BillingInvoiceTemplates = { ...DEFAULT_BILLING_TEMPLATES };
  for (const row of tplRows) {
    if (row.code === "maintenance" || row.code === "views") {
      templates[row.code] = row.description;
    }
  }
  // Невыставленный период: всё накопленное с прошлого счёта до выбранной даты
  let period: { from: Date; to: Date } | null = null;
  if (billing) {
    const from = billing.billedThrough
      ? new Date(billing.billedThrough.getTime() + 1)
      : billing.billingStartedAt;
    if (from && from.getTime() <= to.getTime()) period = { from, to };
  }
  let preview: Awaited<ReturnType<typeof buildBillingItems>> | null = null;
  let viewsInPeriod: Record<string, number> | null = null;
  if (period) {
    const counts = await countViews(id, period.from, period.to);
    viewsInPeriod = counts;
    // Дни скрытия контактов не тарифицируются абонентской платой
    const hiddenIntervals = (await hiddenPeriodsByCompany([id])).get(id) ?? [];
    preview = buildBillingItems(rates, period.from, period.to, counts, templates, hiddenIntervals);
  }

  const ownerId = company.ownerUserId;
  const [debtAgg, invoices, acts, notes] = await Promise.all([
    ownerId
      ? prisma.invoice.aggregate({
          where: { kind: "BILLING", userId: ownerId, status: { in: ["DRAFT", "SENT", "OVERDUE"] } },
          _sum: { total: true },
        })
      : Promise.resolve(null),
    prisma.invoice.findMany({
      where: { kind: "BILLING", user: { ownedCompany: { id } } },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        number: true,
        status: true,
        total: true,
        periodFrom: true,
        periodTo: true,
        paidAt: true,
        createdAt: true,
        act: { select: { id: true, number: true } },
      },
    }),
    ownerId
      ? prisma.serviceAct.findMany({
          where: { invoice: { kind: "BILLING", userId: ownerId } },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            number: true,
            date: true,
            total: true,
            invoice: { select: { number: true } },
          },
        })
      : Promise.resolve([]),
    prisma.companyNote.findMany({
      where: { companyId: id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, text: true, createdAt: true },
    }),
  ]);

  const totalViews = company.metrics
    ? company.metrics.phoneViews + company.metrics.emailViews + company.metrics.websiteViews +
      company.metrics.reviewsViews + company.metrics.ratingViews
    : 0;

  return NextResponse.json({
    company: {
      id: company.id,
      inn: company.inn,
      name: company.name,
      kpp: company.kpp,
      legalAddress: company.legalAddress,
      phone: company.phone,
      email: company.email,
      website: company.website,
      createdAt: company.createdAt,
      owner: company.ownerUser
        ? {
            id: company.ownerUser.id,
            username: company.ownerUser.username,
            email: company.ownerUser.email,
            status: company.ownerUser.status,
            createdAt: company.ownerUser.createdAt,
            banReason: company.ownerUser.serviceFields?.banReason ?? null,
          }
        : null,
    },
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
    templates,
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
    debt: debtAgg?._sum.total?.toNumber() ?? 0,
    totalViews,
    viewsInPeriod,
    invoices: invoices.map((i) => ({
      id: i.id,
      number: i.number,
      status: i.status,
      total: i.total.toNumber(),
      periodFrom: i.periodFrom,
      periodTo: i.periodTo,
      paidAt: i.paidAt,
      createdAt: i.createdAt,
      act: i.act ? { id: i.act.id, number: i.act.number } : null,
    })),
    acts: acts.map((a) => ({
      id: a.id,
      number: a.number,
      date: a.date,
      total: a.total.toNumber(),
      invoiceNumber: a.invoice.number,
    })),
    notes: notes.map((n) => ({ id: n.id, text: n.text, createdAt: n.createdAt })),
  });
}

// Тариф и статус биллинга компании (ставки, потолок, пауза/скрытие)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    const userType = (session.user as SessionUser).type as string;
    if (!ADMIN_TYPES.includes(userType)) {
      return NextResponse.json({ error: "Нет прав" }, { status: 403 });
    }
    const adminId = (session.user as SessionUser).id as string;
    const adminUsername = (session.user as SessionUser).username as string | undefined;

    const { id } = await params;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Некорректный формат запроса" }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    for (const field of RATE_FIELDS) {
      if (field in body) {
        const value = body[field];
        if (value === null) {
          data[field] = null;
          continue;
        }
        const num = Number(value);
        if (!Number.isFinite(num) || num < 0) {
          return NextResponse.json({ error: `Некорректное значение поля ${field}` }, { status: 400 });
        }
        data[field] = Math.round(num * 100) / 100;
      }
    }

    if ("status" in body) {
      const status = body.status as string;
      if (!STATUSES.includes(status as (typeof STATUSES)[number])) {
        return NextResponse.json({ error: "Некорректный статус биллинга" }, { status: 400 });
      }
      data.status = status;
    }
    if ("hiddenReason" in body) {
      const reason = body.hiddenReason as string | null;
      data.hiddenReason = reason ? String(reason).trim().slice(0, 500) || null : null;
    }
    if ("billingStartedAt" in body) {
      const value = body.billingStartedAt as string | null;
      data.billingStartedAt = value ? new Date(value) : null;
      if (data.billingStartedAt instanceof Date && Number.isNaN((data.billingStartedAt as Date).getTime())) {
        return NextResponse.json({ error: "Некорректная дата начала биллинга" }, { status: 400 });
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Нет полей для сохранения" }, { status: 400 });
    }

    const company = await prisma.company.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        ownerUserId: true,
        ownerUser: { select: { email: true } },
      },
    });
    if (!company) {
      return NextResponse.json({ error: "Компания не найдена" }, { status: 404 });
    }

    // Активация биллинга без владельца бессмысленна
    if (data.status === "ACTIVE" && !company.ownerUserId) {
      return NextResponse.json({ error: "Нельзя активировать биллинг: у компании нет владельца" }, { status: 400 });
    }

    const before = await prisma.companyBilling.findUnique({ where: { companyId: id } });
    const billing = await prisma.companyBilling.upsert({
      where: { companyId: id },
      update: {
        ...data,
        // Старт биллинга фиксируем при первой активации
        billingStartedAt:
          before?.billingStartedAt ??
          (data.status === "ACTIVE" ? new Date() : data.billingStartedAt ?? null),
      },
      create: {
        companyId: id,
        ...data,
        billingStartedAt: data.status === "ACTIVE" ? new Date() : null,
      },
    });

    // Интервал скрытия: открываем при скрытии, закрываем при возврате —
    // дни скрытия контактов не тарифицируются абонентской платой
    if (data.status === "HIDDEN") {
      const open = await prisma.billingHiddenPeriod.findFirst({ where: { companyId: id, to: null } });
      if (!open) {
        await prisma.billingHiddenPeriod.create({ data: { companyId: id, from: new Date() } });
      }
    } else if (data.status && data.status !== "HIDDEN" && before?.status === "HIDDEN") {
      await prisma.billingHiddenPeriod.updateMany({
        where: { companyId: id, to: null },
        data: { to: new Date() },
      });
    }

    await logAdminAction({
      adminId,
      adminName: adminUsername ?? adminId,
      action: "billing",
      entityType: "company",
      entityId: id,
      payload: { company: company.name, changes: data },
    });

    if (company.ownerUserId && data.status === "HIDDEN") {
      await notifyUser({
        userId: company.ownerUserId,
        type: "INVOICE",
        title: "Контакты скрыты в базе",
        message: `Контакты компании «${company.name}» скрыты в базе поставщиков. Причина: ${(data.hiddenReason as string) || "не указана"}. Оплатите задолженность — после этого администратор вернёт контакты.`,
        link: "/company/finances",
      });
      // Дублируем письмом владельцу (отключено без POSTAL_API_URL/POSTAL_API_KEY)
      if (company.ownerUser?.email) {
        await sendMail(
          buildContactsHiddenEmail(company.ownerUser.email, {
            companyName: company.name,
            reason: (data.hiddenReason as string) || null,
          }),
        );
      }
    }

    return NextResponse.json({
      success: true,
      billing: {
        status: billing.status,
        maintenanceFee: billing.maintenanceFee?.toNumber() ?? null,
        phonePrice: billing.phonePrice?.toNumber() ?? null,
        emailPrice: billing.emailPrice?.toNumber() ?? null,
        websitePrice: billing.websitePrice?.toNumber() ?? null,
        reviewsPrice: billing.reviewsPrice?.toNumber() ?? null,
        ratingPrice: billing.ratingPrice?.toNumber() ?? null,
        monthlyCap: billing.monthlyCap?.toNumber() ?? null,
        billingStartedAt: billing.billingStartedAt,
        hiddenReason: billing.hiddenReason,
      },
    });
  } catch {
    return NextResponse.json({ error: "Не удалось сохранить тариф" }, { status: 500 });
  }
}
