// Сид: пользователи всех ролей (включая root), демо-контент (отзывы, библиотека,
// конференции, опросы, подарки, транзакции, поддержка) и справочники
// 1:1 из приложенных PDF («регионы.pdf», «продуктовое дерево.pdf»).
// Запуск: npx prisma db seed  (или: npx tsx prisma/seed.ts)
// Пароль всех пользователей: 12345678

import { PrismaClient } from "@prisma/client";
import * as argon2 from "@node-rs/argon2";
import { REGIONS } from "../src/lib/regions";
import { CLASSIFIER_NODES } from "./data/classifier";

const prisma = new PrismaClient();

const PASSWORD = "12345678";

interface UserSeed {
  username: string;
  email: string;
  /** COMMON | COMPANY | MODERATOR | EDITOR | SUPER | ROOT */
  type: string;
  firstName: string;
  lastName: string;
  nick: string;
  region: string;
  /** Роли участника (UserProfileRole) */
  roles?: string[];
  /** Для компаний: ИНН (валидный по контрольной сумме ФНС) */
  inn?: string;
  companyName?: string;
  /** Для админ-ролей */
  adminType?: string;
  balance: number;
}

const USERS: UserSeed[] = [
  // ── ROOT ──
  {
    username: "root", email: "root@ecpr.ru", type: "ROOT",
    firstName: "Кирилл", lastName: "Кокорев", nick: "root",
    region: "г. Москва", adminType: "ROOT", balance: 0,
  },
  // ── SUPER ──
  {
    username: "super_admin", email: "super@ecpr.ru", type: "SUPER",
    firstName: "Александр", lastName: "Ветров", nick: "super_alex",
    region: "г. Москва", adminType: "SUPER", balance: 0,
  },
  {
    username: "super_ops", email: "ops@ecpr.ru", type: "SUPER",
    firstName: "Марина", lastName: "Орлова", nick: "super_marina",
    region: "г. Санкт-Петербург", adminType: "SUPER", balance: 0,
  },
  // ── EDITOR ──
  {
    username: "editor_content", email: "content@ecpr.ru", type: "EDITOR",
    firstName: "Дмитрий", lastName: "Волков", nick: "editor_dmitry",
    region: "г. Москва", adminType: "EDITOR", balance: 30,
  },
  {
    username: "editor_products", email: "products@ecpr.ru", type: "EDITOR",
    firstName: "Елена", lastName: "Соколова", nick: "editor_elena",
    region: "Московская область", adminType: "EDITOR", balance: 30,
  },
  // ── MODERATOR ──
  {
    username: "moderator_reviews", email: "reviews@ecpr.ru", type: "MODERATOR",
    firstName: "Анна", lastName: "Смирнова", nick: "moderator_anna",
    region: "г. Санкт-Петербург", adminType: "MODERATOR", balance: 50,
  },
  {
    username: "moderator_library", email: "library@ecpr.ru", type: "MODERATOR",
    firstName: "Павел", lastName: "Крылов", nick: "moderator_pavel",
    region: "Новосибирская область", adminType: "MODERATOR", balance: 50,
  },
  // ── COMMON (участники) ──
  {
    username: "petrov_nik", email: "petrov@mail.ru", type: "COMMON",
    firstName: "Николай", lastName: "Петров", nick: "petrov_nik",
    region: "г. Москва", roles: ["DESIGNER", "TENDER_SPECIALIST"], balance: 12,
  },
  {
    username: "sidorova_anna", email: "sidorova@mail.ru", type: "COMMON",
    firstName: "Анна", lastName: "Сидорова", nick: "sidorova_anna",
    region: "Республика Татарстан", roles: ["PRODUCTOLOGIST"], balance: 8,
  },
  {
    username: "ivanov_mike", email: "ivanov@tech.ru", type: "COMMON",
    firstName: "Михаил", lastName: "Иванов", nick: "ivanov_mike",
    region: "Свердловская область", roles: ["DESIGNER", "COMPANY_OWNER"], balance: 5,
  },
  {
    username: "smirnov_pro", email: "smirnov@pro.ru", type: "COMMON",
    firstName: "Андрей", lastName: "Смирнов", nick: "smirnov_andrey",
    region: "Новосибирская область", roles: ["TENDER_SPECIALIST", "COMPANY_OWNER"], balance: 15,
  },
  // ── COMPANY ──
  {
    username: "stroy_boss", email: "boss@stroytech.ru", type: "COMPANY",
    firstName: "Алексей", lastName: "Громов", nick: "gromov_stroy",
    region: "г. Москва,Московская область", inn: "7707083893", companyName: "ООО «СтройТехнологии»", balance: 25,
  },
  {
    username: "keram_facade", email: "info@keramfacade.ru", type: "COMPANY",
    firstName: "Сергей", lastName: "Кузнецов", nick: "keram_servis",
    region: "г. Москва", inn: "7723456687", companyName: "ООО «КерамФасад»", balance: 40,
  },
  {
    username: "ural_steel", email: "sales@uralsteel.ru", type: "COMPANY",
    firstName: "Павел", lastName: "Морозов", nick: "ural_steel",
    region: "Свердловская область", inn: "6677463237", companyName: "ООО «УралКрепСтрой»", balance: 15,
  },
  {
    username: "steel_doors", email: "info@steeldoors.ru", type: "COMPANY",
    firstName: "Игорь", lastName: "Стальной", nick: "steel_doors",
    region: "Новосибирская область", inn: "5407456678", companyName: "ООО «СтальДверь»", balance: 20,
  },
  {
    username: "rem_facade", email: "rem@facade-spb.ru", type: "COMPANY",
    firstName: "Ольга", lastName: "Невская", nick: "rem_facade_spb",
    region: "Все регионы", inn: "7812457788", companyName: "ООО «РемФасад СПБ»", balance: 18,
  },
  {
    username: "arch_moscow", email: "arch@arhmos.ru", type: "COMPANY",
    firstName: "Елена", lastName: "Ветрова", nick: "arch_moscow",
    region: "г. Москва", inn: "7723474340", companyName: "ООО «АрхФасад»", balance: 35,
  },
];

