import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/types";
import { logAdminAction } from "@/lib/audit";
import { notifyUser } from "@/lib/notifications";
import { nextDocumentNumber, docTemplateLines, DEFAULT_ACT_LINES, renderDocTemplate } from "@/lib/billing";

const ADMIN_TYPES = ["SUPER", "ROOT"];
const ACTIONS = ["send", "pay", "skip", "cancel", "edit"] as const;

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
//   send — отправить (DRAFT → SENT), skip — простить, cancel — отменить черновик,
//   pay — отметить оплату: фиксирует оплату и создаёт акт об оказанных услугах,
//   edit — изменить скидку черновика (discount).
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

    let body: { action?: unknown; discount?: unknown };
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
        user: { select: { id: true, ownedCompany: { select: { id: true, name: true } } } },
      },
    });
    if (!invoice || invoice.kind !== "BILLING") {
      return NextResponse.json({ error: "Счёт не найден" }, { status: 404 });
    }
    const companyId = invoice.user.ownedCompany?.id ?? null;

    let act: { number: string; date: Date } | null = null;

    if (action === "edit") {
      if (invoice.status !== "DRAFT") {
        return NextResponse.json({ error: "Править можно только черновик" }, { status: 400 });
      }
      const discount = Math.min(invoice.subtotal.toNumber(), Math.max(0, Math.round(Number(body.discount ?? 0) * 100) / 100));
      if (!Number.isFinite(discount)) {
        return NextResponse.json({ error: "Некорректная скидка" }, { status: 400 });
      }
      await prisma.invoice.update({
        where: { id },
        data: { discount, total: Math.round((invoice.subtotal.toNumber() - discount) * 100) / 100 },
      });
    } else if (action === "send") {
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
      if (invoice.status !== "DRAFT") {
        return NextResponse.json({ error: "Отменить можно только черновик" }, { status: 400 });
      }
      await prisma.$transaction(async (tx) => {
        await tx.invoice.update({ where: { id }, data: { status: "CANCELLED" } });
        // Откатываем водяную отметку к предыдущему выставленному периоду
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
      payload: { number: invoice.number, action, companyId },
    });

    if (invoice.user.id) {
      const messages: Record<string, { title: string; message: string }> = {
        send: { title: "Выставлен счёт", message: `Счёт ${invoice.number} на сумму ${invoice.total.toNumber().toLocaleString("ru-RU")} ₽ выставлен. Срок оплаты — ${invoice.dueDate.toLocaleDateString("ru-RU")}.` },
        pay: { title: "Счёт оплачен", message: `Счёт ${invoice.number} оплачен${act ? `, сформирован акт ${act.number}` : ""}. Спасибо!` },
        skip: { title: "Счёт пропущен", message: `Счёт ${invoice.number} пропущен администратором.` },
        cancel: { title: "Счёт отменён", message: `Счёт ${invoice.number} отменён администратором.` },
        edit: { title: "Счёт изменён", message: `Счёт ${invoice.number} скорректирован администратором.` },
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
      }
    }

    return NextResponse.json({ success: true, act });
  } catch {
    return NextResponse.json({ error: "Не удалось выполнить действие" }, { status: 500 });
  }
}
