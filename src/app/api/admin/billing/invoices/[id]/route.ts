import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/types";
import { logAdminAction } from "@/lib/audit";
import { notifyUser } from "@/lib/notifications";
import { sendMail, buildInvoiceEmail } from "@/lib/mailer";
import {
  nextDocumentNumber,
  docTemplateLines,
  DEFAULT_ACT_LINES,
  renderDocTemplate,
  createBillingInvoice,
  endOfDay,
  type BillingRow,
} from "@/lib/billing";

const ADMIN_TYPES = ["SUPER", "ROOT"];
const ACTIONS = ["send", "pay", "skip", "cancel", "reissue"] as const;
const RATE_FIELDS = [
  "maintenanceFee",
  "phonePrice",
  "emailPrice",
  "websitePrice",
  "reviewsPrice",
  "ratingPrice",
  "monthlyCap",
] as const;

/** Ошибка бизнес-правила — возвращается как 400 с понятным текстом */
class InvoiceActionError extends Error {}

/**
 * Есть ли у владельца более поздний неотменённый счёт. Отменять и
 * перевыставлять можно только последний: иначе метрики отменённого
 * периода задвоятся в следующих счетах.
 */
async function hasLaterInvoice(
  tx: Prisma.TransactionClient,
  invoice: { id: string; userId: string; billedThrough: Date | null },
): Promise<boolean> {
  const later = await tx.invoice.findFirst({
    where: {
      kind: "BILLING",
      userId: invoice.userId,
      status: { not: "CANCELLED" },
      id: { not: invoice.id },
      billedThrough: { gt: invoice.billedThrough ?? new Date(0) },
    },
    select: { id: true },
  });
  return !!later;
}

export async function GET(
  _request: Request,
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
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      items: { orderBy: { id: "asc" } },
      act: true,
      user: {
        select: {
          username: true,
          email: true,
          ownedCompany: { select: { id: true, name: true, inn: true, kpp: true, legalAddress: true } },
        },
      },
    },
  });
  if (!invoice || invoice.kind !== "BILLING") {
    return NextResponse.json({ error: "Счёт не найден" }, { status: 404 });
  }

  return NextResponse.json({
    invoice: {
      id: invoice.id,
      number: invoice.number,
      date: invoice.date,
      dueDate: invoice.dueDate,
      status: invoice.status,
      subtotal: invoice.subtotal.toNumber(),
      discount: invoice.discount.toNumber(),
      total: invoice.total.toNumber(),
      limit: invoice.limit.toNumber(),
      periodFrom: invoice.periodFrom,
      periodTo: invoice.periodTo,
      sentAt: invoice.sentAt,
      paidAt: invoice.paidAt,
      username: invoice.user.username,
      email: invoice.user.email,
      company: invoice.user.ownedCompany
        ? {
            id: invoice.user.ownedCompany.id,
            name: invoice.user.ownedCompany.name,
            inn: invoice.user.ownedCompany.inn,
            kpp: invoice.user.ownedCompany.kpp,
            legalAddress: invoice.user.ownedCompany.legalAddress,
          }
        : null,
      act: invoice.act
        ? { id: invoice.act.id, number: invoice.act.number, date: invoice.act.date, total: invoice.act.total.toNumber() }
        : null,
      items: invoice.items.map((i) => ({
        description: i.description,
        quantity: i.quantity,
        unitPrice: i.unitPrice.toNumber(),
        total: i.total.toNumber(),
      })),
    },
  });
}