/** Категории классификатора (пути) для компаний */
const COMPANY_CLASSIFIER_PATHS: Record<string, string[]> = {
  stroy_boss: ["4.1.2.2.3", "4.1.2.2.1.1"],
  keram_facade: ["4.1.3.1.2.2.1", "4.1.3.1.2.1"],
  ural_steel: ["3.2.2.2"],
  steel_doors: ["4.1.7.4", "4.1.7.1"],
  rem_facade: ["4.1.3.1.2.2"],
  arch_moscow: ["4.1.3.1.3", "4.1.3.1.3.1"],
};

/** Компания без владельца — добавлена участником */
const EXTRA_COMPANY = {
  inn: "7723457793",
  name: "ООО «НовСтрой»",
  email: "novstroy@mail.ru",
  phone: "+7 (495) 123-45-68",
  region: "г. Москва",
  addedBy: "petrov_nik",
  classifierPaths: ["4.1.3.1", "4.5"],
};

/** Товары для матрицы: компания + путь категории из классификатора */
const PRODUCTS: {
  company: string;
  treePath: string;
  name: string;
  classes: string[];
  region: string;
  unit: string;
  price: number;
  characteristics: string[];
}[] = [
  {
    company: "stroy_boss", treePath: "4.1.2.2.3",
    name: "Газобетонный блок D500 600x300x200",
    classes: ["STANDARD", "COMFORT"], region: "г. Москва,Московская область", unit: "шт", price: 180,
    characteristics: ["Плотность: D500", "Размер: 600x300x200 мм", "Прочность: B3.5"],
  },
  {
    company: "keram_facade", treePath: "4.1.3.1.2.2.1",
    name: "Клинкерная плитка KeramPro 250x65",
    classes: ["COMFORT", "BUSINESS"], region: "г. Москва", unit: "м²", price: 2300,
    characteristics: ["Размер: 250x65 мм", "Морозостойкость: F100"],
  },
  {
    company: "ural_steel", treePath: "3.2.2.2",
    name: "Балка двутавровая 20Б1 С245",
    classes: ["STANDARD", "COMFORT"], region: "Все регионы", unit: "т", price: 68000,
    characteristics: ["Профиль: 20Б1", "Сталь: С245", "Длина: 12 м"],
  },
  {
    company: "steel_doors", treePath: "4.1.7.4",
    name: "Дверь входная Стальная-Премиум",
    classes: ["COMFORT", "BUSINESS"], region: "Новосибирская область", unit: "шт", price: 45000,
    characteristics: ["Толщина металла: 1.5 мм", "Замки: 3 класса", "Утепление: минвата"],
  },
  {
    company: "arch_moscow", treePath: "4.1.3.1.3.1",
    name: "Плитка бетонная ArchStone 400x400",
    classes: ["BUSINESS", "PREMIUM"], region: "г. Москва", unit: "м²", price: 4200,
    characteristics: ["Размер: 400x400 мм", "Толщина: 20 мм", "Ручная работа"],
  },
];

