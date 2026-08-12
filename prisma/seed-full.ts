// Полноценный seed со всеми тестовыми данными
// Запуск: npx tsx prisma/seed-full.ts

import { PrismaClient } from "@prisma/client";
import * as argon2 from "@node-rs/argon2";
import { REGIONS } from "../src/lib/regions";

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
  await prisma.region.deleteMany();
  await prisma.user.deleteMany();
  console.log("  🧹 Очищено");

  // ═══════════════════════════════════════════
  // 0. СПРАВОЧНИК РЕГИОНОВ
  // ═══════════════════════════════════════════
  const regionNames = REGIONS.filter((r) => r !== "Все регионы");
  for (let i = 0; i < regionNames.length; i++) {
    await prisma.region.create({
      data: { name: regionNames[i], sortOrder: i },
    });
  }
  console.log(`  📍 Регионы: ${regionNames.length}`);

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
  // 2. PRODUCT TREE — полный классификатор 1:1 по ТЗ
  // ═══════════════════════════════════════════
  const CLASSIFIER = `
1. Работы пред-подготовительного периода разработки проекта
1.1. Приобретение участка под строительство
1.2. Аренда участка под строительство
2. Предпроектная подготовка
2.1. Разработка мастер-плана
2.2. Проектирование стадия "П"
2.2.1. АР (Архитектурные решения)
2.2.1.1. Сбор исходных данных
2.2.1.2. Предпроектная проработка
2.2.1.3. Концепция
2.3. Согласование с городом
2.4. ТЗК (тех заключение конструкции) экспертиза
2.5. РНС
2.6. Проектирование стадия "РД"
2.6.1. АР (Архитектурные решения)
2.6.2. Конструктивные решения (КР)
2.6.2.1. Конструкции металлические (КМ)
2.6.2.2. Конструкции железобетонные (КЖ)
2.6.3. ГПЗУ
2.6.4. Инженерное оборудование (ИОС)
2.6.4.1. ОВиК
2.6.4.1.1. Отопление
2.6.4.1.2. Вентиляция
2.6.4.1.3. Кондиционирование
2.6.4.2. ВК
2.6.4.2.1. Водоснабжение
2.6.4.2.1.1. Внешнее водоснабжение
2.6.4.2.1.2. Внутреннее водоснабжение
2.6.4.2.2. Канализация (водоотведение)
2.6.4.2.2.1. Внешняя канализация
2.6.4.2.2.2. Внутренняя канализация
2.6.4.3. Проектирование СС
2.6.4.4. Проектирование ЭОМ
2.6.4.5. Проектирование Система безопасности
2.6.4.6. Проектирование Лифты
2.6.4.7. Проектирование Мусоропровод
2.6.4.8. Проектирование Газификация
2.6.4.9. Проектирование Пожарная безопасность
2.6.4.10. Проектирование Молниезащита
2.6.5. АИ-Р (архитектурные интерьеры)
2.6.6. Проектирование благоустройства территории
2.6.7. Услуги лабораторий
2.6.8. Авторский надзор
2.6.9. Передача документации
3. Конструктив
3.1. Фундаментные работы
3.1.1. Свайное основание
3.2. Монолитные работы
3.2.1. Бетон
3.2.2. Арматура
3.2.3. Монолитные работы (СМР)
3.3. ЖБИ изделия
3.3.1. Блоки фундаментные железобетонные
3.4. Стены наружные
3.4.1. Газобетонный блок
3.4.2. Газосиликатный блок
3.4.3. Керамзитный блок
3.4.4. Кирпич
3.5. Стены внутренние
3.5.1. Газобетонный блок
3.5.2. ГВЛ
3.6. Кровля
3.7. Паркинг многоуровневый
4. Фасад
4.1. Облицовка фасада
4.1.1. Фасад мокрый
4.1.2. Фасад навесной вентилируемый
4.1.2.1. Фасад керамогранитный
4.1.2.2. Фасад клинкерный
4.1.2.2.1. Плитка клинкерная
4.1.2.2.2. Кирпич клинкерный
4.1.2.3. Фасад бетонный
4.1.2.3.1. Плитка
4.2. Двухслойный фасад
4.3. Декоративные элементы фасада
4.4. Освещение фасада
4.5. Корзины для кондиционеров
4.6. Вывески коммерческие фасадные
4.7. Козырьки
5. Светопрозрачные конструкции, окна и витражное остекление
5.1. Окна жилых помещений
5.2. Окна нежилых помещений (МОП)
6. Двери
6.1. Двери входных групп (МОП)
6.2. Двери тамбурные
6.3. Двери поэтажные
6.4. Двери входные квартирные
6.5. Двери балконные
6.6. Двери межкомнатные
6.7. Двери в технические помещения
6.8. Двери в кладовые помещения
7. Инженерные коммуникации
7.1. Водоснабжение
7.1.1. Трубы водоснабжения
7.1.2. Счетчики
7.1.2.1. Обычный счетчик
7.1.2.2. Счетчик с телеметрией
7.1.3. Люк ревизионный
7.2. Канализация
7.2.1. Трубы канализационные
7.2.2. Очистные сооружения
7.3. Отопление
7.3.1. Трубы отопления
7.3.2. Отопительные приборы
7.3.2.1. Батареи
7.3.2.2. Радиаторы
7.3.2.2.1. Счетчик отопления квартирный с телеметрией
7.3.2.3. Конвекторы
7.3.2.3.1. Конвекторы внутрипольные
7.3.2.3.2. Конвекторы напольные
7.3.3. Индивидуальные тепловые пункты
7.3.4. Котельные
8. Вентиляция и кондиционирование
8.1. Вентиляция естественная
8.2. Вентиляция принудительная
8.3. Блоки кондиционеров
8.4. Сплит-системы
8.5. Решетка вентиляционная
9. Электроснабжение
9.1. Кабель
9.2. Провода
9.3. Счетчики
9.3.1. Счетчик электроснабжения обычный
9.3.2. Счетчик электроснабжения с телеметрией
9.4. Станции зарядки электрокаров
9.4.1. Уличные станции зарядки электрокаров
9.4.2. Внутридомовые станции зарядки электрокаров
9.5. Щит квартирный
9.5.1. Щит квартирный накладной
9.5.2. Щит квартирный встраиваемый
9.6. Приборы внутренние осветительные
9.6.1. Освещение входных групп и МОП
9.6.1.1. Светильник
9.6.1.1.1. Светильники армстронг 600х600мм
9.6.1.1.2. Светильники грильятта
9.6.1.1.3. Светильники линейные
9.6.1.1.4. Светильник общего назначения
9.6.1.1.5. Светильники эвакуационные, аварийные
9.6.2. Освещение жилых помещений
9.6.2.1. Светильник точечный, споты
9.7. Выключатели
9.8. Розетки
9.8.1. Розетки для сухих помещений
9.8.2. Розетки влагозащищенные
10. Слаботочные сети
10.1. Домофония
10.2. Видеонаблюдение
10.3. Усилители связи
10.4. Система бесключевого доступа
10.5. Интернет-коммуникации и wi-fi
10.6. Музыкальное сопровождение
10.7. Умный дом система
11. Подъемные механизмы и оборудование
11.1. Лифтовое оборудование
11.2. Эскалаторы
12. Благоустройство
12.1. Твёрдые покрытия
12.1.1. Асфальтированные покрытия
12.1.2. Брусчатка
12.1.3. Тротуарная плитка
12.1.4. Бордюры
12.2. Натуральные и синтетические покрытия
12.2.1. Покрытие резиновые
12.2.1.1. Покрытие резиновое плиточное
12.2.1.1.1. Клей для резинового покрытия плиточного
12.2.1.2. Покрытие резиновое бесшовное
12.2.1.2.1. Клей для резинового покрытия
12.2.1.2.2. Крошка EPDM
12.2.1.2.3. Крошка переработанная SBR
12.2.1.2.3.1. Крошка переработанная SBR мм 2-5
12.2.1.2.3.2. Крошка переработанная SBR мм 1-3
12.2.1.2.3.3. Крошка переработанная SBR мм 0-0,5 (пыль)
12.3. Малые архитектурные формы (МАФ)
12.3.1. Детское игровое уличное оборудование
12.3.1.1. Игровые комплексы
12.3.1.1.1. от 0-5 лет
12.3.1.1.2. от 5-11 лет
12.3.1.1.3. от 12 и выше лет
12.3.1.2. Качели
12.3.1.2.1. от 0-5 лет
12.3.1.2.2. от 5 и выше лет
12.3.1.3. Горки
12.3.1.3.1. от 0-5 лет
12.3.1.3.2. от 5-11 лет
12.3.1.3.3. от 12 и выше лет
12.3.1.4. Песочницы
12.3.1.4.1. от 0-7 лет
12.3.1.5. Карусели
12.3.1.5.1. Карусели с сидениями
12.3.1.5.1.1. от 2-5 лет
12.3.1.5.1.2. от 5-11 лет
12.3.1.5.1.3. от 12 и выше лет
12.3.1.5.2. Карусели без сидений
12.3.1.5.2.1. от 2-5 лет
12.3.1.5.2.2. от 5-11 лет
12.3.1.5.2.3. от 12 и выше лет
12.3.1.5.3. Карусели стоячие цепные
12.3.1.5.3.1. от 2-5 лет
12.3.1.5.3.2. от 5-11 лет
12.3.1.5.3.3. от 12 и выше лет
12.3.1.5.4. Карусели сидячие подвесные
12.3.1.5.4.1. от 2-5 лет
12.3.1.5.4.2. от 5-11 лет
12.3.1.5.4.3. от 12 и выше лет
12.3.1.6. Домики
12.3.1.6.1. от 0-5 лет
12.3.1.6.2. от 5-11 лет
12.3.1.7. Балансиры
12.3.1.7.1. от 3-7 лет
12.3.1.8. Канатные дороги
12.3.1.9. Пространственные сетки
12.3.1.9.1. до 1,5 м от 3-7 лет
12.3.1.9.2. от 1,5 до 2,5 м от 7-12 лет
12.3.1.9.3. от 2,5 м от 12 лет
12.3.1.10. Батуты
12.3.1.10.1. R=1100 мм
12.3.1.10.2. R=1500 мм
12.3.1.10.3. R=2000 мм
12.3.1.11. Игровые элементы
12.3.1.11.1. Бизиборды
12.3.1.11.2. Развивающие элементы
12.3.1.12. Игры с водой и песком
12.3.1.12.1. от 2-10 лет
12.3.1.13. Полосы препятствий
12.3.1.13.1. H до 1600 мм от 3 до 6 лет
12.3.1.13.2. H от 1600 до 2500 мм от 7 и выше
12.3.1.14. Качалки на пружине
12.3.1.14.1. от 0 до 6 лет
12.3.1.15. Детские научные площадки
12.3.1.15.1. тематические от 0 до 7 лет
12.3.2. Спортивное уличное оборудование
12.3.2.1. Уличные тренажеры (от 12+ лет)
12.3.2.2. Оборудование для воркаута (от 12+ лет)
12.3.2.3. Трибуны
12.3.2.4. Теннисные столы
12.3.2.5. Футбольные ворота
12.3.3. Оборудование для уличного отдыха
12.3.3.1. Скамьи
12.3.3.2. Беседки
12.3.3.3. Перголы
12.3.3.4. Навесы
12.3.3.5. Качели для взрослого отдыха
12.3.3.6. Летние кинотеатры
12.3.3.7. Подиумы
12.3.3.8. Шезлонги
12.3.3.9. Арки
12.3.3.10. Велопарковки
12.3.4. Мусороудаление
12.3.4.1. Урны мусорные
12.3.4.2. Контейнеры мусорные
12.3.4.3. Вывоз ТБО, КГМ
12.3.5. Оборудование для выгула домашних животных
12.3.5.1. Кольца
12.3.5.2. Многоуровневые стойки
12.3.5.3. Барьер
12.3.5.4. Балансир для занятия с питомцем
12.3.5.5. Змейка
12.3.5.6. Стойки для привязки
12.3.5.7. Тоннель
12.3.5.8. Урна для экскрементов
12.3.5.9. Качели
12.3.5.10. Мостик
12.3.6. Арт-объекты
12.3.7. Водные объекты и фонтаны
12.3.8. Барбекю-зоны
12.3.8.1. Мангал
12.4. Закрытая территория
12.4.1. Забор
12.4.2. Калитка
12.4.3. Ворота
12.4.3.1. Ворота уличные
12.4.3.2. Ворота в паркинг
12.4.4. Отбойники
12.4.5. Знаки дорожные
12.5. Наружное освещение
12.5.1. Декоративное уличное освещение
12.5.1.1. Высотные фонарные столбы (от 2 м до 8 м)
12.5.1.1.1. Высотные фонарные столбы (от 2 до 4 м)
12.5.1.1.2. Прямостоечные опоры освещения
12.5.1.1.3. Складывающиеся опоры освещения
12.5.1.1.4. Смарт-опоры
12.5.1.1.5. Опора зарядка для электромобилей
12.5.1.1.6. Опоры гнутые
12.5.1.2. Высотные фонарные столбы (от 4 до 6 м)
12.5.1.2.1. Прямостоечные опоры освещения
12.5.1.2.2. Складывающиеся опоры освещения
12.5.1.2.3. Смарт-опоры
12.5.1.2.4. Опора зарядка для электромобилей
12.5.1.2.5. Опоры гнутые
12.5.1.3. Высотные фонарные столбы (от 6 и более)
12.5.1.3.1. Прямостоечные опоры освещения
12.5.1.3.2. Складывающиеся опоры освещения
12.5.1.3.3. Смарт-опоры
12.5.1.3.4. Опора зарядка для электромобилей
12.5.1.3.5. Опоры гнутые
12.5.2. Ландшафтное освещение
12.5.2.1. Болларды (от 0,5 до 2 м)
12.5.2.2. Лента LED
12.5.3. Архитектурное освещение
12.5.4. Магистральное освещение (уличное и дорожное)
12.5.4.1. Высотные фонарные столбы (от 4 до 6 м)
12.5.4.2. Высотные фонарные столбы (от 6 и более)
12.5.5. Освещение для спортивных зон
12.5.5.1. Высотные фонарные столбы
12.5.5.1.1. Высотные фонарные столбы для спортивных зон (от 4 до 6 м)
12.5.5.1.2. Высотные фонарные столбы для спортивных зон (от 6 и более)
12.5.5.1.3. Высотные фонарные столбы для спортивных зон (от 4 до 6 м)
12.5.5.1.4. Высотные фонарные столбы для спортивных зон (от 6 и более)
12.5.5.2. Кронштейны
12.5.5.2.1. Кронштейны Т-образные
12.5.5.2.2. Кронштейны навесной
12.5.5.3. Прожекторы
12.5.5.3.1. Прожекторы спортивного сооружения для жилых комплексов
12.6. Озеленение территории
12.6.1. Газон
12.6.1.1. Газон рулонный
12.6.1.2. Газон посевной
12.7. Навигация в благоустройстве
12.8. Бассейны
13. Отделочные работы и материалы
13.1. Грязезащитные решетки
13.2. Грунтовка
13.3. Краска
13.4. Эмаль
13.5. Клеи
13.5.1. Клей для обоев флизелиновых
13.6. Герметики
13.7. Пена монтажная
13.8. Гидроизоляционные материалы
13.9. Покрытия настенные
13.9.1. Обои
13.9.2. Панели декоративные
13.9.3. Панно
13.9.4. Штукатурка фактурная
13.9.5. Плитка керамическая настенная
13.9.6. Затирка плиточная
13.10. Покрытия напольные
13.10.1. Плитка керамическая
13.10.2. Затирка плиточная
13.10.3. Ламинат
13.10.4. Паркет
13.10.5. Линолеум
13.11. Плинтуса напольные
13.11.1. Плинтуса полимерные
13.11.2. Металлические
13.11.3. Плинтуса деревянные
13.11.4. Профиль соединительный
13.12. Покрытия потолочные
13.12.1. Потолок натяжной
13.12.2. Потолок армстронг
13.12.3. Декоративные рейки
14. Навигация в помещениях
14.1. Навигация в МОП
14.2. Навигация в паркинге
14.3. Навигация в деловой зоне
15. Сантехнические приборы
15.1. Ванна
15.1.1. Ванна 1500
15.1.2. Ванна 1700
15.1.3. Ванна 1900
15.2. Душевые кабины
15.3. Кабины душевые сборные
15.4. Унитазы
15.5. Умывальник
15.6. Смеситель
15.7. Мойка кухонная
15.8. Ревизионный люк доступа
15.9. Полотенцесушитель
16. Моечные станции, автомойка
17. Интерьер общественных пространств
17.1. Ресепшн
17.2. Мебель для зоны ожидания гостей
17.2.1. Диваны
17.2.1.1. Диваны цельные
17.2.1.1.1. Диваны цельные из кожи
17.2.1.1.1.1. Диваны цельные из кожи кат 1
17.2.1.1.1.2. Диваны цельные из кожи кат 2
17.2.1.1.2. Диваны цельные из рогожки
17.2.1.1.2.1. Диваны цельные из рогожки кат 1
17.2.1.1.2.2. Диваны цельные из рогожки кат 2
17.2.1.1.2.3. Диваны цельные из рогожки кат 3
17.2.1.1.3. Диваны цельные из буклии
17.2.1.1.3.1. Диваны цельные из буклии кат 2
17.2.1.1.3.2. Диваны цельные из буклии кат 3
17.2.1.1.3.3. Диваны цельные из буклии кат 4
17.2.1.1.3.4. Диваны цельные из буклии кат 5
17.2.1.1.4. Диваны цельные из шенила
17.2.1.1.4.1. Диваны цельные из шенила кат 1
17.2.1.1.4.2. Диваны цельные из шенила кат 2
17.2.1.1.4.3. Диваны цельные из шенила кат 3
17.2.1.1.4.4. Диваны цельные из шенила кат 4
17.2.1.1.4.5. Диваны цельные из шенила кат 5
17.2.1.1.5. Диваны цельные из велюра
17.2.1.1.5.1. Диваны цельные из велюра кат 1
17.2.1.1.6. Диваны цельные из микро-велюра
17.2.1.1.6.1. Диваны цельные из микро-велюра кат 1
17.2.1.2. Диваны модульные
17.2.1.2.1. Диваны модульные из кожи
17.2.1.2.1.1. Диваны модульные из кожи кат 1
17.2.1.2.1.2. Диваны модульные из кожи кат 2
17.2.1.2.2. Диваны модульные из рогожки
17.2.1.2.2.1. Рогожка кат 1
17.2.1.2.2.2. Рогожка кат 2
17.2.1.2.2.3. Рогожка кат 3
17.2.1.2.3. Диваны модульные из буклии
17.2.1.2.3.1. Диваны модульные из буклии кат 2
17.2.1.2.3.2. Диваны модульные из буклии кат 3
17.2.1.2.3.3. Диваны модульные из буклии кат 4
17.2.1.2.3.4. Диваны модульные из буклии кат 5
17.2.1.2.4. Диваны модульные из шенила
17.2.1.2.4.1. Диваны модульные из шенила кат 1
17.2.1.2.4.2. Диваны модульные из шенила кат 2
17.2.1.2.4.3. Диваны модульные из шенила кат 3
17.2.1.2.4.4. Диваны модульные из шенила кат 4
17.2.1.2.4.5. Диваны модульные из шенила кат 5
17.2.1.2.5. Диваны модульные из велюра
17.2.1.2.5.1. Диваны модульные из велюра кат 1
17.2.1.2.6. Диваны модульные из микро-велюра
17.2.1.2.6.1. Диваны модульные из микро-велюра кат 1
17.2.2. Кресла
17.2.3. Стулья
17.2.3.1. Стулья барные
17.2.3.2. Стулья полубарные
17.2.4. Пуфы
17.2.5. Табуреты
17.2.5.1. Табуреты барные
17.2.5.2. Табуреты полубарные
17.2.6. Столы
17.2.7. Журнальные столики
17.2.7.1. Журнальные столики приставные
17.2.7.2. Журнальные столики автономные
17.3. Оборудование детское для общественных пространств
17.3.1. Оборудование для колясочных
17.3.2. Оборудование для игровых комнат
17.4. Почтовые ящики
17.5. Библиотека (букроссинг)
17.6. Вазы
17.7. Кашпо
17.8. Растения общественных зон
17.9. Картины, постеры и арт-элементы настенные общественных зон
17.10. Зеркала
17.11. Оборудование для соц. объектов
18. Уборка и клининг
18.1. Проведение уборочных работ и клининга
18.2. Средства уборки, химия
19. Подготовка маркетинговых материалов
19.1. Печатная продукция
19.2. Видео реклама
19.3. Рекламные конструкции
`;

  const treeIdMap = new Map<string, string>();

  // Parse flat classifier lines into nodes, then insert in order
  const classifierLines = CLASSIFIER.trim().split("\n").filter(l => l.trim());
  const treeNodes: { number: string; name: string; parentNumber: string | null }[] = [];

  for (const line of classifierLines) {
    const match = line.match(/^(\d+(?:\.\d+)*)\.\s+(.+)/);
    if (!match) continue;
    const number = match[1];
    const name = match[2].trim();
    const parts = number.split(".");
    const parentNumber = parts.length > 1 ? parts.slice(0, -1).join(".") : null;
    treeNodes.push({ number, name, parentNumber });
  }

  // Sort: parents first (fewer dots first)
  treeNodes.sort((a, b) => {
    const depthA = a.number.split(".").length;
    const depthB = b.number.split(".").length;
    if (depthA !== depthB) return depthA - depthB;
    return a.number.localeCompare(b.number, undefined, { numeric: true });
  });

  for (const node of treeNodes) {
    const parentId = node.parentNumber ? treeIdMap.get(node.parentNumber) || null : null;
    const parts = node.number.split(".");
    const inBranchNumber = parseInt(parts[parts.length - 1]);
    const created = await prisma.productTreeItem.create({
      data: {
        name: node.name,
        parentId,
        inBranchNumber,
        fullNumberPath: node.number,
      },
    });
    treeIdMap.set(node.number, created.id);
  }

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
    { username: "root", email: "root@ecpr.ru", type: "ROOT", firstName: "Кирилл", lastName: "Кокорев", nick: "kokorev", region: "г. Москва", phone: "+7 (916) 111-11-11", isAdmin: true, adminType: "ROOT", balance: 0 },
    { username: "moderator", email: "moder@ecpr.ru", type: "MODERATOR", firstName: "Анна", lastName: "Смирнова", nick: "moderator_anna", region: "г. Санкт-Петербург", phone: "+7 (921) 222-22-22", isAdmin: true, adminType: "MODERATOR", balance: 50 },
    { username: "editor", email: "editor@ecpr.ru", type: "EDITOR", firstName: "Дмитрий", lastName: "Волков", nick: "editor_dmitry", region: "г. Москва", isAdmin: true, adminType: "EDITOR", balance: 30 },
    { username: "stroy_boss", email: "boss@stroytech.ru", type: "COMPANY", firstName: "Алексей", lastName: "Громов", nick: "gromov_stroy", region: "г. Москва", phone: "+7 (495) 333-33-33", inn: "7707083893", companyName: "ООО «СтройТехнологии»", balance: 25 },
    { username: "keram_facade", email: "info@keramfacade.ru", type: "COMPANY", firstName: "Сергей", lastName: "Кузнецов", nick: "keram_servis", region: "г. Москва", phone: "+7 (495) 555-55-55", inn: "7723456688", companyName: "ООО «КерамФасад»", balance: 40 },
    { username: "ural_steel", email: "sales@uralsteel.ru", type: "COMPANY", firstName: "Павел", lastName: "Морозов", nick: "ural_steel", region: "Свердловская область", phone: "+7 (343) 777-77-77", inn: "6677463232", companyName: "ООО «УралКрепСтрой»", balance: 15 },
    { username: "arch_moscow", email: "arch@arhmos.ru", type: "COMPANY", firstName: "Елена", lastName: "Ветрова", nick: "arch_moscow", region: "г. Москва", phone: "+7 (495) 888-88-88", inn: "7723474343", companyName: "ООО «АрхФасад»", balance: 35 },
    { username: "steel_doors", email: "info@steeldoors.ru", type: "COMPANY", firstName: "Игорь", lastName: "Стальной", nick: "steel_doors", region: "Новосибирская область", phone: "+7 (383) 999-99-99", inn: "5407456677", companyName: "ООО «СтальДверь»", balance: 20 },
    { username: "rem_facade", email: "rem@facade-spb.ru", type: "COMPANY", firstName: "Ольга", lastName: "Невская", nick: "rem_facade_spb", region: "г. Санкт-Петербург", phone: "+7 (812) 444-44-44", inn: "7812457788", companyName: "ООО «РемФасад СПБ»", balance: 18 },
    { username: "petrov_engineer", email: "petrov@mail.ru", type: "COMMON", firstName: "Николай", lastName: "Петров", nick: "petrov_nik", region: "г. Москва", roles: ["DESIGNER", "TENDER_SPECIALIST"], balance: 12 },
    { username: "sidorova_anna", email: "sidorova@mail.ru", type: "COMMON", firstName: "Анна", lastName: "Сидорова", nick: "sidorova_anna", region: "Республика Татарстан", roles: ["PRODUCTOLOGIST"], balance: 8 },
    { username: "ivanov_tech", email: "ivanov@tech.ru", type: "COMMON", firstName: "Михаил", lastName: "Иванов", nick: "ivanov_mike", region: "Свердловская область", roles: ["DESIGNER"], balance: 5 },
    { username: "smirnov_pro", email: "smirnov@pro.ru", type: "COMMON", firstName: "Андрей", lastName: "Смирнов", nick: "smirnov_andrey", region: "Новосибирская область", roles: ["TENDER_SPECIALIST", "COMPANY_OWNER"], balance: 15 },
    { username: "guest_test", email: "guest@test.ru", type: "COMMON", firstName: "Тестовый", lastName: "Гость", nick: "guest_user", region: "г. Москва", balance: 1 },
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
        classifierIds: ["4.1.2", "4.1.2.2", "4.1.2.2.1"]
          .map((p) => treeIdMap.get(p))
          .filter(Boolean)
          .join(","),
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
      region: "г. Москва",
      addedById: userIdMap.get("petrov_engineer")!,
      classifierIds: ["4.1.2", "4.3"]
        .map((p) => treeIdMap.get(p))
        .filter(Boolean)
        .join(","),
      metrics: { create: { phoneViews: 8, emailViews: 4 } },
    },
  });
  console.log("  ✅ Extra company (no owner)");

  // ═══════════════════════════════════════════
  // 5. PRODUCTS (Matrix)
  // ═══════════════════════════════════════════
  const productData = [
    { company: "keram_facade", treePath: "4.1.2.2", name: "Клинкерная плитка KeramPro 250x65", classes: ["STANDARD","COMFORT"], region: "г. Москва", unit: "шт", price: 2300, characteristics: ["Размер: 250x65 мм","Морозостойкость: F100","Водопоглощение: <3%"] },
    { company: "keram_facade", treePath: "4.1.2.1", name: "Керамогранит KeramGranit 600x600", classes: ["COMFORT","BUSINESS"], region: "г. Москва", unit: "м²", price: 1850, characteristics: ["Размер: 600x600 мм","Толщина: 10 мм","Износостойкость: PEI 4"] },
    { company: "rem_facade", treePath: "4.1.2.2", name: "Клинкер RommerS 240x71", classes: ["STANDARD","COMFORT","BUSINESS"], region: "г. Санкт-Петербург", unit: "шт", price: 2700, characteristics: ["Размер: 240x71 мм","Морозостойкость: F150","Производство: Германия"] },
    { company: "rem_facade", treePath: "4.1.2.2", name: "Клинкер эконом RommerS 200x60", classes: ["STANDARD"], region: "г. Санкт-Петербург", unit: "шт", price: 1600, characteristics: ["Размер: 200x60 мм","Морозостойкость: F75"] },
    { company: "arch_moscow", treePath: "4.1.2.3", name: "Бетонная плитка ArchStone 400x400", classes: ["BUSINESS","PREMIUM"], region: "г. Москва", unit: "м²", price: 4200, characteristics: ["Размер: 400x400 мм","Толщина: 20 мм","Ручная работа"] },
    { company: "arch_moscow", treePath: "4.1.1", name: "Штукатурка фасадная ArchTex", classes: ["STANDARD","COMFORT","BUSINESS"], region: "г. Москва", unit: "кг", price: 350, characteristics: ["Расход: 3-4 кг/м²","Цвет: белый под окраску"] },
    { company: "stroy_boss", treePath: "3.4.1", name: "Газобетонный блок D500 600x300x200", classes: ["STANDARD","COMFORT"], region: "г. Москва", unit: "шт", price: 180, characteristics: ["Плотность: D500","Размер: 600x300x200 мм","Прочность: B3.5"] },
    { company: "stroy_boss", treePath: "3.4.4", name: "Кирпич полнотелый М150", classes: ["STANDARD"], region: "г. Москва", unit: "шт", price: 25, characteristics: ["Размер: 250x120x65 мм","Прочность: М150","Морозостойкость: F50"] },
    { company: "ural_steel", treePath: "2.6.2.1", name: "Балка двутавровая 20Б1 С245", classes: ["STANDARD","COMFORT"], region: "Свердловская область", unit: "т", price: 68000, characteristics: ["Профиль: 20Б1","Сталь: С245","Длина: 12 м"] },
    { company: "ural_steel", treePath: "2.6.2.1", name: "Швеллер 20П С345", classes: ["STANDARD","COMFORT","BUSINESS"], region: "Свердловская область", unit: "т", price: 72000, characteristics: ["Профиль: 20П","Сталь: С345","Длина: 12 м"] },
    { company: "steel_doors", treePath: "6.4", name: "Дверь входная Стальная-Премиум", classes: ["COMFORT","BUSINESS"], region: "Новосибирская область", unit: "шт", price: 45000, characteristics: ["Толщина металла: 1.5 мм","Замки: 3 класса","Утепление: минвата"] },
    { company: "steel_doors", treePath: "6.1", name: "Дверь входная МОП Стальная-Стандарт", classes: ["STANDARD"], region: "Новосибирская область", unit: "шт", price: 28000, characteristics: ["Толщина металла: 1.2 мм","Замки: 2 класса","Доводчик в комплекте"] },
    { company: "keram_facade", treePath: "4.1.2.2.2", name: "Кирпич клинкерный KeramBrick NF", classes: ["COMFORT","BUSINESS"], region: "г. Москва", unit: "шт", price: 95, characteristics: ["Формат: NF","Пустотность: полнотелый","Морозостойкость: F200"] },
    { company: "arch_moscow", treePath: "4.3", name: "Молдинг фасадный ArchDecor 60мм", classes: ["BUSINESS","PREMIUM"], region: "г. Москва", unit: "п.м", price: 1200, characteristics: ["Ширина: 60 мм","Материал: полиуретан"] },
    { company: "stroy_boss", treePath: "7.3.2.3.1", name: "Конвектор внутрипольный StroyTherm 200", classes: ["COMFORT","BUSINESS"], region: "г. Москва", unit: "шт", price: 18500, characteristics: ["Длина: 2000 мм","Теплоотдача: 2.5 кВт","Вентилятор: тангенциальный"] },
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
    { author: "smirnov_pro", target: "ural_steel", company: "ural_steel", scores: [4,4,3,4,4,4,3,5,3], comment: "Неплохой поставщик металлопроката. Качество стали хорошее, но один раз была задержка поставки на неделю. Цены средние по рынку, но для крупных заказов дают хорошие скидки. Работаем дальше." },
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
    { author: "sidorova_anna", title: "Спецификация отделочных материалов ЖК «Солнечный»", treePath: "13.9", coinPrice: 15, fileUrl: "https://docs.google.com/finishing-spec", fileSize: 4200000, approved: true },
    { author: "ivanov_tech", title: "Техническое задание на монтаж оконных конструкций", treePath: "5.1", coinPrice: 8, fileUrl: "https://docs.google.com/windows-tz", fileSize: 1800000, approved: true },
    { author: "smirnov_pro", title: "Стандарт организации: входные группы МОП", treePath: "6.1", coinPrice: 12, fileUrl: "https://docs.google.com/entrance-standard", fileSize: 3100000, approved: true },
    { author: "stroy_boss", title: "Каталог газобетонных блоков StroyTech", treePath: "3.4.1", coinPrice: 5, fileUrl: "https://docs.google.com/gasblock-catalog", fileSize: 5600000, approved: true },
    { author: "keram_facade", title: "Инструкция по монтажу клинкерной плитки KeramPro", treePath: "4.1.2.2", coinPrice: 5, fileUrl: "https://docs.google.com/kerampro-montage", fileSize: 4800000, approved: true },
    { author: "ural_steel", title: "Сортамент металлопроката УралКрепСтрой", treePath: "2.6.2.1", coinPrice: 5, fileUrl: "https://docs.google.com/ural-steel-sort", fileSize: 7100000, approved: true },
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
    { organizer: "stroy_boss", title: "Газобетон vs Кирпич: выбор материалов для строительства", date: new Date(now.getTime() + 14 * 86400000), time: "10:00", description: "Сравнительный анализ стеновых материалов. Экономика строительства, теплотехника, скорость возведения.", treePath: "3.4", coinPrice: 0, status: "APPROVED" },
    { organizer: "ural_steel", title: "Металлоконструкции в современном строительстве", date: new Date(now.getTime() + 21 * 86400000), time: "14:00", description: "Применение стальных конструкций в жилом и коммерческом строительстве. Преимущества, нормативная база, примеры проектов.", treePath: "2.6.2.1", coinPrice: 3, status: "APPROVED" },
    { organizer: "arch_moscow", title: "Архитектурный бетон в интерьере общественных пространств", date: new Date(now.getTime() + 5 * 86400000), time: "12:00", description: "Тренды в оформлении общественных зон ЖК. Бетонные панели, малые формы, освещение.", treePath: "17.2", coinPrice: 5, status: "APPROVED" },
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
      treePath: "2.6",
      options: ["Да, используем BIM", "Нет, не используем"],
      votes: [5, 4],
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
      options: ["Да, готов делиться", "Нет, пока не готов"],
      votes: [6, 4],
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
    account: `<h2>Личный кабинет участника</h2><p>Управляйте своим профилем, финансами, отзывами, конференциями и документами.</p>`,
    company: `<h2>Личный кабинет компании</h2><p>Управляйте профилем компании, товарами и услугами, финансами, отзывами и конференциями.</p>`,
    admin: `<h2>Панель управления</h2><p>Управление контентом платформы, пользователями, модерация конференций и библиотеки, биллинг и финансы.</p>`,
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