// Действия над счётом:
//   send — отправить (DRAFT → SENT), skip — списать (простить долг),
//   cancel — отменить (черновик, выставленный или просроченный; метрики
//   периода возвращаются в невыставленные), pay — отметить оплату:
//   фиксирует оплату и создаёт акт об оказанных услугах, reissue —
//   отменить и выставить новый счёт за тот же период с другими
//   ставками, потолком и датой.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

    const { id } = await params;

    let body: { action?: unknown; date?: unknown; rates?: unknown; saveRates?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Некорректный формат запроса" }, { status: 400 });
    }

    const action = body.action as string;
    if (!ACTIONS.includes(action as (typeof ACTIONS)[number])) {
      return NextResponse.json({ error: "Некорректное действие" }, { status: 400 });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        items: true,
        user: {
          select: {
            id: true,
            email: true,
            ownedCompany: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!invoice || invoice.kind !== "BILLING") {
      return NextResponse.json({ error: "Счёт не найден" }, { status: 404 });
    }
    const companyId = invoice.user.ownedCompany?.id ?? null;

    let act: { number: string; date: Date } | null = null;
    let reissued: { id: string; number: string; total: number } | null = null;

    if (action === "send") {
      if (invoice.status !== "DRAFT") {
        return NextResponse.json({ error: "Отправить можно только черновик" }, { status: 400 });
      }
      await prisma.invoice.update({ where: { id }, data: { status: "SENT", sentAt: new Date() } });
    } else if (action === "skip") {
      if (invoice.status === "PAID" || invoice.status === "CANCELLED") {
        return NextResponse.json({ error: "Нельзя пропустить счёт в этом статусе" }, { status: 400 });
      }
      await prisma.invoice.update({ where: { id }, data: { status: "SKIPPED" } });
    } else if (action === "cancel") {
      if (!["DRAFT", "SENT", "OVERDUE"].includes(invoice.status)) {
        return NextResponse.json({ error: "Отменить можно только черновик, выставленный или просроченный счёт" }, { status: 400 });
      }
      try {
        await prisma.$transaction(async (tx) => {
          if (await hasLaterInvoice(tx, invoice)) {
            throw new InvoiceActionError("Нельзя отменить: сначала отмените более поздние счета компании");
          }
          await tx.invoice.update({ where: { id }, data: { status: "CANCELLED" } });
          // Откатываем водяную отметку к предыдущему выставленному периоду —
          // метрики отменённого счёта снова становятся невыставленными
          const prev = await tx.invoice.findFirst({
            where: {
              kind: "BILLING",
              userId: invoice.userId,
              status: { not: "CANCELLED" },
              billedThrough: { lt: invoice.billedThrough ?? new Date() },
            },
            orderBy: { billedThrough: "desc" },
            select: { billedThrough: true },
          });
          if (companyId) {
            await tx.companyBilling.update({
              where: { companyId },
              data: { billedThrough: prev?.billedThrough ?? null },
            });
          }
        });
      } catch (e) {
        if (e instanceof InvoiceActionError) {
          return NextResponse.json({ error: e.message }, { status: 400 });
        }
        throw e;
      }
    } else if (action === "reissue") {
      if (!["SENT", "OVERDUE"].includes(invoice.status)) {
        return NextResponse.json({ error: "Перевыставить можно только выставленный или просроченный счёт" }, { status: 400 });
      }
      if (!companyId) {
        return NextResponse.json({ error: "Перевыставление доступно только для счетов с компанией" }, { status: 400 });
      }

      // Дата нового счёта: по умолчанию — конец периода исходного, не позднее сегодня
      let date: Date;
      if (typeof body.date === "string" && body.date) {
        date = new Date(body.date);
        if (Number.isNaN(date.getTime())) {
          return NextResponse.json({ error: "Некорректная дата" }, { status: 400 });
        }
      } else {
        date = invoice.periodTo ?? new Date();
      }
      const to = endOfDay(date);
      if (to.getTime() > endOfDay(new Date()).getTime()) {
        return NextResponse.json({ error: "Нельзя выставить счёт за будущую дату" }, { status: 400 });
      }

      // Ставки нового счёта: пустое поле — тариф компании/по умолчанию
      const ratesRaw = body.rates && typeof body.rates === "object" ? (body.rates as Record<string, unknown>) : {};
      const rates: Record<string, number | null> = {};
      for (const f of RATE_FIELDS) {
        if (f in ratesRaw) {
          const v = Number(ratesRaw[f]);
          rates[f] = Number.isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : null;
        }
      }
      const ratesOverride: Record<string, number> = {};
      for (const [k, v] of Object.entries(rates)) {
        if (v !== null) ratesOverride[k] = v;
      }

      const config = await prisma.billingConfig.findUniqueOrThrow({ where: { id: "default" } });
      try {
        reissued = await prisma.$transaction(async (tx) => {
          if (await hasLaterInvoice(tx, invoice)) {
            throw new InvoiceActionError("Нельзя перевыставить: сначала отмените более поздние счета компании");
          }
          // Исходный счёт отменяется, метрики периода возвращаются в невыставленные
          await tx.invoice.update({ where: { id }, data: { status: "CANCELLED" } });
          const prev = await tx.invoice.findFirst({
            where: {
              kind: "BILLING",
              userId: invoice.userId,
              status: { not: "CANCELLED" },
              billedThrough: { lt: invoice.billedThrough ?? new Date() },
            },
            orderBy: { billedThrough: "desc" },
            select: { billedThrough: true },
          });
          const rolledBack = prev?.billedThrough ?? null;
          await tx.companyBilling.update({
            where: { companyId },
            data: { billedThrough: rolledBack },
          });

          // По желанию администратора новые ставки становятся тарифом компании
          if (body.saveRates === true && Object.keys(rates).length > 0) {
            await tx.companyBilling.upsert({
              where: { companyId },
              update: rates,
              create: { companyId, ...rates },
            });
          }

          const billingAfter = await tx.companyBilling.findUnique({ where: { companyId } });
          const from = rolledBack
            ? new Date(rolledBack.getTime() + 1)
            : billingAfter?.billingStartedAt ?? invoice.periodFrom;
          if (!from || from.getTime() > to.getTime()) {
            throw new InvoiceActionError("Нет периода для выставления за выбранную дату");
          }

          const createdInvoice = await createBillingInvoice(tx, {
            companyId,
            userId: invoice.userId,
            periodFrom: from,
            periodTo: to,
            config,
            billing:
              billingAfter ??
              ({ maintenanceFee: null, phonePrice: null, emailPrice: null, websitePrice: null, reviewsPrice: null, ratingPrice: null, monthlyCap: null } as BillingRow),
            ratesOverride: Object.keys(ratesOverride).length > 0 ? ratesOverride : undefined,
          });
          return {
            id: createdInvoice.id,
            number: createdInvoice.number,
            total: createdInvoice.total.toNumber(),
          };
        });
      } catch (e) {
        if (e instanceof InvoiceActionError) {
          return NextResponse.json({ error: e.message }, { status: 400 });
        }
        throw e;
      }

      if (invoice.user.id && reissued) {
        await notifyUser({
          userId: invoice.user.id,
          type: "INVOICE",
          title: "Счёт перевыставлен",
          message: `Счёт ${invoice.number} отменён; выставлен новый счёт ${reissued.number} на сумму ${reissued.total.toLocaleString("ru-RU")} ₽.`,
          link: "/company/finances",
        });
        // Письмо о новом счёте (отключено без POSTAL_API_URL/POSTAL_API_KEY)
        if (invoice.user.email) {
          await sendMail(
            buildInvoiceEmail(invoice.user.email, {
              companyName: invoice.user.ownedCompany?.name,
              number: reissued.number,
              total: reissued.total,
              note: `Ранее выставленный счёт ${invoice.number} отменён, вместо него выставлен новый.`,
            }),
          );
        }
      }
    } else if (action === "pay") {
      if (invoice.status === "PAID") {
        return NextResponse.json({ error: "Счёт уже оплачен" }, { status: 400 });
      }
      if (invoice.status === "CANCELLED") {
        return NextResponse.json({ error: "Отменённый счёт нельзя оплатить" }, { status: 400 });
      }
      // Строки акта — из шаблона (настраиваются в админке), сумма = сумма счёта
      const actTpl = await docTemplateLines("service_act");
      const actLines = actTpl.length > 0 ? actTpl.map((r) => r.description) : DEFAULT_ACT_LINES;
      const periodLabel =
        invoice.periodFrom && invoice.periodTo
          ? `${invoice.periodFrom.toLocaleDateString("ru-RU")} — ${invoice.periodTo.toLocaleDateString("ru-RU")}`
          : "";
      const actDescription = actLines
        .map((line) =>
          renderDocTemplate(line, {
            period: periodLabel,
            invoice: invoice.number,
            total: invoice.total.toNumber().toLocaleString("ru-RU", { maximumFractionDigits: 2 }),
          }),
        )
        .join("\n");
      act = await prisma.$transaction(async (tx) => {
        await tx.invoice.update({
          where: { id },
          data: {
            status: "PAID",
            paidAt: new Date(),
            sentAt: invoice.sentAt ?? new Date(),
          },
        });
        const number = await nextDocumentNumber(tx, "act");
        const created = await tx.serviceAct.create({
          data: {
            invoiceId: invoice.id,
            number,
            date: new Date(),
            total: invoice.total,
            itemsJson: JSON.stringify([
              {
                description: actDescription,
                quantity: 1,
                unitPrice: invoice.total.toNumber(),
                total: invoice.total.toNumber(),
              },
            ]),
          },
        });
        // Контакты скрытой компании администратор возвращает вручную
        // («Компании и тарифы» → «Вернуть контакты») — автоматики нет.
        return { number: created.number, date: created.date };
      });
    }

    await logAdminAction({
      adminId,
      adminName: adminUsername ?? adminId,
      action: "billing",
      entityType: "invoice",
      entityId: id,
      payload: {
        number: invoice.number,
        action,
        companyId,
        ...(reissued ? { newNumber: reissued.number, newTotal: reissued.total } : {}),
      },
    });

    if (invoice.user.id) {
      const messages: Record<string, { title: string; message: string }> = {
        send: { title: "Выставлен счёт", message: `Счёт ${invoice.number} на сумму ${invoice.total.toNumber().toLocaleString("ru-RU")} ₽ выставлен. Срок оплаты — ${invoice.dueDate.toLocaleDateString("ru-RU")}.` },
        pay: { title: "Счёт оплачен", message: `Счёт ${invoice.number} оплачен${act ? `, сформирован акт ${act.number}` : ""}. Спасибо!` },
        skip: { title: "Счёт списан", message: `Счёт ${invoice.number} списан администратором — оплата не требуется.` },
        cancel: { title: "Счёт отменён", message: `Счёт ${invoice.number} отменён администратором.` },
      };
      const n = messages[action];
      if (n) {
        await notifyUser({
          userId: invoice.user.id,
          type: "INVOICE",
          title: n.title,
          message: n.message,
          link: "/company/finances",
        });
        // При отправке счёта дублируем письмом (отключено без POSTAL_API_URL/POSTAL_API_KEY)
        if (action === "send" && invoice.user.email) {
          await sendMail(
            buildInvoiceEmail(invoice.user.email, {
              companyName: invoice.user.ownedCompany?.name,
              number: invoice.number,
              total: invoice.total.toNumber(),
              periodLabel:
                invoice.periodFrom && invoice.periodTo
                  ? `${invoice.periodFrom.toLocaleDateString("ru-RU")} — ${invoice.periodTo.toLocaleDateString("ru-RU")}`
                  : null,
              dueDate: invoice.dueDate,
            }),
          );
        }
      }
    }

    return NextResponse.json({ success: true, act, reissued });
  } catch (e) {
    if (e instanceof InvoiceActionError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Не удалось выполнить действие" }, { status: 500 });
  }
}
