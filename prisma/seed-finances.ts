// Сид финансов админки: компании и счета во всех возможных состояниях,
// чтобы можно было проверить каждую ситуацию вкладки «Финансы»:
//   - «Платит» / «Не платит» / «—» (счетов ещё нет)
//   - статусы компании: Активна / Контакты скрыты / Без владельца
//   - владелец забанен
//   - все статусы счетов: Черновик, Выставлен, Оплачен (+ акт), Пропущен,
//     Просрочен (помечается автоматически), Отменён
//   - скидка на счёте, индивидуальные ставки, потолок
//   - заметки администратора, просмотры контактов, разные даты регистрации
// Запуск: npx tsx prisma/seed-finances.ts
// Пароль всех создаваемых владельцев: 12345678
// Повторный запуск безопасен: существующие компании (по ИНН) пропускаются.

import { PrismaClient } from "@prisma/client";
import * as argon2 from "@node-rs/argon2";

const prisma = new PrismaClient();

function monthStartOffset(offset: number): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + offset, 1);
}

function monthEndOffset(offset: number): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + offset + 1, 0, 23, 59, 59, 999);
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function daysAhead(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

/** Дата внутри месяца со сдвигом offset (для событий просмотров) */
function dayInMonth(offset: number, day: number): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + offset, Math.min(day, 27), 12);
}

interface InvoiceSpec {
  number: string;
  periodOffset: number; // смещение месяца периода
  status: string;
  subtotal: number;
  discount?: number;
  dueDate: Date;
  sentAt?: Date;
  paidAt?: Date;
  createdAt?: Date;
  actNumber?: string;
}

interface CompanySpec {
  inn: string;
  name: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  createdAt: Date;
  owner?: { username: string; email: string; status: string; banReason?: string };
  billing: {
    status: string;
    billingStartedAt?: Date;
    billedThrough?: Date;
    hiddenReason?: string;
    maintenanceFee?: number | null;
    phonePrice?: number | null;
    emailPrice?: number | null;
    websitePrice?: number | null;
    reviewsPrice?: number | null;
    ratingPrice?: number | null;
    monthlyCap?: number | null;
  } | null;
  invoices: InvoiceSpec[];
  metrics: { phoneViews: number; emailViews: number; websiteViews: number; reviewsViews: number; ratingViews: number };
  viewEvents: { metric: string; date: Date }[];
  notes: string[];
}

