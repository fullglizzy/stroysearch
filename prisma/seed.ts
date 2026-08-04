import { PrismaClient } from "@prisma/client";
import * as argon2 from "@node-rs/argon2";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // ── Создание root-администратора ──
  const rootPwdHash = await argon2.hash("admin123");
  const root = await prisma.user.upsert({
    where: { username: "root" },
    update: {},
    create: {
      username: "root",
      pwdHash: rootPwdHash,
      email: "root@ecpr.ru",
      status: "ACTIVE",
      type: "ROOT",
      profile: {
        create: {
          firstName: "Кирилл",
          lastName: "Кокорев",
          nick: "root",
        },
      },
      serviceFields: {
        create: {
          isEmailVerified: true,
        },
      },
      admin: {
        create: {
          adminType: "ROOT",
          permissions: JSON.stringify({ all: true }),
        },
      },
      wallet: {
        create: {
          balance: 0,
        },
      },
    },
  });
  console.log(`  ✅ Root admin: ${root.username}`);

  // ── Создание модератора ──
  const modPwdHash = await argon2.hash("moderator123");
  const moderator = await prisma.user.upsert({
    where: { username: "moderator" },
    update: {},
    create: {
      username: "moderator",
      pwdHash: modPwdHash,
      email: "moderator@ecpr.ru",
      status: "ACTIVE",
      type: "MODERATOR",
      profile: {
        create: {
          firstName: "Модератор",
          nick: "moderator",
        },
      },
      serviceFields: {
        create: {
          isEmailVerified: true,
        },
      },
      admin: {
        create: {
          adminType: "MODERATOR",
          permissions: JSON.stringify({ content: true, conferences: true, library: true }),
        },
      },
      wallet: {
        create: {
          balance: 0,
        },
      },
    },
  });
  console.log(`  ✅ Moderator: ${moderator.username}`);

  // ── Корневые категории продуктового дерева ──
  const rootCategories = [
    "Работы пред-подготовительного периода разработки проекта",
    "Предпроектная подготовка",
    "Конструктив",
    "Фасад",
    "Светопрозрачные конструкции, окна и витражное остекление",
    "Двери",
    "Инженерные коммуникации",
    "Вентиляция и кондиционирование",
    "Электроснабжение",
    "Слаботочные сети",
    "Подъемные механизмы и оборудование",
    "Благоустройство",
    "Отделочные работы и материалы",
    "Навигация в помещениях",
    "Сантехнические приборы",
    "Моечные станции, автомойка",
    "Интерьер общественных пространств",
    "Уборка и клининг",
    "Подготовка маркетинговых материалов",
  ];

  // Delete existing tree items first (to avoid unique constraint issues with SQLite)
  await prisma.productTreeItem.deleteMany();

  for (let i = 0; i < rootCategories.length; i++) {
    const num = i + 1;
    await prisma.productTreeItem.create({
      data: {
        name: rootCategories[i],
        parentId: null,
        inBranchNumber: num,
        fullNumberPath: String(num),
        description: null,
      },
    });
  }
  console.log(`  ✅ ${rootCategories.length} root product categories`);

  // ── Базовое наполнение контентом страниц ──
  const pagesContent: { pageKey: string; content: string }[] = [
    {
      pageKey: "home",
      content: `<h2>Добро пожаловать на платформу ЕЦПР</h2>
<p><strong>Единый независимый центр продуктовых решений, закупок и технических заданий строительной отрасли</strong> — это открытая независимая платформа, где каждый специалист от инженера до руководителя сможет найти актуальные решения, поделиться опытом, сформировать технические задания, оптимизировать процессы закупок и презентовать свой продукт.</p>
<p>Наша миссия — укрепить российский рынок строительства, повысить конкурентоспособность отечественных компаний, создать независимое пространство для инженеров, специалистов по закупкам, поставщиков и собственников компаний.</p>
<p><em>Основатель платформы — Кокорев Кирилл Владимирович</em></p>`,
    },
    {
      pageKey: "products",
      content: `<h2>Продуктовые решения</h2>
<p>Иерархический классификатор строительных продуктов, материалов и услуг. Выберите интересующую категорию, чтобы найти товары, документы и конференции по данной тематике.</p>`,
    },
    {
      pageKey: "suppliers",
      content: `<h2>База поставщиков и заказчиков</h2>
<p>Актуальная база компаний и специалистов строительной отрасли. Контакты открываются по клику — каждый просмотр фиксируется в метрике компании.</p>`,
    },
    {
      pageKey: "matrix",
      content: `<h2>Даешь аналог! Матрица материалов</h2>
<p>Конкурентная таблица товаров. Сравнивайте аналоги разных производителей по цене, характеристикам и классу.</p>`,
    },
    {
      pageKey: "library",
      content: `<h2>Библиотека технических заданий</h2>
<p>База документов: технические задания, спецификации, инструкции. Загружайте свои документы и приобретайте документы коллег за монеты.</p>`,
    },
    {
      pageKey: "conferences",
      content: `<h2>Конференции</h2>
<p>Отраслевые конференции, вебинары и лекции. Презентуйте свой продукт, делитесь опытом, участвуйте в обсуждениях.</p>`,
    },
    {
      pageKey: "polls",
      content: `<h2>Статистика и опросы</h2>
<p>Голосуйте в отраслевых опросах, получайте монеты за участие и смотрите статистику по профилям деятельности.</p>`,
    },
    {
      pageKey: "account",
      content: `<h2>Личный кабинет участника</h2>
<p>Управляйте своим профилем, финансами, отзывами, конференциями и документами.</p>`,
    },
    {
      pageKey: "company",
      content: `<h2>Личный кабинет компании</h2>
<p>Управляйте профилем компании, товарами и услугами, финансами, отзывами и конференциями.</p>`,
    },
    {
      pageKey: "admin",
      content: `<h2>Панель управления</h2>
<p>Управление контентом платформы, пользователями, модерация конференций и библиотеки, биллинг и финансы.</p>`,
    },
  ];

  for (const page of pagesContent) {
    await prisma.pageContent.upsert({
      where: { pageKey: page.pageKey },
      update: { content: page.content },
      create: page,
    });
  }
  console.log(`  ✅ ${pagesContent.length} page contents`);

  // ── Конфигурация биллинга ──
  await prisma.billingConfig.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      coinPriceRub: 100,
      viewPriceRub: 100,
      addCompanyCoins: 1,
      reviewCoins: 1,
      maxMonthlyLimit: 1000,
    },
  });
  console.log("  ✅ Billing config");

  // ── Тестовый участник ──
  const userPwdHash = await argon2.hash("user123");
  const testUser = await prisma.user.upsert({
    where: { username: "user" },
    update: {},
    create: {
      username: "user",
      pwdHash: userPwdHash,
      email: "user@ecpr.ru",
      status: "ACTIVE",
      type: "COMMON",
      profile: {
        create: {
          firstName: "Иван",
          lastName: "Петров",
          nick: "user",
          region: "Москва",
        },
      },
      serviceFields: {
        create: { isEmailVerified: true },
      },
      wallet: {
        create: { balance: 5 },
      },
    },
  });
  console.log(`  ✅ Test user: ${testUser.username} (password: user123)`);

  // ── Тестовая компания ──
  const compPwdHash = await argon2.hash("company123");
  const testCompany = await prisma.user.upsert({
    where: { username: "company" },
    update: {},
    create: {
      username: "company",
      pwdHash: compPwdHash,
      email: "company@ecpr.ru",
      status: "ACTIVE",
      type: "COMPANY",
      profile: {
        create: {
          nick: "company",
          inn: "7707083893",
          companyName: "ООО «СтройИнновации»",
          region: "Москва",
        },
      },
      serviceFields: {
        create: { isEmailVerified: true },
      },
      wallet: {
        create: { balance: 10 },
      },
    },
  });
  console.log(`  ✅ Test company: ${testCompany.username} (password: company123)`);

  // ── Тестовая компания в реестре ──
  await prisma.company.upsert({
    where: { inn: "7707083893" },
    update: {},
    create: {
      inn: "7707083893",
      name: "ООО «СтройИнновации»",
      email: "company@ecpr.ru",
      phone: "+7 (495) 123-45-67",
      region: "Москва",
      ownerUserId: testCompany.id,
      metrics: { create: {} },
    },
  });

  console.log("🎉 Seed completed!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