interface ReviewSeed {
  author: string;
  target: string;
  /** Компания, о которой отзыв (если отзыв на компанию) */
  company?: string;
  scores: number[];
  comment: string;
}

const REVIEWS: ReviewSeed[] = [
  { author: "petrov_nik", target: "keram_facade", company: "keram_facade", scores: [5, 4, 5, 4, 4, 5, 4, 4, 5], comment: "Отличное качество клинкерной плитки! Работали с КерамФасадом на объекте ЖК «Солнечный» — поставка точно в срок, материал высокого качества. Менеджеры всегда на связи, оперативно решают вопросы. Рекомендую к сотрудничеству." },
  { author: "sidorova_anna", target: "keram_facade", company: "keram_facade", scores: [4, 5, 4, 4, 5, 4, 5, 4, 4], comment: "Хорошая компания, качественная продукция. Единственный минус — иногда задерживают отгрузку на 1-2 дня, но в целом работаем стабильно. Цены рыночные, качество соответствует заявленному." },
  { author: "ivanov_mike", target: "rem_facade", company: "rem_facade", scores: [5, 5, 5, 5, 5, 5, 5, 5, 5], comment: "Лучший поставщик клинкера в СПб! Работаем с ними уже 3 года на разных объектах. Качество всегда на высоте, логистика отлажена, цены конкурентные. Особая благодарность менеджеру Ольге за профессионализм!" },
  { author: "smirnov_pro", target: "ural_steel", company: "ural_steel", scores: [4, 4, 3, 4, 4, 4, 3, 5, 3], comment: "Неплохой поставщик металлопроката. Качество стали хорошее, но один раз была задержка поставки на неделю. Цены средние по рынку, но для крупных заказов дают хорошие скидки. Работаем дальше." },
  { author: "petrov_nik", target: "stroy_boss", company: "stroy_boss", scores: [5, 4, 5, 4, 5, 4, 4, 4, 5], comment: "СтройТехнологии — надёжный партнёр по строительным материалам. Газобетонные блоки всегда в наличии, качество стабильное. Доставка по Москве и области без задержек. Рекомендую." },
  { author: "sidorova_anna", target: "steel_doors", company: "steel_doors", scores: [4, 4, 4, 4, 3, 4, 4, 5, 4], comment: "Двери хорошего качества, установили в подъездах ЖК «Весенний». Монтаж выполнен в срок, двери надёжные. По цене — чуть выше среднего, но качество оправдывает. Продолжаем сотрудничество." },
  { author: "ivanov_mike", target: "arch_moscow", company: "arch_moscow", scores: [5, 5, 5, 4, 5, 5, 5, 5, 5], comment: "Великолепная бетонная плитка ручной работы! Использовали в интерьере общественных зон премиум-класса. Результат превзошёл ожидания. Команда АрхФасад — настоящие профессионалы своего дела." },
  { author: "smirnov_pro", target: "petrov_nik", scores: [5, 5, 5, 5, 5, 5, 5, 5, 5], comment: "Николай — отличный проектировщик! Разработал проект фасада для нашего объекта в сжатые сроки и с высоким качеством. Всегда на связи, учитывает все пожелания. Настоящий профессионал." },
  { author: "stroy_boss", target: "petrov_nik", scores: [5, 4, 5, 5, 4, 5, 5, 5, 5], comment: "Хороший специалист, работали вместе над несколькими проектами. Качественно готовит проектную документацию, соблюдает сроки. Рекомендую как надёжного проектировщика для строительных проектов." },
  { author: "keram_facade", target: "sidorova_anna", scores: [5, 5, 5, 5, 5, 5, 5, 5, 4], comment: "Анна — грамотный продуктолог. Отлично разбирается в строительных материалах, помогает с подбором оптимальных решений для проектов. Всегда приятно работать с профессионалом такого уровня." },
];