const SPECS: CompanySpec[] = [
  {
    // Активна, «Платит», завершённый период не выставлен — счёт за прошлый
    // месяц можно сформировать в попапе (постоплата)
    inn: "7712345678",
    name: "ООО «Ромашка»",
    email: "info@romashka.ru",
    phone: null,
    website: "https://romashka.ru",
    createdAt: new Date(2026, 2, 14),
    owner: { username: "romashka_owner", email: "owner@romashka.ru", status: "ACTIVE" },
    billing: {
      status: "ACTIVE",
      billingStartedAt: monthStartOffset(-3),
      billedThrough: monthEndOffset(-2),
    },
    invoices: [
      {
        number: "СЧ-2026-601",
        periodOffset: -2,
        status: "PAID",
        subtotal: 1250,
        dueDate: daysAgo(45),
        sentAt: daysAgo(55),
        paidAt: daysAgo(50),
        actNumber: "АКТ-2026-601",
      },
    ],
    metrics: { phoneViews: 5, emailViews: 3, websiteViews: 2, reviewsViews: 0, ratingViews: 0 },
    viewEvents: [
      { metric: "phone", date: dayInMonth(-1, 3) },
      { metric: "phone", date: dayInMonth(-1, 5) },
      { metric: "phone", date: dayInMonth(-1, 8) },
      { metric: "phone", date: dayInMonth(-1, 11) },
      { metric: "phone", date: dayInMonth(-1, 15) },
      { metric: "email", date: dayInMonth(-1, 4) },
      { metric: "email", date: dayInMonth(-1, 9) },
      { metric: "email", date: dayInMonth(-1, 14) },
      { metric: "website", date: dayInMonth(-1, 6) },
      { metric: "website", date: dayInMonth(-1, 17) },
    ],
    notes: [],
  },
  {
    // Активна, «Не платит»: выставленный счёт с истёкшим сроком — станет «Просрочен» сам
    inn: "7709123456",
    name: "ООО «СтройГрад»",
    email: "mail@stroygrad.ru",
    phone: null,
    website: null,
    createdAt: new Date(2025, 8, 3),
    owner: { username: "stroygrad_owner", email: "owner@stroygrad.ru", status: "ACTIVE" },
    billing: {
      status: "ACTIVE",
      billingStartedAt: monthStartOffset(-4),
      billedThrough: monthEndOffset(-1),
    },
    invoices: [
      {
        number: "СЧ-2026-602",
        periodOffset: -2,
        status: "PAID",
        subtotal: 1600,
        dueDate: daysAgo(40),
        sentAt: daysAgo(50),
        paidAt: daysAgo(45),
        actNumber: "АКТ-2026-602",
      },
      {
        // срок оплаты истёк 3 дня назад — при просмотре списка станет OVERDUE
        number: "СЧ-2026-603",
        periodOffset: -1,
        status: "SENT",
        subtotal: 1700,
        dueDate: daysAgo(3),
        sentAt: daysAgo(10),
      },
    ],
    metrics: { phoneViews: 10, emailViews: 5, websiteViews: 4, reviewsViews: 0, ratingViews: 0 },
    viewEvents: [
      { metric: "phone", date: dayInMonth(-1, 4) },
      { metric: "phone", date: dayInMonth(-1, 7) },
      { metric: "phone", date: dayInMonth(-1, 12) },
      { metric: "phone", date: dayInMonth(-1, 18) },
      { metric: "phone", date: dayInMonth(-1, 22) },
      { metric: "email", date: dayInMonth(-1, 6) },
      { metric: "email", date: dayInMonth(-1, 15) },
      { metric: "website", date: dayInMonth(-1, 9) },
      { metric: "website", date: dayInMonth(-1, 20) },
    ],
    notes: [],
  },
  {
    // Санкция применена: контакты скрыты с причиной, есть просроченный счёт
    inn: "7723456789",
    name: "ИП «Иванов А.В.»",
    email: "ivanov-ip@mail.ru",
    phone: null,
    website: null,
    createdAt: new Date(2025, 5, 21),
    owner: { username: "ivanov_ip", email: "ivanov.ip@mail.ru", status: "ACTIVE" },
    billing: {
      status: "HIDDEN",
      billingStartedAt: monthStartOffset(-5),
      billedThrough: monthEndOffset(-2),
      hiddenReason: "Не оплачен счёт СЧ-2026-604",
    },
    invoices: [
      {
        number: "СЧ-2026-604",
        periodOffset: -2,
        status: "OVERDUE",
        subtotal: 900,
        dueDate: daysAgo(40),
        sentAt: daysAgo(47),
      },
    ],
    metrics: { phoneViews: 2, emailViews: 1, websiteViews: 0, reviewsViews: 0, ratingViews: 0 },
    viewEvents: [
      { metric: "phone", date: dayInMonth(-2, 5) },
      { metric: "phone", date: dayInMonth(-2, 16) },
      { metric: "email", date: dayInMonth(-2, 10) },
    ],
    notes: ["Звонил 10.08.2026: обещал оплатить до конца месяца"],
  },
  {
    // Без владельца: биллинг выключен, есть заметки, зарегистрирована давно
    inn: "7734567890",
    name: "ООО «ПромКомплект»",
    email: "prom@komplekt.ru",
    phone: "+7 (900) 111-22-33",
    website: null,
    createdAt: new Date(2025, 10, 20),
    owner: undefined,
    billing: { status: "INACTIVE" },
    invoices: [],
    metrics: { phoneViews: 0, emailViews: 0, websiteViews: 0, reviewsViews: 0, ratingViews: 0 },
    viewEvents: [],
    notes: [
      "Зарегистрировался по телефону 05.08.2026",
      "Обещал прислать документы и ИНН — пока не прислал",
    ],
  },
  {
    // Владелец забанен: компания в таблице, вход для владельца запрещён
    inn: "7745678901",
    name: "АО «ТехноСервис»",
    email: "info@tehservis.ru",
    phone: null,
    website: "https://tehservis.ru",
    createdAt: new Date(2026, 0, 12),
    owner: {
      username: "tehservis_owner",
      email: "owner@tehservis.ru",
      status: "BANNED",
      banReason: "Нарушение правил платформы",
    },
    billing: {
      status: "ACTIVE",
      billingStartedAt: monthStartOffset(-1),
      billedThrough: monthEndOffset(0),
    },
    invoices: [
      {
        number: "СЧ-2026-605",
        periodOffset: 0,
        status: "SENT",
        subtotal: 1050,
        dueDate: daysAhead(5),
        sentAt: daysAgo(1),
        createdAt: daysAgo(1),
      },
    ],
    metrics: { phoneViews: 1, emailViews: 2, websiteViews: 1, reviewsViews: 0, ratingViews: 0 },
    viewEvents: [
      { metric: "phone", date: dayInMonth(0, 2) },
      { metric: "email", date: dayInMonth(0, 2) },
      { metric: "email", date: dayInMonth(0, 6) },
      { metric: "website", date: dayInMonth(0, 7) },
    ],
    notes: ["Заблокирован после конфликта с участником — разобраться с модераторами"],
  },
  {
    // Черновик за прошлый месяц: ждёт кнопки «Выставить»
    inn: "7756789012",
    name: "ООО «Вектор»",
    email: "mail@vektor-stroy.ru",
    phone: null,
    website: null,
    createdAt: new Date(2026, 4, 6),
    owner: { username: "vektor_owner", email: "owner@vektor-stroy.ru", status: "ACTIVE" },
    billing: {
      status: "ACTIVE",
      billingStartedAt: monthStartOffset(-2),
      billedThrough: monthEndOffset(-1),
    },
    invoices: [
      {
        number: "СЧ-2026-606",
        periodOffset: -1,
        status: "DRAFT",
        subtotal: 1100,
        dueDate: daysAhead(5),
        createdAt: new Date(),
      },
    ],
    metrics: { phoneViews: 3, emailViews: 1, websiteViews: 2, reviewsViews: 0, ratingViews: 0 },
    viewEvents: [
      { metric: "phone", date: dayInMonth(0, 1) },
      { metric: "phone", date: dayInMonth(0, 4) },
      { metric: "phone", date: dayInMonth(0, 10) },
      { metric: "email", date: dayInMonth(0, 5) },
      { metric: "website", date: dayInMonth(0, 8) },
      { metric: "website", date: dayInMonth(0, 13) },
    ],
    notes: [],
  },
  {
    // Долг прощён («Пропущен»): «Платит», период снова открыт
    inn: "7767890123",
    name: "ООО «НоваСтрой»",
    email: "info@novastroy.ru",
    phone: null,
    website: null,
    createdAt: new Date(2026, 1, 27),
    owner: { username: "novastroy_owner", email: "owner@novastroy.ru", status: "ACTIVE" },
    billing: {
      status: "ACTIVE",
      billingStartedAt: monthStartOffset(-2),
      billedThrough: monthEndOffset(-1),
    },
    invoices: [
      {
        number: "СЧ-2026-607",
        periodOffset: -1,
        status: "SKIPPED",
        subtotal: 800,
        dueDate: daysAgo(12),
        sentAt: daysAgo(20),
      },
    ],
    metrics: { phoneViews: 0, emailViews: 0, websiteViews: 0, reviewsViews: 0, ratingViews: 0 },
    viewEvents: [],
    notes: [],
  },
  {
    // Отменённый счёт: период вернулся в невыставленные
    inn: "7778901234",
    name: "ООО «МегаПоставка»",
    email: "mega@postavka.ru",
    phone: null,
    website: null,
    createdAt: new Date(2025, 11, 9),
    owner: { username: "mega_owner", email: "owner@megapost.ru", status: "ACTIVE" },
    billing: {
      status: "ACTIVE",
      billingStartedAt: monthStartOffset(-3),
      billedThrough: new Date(monthStartOffset(-1).getTime() - 1),
    },
    invoices: [
      {
        number: "СЧ-2026-608",
        periodOffset: -1,
        status: "CANCELLED",
        subtotal: 950,
        dueDate: daysAgo(9),
      },
    ],
    metrics: { phoneViews: 0, emailViews: 0, websiteViews: 1, reviewsViews: 0, ratingViews: 0 },
    viewEvents: [{ metric: "website", date: dayInMonth(-1, 3) }],
    notes: [],
  },
  {
    // Индивидуальные ставки, потолок и скидка на оплаченном счёте
    inn: "7789012345",
    name: "ООО «СкидкиПро»",
    email: "sales@skidkipro.ru",
    phone: null,
    website: "https://skidkipro.ru",
    createdAt: new Date(2025, 7, 15),
    owner: { username: "skidki_owner", email: "owner@skidkipro.ru", status: "ACTIVE" },
    billing: {
      status: "ACTIVE",
      billingStartedAt: monthStartOffset(-4),
      billedThrough: monthEndOffset(-1),
      maintenanceFee: 500,
      phonePrice: 30,
      emailPrice: 20,
      websitePrice: 10,
      reviewsPrice: 5,
      ratingPrice: 5,
      monthlyCap: 2000,
    },
    invoices: [
      {
        number: "СЧ-2026-609",
        periodOffset: -2,
        status: "PAID",
        subtotal: 2200,
        discount: 300,
        dueDate: daysAgo(35),
        sentAt: daysAgo(45),
        paidAt: daysAgo(40),
        actNumber: "АКТ-2026-603",
      },
    ],
    metrics: { phoneViews: 20, emailViews: 15, websiteViews: 30, reviewsViews: 10, ratingViews: 8 },
    viewEvents: [
      { metric: "phone", date: dayInMonth(-1, 3) },
      { metric: "email", date: dayInMonth(-1, 5) },
      { metric: "website", date: dayInMonth(-1, 8) },
      { metric: "reviews", date: dayInMonth(-1, 11) },
      { metric: "rating", date: dayInMonth(-1, 14) },
    ],
    notes: ["Договорились о скидке на абонплату со следующего месяца"],
  },
  {
    // Несколько заметок — индикатор «📝 3» в таблице
    inn: "7790123456",
    name: "ООО «АльфаСтрой»",
    email: "alfa@stroy.ru",
    phone: null,
    website: null,
    createdAt: new Date(2025, 3, 30),
    owner: { username: "alfa_owner", email: "owner@alfastroy.ru", status: "ACTIVE" },
    billing: {
      status: "ACTIVE",
      billingStartedAt: monthStartOffset(-5),
      billedThrough: monthEndOffset(-1),
    },
    invoices: [
      {
        number: "СЧ-2026-610",
        periodOffset: -3,
        status: "PAID",
        subtotal: 1200,
        dueDate: daysAgo(70),
        sentAt: daysAgo(80),
        paidAt: daysAgo(75),
        actNumber: "АКТ-2026-604",
      },
    ],
    metrics: { phoneViews: 1, emailViews: 0, websiteViews: 0, reviewsViews: 0, ratingViews: 0 },
    viewEvents: [],
    notes: [
      "Постоянный клиент с 2025 года",
      "Просит выставлять счета до 5 числа месяца",
      "Договорились о скидке на абонплату со следующего месяца",
    ],
  },
  {
    // Активна, но счетов ещё не было — в колонке «Оплата» будет «—»
    inn: "7701234567",
    name: "ООО «ДорСтрой»",
    email: "dor@stroy.ru",
    phone: null,
    website: null,
    createdAt: new Date(2026, 6, 18),
    owner: { username: "dorstroy_owner", email: "owner@dorstroy.ru", status: "ACTIVE" },
    billing: {
      status: "ACTIVE",
      billingStartedAt: monthStartOffset(0),
      billedThrough: null,
    },
    invoices: [],
    metrics: { phoneViews: 4, emailViews: 0, websiteViews: 3, reviewsViews: 0, ratingViews: 0 },
    viewEvents: [
      { metric: "phone", date: dayInMonth(0, 6) },
      { metric: "phone", date: dayInMonth(0, 9) },
      { metric: "phone", date: dayInMonth(0, 12) },
      { metric: "phone", date: dayInMonth(0, 16) },
      { metric: "website", date: dayInMonth(0, 7) },
      { metric: "website", date: dayInMonth(0, 11) },
      { metric: "website", date: dayInMonth(0, 19) },
    ],
    notes: [],
  },
];

