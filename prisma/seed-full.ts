// Полноценный seed со всеми тестовыми данными
// Запуск: npx tsx prisma/seed-full.ts

import { PrismaClient } from "@prisma/client";
import * as argon2 from "@node-rs/argon2";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Создание полноценного сида...\n");

  // Очистка (в правильном порядке для foreign keys)
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
  await prisma.product.deleteMany();
  await prisma.companyMetrics.deleteMany();
  await prisma.company.deleteMany();
  await prisma.productTreeItem.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.userProfileRole.deleteMany();
  await prisma.userProfile.deleteMany();
  await prisma.userServiceFields.deleteMany();
  await prisma.admin.deleteMany();
  await prisma.wallet.deleteMany();
  await prisma.supportTicket.deleteMany();
  await prisma.pageContent.deleteMany();
  await prisma.billingConfig.deleteMany();
  await prisma.user.deleteMany();
  console.log("  🧹 Очищено");

  // ═══════════════════════════════════════════
  // 1. BILLING CONFIG
  // ═══════════════════════════════════════════
  await prisma.billingConfig.create({
    data: {
      id: "default",
      coinPriceRub: 100,
      viewPriceRub: 100,
      addCompanyCoins: 1,
      reviewCoins: 1,
      maxMonthlyLimit: 1000,
      organizationName: "ООО «ЕЦПР»",
      organizationInn: "7700000001",
      organizationKpp: "770001001",
      organizationAddress: "г. Москва, ул. Строителей, д. 1",
      bankName: "ПАО Сбербанк",
      bankBik: "044525225",
      bankAccount: "40702810000000000001",
      bankCorrAccount: "30101810400000000225",
      directorName: "Кокорев Кирилл Владимирович",
      directorPhone: "+7 (495) 000-00-01",
      directorEmail: "info@ecpr.ru",
    },
  });
  console.log("  ✅ Billing config");

  // ═══════════════════════════════════════════
  // 2. PRODUCT TREE (упрощённый — полный классификатор запускается отдельно)
  // ═══════════════════════════════════════════
  const categories = [
    { path: "1", name: "Работы пред-подготовительного периода", children: [
      { path: "1.1", name: "Приобретение участка под строительство" },
      { path: "1.2", name: "Аренда участка под строительство" },
    ]},
    { path: "2", name: "Предпроектная подготовка", children: [
      { path: "2.1", name: "Разработка мастер-плана" },
      { path: "2.2", name: "Проектирование стадия «П»", children: [
        { path: "2.2.1", name: "АР (Архитектурные решения)" },
        { path: "2.2.2", name: "Согласование с городом" },
        { path: "2.2.3", name: "ТЗК экспертиза" },
      ]},
      { path: "2.3", name: "Проектирование стадия «РД»", children: [
        { path: "2.3.1", name: "Конструктивные решения (КР)" },
        { path: "2.3.2", name: "Конструкции металлические (КМ)" },
        { path: "2.3.3", name: "Конструкции железобетонные (КЖ)" },
        { path: "2.3.4", name: "Инженерное оборудование (ИОС)", children: [
          { path: "2.3.4.1", name: "ОВиК" },
          { path: "2.3.4.2", name: "Водоснабжение и канализация" },
          { path: "2.3.4.3", name: "Электроснабжение" },
          { path: "2.3.4.4", name: "Пожарная безопасность" },
        ]},
      ]},
    ]},
    { path: "3", name: "Конструктив", children: [
      { path: "3.1", name: "Фундаментные работы", children: [
        { path: "3.1.1", name: "Свайное основание" },
      ]},
      { path: "3.2", name: "Монолитные работы", children: [
        { path: "3.2.1", name: "Бетон" },
        { path: "3.2.2", name: "Арматура" },
      ]},
      { path: "3.3", name: "Стены наружные", children: [
        { path: "3.3.1", name: "Газобетонный блок" },
        { path: "3.3.2", name: "Кирпич" },
      ]},
      { path: "3.4", name: "Кровля" },
    ]},
    { path: "4", name: "Фасад", children: [
      { path: "4.1", name: "Облицовка фасада", children: [
        { path: "4.1.1", name: "Фасад мокрый" },
        { path: "4.1.2", name: "Фасад навесной вентилируемый", children: [
          { path: "4.1.2.1", name: "Фасад керамогранитный" },
          { path: "4.1.2.2", name: "Фасад клинкерный" },
          { path: "4.1.2.3", name: "Фасад бетонный" },
        ]},
      ]},
      { path: "4.2", name: "Декоративные элементы фасада" },
      { path: "4.3", name: "Освещение фасада" },
      { path: "4.4", name: "Козырьки" },
    ]},
    { path: "5", name: "Светопрозрачные конструкции и окна", children: [
      { path: "5.1", name: "Окна жилых помещений" },
      { path: "5.2", name: "Окна нежилых помещений (МОП)" },
    ]},
    { path: "6", name: "Двери", children: [
      { path: "6.1", name: "Двери входных групп" },
      { path: "6.2", name: "Двери тамбурные" },
      { path: "6.3", name: "Двери входные квартирные" },
      { path: "6.4", name: "Двери межкомнатные" },
    ]},
    { path: "7", name: "Инженерные коммуникации", children: [
      { path: "7.1", name: "Водоснабжение", children: [
        { path: "7.1.1", name: "Трубы водоснабжения" },
        { path: "7.1.2", name: "Счетчики" },
      ]},
      { path: "7.2", name: "Отопление", children: [
        { path: "7.2.1", name: "Батареи" },
        { path: "7.2.2", name: "Радиаторы" },
        { path: "7.2.3", name: "Конвекторы" },
        { path: "7.2.4", name: "Тепловые пункты" },
      ]},
    ]},
    { path: "8", name: "Вентиляция и кондиционирование", children: [
      { path: "8.1", name: "Вентиляция естественная" },
      { path: "8.2", name: "Вентиляция принудительная" },
      { path: "8.3", name: "Сплит-системы" },
    ]},
    { path: "9", name: "Электроснабжение", children: [
      { path: "9.1", name: "Кабель" },
      { path: "9.2", name: "Счетчики" },
      { path: "9.3", name: "Осветительные приборы" },
    ]},
    { path: "10", name: "Слаботочные сети", children: [
      { path: "10.1", name: "Домофония" },
      { path: "10.2", name: "Видеонаблюдение" },
      { path: "10.3", name: "Умный дом" },
    ]},
    { path: "11", name: "Благоустройство", children: [
      { path: "11.1", name: "Твёрдые покрытия" },
      { path: "11.2", name: "Малые архитектурные формы (МАФ)" },
      { path: "11.3", name: "Детское игровое оборудование" },
      { path: "11.4", name: "Наружное освещение" },
      { path: "11.5", name: "Озеленение" },
    ]},
    { path: "12", name: "Отделочные работы и материалы", children: [
      { path: "12.1", name: "Покрытия настенные" },
      { path: "12.2", name: "Покрытия напольные" },
      { path: "12.3", name: "Покрытия потолочные" },
    ]},
    { path: "13", name: "Интерьер общественных пространств", children: [
      { path: "13.1", name: "Мебель для зоны ожидания" },
      { path: "13.2", name: "Диваны модульные" },
    ]},
  ];

  const treeIdMap = new Map<string, string>();

  async function insertTree(items: typeof categories, parentId: string | null) {
    for (const item of items) {
      const parts = item.path.split(".");
      const inBranchNumber = parseInt(parts[parts.length - 1]);
      const created = await prisma.productTreeItem.create({
        data: {
          name: item.name,
          parentId,
          inBranchNumber,
          fullNumberPath: item.path,
        },
      });
      treeIdMap.set(item.path, created.id);
      if ("children" in item && item.children) {
        await insertTree(item.children, created.id);
      }
    }
  }

  await insertTree(categories, null);
  console.log(`  ✅ Product tree: ${treeIdMap.size} items`);

  // ═══════════════════════════════════════════
  // 3. USERS
  // ═══════════════════════════════════════════
  const pwd = await argon2.hash("12345678");

  interface UserSeed {
    username: string;
    email: string;
    type: string;
    firstName: string;
    lastName: string;
    nick: string;
    region: string;
    phone?: string;
    roles?: string[];
    inn?: string;
    companyName?: string;
    isAdmin?: boolean;
    adminType?: string;
    balance: number;
  }

  const users: UserSeed[] = [
    { username: "root", email: "root@ecpr.ru", type: "ROOT", firstName: "Кирилл", lastName: "Кокорев", nick: "kokorev", region: "Москва", phone: "+7 (916) 111-11-11", isAdmin: true, adminType: "ROOT", balance: 0 },
    { username: "moderator", email: "moder@ecpr.ru", type: "MODERATOR", firstName: "Анна", lastName: "Смирнова", nick: "moderator_anna", region: "Санкт-Петербург", phone: "+7 (921) 222-22-22", isAdmin: true, adminType: "MODERATOR", balance: 50 },
    { username: "editor", email: "editor@ecpr.ru", type: "EDITOR", firstName: "Дмитрий", lastName: "Волков", nick: "editor_dmitry", region: "Москва", isAdmin: true, adminType: "EDITOR", balance: 30 },
    { username: "stroy_boss", email: "boss@stroytech.ru", type: "COMPANY", firstName: "Алексей", lastName: "Громов", nick: "gromov_stroy", region: "Москва", phone: "+7 (495) 333-33-33", inn: "7707083893", companyName: "ООО «СтройТехнологии»", balance: 25 },
    { username: "keram_facade", email: "info@keramfacade.ru", type: "COMPANY", firstName: "Сергей", lastName: "Кузнецов", nick: "keram_servis", region: "Москва", phone: "+7 (495) 555-55-55", inn: "7723456688", companyName: "ООО «КерамФасад»", balance: 40 },
    { username: "ural_steel", email: "sales@uralsteel.ru", type: "COMPANY", firstName: "Павел", lastName: "Морозов", nick: "ural_steel", region: "Екатеринбург", phone: "+7 (343) 777-77-77", inn: "6677463232", companyName: "ООО «УралКрепСтрой»", balance: 15 },
    { username: "arch_moscow", email: "arch@arhmos.ru", type: "COMPANY", firstName: "Елена", lastName: "Ветрова", nick: "arch_moscow", region: "Москва", phone: "+7 (495) 888-88-88", inn: "7723474343", companyName: "ООО «АрхФасад»", balance: 35 },
    { username: "steel_doors", email: "info@steeldoors.ru", type: "COMPANY", firstName: "Игорь", lastName: "Стальной", nick: "steel_doors", region: "Новосибирск", phone: "+7 (383) 999-99-99", inn: "5407456677", companyName: "ООО «СтальДверь»", balance: 20 },
    { username: "rem_facade", email: "rem@facade-spb.ru", type: "COMPANY", firstName: "Ольга", lastName: "Невская", nick: "rem_facade_spb", region: "Санкт-Петербург", phone: "+7 (812) 444-44-44", inn: "7812457788", companyName: "ООО «РемФасад СПБ»", balance: 18 },
    { username: "petrov_engineer", email: "petrov@mail.ru", type: "COMMON", firstName: "Николай", lastName: "Петров", nick: "petrov_nik", region: "Москва", roles: ["DESIGNER", "TENDER_SPECIALIST"], balance: 12 },
    { username: "sidorova_anna", email: "sidorova@mail.ru", type: "COMMON", firstName: "Анна", lastName: "Сидорова", nick: "sidorova_anna", region: "Казань", roles: ["PRODUCTOLOGIST"], balance: 8 },
    { username: "ivanov_tech", email: "ivanov@tech.ru", type: "COMMON", firstName: "Михаил", lastName: "Иванов", nick: "ivanov_mike", region: "Екатеринбург", roles: ["DESIGNER"], balance: 5 },
    { username: "smirnov_pro", email: "smirnov@pro.ru", type: "COMMON", firstName: "Андрей", lastName: "Смирнов", nick: "smirnov_andrey", region: "Новосибирск", roles: ["TENDER_SPECIALIST", "COMPANY_OWNER"], balance: 15 },
    { username: "guest_test", email: "guest@test.ru", type: "COMMON", firstName: "Тестовый", lastName: "Гость", nick: "guest_user", region: "Москва", balance: 1 },
  ];

  const userIdMap = new Map<string, string>();
  const userObjects: any[] = [];

  for (const u of users) {
    const user = await prisma.user.create({
      data: {
        username: u.username,
        pwdHash: pwd,
        email: u.email,
        phone: u.phone || null,
        status: "ACTIVE",
        type: u.type,
        profile: {
          create: {
            firstName: u.firstName,
            lastName: u.lastName,
            nick: u.nick,
            region: u.region,
            inn: u.inn || null,
            companyName: u.companyName || null,
            roles: u.roles ? {
              create: u.roles.map((r) => ({ role: r })),
            } : undefined,
          },
        },
        serviceFields: { create: { isEmailVerified: true } },
        wallet: { create: { balance: u.balance } },
        ...(u.isAdmin ? { admin: { create: { adminType: u.adminType || "MODERATOR", permissions: JSON.stringify({ all: u.adminType === "ROOT" }) } } } : {}),
      },
    });
    userIdMap.set(u.username, user.id);
    userObjects.push({ ...u, id: user.id });
  }
  console.log(`  ✅ Users: ${users.length}`);

  // ═══════════════════════════════════════════
  // 4. COMPANIES
  // ═══════════════════════════════════════════
  const companyUsers = users.filter(u => u.type === "COMPANY");
  const companyIdMap = new Map<string, string>();

  for (const cu of companyUsers) {
    const company = await prisma.company.create({
      data: {
        inn: cu.inn!,
        name: cu.companyName!,
        email: cu.email,
        phone: cu.phone || null,
        region: cu.region,
        ownerUserId: userIdMap.get(cu.username)!,
        website: `https://${cu.nick.replace(/_/g, "")}.ru`,
        classifierIds: ["4.1.2", "4.1.2.2", "3.3.1"].join(","),
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
    companyIdMap.set(cu.username, company.id);
  }
  console.log(`  ✅ Companies: ${companyIdMap.size}`);

  // Также добавим компанию без владельца (добавлена другим пользователем)
  await prisma.company.create({
    data: {
      inn: "7723457799",
      name: "ООО «НовСтрой»",
      email: "novstroy@mail.ru",
      phone: "+7 (495) 123-45-68",
      region: "Москва",
      addedById: userIdMap.get("petrov_engineer")!,
      classifierIds: "4.1.2,4.2",
      metrics: { create: { phoneViews: 8, emailViews: 4 } },
    },
  });
  console.log("  ✅ Extra company (no owner)");

  // ═══════════════════════════════════════════
  // 5. PRODUCTS (Matrix)
  // ═══════════════════════════════════════════
  const productData = [
    { company: "keram_facade", treePath: "4.1.2.2", name: "Клинкерная плитка KeramPro 250x65", classes: ["STANDARD","COMFORT"], region: "Москва", unit: "шт", price: 2300, characteristics: ["Размер: 250x65 мм","Морозостойкость: F100","Водопоглощение: <3%"] },
    { company: "keram_facade", treePath: "4.1.2.1", name: "Керамогранит KeramGranit 600x600", classes: ["COMFORT","BUSINESS"], region: "Москва", unit: "м²", price: 1850, characteristics: ["Размер: 600x600 мм","Толщина: 10 мм","Износостойкость: PEI 4"] },
    { company: "rem_facade", treePath: "4.1.2.2", name: "Клинкер RommerS 240x71", classes: ["STANDARD","COMFORT","BUSINESS"], region: "Санкт-Петербург", unit: "шт", price: 2700, characteristics: ["Размер: 240x71 мм","Морозостойкость: F150","Производство: Германия"] },
    { company: "rem_facade", treePath: "4.1.2.2", name: "Клинкер эконом RommerS 200x60", classes: ["STANDARD"], region: "Санкт-Петербург", unit: "шт", price: 1600, characteristics: ["Размер: 200x60 мм","Морозостойкость: F75"] },
    { company: "arch_moscow", treePath: "4.1.2.3", name: "Бетонная плитка ArchStone 400x400", classes: ["BUSINESS","PREMIUM"], region: "Москва", unit: "м²", price: 4200, characteristics: ["Размер: 400x400 мм","Толщина: 20 мм","Ручная работа"] },
    { company: "arch_moscow", treePath: "4.1.1", name: "Штукатурка фасадная ArchTex", classes: ["STANDARD","COMFORT","BUSINESS"], region: "Москва", unit: "кг", price: 350, characteristics: ["Расход: 3-4 кг/м²","Цвет: белый под окраску"] },
    { company: "stroy_boss", treePath: "3.3.1", name: "Газобетонный блок D500 600x300x200", classes: ["STANDARD","COMFORT"], region: "Москва", unit: "шт", price: 180, characteristics: ["Плотность: D500","Размер: 600x300x200 мм","Прочность: B3.5"] },
    { company: "stroy_boss", treePath: "3.3.2", name: "Кирпич полнотелый М150", classes: ["STANDARD"], region: "Москва", unit: "шт", price: 25, characteristics: ["Размер: 250x120x65 мм","Прочность: М150","Морозостойкость: F50"] },
    { company: "ural_steel", treePath: "2.3.2", name: "Балка двутавровая 20Б1 С245", classes: ["STANDARD","COMFORT"], region: "Екатеринбург", unit: "т", price: 68000, characteristics: ["Профиль: 20Б1","Сталь: С245","Длина: 12 м"] },
    { company: "ural_steel", treePath: "2.3.2", name: "Швеллер 20П С345", classes: ["STANDARD","COMFORT","BUSINESS"], region: "Екатеринбург", unit: "т", price: 72000, characteristics: ["Профиль: 20П","Сталь: С345","Длина: 12 м"] },
    { company: "steel_doors", treePath: "6.3", name: "Дверь входная Стальная-Премиум", classes: ["COMFORT","BUSINESS"], region: "Новосибирск", unit: "шт", price: 45000, characteristics: ["Толщина металла: 1.5 мм","Замки: 3 класса","Утепление: минвата"] },
    { company: "steel_doors", treePath: "6.1", name: "Дверь входная МОП Стальная-Стандарт", classes: ["STANDARD"], region: "Новосибирск", unit: "шт", price: 28000, characteristics: ["Толщина металла: 1.2 мм","Замки: 2 класса","Доводчик в комплекте"] },
    { company: "keram_facade", treePath: "4.1.2.2", name: "Кирпич клинкерный KeramBrick NF", classes: ["COMFORT","BUSINESS"], region: "Москва", unit: "шт", price: 95, characteristics: ["Формат: NF","Пустотность: полнотелый","Морозостойкость: F200"] },
    { company: "arch_moscow", treePath: "4.2", name: "Молдинг фасадный ArchDecor 60мм", classes: ["BUSINESS","PREMIUM"], region: "Москва", unit: "п.м", price: 1200, characteristics: ["Ширина: 60 мм","Материал: полиуретан"] },
    { company: "stroy_boss", treePath: "7.2.3", name: "Конвектор внутрипольный StroyTherm 200", classes: ["COMFORT","BUSINESS"], region: "Москва", unit: "шт", price: 18500, characteristics: ["Длина: 2000 мм","Теплоотдача: 2.5 кВт","Вентилятор: тангенциальный"] },
  ];

  for (const p of productData) {
    const companyId = companyIdMap.get(p.company);
    const treeItemId = treeIdMap.get(p.treePath);
    if (companyId && treeItemId) {
      await prisma.product.create({
        data: {
          companyId,
          treeItemId,
          ownerUserId: userIdMap.get(p.company) || null,
          name: p.name,
          classes: JSON.stringify(p.classes),
          region: p.region,
          unit: p.unit,
          characteristics: JSON.stringify(p.characteristics),
          price: p.price,
          views: Math.floor(Math.random() * 120) + 10,
        },
      });
    }
  }
  console.log(`  ✅ Products: ${productData.length}`);

  // ═══════════════════════════════════════════
  // 6. REVIEWS
  // ═══════════════════════════════════════════
  const reviewTargets = [
    { author: "petrov_engineer", target: "keram_facade", company: "keram_facade", scores: [5,4,5,4,4,5,4,4,5], comment: "Отличное качество клинкерной плитки! Работали с КерамФасадом на объекте ЖК «Солнечный» — поставка точно в срок, материал высокого качества. Менеджеры всегда на связи, оперативно решают вопросы. Рекомендую к сотрудничеству." },
    { author: "sidorova_anna", target: "keram_facade", company: "keram_facade", scores: [4,5,4,4,5,4,5,4,4], comment: "Хорошая компания, качественная продукция. Единственный минус — иногда задерживают отгрузку на 1-2 дня, но в целом работаем стабильно. Цены рыночные, качество соответствует заявленному." },
    { author: "ivanov_tech", target: "rem_facade", company: "rem_facade", scores: [5,5,5,5,5,5,5,5,5], comment: "Лучший поставщик клинкера в СПб! Работаем с ними уже 3 года на разных объектах. Качество всегда на высоте, логистика отлажена, цены конкурентные. Особая благодарность менеджеру Ольге за профессионализм!" },
    { author: "smirnov_pro", target: "ural_steel", company: "ural_steel", scores: [4,4,3,4,4,4,3,5,3], comment: "Неплохой поставщик металлопроката. Качество стали хорошее,但有 раз была задержка поставки на неделю. Цены средние по рынку, но для крупных заказов дают хорошие скидки. Работаем дальше." },
    { author: "petrov_engineer", target: "stroy_boss", company: "stroy_boss", scores: [5,4,5,4,5,4,4,4,5], comment: "СтройТехнологии — надёжный партнёр по строительным материалам. Газобетонные блоки всегда в наличии, качество стабильное. Доставка по Москве и области без задержек. Рекомендую." },
    { author: "sidorova_anna", target: "steel_doors", company: "steel_doors", scores: [4,4,4,4,3,4,4,5,4], comment: "Двери хорошего качества, установили в подъездах ЖК «Весенний». Монтаж выполнен в срок, двери надёжные. По цене — чуть выше среднего, но качество оправдывает. Продолжаем сотрудничество." },
    { author: "ivanov_tech", target: "arch_moscow", company: "arch_moscow", scores: [5,5,5,4,5,5,5,5,5], comment: "Великолепная бетонная плитка ручной работы! Использовали в интерьере общественных зон премиум-класса. Результат превзошёл ожидания. Команда АрхФасад — настоящие профессионалы своего дела." },
    { author: "smirnov_pro", target: "petrov_engineer", company: undefined, scores: [5,5,5,5,5,5,5,5,5], comment: "Николай — отличный проектировщик! Разработал проект фасада для нашего объекта в сжатые сроки и с высоким качеством. Всегда на связи, учитывает все пожелания. Настоящий профессионал." },
    { author: "stroy_boss", target: "petrov_engineer", company: undefined, scores: [5,4,5,5,4,5,5,5,5], comment: "Хороший специалист, работали вместе над несколькими проектами. Качественно готовит проектную документацию, соблюдает сроки. Рекомендую как надёжного проектировщика для строительных проектов." },
    { author: "keram_facade", target: "sidorova_anna", company: undefined, scores: [5,5,5,5,5,5,5,5,4], comment: "Анна — грамотный продуктолог. Отлично разбирается в строительных материалах, помогает с подбором оптимальных решений для проектов. Всегда приятно работать с профессионалом такого уровня." },
  ];

  for (const r of reviewTargets) {
    const authorId = userIdMap.get(r.author)!;
    const targetId = userIdMap.get(r.target)!;
    const companyId = r.company ? companyIdMap.get(r.company) : null;
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
          create: r.scores.map((score, i) => ({
            criteriaIndex: i + 1,
            score,
          })),
        },
      },
    });
  }
  console.log(`  ✅ Reviews: ${reviewTargets.length}`);

  // ═══════════════════════════════════════════
  // 7. LIBRARY DOCUMENTS
  // ═══════════════════════════════════════════
  const libraryDocs = [
    { author: "petrov_engineer", title: "ТЗ на устройство вентилируемого фасада", treePath: "4.1.2", coinPrice: 10, fileUrl: "https://docs.google.com/facade-tz-1", fileSize: 2500000, approved: true },
    { author: "sidorova_anna", title: "Спецификация отделочных материалов ЖК «Солнечный»", treePath: "12.1", coinPrice: 15, fileUrl: "https://docs.google.com/finishing-spec", fileSize: 4200000, approved: true },
    { author: "ivanov_tech", title: "Техническое задание на монтаж оконных конструкций", treePath: "5.1", coinPrice: 8, fileUrl: "https://docs.google.com/windows-tz", fileSize: 1800000, approved: true },
    { author: "smirnov_pro", title: "Стандарт организации: входные группы МОП", treePath: "6.1", coinPrice: 12, fileUrl: "https://docs.google.com/entrance-standard", fileSize: 3100000, approved: true },
    { author: "stroy_boss", title: "Каталог газобетонных блоков StroyTech", treePath: "3.3.1", coinPrice: 5, fileUrl: "https://docs.google.com/gasblock-catalog", fileSize: 5600000, approved: true },
    { author: "keram_facade", title: "Инструкция по монтажу клинкерной плитки KeramPro", treePath: "4.1.2.2", coinPrice: 5, fileUrl: "https://docs.google.com/kerampro-montage", fileSize: 4800000, approved: true },
    { author: "ural_steel", title: "Сортамент металлопроката УралКрепСтрой", treePath: "2.3.2", coinPrice: 5, fileUrl: "https://docs.google.com/ural-steel-sort", fileSize: 7100000, approved: true },
    { author: "arch_moscow", title: "Альбом фасадных решений ArchStone 2026", treePath: "4.1.2.3", coinPrice: 20, fileUrl: "https://docs.google.com/archstone-album", fileSize: 8900000, approved: true },
    { author: "editor", title: "ГОСТ Р 56707-2025 Системы фасадные", treePath: "4.1.2", coinPrice: 15, fileUrl: "https://docs.google.com/gost-56707", fileSize: 3200000, approved: true },
  ];

  const docIdMap = new Map<string, string>();

  for (const d of libraryDocs) {
    const authorId = userIdMap.get(d.author)!;
    const treeItemId = treeIdMap.get(d.treePath) || null;
    const doc = await prisma.libraryDocument.create({
      data: {
        userId: authorId,
        treeItemId,
        title: d.title,
        coinPrice: d.coinPrice,
        fileUrl: d.fileUrl,
        fileSize: d.fileSize,
        isApproved: d.approved,
        views: Math.floor(Math.random() * 80) + 10,
        purchasesCount: Math.floor(Math.random() * 12) + 1,
      },
    });
    docIdMap.set(d.title, doc.id);
  }
  console.log(`  ✅ Library documents: ${libraryDocs.length}`);

  // ═══════════════════════════════════════════
  // 8. CONFERENCES
  // ═══════════════════════════════════════════
  const now = new Date();
  const conferencesData = [
    { organizer: "keram_facade", title: "Современные фасадные решения в девелопменте", date: new Date(now.getTime() + 7 * 86400000), time: "11:00", description: "Обзор современных фасадных материалов и технологий. Сравнение клинкера, керамогранита и бетонных панелей. Практические кейсы ЖК бизнес-класса.", treePath: "4.1.2", coinPrice: 5, status: "APPROVED" },
    { organizer: "stroy_boss", title: "Газобетон vs Кирпич: выбор материалов для строительства", date: new Date(now.getTime() + 14 * 86400000), time: "10:00", description: "Сравнительный анализ стеновых материалов. Экономика строительства, теплотехника, скорость возведения.", treePath: "3.3", coinPrice: 0, status: "APPROVED" },
    { organizer: "ural_steel", title: "Металлоконструкции в современном строительстве", date: new Date(now.getTime() + 21 * 86400000), time: "14:00", description: "Применение стальных конструкций в жилом и коммерческом строительстве. Преимущества, нормативная база, примеры проектов.", treePath: "2.3.2", coinPrice: 3, status: "APPROVED" },
    { organizer: "arch_moscow", title: "Архитектурный бетон в интерьере общественных пространств", date: new Date(now.getTime() + 5 * 86400000), time: "12:00", description: "Тренды в оформлении общественных зон ЖК. Бетонные панели, малые формы, освещение.", treePath: "13.1", coinPrice: 5, status: "APPROVED" },
    { organizer: "steel_doors", title: "Противопожарные двери: нормативы и подбор", date: new Date(now.getTime() + 30 * 86400000), time: "11:00", description: "Обзор требований пожарной безопасности к дверным конструкциям в жилых и общественных зданиях.", treePath: "6.1", coinPrice: 2, status: "PENDING" },
    { organizer: "editor", title: "ГОСТ Р 21.101-2026: новые требования к проектной документации", date: new Date(now.getTime() - 3 * 86400000), time: "10:00", description: "Разбор ключевых изменений в ГОСТ Р 21.101-2026. Влияние на проектирование стадий П и РД.", treePath: "2.2", coinPrice: 0, status: "APPROVED" },
    { organizer: "rem_facade", title: "Особенности фасадных работ в условиях СЗФО", date: new Date(now.getTime() + 10 * 86400000), time: "15:00", description: "Климатические особенности Северо-Запада и их влияние на выбор фасадных систем и материалов.", treePath: "4.1.2", coinPrice: 0, status: "PENDING" },
  ];

  for (const c of conferencesData) {
    const organizerId = userIdMap.get(c.organizer)!;
    const treeItemId = treeIdMap.get(c.treePath) || null;
    const conf = await prisma.conference.create({
      data: {
        organizerId,
        title: c.title,
        date: c.date,
        time: c.time,
        description: c.description,
        treeItemId,
        coinPrice: c.coinPrice,
        status: c.status,
        connectionLink: "https://zoom.us/j/123456789",
        views: Math.floor(Math.random() * 60) + 5,
      },
    });

    // Add some participants
    const participantCount = Math.floor(Math.random() * 4) + 1;
    const shuffled = [...userObjects].sort(() => Math.random() - 0.5).slice(0, participantCount);
    for (const p of shuffled) {
      if (p.id !== organizerId) {
        await prisma.conferenceParticipant.create({
          data: { conferenceId: conf.id, userId: p.id },
        }).catch(() => {}); // ignore duplicates
      }
    }
  }
  console.log(`  ✅ Conferences: ${conferencesData.length}`);

  // ═══════════════════════════════════════════
  // 9. POLLS
  // ═══════════════════════════════════════════
  const pollsData = [
    {
      question: "Какой класс жилья наиболее востребован в вашем регионе?",
      pollType: "MULTIPLE",
      coinReward: 0.2,
      treePath: "2.2",
      options: ["Стандарт", "Комфорт", "Бизнес", "Премиум"],
      votes: [3, 5, 2, 0],
    },
    {
      question: "Используете ли вы BIM-моделирование в проектах?",
      pollType: "DICHOTOMOUS",
      coinReward: 0.1,
      treePath: "2.3",
      options: ["Да, на всех проектах", "Да, на крупных проектах", "Нет, не используем"],
      votes: [4, 3, 2],
    },
    {
      question: "Какой фасадный материал предпочитаете для ЖК бизнес-класса?",
      pollType: "MULTIPLE",
      coinReward: 0.2,
      treePath: "4.1.2",
      options: ["Керамогранит", "Клинкер", "Фиброцемент", "Бетонные панели"],
      votes: [5, 4, 1, 2],
    },
    {
      question: "Готовы ли вы делиться техническими заданиями в библиотеке платформы?",
      pollType: "DICHOTOMOUS",
      coinReward: 0.15,
      treePath: null,
      options: ["Да, готов делиться", "Да, за монеты", "Пока не готов"],
      votes: [6, 3, 3],
    },
    {
      question: "Что важнее при выборе поставщика?",
      pollType: "MULTIPLE",
      coinReward: 0.1,
      treePath: null,
      options: ["Цена", "Качество", "Сроки поставки", "Репутация и отзывы"],
      votes: [4, 6, 3, 5],
    },
  ];

  const allUserIds = Array.from(userIdMap.values());

  for (const p of pollsData) {
    const treeItemId = p.treePath ? treeIdMap.get(p.treePath) : null;
    const poll = await prisma.poll.create({
      data: {
        question: p.question,
        pollType: p.pollType,
        coinReward: p.coinReward,
        treeItemId,
        isActive: true,
        options: {
          create: p.options.map((text, i) => ({
            text,
            sortOrder: i,
          })),
        },
      },
    });

    // Get options with IDs
    const createdPoll = await prisma.poll.findUnique({
      where: { id: poll.id },
      include: { options: true },
    });

    if (createdPoll) {
      // Create votes
      const voters = [...allUserIds].sort(() => Math.random() - 0.5).slice(0, 6);
      for (let optIdx = 0; optIdx < createdPoll.options.length; optIdx++) {
        const opt = createdPoll.options[optIdx];
        const voteCount = p.votes[optIdx] || 0;
        for (let v = 0; v < voteCount; v++) {
          const voter = voters[v % voters.length];
          await prisma.pollVote.create({
            data: { pollId: poll.id, optionId: opt.id, userId: voter },
          }).catch(() => {}); // ignore duplicate
        }
      }
    }
  }
  console.log(`  ✅ Polls: ${pollsData.length}`);

  // ═══════════════════════════════════════════
  // 10. GIFTS
  // ═══════════════════════════════════════════
  const giftsData = [
    { name: "Фирменный блокнот ЕЦПР", coinPrice: 5, limit: 50 },
    { name: "Термокружка с логотипом", coinPrice: 10, limit: 30 },
    { name: "Power Bank 10000 mAh", coinPrice: 20, limit: 15 },
    { name: "Сертификат OZON 1000 ₽", coinPrice: 15, limit: 20 },
    { name: "Книга «Строительство будущего»", coinPrice: 8, limit: 25 },
  ];

  for (const g of giftsData) {
    await prisma.gift.create({ data: g });
  }
  console.log(`  ✅ Gifts: ${giftsData.length}`);

  // ═══════════════════════════════════════════
  // 11. TRANSACTIONS
  // ═══════════════════════════════════════════
  const txTypes = ["ADD_COMPANY","REVIEW","POLL_VOTE","DOCUMENT_PURCHASE","GIFT_SEND","MODERATOR_ADD"];
  for (let i = 0; i < 25; i++) {
    const user = userObjects[Math.floor(Math.random() * userObjects.length)];
    const txType = txTypes[Math.floor(Math.random() * txTypes.length)];
    const amount = txType === "MODERATOR_ADD" ? Math.floor(Math.random() * 20) + 1
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
  console.log(`  ✅ Transactions: 25`);

  // ═══════════════════════════════════════════
  // 12. SUPPORT TICKETS
  // ═══════════════════════════════════════════
  await prisma.supportTicket.create({
    data: {
      userId: userIdMap.get("petrov_engineer")!,
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
  console.log("  ✅ Support tickets: 2");

  // ═══════════════════════════════════════════
  // 13. PAGE CONTENT
  // ═══════════════════════════════════════════
  const pages = {
    home: `<h2>Добро пожаловать на платформу ЕЦПР</h2>
<p><strong>Единый независимый центр продуктовых решений, закупок и технических заданий строительной отрасли</strong> — открытая независимая платформа для инженеров, специалистов по закупкам, поставщиков и собственников компаний.</p>
<p>Наша цель — укрепить российский рынок строительства, повысить конкурентоспособность отечественных компаний.</p>
<p><em>Основатель платформы — Кокорев Кирилл Владимирович</em></p>`,
    products: `<h2>Продуктовые решения</h2><p>Иерархический классификатор строительных продуктов, материалов и услуг. Выберите категорию, чтобы найти товары, документы и конференции.</p>`,
    suppliers: `<h2>База поставщиков и заказчиков</h2><p>Актуальная база компаний и специалистов. Контакты открываются по клику на иконку глаза — каждый просмотр фиксируется в метрике.</p>`,
    matrix: `<h2>Даешь аналог! Матрица материалов</h2><p>Конкурентная таблица товаров. Сравнивайте аналоги разных производителей по цене, характеристикам и классу.</p>`,
    library: `<h2>Библиотека технических заданий</h2><p>Загружайте свои документы и приобретайте документы коллег за монеты программы лояльности.</p>`,
    conferences: `<h2>Конференции</h2><p>Отраслевые конференции, вебинары и лекции. Презентуйте свой продукт, делитесь опытом.</p>`,
    polls: `<h2>Статистика и опросы</h2><p>Голосуйте в отраслевых опросах, получайте монеты за участие.</p>`,
  };

  for (const [key, content] of Object.entries(pages)) {
    await prisma.pageContent.upsert({
      where: { pageKey: key },
      update: { content },
      create: { pageKey: key, content },
    });
  }
  console.log(`  ✅ Page content: ${Object.keys(pages).length} pages`);

  // ═══════════════════════════════════════════
  console.log("\n🎉 Полноценный сид завершён!\n");
  console.log("  Учётные данные (пароль везде: 12345678):");
  console.log("  ───────────────────────────────────────");
  console.log("  root / 12345678          — владелец платформы");
  console.log("  moderator / 12345678     — модератор (Анна Смирнова)");
  console.log("  editor / 12345678        — редактор (Дмитрий Волков)");
  console.log("  stroy_boss / 12345678    — компания «СтройТехнологии»");
  console.log("  keram_facade / 12345678  — компания «КерамФасад»");
  console.log("  ural_steel / 12345678    — компания «УралКрепСтрой»");
  console.log("  arch_moscow / 12345678   — компания «АрхФасад»");
  console.log("  steel_doors / 12345678   — компания «СтальДверь»");
  console.log("  rem_facade / 12345678 — компания «РемФасад СПБ»");
  console.log("  petrov_engineer / 12345678 — участник-проектировщик");
  console.log("  sidorova_anna / 12345678  — участник-продуктолог");
  console.log("  ───────────────────────────────────────");
  console.log(`\n  Статистика:`);
  console.log(`  • ${users.length} пользователей`);
  console.log(`  • ${companyIdMap.size} компаний с метриками`);
  console.log(`  • ${treeIdMap.size} пунктов классификатора`);
  console.log(`  • ${productData.length} товаров в матрице`);
  console.log(`  • ${reviewTargets.length} отзывов с рейтингами`);
  console.log(`  • ${libraryDocs.length} документов библиотеки`);
  console.log(`  • ${conferencesData.length} конференций`);
  console.log(`  • ${pollsData.length} опросов с голосами`);
  console.log(`  • ${giftsData.length} подарков`);
  console.log(`  • 25 транзакций, 2 обращения в поддержку`);
  console.log("");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