const LIBRARY_DOCS: { author: string; title: string; treePath: string; coinPrice: number; fileUrl: string; fileSize: number; approved: boolean }[] = [
  { author: "petrov_nik", title: "ТЗ на устройство вентилируемого фасада", treePath: "4.1.3.1.2", coinPrice: 10, fileUrl: "https://docs.google.com/facade-tz-1", fileSize: 2500000, approved: true },
  { author: "sidorova_anna", title: "Спецификация отделочных материалов ЖК «Солнечный»", treePath: "4.5", coinPrice: 15, fileUrl: "https://docs.google.com/finishing-spec", fileSize: 4200000, approved: true },
  { author: "ivanov_mike", title: "Техническое задание на монтаж оконных конструкций", treePath: "4.1.6.1", coinPrice: 8, fileUrl: "https://docs.google.com/windows-tz", fileSize: 1800000, approved: true },
  { author: "smirnov_pro", title: "Стандарт организации: входные группы МОП", treePath: "4.1.7.1", coinPrice: 12, fileUrl: "https://docs.google.com/entrance-standard", fileSize: 3100000, approved: true },
  { author: "stroy_boss", title: "Каталог газобетонных блоков StroyTech", treePath: "4.1.2.2.3", coinPrice: 5, fileUrl: "https://docs.google.com/gasblock-catalog", fileSize: 5600000, approved: true },
  { author: "keram_facade", title: "Инструкция по монтажу клинкерной плитки KeramPro", treePath: "4.1.3.1.2.2.1", coinPrice: 5, fileUrl: "https://docs.google.com/kerampro-montage", fileSize: 4800000, approved: true },
  { author: "ural_steel", title: "Сортамент металлопроката УралКрепСтрой", treePath: "3.2.2.2", coinPrice: 5, fileUrl: "https://docs.google.com/ural-steel-sort", fileSize: 7100000, approved: true },
  { author: "arch_moscow", title: "Альбом фасадных решений ArchStone 2026", treePath: "4.1.3.1.3", coinPrice: 20, fileUrl: "https://docs.google.com/archstone-album", fileSize: 8900000, approved: true },
  { author: "editor_content", title: "ГОСТ Р 56707-2025 Системы фасадные", treePath: "4.1.3.1", coinPrice: 15, fileUrl: "https://docs.google.com/gost-56707", fileSize: 3200000, approved: true },
];

const CONFERENCES: { organizer: string; title: string; daysFromNow: number; time: string; description: string; treePath: string; coinPrice: number; status: string }[] = [
  { organizer: "keram_facade", title: "Современные фасадные решения в девелопменте", daysFromNow: 7, time: "11:00", description: "Обзор современных фасадных материалов и технологий. Сравнение клинкера, керамогранита и бетонных панелей. Практические кейсы ЖК бизнес-класса.", treePath: "4.1.3.1", coinPrice: 5, status: "APPROVED" },
  { organizer: "stroy_boss", title: "Газобетон vs Кирпич: выбор материалов для строительства", daysFromNow: 14, time: "10:00", description: "Сравнительный анализ стеновых материалов. Экономика строительства, теплотехника, скорость возведения.", treePath: "4.1.2.2.3", coinPrice: 0, status: "APPROVED" },
  { organizer: "ural_steel", title: "Металлоконструкции в современном строительстве", daysFromNow: 21, time: "14:00", description: "Применение стальных конструкций в жилом и коммерческом строительстве. Преимущества, нормативная база, примеры проектов.", treePath: "3.2.2.2", coinPrice: 3, status: "APPROVED" },
  { organizer: "arch_moscow", title: "Архитектурный бетон в интерьере общественных пространств", daysFromNow: 5, time: "12:00", description: "Тренды в оформлении общественных зон ЖК. Бетонные панели, малые формы, освещение.", treePath: "4.5.1.5", coinPrice: 5, status: "APPROVED" },
  { organizer: "steel_doors", title: "Противопожарные двери: нормативы и подбор", daysFromNow: 30, time: "11:00", description: "Обзор требований пожарной безопасности к дверным конструкциям в жилых и общественных зданиях.", treePath: "4.1.7.4", coinPrice: 2, status: "PENDING" },
  { organizer: "editor_content", title: "ГОСТ Р 21.101-2026: новые требования к проектной документации", daysFromNow: -3, time: "10:00", description: "Разбор ключевых изменений в ГОСТ Р 21.101-2026. Влияние на проектирование стадий П и РД.", treePath: "2.13.16", coinPrice: 0, status: "APPROVED" },
  { organizer: "rem_facade", title: "Особенности фасадных работ в условиях СЗФО", daysFromNow: 10, time: "15:00", description: "Климатические особенности Северо-Запада и их влияние на выбор фасадных систем и материалов.", treePath: "4.1.3.1", coinPrice: 0, status: "PENDING" },
];

