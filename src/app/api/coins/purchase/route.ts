import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMissingInvoiceProfileFields, pluralRu } from "@/lib/invoices";
import { docTemplateLines, DEFAULT_COIN_LINES, renderDocTemplate } from "@/lib/billing";
import type { SessionUser } from "@/types";
import crypto from "crypto";

const PURCHASE_SUBJECT = "Покупка монет";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
    }

    const userId = (session.user as SessionUser).id as string;
    const email = session.user.email || "";

    // Покупатель в печатном счёте заполняется из профиля (название/ФИО и адрес) —
    // блокируем покупку, пока нужные поля не заполнены
    const [profile, ownedCompany] = await Promise.all([
      prisma.userProfile.findUnique({ where: { userId } }),
      prisma.company.findFirst({
        where: { ownerUserId: userId },
        select: { name: true, legalAddress: true },
      }),
    ]);
    const missingInvoiceFields = getMissingInvoiceProfileFields({
      inn: profile?.inn || null,
      companyName: profile?.companyName || null,
      legalAddress: profile?.legalAddress || null,
      firstName: profile?.firstName || null,
      lastName: profile?.lastName || null,
      middleName: profile?.middleName || null,
      regions: profile?.regions || null,
      linkedCompanyName: ownedCompany?.name || null,
      linkedCompanyAddress: ownedCompany?.legalAddress || null,
    });
    if (missingInvoiceFields.length > 0) {
      return NextResponse.json(
        { error: `Для выставления счёта заполните в профиле: ${missingInvoiceFields.join(", ")}` },
        { status: 400 },
      );
    }

    let body: { amount?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Некорректный формат запроса" }, { status: 400 });
    }

    const amount = Number(body.amount);
    if (!Number.isInteger(amount) || amount < 1 || amount > 10000) {
      return NextResponse.json({ error: "Укажите целое количество монет от 1 до 10000" }, { status: 400 });
    }

    const billing = await prisma.billingConfig.findUnique({ where: { id: "default" } });
    const coinPrice = billing?.coinPriceRub ? billing.coinPriceRub.toNumber() : 100;
    const total = Math.round(amount * coinPrice * 100) / 100;

    // Описание позиции счёта — из шаблона (настраивается в админке);
    // название и примечание шаблона в позицию не попадают
    const tplRows = await docTemplateLines("coin_invoice");
    const itemRows = tplRows.filter((r) => r.code === "license" || r.code === "scope");
    const lines = itemRows.length > 0 ? itemRows.map((r) => r.description) : DEFAULT_COIN_LINES;
    const itemDescription = lines
      .map((line) =>
        renderDocTemplate(line, {
          count: String(amount),
          units: pluralRu(amount, "условная единица", "условные единицы", "условных единиц"),
          coins: pluralRu(amount, "монета", "монеты", "монет"),
          price: coinPrice.toLocaleString("ru-RU", { maximumFractionDigits: 2 }),
          total: total.toLocaleString("ru-RU", { maximumFractionDigits: 2 }),
        }),
      )
      .join("\n");

    const number = `INV-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

    const result = await prisma.$transaction(async (tx) => {
      // Заявка падает в систему тикетов
      const ticket = await tx.supportTicket.create({
        data: {
          userId,
          email,
          subject: PURCHASE_SUBJECT,
          message: `Заявка на покупку ${amount} монет на сумму ${total} ₽.`,
        },
      });

      const invoice = await tx.invoice.create({
        data: {
          userId,
          number,
          date: new Date(),
          dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          subtotal: total,
          limit: 0,
          total,
          ticketId: ticket.id,
          items: {
            create: [
              {
                description: itemDescription,
                quantity: amount,
                unitPrice: coinPrice,
                total,
              },
            ],
          },
        },
      });

      return { ticketId: ticket.id, invoiceId: invoice.id, total };
    });

    return NextResponse.json({ success: true, ...result });
  } catch {
    return NextResponse.json({ error: "Не удалось создать заявку на покупку" }, { status: 500 });
  }
}