async function main() {
  const passwordHash = await argon2.hash("12345678");
  const rootAdmin = await prisma.user.findFirst({ where: { type: "ROOT" }, select: { id: true } });

  // Строки шаблонов документов по умолчанию (если ещё не созданы)
  const TEMPLATE_LINES: {
    docKind: string;
    code: string;
    label: string;
    description: string;
    sortOrder: number;
  }[] = [
    { docKind: "billing_invoice", code: "title", label: "Название счёта", description: "Счёт на оплату № {number} от {date}", sortOrder: 0 },
    { docKind: "billing_invoice", code: "maintenance", label: "Абонентская плата", description: "Абонентская плата за использование платформы ({period})", sortOrder: 1 },
    { docKind: "billing_invoice", code: "views", label: "Плата за просмотры контактов", description: "Плата за просмотры контактов: {metric} ({period})", sortOrder: 2 },
    { docKind: "billing_invoice", code: "cap", label: "Строка при применении потолка", description: "Плата за просмотры контактов ({period}; {breakdown}; применён лимит счёта)", sortOrder: 3 },
    { docKind: "billing_invoice", code: "note", label: "Примечание", description: "Оплата данного счёта означает полное и безоговорочное согласие с условиями Публичной оферты (акцепт оферты согласно ст. 438 ГК РФ).\n*Упрощенная система налогообложения (УСН) / ст. 346.11 НК РФ (или пп. 26 п. 2 ст. 149 НК РФ, если софт в реестре РФ).", sortOrder: 10 },
    { docKind: "service_act", code: "services", label: "Оказанные услуги", description: "Услуги платформы за период {period} по счёту {invoice}", sortOrder: 1 },
    { docKind: "coin_invoice", code: "title", label: "Название счёта", description: "Счёт на оплату № {number} от {date}", sortOrder: 0 },
    { docKind: "coin_invoice", code: "license", label: "Лицензионное вознаграждение", description: "Предоставление права использования функционала платформы ЕНЦПР (Лицензионное вознаграждение)", sortOrder: 1 },
    { docKind: "coin_invoice", code: "scope", label: "Объем прав", description: "Объем прав: {count} {units} ({coins})", sortOrder: 2 },
    { docKind: "coin_invoice", code: "note", label: "Примечание", description: "Оплата данного счёта означает полное и безоговорочное согласие с условиями Публичной оферты (акцепт оферты согласно ст. 438 ГК РФ).\n*Упрощенная система налогообложения (УСН) / ст. 346.11 НК РФ (или пп. 26 п. 2 ст. 149 НК РФ, если софт в реестре РФ).", sortOrder: 10 },
  ];
  for (const line of TEMPLATE_LINES) {
    await prisma.docTemplateLine.upsert({
      where: { docKind_code: { docKind: line.docKind, code: line.code } },
      update: {},
      create: line,
    });
  }

  let createdCompanies = 0;
  let skippedCompanies = 0;

  for (const spec of SPECS) {
    const existing = await prisma.company.findUnique({ where: { inn: spec.inn } });
    if (existing) {
      console.log(`Пропущено (ИНН существует): ${spec.name}`);
      skippedCompanies += 1;
      continue;
    }

    let ownerId: string | null = null;
    if (spec.owner) {
      const owner = await prisma.user.upsert({
        where: { username: spec.owner.username },
        update: {},
        create: {
          username: spec.owner.username,
          email: spec.owner.email,
          pwdHash: passwordHash,
          status: spec.owner.status,
          type: "COMPANY",
          profile: { create: { nick: spec.owner.username, inn: spec.inn, companyName: spec.name } },
          serviceFields: { create: spec.owner.banReason ? { banReason: spec.owner.banReason } : {} },
          wallet: { create: { balance: 0 } },
        },
      });
      ownerId = owner.id;
      if (spec.owner.status === "BANNED" && rootAdmin) {
        await prisma.banLog.create({
          data: { userId: owner.id, adminId: rootAdmin.id, action: "BAN", reason: spec.owner.banReason ?? null },
        });
      }
    }

    const company = await prisma.company.create({
      data: {
        inn: spec.inn,
        name: spec.name,
        searchText: `${spec.name} ${spec.inn}`.toLowerCase(),
        email: spec.email,
        phone: spec.phone,
        website: spec.website,
        ownerUserId: ownerId,
        createdAt: spec.createdAt,
        metrics: { create: spec.metrics },
        ...(spec.billing ? { billing: { create: spec.billing } } : {}),
      },
    });

    for (const noteText of spec.notes) {
      await prisma.companyNote.create({ data: { companyId: company.id, text: noteText } });
    }

    if (spec.viewEvents.length > 0) {
      await prisma.companyViewEvent.createMany({
        data: spec.viewEvents.map((e) => ({
          companyId: company.id,
          metric: e.metric,
          createdAt: e.date,
        })),
      });
    }

    for (const inv of spec.invoices) {
      const periodFrom = monthStartOffset(inv.periodOffset);
      const periodTo = monthEndOffset(inv.periodOffset);
      const total = inv.subtotal - (inv.discount ?? 0);
      const invoice = await prisma.invoice.create({
        data: {
          userId: ownerId!,
          number: inv.number,
          date: inv.createdAt ?? inv.sentAt ?? periodFrom,
          dueDate: inv.dueDate,
          status: inv.status,
          kind: "BILLING",
          subtotal: inv.subtotal,
          limit: spec.billing?.monthlyCap ?? 1000,
          discount: inv.discount ?? 0,
          total,
          periodFrom,
          periodTo,
          billedThrough: periodTo,
          sentAt: inv.sentAt,
          paidAt: inv.paidAt,
          createdAt: inv.createdAt ?? inv.sentAt ?? periodFrom,
          items: {
            create: [
              {
                description: `Абонентская плата за использование платформы (${periodFrom.toLocaleDateString("ru-RU")} — ${periodTo.toLocaleDateString("ru-RU")})`,
                quantity: 1,
                unitPrice: total,
                total,
              },
            ],
          },
        },
      });

      if (inv.actNumber) {
        await prisma.serviceAct.create({
          data: {
            invoiceId: invoice.id,
            number: inv.actNumber,
            date: inv.paidAt ?? new Date(),
            total,
            itemsJson: JSON.stringify([
              { description: "Услуги платформы", quantity: 1, unitPrice: total, total },
            ]),
          },
        });
      }
    }

    console.log(`Создано: ${spec.name} (${spec.owner ? `владелец ${spec.owner.username}` : "без владельца"})`);
    createdCompanies += 1;
  }

  // Сквозная нумерация — выше демо-номеров, но не ниже уже использованных
  // (иначе новые счета/акты будут конфликтовать с существующими номерами)
  const bumpSequence = async (key: string, floor: number) => {
    const seq = await prisma.numberSequence.findUnique({ where: { key } });
    if (!seq || seq.value < floor) {
      await prisma.numberSequence.upsert({
        where: { key },
        update: { value: floor },
        create: { key, value: floor },
      });
    }
  };
  await bumpSequence("invoice-2026", 700);
  await bumpSequence("act-2026", 650);

  console.log(`Готово: создано компаний ${createdCompanies}, пропущено ${skippedCompanies}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