const POLLS: { question: string; pollType: string; coinReward: number; treePath: string | null; options: string[]; votes: number[] }[] = [
  {
    question: "Какой класс жилья наиболее востребован в вашем регионе?",
    pollType: "MULTIPLE", coinReward: 0.2, treePath: "2.2",
    options: ["Стандарт", "Комфорт", "Бизнес", "Премиум"], votes: [3, 5, 2, 0],
  },
  {
    question: "Используете ли вы BIM-моделирование в проектах?",
    pollType: "DICHOTOMOUS", coinReward: 0.1, treePath: "2.3",
    options: ["Да, используем BIM", "Нет, не используем"], votes: [5, 4],
  },
  {
    question: "Какой фасадный материал предпочитаете для ЖК бизнес-класса?",
    pollType: "MULTIPLE", coinReward: 0.2, treePath: "4.1.3.1",
    options: ["Керамогранит", "Клинкер", "Фиброцемент", "Бетонные панели"], votes: [5, 4, 1, 2],
  },
  {
    question: "Готовы ли вы делиться техническими заданиями в библиотеке платформы?",
    pollType: "DICHOTOMOUS", coinReward: 0.15, treePath: null,
    options: ["Да, готов делиться", "Нет, пока не готов"], votes: [6, 4],
  },
  {
    question: "Что важнее при выборе поставщика?",
    pollType: "MULTIPLE", coinReward: 0.1, treePath: null,
    options: ["Цена", "Качество", "Сроки поставки", "Репутация и отзывы"], votes: [4, 6, 3, 5],
  },
];

const GIFTS = [
  { name: "Фирменный блокнот ЕНЦПР", coinPrice: 5, limit: 50 },
  { name: "Термокружка с логотипом", coinPrice: 10, limit: 30 },
  { name: "Power Bank 10000 mAh", coinPrice: 20, limit: 15 },
  { name: "Сертификат OZON 1000 ₽", coinPrice: 15, limit: 20 },
  { name: "Книга «Строительство будущего»", coinPrice: 8, limit: 25 },
];

async function main() {
  console.log("🌱 Seeding database...\n");

  // ── 0. Очистка демо-контента (сид идемпотентен) ──
  await prisma.transaction.deleteMany();
  await prisma.pollVote.deleteMany();
  await prisma.pollOption.deleteMany();
  await prisma.poll.deleteMany();
  await prisma.giftClaim.deleteMany();
  await prisma.gift.deleteMany();
  await prisma.documentPurchase.deleteMany();
  await prisma.libraryDocument.deleteMany();
  await prisma.conferenceParticipant.deleteMany();
  await prisma.conference.deleteMany();
  await prisma.reviewCriteria.deleteMany();
  await prisma.review.deleteMany();
  await prisma.supportTicket.deleteMany();
  await prisma.product.deleteMany();

  // ── 1. Регионы (1:1 из «регионы.pdf») ──
  await prisma.region.deleteMany();
  const regionNames = REGIONS.filter((r) => r !== "Все регионы");
  for (let i = 0; i < regionNames.length; i++) {
    await prisma.region.create({ data: { name: regionNames[i], sortOrder: i } });
  }
  console.log(`  ✅ Регионы: ${regionNames.length}`);

  // ── 2. Продуктовое дерево (1:1 из «продуктовое дерево.pdf») ──
  await prisma.productTreeItem.deleteMany();

  const treeIdMap = new Map<string, string>();
  for (const node of CLASSIFIER_NODES) {
    // Родитель — ближайший существующий префикс номера
    // (в PDF дважды пропущен уровень нумерации, переносим как есть)
    const parts = node.num.split(".");
    let parentId: string | null = null;
    for (let len = parts.length - 1; len >= 1; len--) {
      const candidate = parts.slice(0, len).join(".");
      const found = treeIdMap.get(candidate);
      if (found) {
        parentId = found;
        break;
      }
    }

    const created = await prisma.productTreeItem.create({
      data: {
        name: node.name,
        description: node.description || null,
        parentId,
        inBranchNumber: parseInt(parts[parts.length - 1], 10),
        fullNumberPath: node.num,
      },
    });
    treeIdMap.set(node.num, created.id);
  }
  console.log(`  ✅ Классификатор: ${CLASSIFIER_NODES.length} узлов`);

  const pathToId = (path: string) => treeIdMap.get(path) ?? null;

  // ── 3. Пользователи всех ролей ──
  const pwdHash = await argon2.hash(PASSWORD);
  const userIdMap = new Map<string, string>();
  const userObjects: { id: string; username: string; balance: number }[] = [];

  for (const u of USERS) {
    const user = await prisma.user.upsert({
      where: { username: u.username },
      update: {},
      create: {
        username: u.username,
        pwdHash,
        email: u.email,
        status: "ACTIVE",
        type: u.type,
        profile: {
          create: {
            firstName: u.firstName,
            lastName: u.lastName,
            nick: u.nick,
            regions: u.region,
            inn: u.inn || null,
            companyName: u.companyName || null,
            roles: u.roles ? { create: u.roles.map((r) => ({ role: r })) } : undefined,
          },
        },
        serviceFields: { create: { isEmailVerified: true } },
        wallet: { create: { balance: u.balance } },
        ...(u.adminType
          ? {
              admin: {
                create: {
                  adminType: u.adminType,
                  permissions: JSON.stringify({
                    all: u.adminType === "ROOT" || u.adminType === "SUPER",
                  }),
                },
              },
            }
          : {}),
      },
    });
    userIdMap.set(u.username, user.id);
    userObjects.push({ id: user.id, username: u.username, balance: u.balance });
  }
  console.log(`  ✅ Пользователи: ${USERS.length} (пароль: ${PASSWORD})`);

  // ── 4. Компании владельцев ──
  const companyIdMap = new Map<string, string>();
  for (const u of USERS.filter((x) => x.type === "COMPANY")) {
    const classifierIds = (COMPANY_CLASSIFIER_PATHS[u.username] || [])
      .map(pathToId)
      .filter((id): id is string => !!id)
      .join(",");

    const company = await prisma.company.upsert({
      where: { inn: u.inn! },
      update: {
        name: u.companyName!,
        email: u.email,
        regions: u.region,
        ownerUserId: userIdMap.get(u.username)!,
        classifierIds,
      },
      create: {
        inn: u.inn!,
        name: u.companyName!,
        email: u.email,
        regions: u.region,
        ownerUserId: userIdMap.get(u.username)!,
        classifierIds,
        metrics: {
          create: {
            phoneViews: Math.floor(Math.random() * 50) + 5,
            emailViews: Math.floor(Math.random() * 30) + 3,
            websiteViews: Math.floor(Math.random() * 20) + 2,
            reviewsViews: Math.floor(Math.random() * 40) + 5,
            ratingViews: Math.floor(Math.random() * 35) + 5,
          },
        },
      },
    });
    companyIdMap.set(u.username, company.id);
  }
  console.log(`  ✅ Компании: ${companyIdMap.size}`);

  // ── 5. Компания без владельца (добавлена участником) ──
  await prisma.company.upsert({
    where: { inn: EXTRA_COMPANY.inn },
    update: {},
    create: {
      inn: EXTRA_COMPANY.inn,
      name: EXTRA_COMPANY.name,
      email: EXTRA_COMPANY.email,
      phone: EXTRA_COMPANY.phone,
      regions: EXTRA_COMPANY.region,
      addedById: userIdMap.get(EXTRA_COMPANY.addedBy)!,
      classifierIds: EXTRA_COMPANY.classifierPaths.map(pathToId).filter((id): id is string => !!id).join(","),
      metrics: { create: { phoneViews: 8, emailViews: 4 } },
    },
  });
  console.log(`  ✅ Доп. компания: ${EXTRA_COMPANY.name}`);

  // ── Демо-тарифы биллинга компаний (индивидуальные ставки, ₽) ──
  const DEMO_RATES: Record<string, Record<string, number>> = {
    stroy_boss: { maintenanceFee: 1500, phonePrice: 50, emailPrice: 30, websitePrice: 20, monthlyCap: 5000 },
    keram_facade: { maintenanceFee: 800, phonePrice: 30, emailPrice: 20, websitePrice: 15, monthlyCap: 3000 },
    ural_steel: { maintenanceFee: 2000, phonePrice: 80, emailPrice: 40, websitePrice: 30, monthlyCap: 8000 },
  };
  for (const [username, rates] of Object.entries(DEMO_RATES)) {
    const cid = companyIdMap.get(username);
    if (!cid) continue;
    await prisma.companyBilling.upsert({
      where: { companyId: cid },
      update: { ...rates, status: "ACTIVE", billingStartedAt: new Date(), billedThrough: null, hiddenReason: null },
      create: { companyId: cid, ...rates, status: "ACTIVE", billingStartedAt: new Date() },
    });
  }
  console.log(`  ✅ Тарифы биллинга: ${Object.keys(DEMO_RATES).length} компании`);

  // ── 6. Товары ──
  for (const p of PRODUCTS) {
    const companyId = companyIdMap.get(p.company);
    const treeItemId = pathToId(p.treePath);
    if (!companyId || !treeItemId) {
      console.warn(`  ⚠️ Пропущен товар «${p.name}»: нет компании/категории`);
      continue;
    }
    await prisma.product.create({
      data: {
        companyId,
        treeItemId,
        ownerUserId: userIdMap.get(p.company) ?? null,
        name: p.name,
        classes: JSON.stringify(p.classes),
        regions: p.region,
        unit: p.unit,
        characteristics: JSON.stringify(p.characteristics),
        price: p.price,
        views: Math.floor(Math.random() * 30) + 5,
      },
    });
  }
  console.log(`  ✅ Товары: ${PRODUCTS.length}`);

  // ── 7. Отзывы ──
  for (const r of REVIEWS) {
    const authorId = userIdMap.get(r.author)!;
    const targetId = userIdMap.get(r.target)!;
    const companyId = r.company ? companyIdMap.get(r.company) ?? null : null;
    const avg = r.scores.reduce((a, b) => a + b, 0) / r.scores.length;
    await prisma.review.create({
      data: {
        authorId,
        targetId,
        companyId,
        comment: r.comment,
        signatureType: "nick",
        weightedAverage: avg,
        criteria: {
          create: r.scores.map((score, i) => ({ criteriaIndex: i + 1, score })),
        },
      },
    });
  }
  console.log(`  ✅ Отзывы: ${REVIEWS.length}`);

  // ── 8. Библиотека документов ──
  for (const d of LIBRARY_DOCS) {
    await prisma.libraryDocument.create({
      data: {
        userId: userIdMap.get(d.author)!,
        treeItemId: pathToId(d.treePath),
        title: d.title,
        coinPrice: d.coinPrice,
        fileUrl: d.fileUrl,
        fileSize: d.fileSize,
        isApproved: d.approved,
        views: Math.floor(Math.random() * 80) + 10,
        purchasesCount: Math.floor(Math.random() * 12) + 1,
      },
    });
  }
  console.log(`  ✅ Библиотека: ${LIBRARY_DOCS.length} документов`);

  // ── 9. Конференции ──
  const now = Date.now();
  for (const c of CONFERENCES) {
    const organizerId = userIdMap.get(c.organizer)!;
    const conf = await prisma.conference.create({
      data: {
        organizerId,
        title: c.title,
        date: new Date(now + c.daysFromNow * 86400000),
        time: c.time,
        description: c.description,
        treeItemId: pathToId(c.treePath),
        coinPrice: c.coinPrice,
        status: c.status,
        connectionLink: "https://zoom.us/j/123456789",
        views: Math.floor(Math.random() * 60) + 5,
      },
    });

    // Несколько участников
    const participantCount = Math.floor(Math.random() * 4) + 1;
    const shuffled = [...userObjects].sort(() => Math.random() - 0.5).slice(0, participantCount);
    for (const p of shuffled) {
      if (p.id !== organizerId) {
        await prisma.conferenceParticipant
          .create({ data: { conferenceId: conf.id, userId: p.id } })
          .catch(() => {}); // дубли игнорируем
      }
    }
  }
  console.log(`  ✅ Конференции: ${CONFERENCES.length}`);

  // ── 10. Опросы и голоса ──
  const allUserIds = Array.from(userIdMap.values());
  for (const p of POLLS) {
    const poll = await prisma.poll.create({
      data: {
        question: p.question,
        pollType: p.pollType,
        coinReward: p.coinReward,
        treeItemId: p.treePath ? pathToId(p.treePath) : null,
        isActive: true,
        options: { create: p.options.map((text, i) => ({ text, sortOrder: i })) },
      },
    });

    const withOptions = await prisma.poll.findUnique({ where: { id: poll.id }, include: { options: true } });
    if (!withOptions) continue;

    // Голоса: неповторяющиеся пользователи на каждый вариант
    const voters = [...allUserIds].sort(() => Math.random() - 0.5);
    let cursor = 0;
    for (let i = 0; i < withOptions.options.length; i++) {
      const optionId = withOptions.options[i].id;
      const count = p.votes[i] || 0;
      for (let v = 0; v < count; v++) {
        const voter = voters[cursor % voters.length];
        cursor += 1;
        await prisma.pollVote
          .create({ data: { pollId: poll.id, optionId, userId: voter } })
          .catch(() => {});
      }
    }
  }
  console.log(`  ✅ Опросы: ${POLLS.length} с голосами`);

  // ── 11. Подарки ──
  for (const g of GIFTS) {
    await prisma.gift.create({ data: g });
  }
  console.log(`  ✅ Подарки: ${GIFTS.length}`);

  // ── 12. Транзакции ──
  const txTypes = ["ADD_COMPANY", "REVIEW", "POLL_VOTE", "DOCUMENT_PURCHASE", "GIFT_SEND", "MODERATOR_ADD"];
  for (let i = 0; i < 25; i++) {
    const user = userObjects[Math.floor(Math.random() * userObjects.length)];
    const txType = txTypes[Math.floor(Math.random() * txTypes.length)];
    const amount =
      txType === "MODERATOR_ADD" ? Math.floor(Math.random() * 20) + 1
      : txType === "GIFT_SEND" ? -(Math.floor(Math.random() * 5) + 1)
      : txType === "DOCUMENT_PURCHASE" ? -(Math.floor(Math.random() * 15) + 5)
      : Math.random() < 0.5 ? 0.1 : 1;

    await prisma.transaction.create({
      data: {
        userId: user.id,
        type: txType,
        amount,
        balanceAfter: (user.balance || 0) + amount,
        description: `Тестовая транзакция #${i + 1}`,
        createdAt: new Date(Date.now() - Math.floor(Math.random() * 30) * 86400000),
      },
    });
  }
  console.log("  ✅ Транзакции: 25");

  // ── 13. Поддержка ──
  await prisma.supportTicket.create({
    data: {
      userId: userIdMap.get("petrov_nik")!,
      email: "petrov@mail.ru",
      subject: "Вопрос по загрузке документа",
      message: "Не могу загрузить PDF-файл в библиотеку, появляется ошибка «файл слишком большой». Размер файла 8 МБ.",
      isResolved: false,
    },
  });
  await prisma.supportTicket.create({
    data: {
      email: "newuser@gmail.com",
      subject: "Хочу зарегистрировать компанию",
      message: "Здравствуйте! Подскажите, как зарегистрировать компанию на платформе? Наш ИНН 7708123456.",
      isResolved: true,
    },
  });
  console.log("  ✅ Обращения в поддержку: 2");

  // ── 14. Конфигурация биллинга ──
  await prisma.billingConfig.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      coinPriceRub: 100,
      addCompanyCoins: 1,
      reviewCoins: 1,
    },
  });
  console.log("  ✅ Billing config");

  console.log("\n🎉 Seed completed!\n");
  console.log("  Учётные данные (пароль везде: 12345678):");
  console.log("  ───────────────────────────────────────");
  for (const u of USERS) {
    const label =
      u.type === "COMPANY" ? `компания «${u.companyName}»`
      : u.type === "ROOT" ? "владелец платформы"
      : u.type === "SUPER" ? "суперадмин"
      : u.type === "EDITOR" ? "редактор"
      : u.type === "MODERATOR" ? "модератор"
      : `участник${u.roles ? ` (${u.roles.join(", ")})` : ""}`;
    console.log(`  ${u.username.padEnd(20)} — ${label}`);
  }
  console.log("\n  Статистика:");
  console.log(`  • ${USERS.length} пользователей, ${companyIdMap.size + 1} компаний`);
  console.log(`  • ${CLASSIFIER_NODES.length} узлов классификатора, ${regionNames.length} регионов`);
  console.log(`  • ${PRODUCTS.length} товаров, ${REVIEWS.length} отзывов, ${LIBRARY_DOCS.length} документов`);
  console.log(`  • ${CONFERENCES.length} конференций, ${POLLS.length} опросов, ${GIFTS.length} подарков, 25 транзакций\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
