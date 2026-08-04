# Техническое задание

## Единый независимый центр продуктовых решений, закупок и технических заданий строительной отрасли

**Редакция:** 02.08.2026  
**Стек:** Next.js 16 (Turbopack) · TypeScript · PostgreSQL · Prisma · Tailwind CSS · shadcn/ui · NextAuth.js

---

# Часть I. Общие сведения

## 1. Наименование и назначение платформы

### 1.1. Название
**«Единый независимый центр продуктовых решений, закупок и технических заданий строительной отрасли»** (ЕЦПР).

### 1.2. Цель
Укрепить российский рынок строительства, повысить конкурентоспособность отечественных компаний, создать независимое пространство для инженеров, специалистов по закупкам, поставщиков и собственников компаний.

### 1.3. Миссия
Создать открытую независимую платформу, где каждый специалист — от инженера до руководителя — сможет найти актуальные решения, поделиться опытом, сформировать технические задания, оптимизировать процессы закупок и презентовать свой продукт.

### 1.4. Целевая аудитория
- Инженеры и проектировщики
- Специалисты по закупкам и снабжению
- Продуктологи в девелопменте
- Руководители и собственники строительных компаний
- Поставщики строительных товаров и услуг

### 1.5. Основатель
Кокорев Кирилл Владимирович.

---

## 2. Технический стек

| Слой | Технология | Обоснование |
|---|---|---|
| **Фреймворк** | Next.js 16 (App Router) | Серверный рендеринг (SSR), статическая генерация (SSG), Server Actions, единый full-stack фреймворк |
| **Бандлер** | Turbopack | Встроен в Next.js 16, быстрая сборка (Rust) |
| **Язык** | TypeScript 5.x (strict) | Типобезопасность на всём стеке |
| **База данных** | PostgreSQL 16+ | Надёжная реляционная СУБД, поддержка ltree для иерархических структур |
| **ORM** | Prisma 6.x | Типобезопасный клиент, миграции, отличная интеграция с Next.js |
| **Аутентификация** | NextAuth.js v5 (Auth.js) | Бесшовная интеграция с Next.js, JWT, ролевая модель, refresh-токены |
| **Валидация** | Zod 4.x | Типобезопасная валидация на клиенте и сервере |
| **Стилизация** | Tailwind CSS 4.x + shadcn/ui | Современный utility-first подход, готовая библиотека компонентов |
| **Иконки** | Lucide Icons | Дерево-шейкабельные SVG-иконки |
| **Формы** | React Hook Form + Zod | Производительные формы с валидацией |
| **Таблицы** | TanStack Table v8 | Виртуализированные, сортируемые, фильтруемые таблицы |
| **Email** | Resend / React Email | Серверная отправка писем, шаблоны на React |
| **Файлы** | UploadThing / локальное хранилище | Загрузка документов и изображений |
| **Мониторинг** | Sentry / Vercel Analytics | Отслеживание ошибок и аналитика |
| **Тестирование** | Vitest + Playwright | Unit + e2e тесты |
| **Линтинг** | Biome | Быстрый линтер и форматтер |

---

## 3. Общие требования к платформе

### 3.1. Адаптивность
Платформа должна быть полностью адаптирована для ПК и мобильных устройств (mobile-first подход). Единый стиль, читаемые шрифты, адекватное восприятие на всех разрешениях.

### 3.2. Компоновка страниц
Страницы конструируются без горизонтального пролистывания. Допустимо пролистывание только вниз. Ключевая информация видна при открытии без скролла.

### 3.3. Дизайн
- **Стиль:** умеренный, без избыточных графических элементов, современный, аккуратный, функциональный.
- **Цветовая схема:** ментоловый, белый, серый, оранжевый.
- **Графика:** высокое качество, без пикселизации и артефактов.
- **Навигация:** интуитивно понятна при первом открытии.
- **Референсы:** newpeople.ru, soyuzrp.ru, russiasmartcity.ru.

### 3.4. Навигационная панель
Сверху страниц закреплена панель с логотипом «ЕЦПР» и ссылками на основные разделы.

### 3.5. Нижняя шапка (футер)
На каждой странице внизу размещены ссылки:
- Согласие на обработку персональных данных
- Условия пользовательского соглашения

### 3.6. Оптимизация хранения
Для минимизации веса большинство информации хранится по ссылкам. Документы не загружаются на сервер, за исключением документов библиотеки (ограничение: PDF до 10 МБ).

---

## 4. Ролевая модель

### 4.1. Роли пользователей

| Роль | Описание | Доступ |
|---|---|---|
| **Гость** | Незарегистрированный пользователь | Просмотр публичных страниц: дерево продуктов, база поставщиков (скрытые контакты — по клику), матрица материалов, список документов библиотеки, список конференций |
| **Участник (common)** | Зарегистрированное физическое лицо | Всё, что у гостя, +: личный кабинет, отзывы, загрузка документов, участие в конференциях, голосование в опросах, покупка документов за монеты, добавление компаний |
| **Компания (company)** | Зарегистрированное юридическое лицо | Всё, что у участника, +: управление карточками товаров/услуг, публикация в матрице материалов |
| **Модератор (moderator)** | Контент-менеджер | Управление контентом: текст страниц, баннеры, модерация конференций и документов |
| **Редактор (editor)** | Расширенный модератор | Всё, что у модератора, +: редактирование дерева продуктов, управление опросами |
| **Супер-админ (super)** | Старший администратор | Всё, что у редактора, +: управление пользователями, финансы, биллинг, зачисление монет, счета |
| **Root** | Владелец платформы | Полный доступ, включая назначение администраторов |

### 4.2. Гостевой режим (без регистрации)
- **Цель:** ознакомление с платформой, её возможностями; индексация поисковиками.
- **Доступно гостю:**
  - Просмотр продуктового дерева (страница 2)
  - Просмотр базы поставщиков и заказчиков (страница 3) — контакты скрыты за «глазком», открываются по клику с фиксацией метрики
  - Просмотр матрицы материалов (страница 4)
  - Просмотр списка документов библиотеки (страница 5) — без возможности скачивания
  - Просмотр конференций (страница 6) — без регистрации на платные
  - Просмотр опросов (страница 7) — без голосования
  - Поиск и фильтры на всех страницах
- **Кнопки действий** видны гостю. При нажатии — модальное окно: «Это действие доступно только зарегистрированным пользователям. Хотите войти или создать аккаунт?» (с кнопками «Войти» и «Зарегистрироваться»).
- **Метрика:** клики гостей по скрытым контактам учитываются в метрике компании (для последующей монетизации).

### 4.3. Таблица прав доступа по страницам

| Действие | Гость | Участник | Компания | Модератор | Редактор | Супер-админ |
|---|---|---|---|---|---|---|
| Просмотр главной | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Просмотр дерева продуктов | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Просмотр базы поставщиков | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Клик по скрытому контакту (глазок) | ✅ (+метрика) | ✅ (+метрика) | ✅ (+метрика) | ✅ | ✅ | ✅ |
| Просмотр матрицы материалов | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Просмотр списка библиотеки | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Покупка документа библиотеки | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Загрузка документа | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Просмотр конференций | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Создание конференции | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Участие в платной конференции | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Голосование в опросах | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Добавление компании по ИНН | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Оставление отзыва | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Добавление товара/услуги | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Дать аналог | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Модерация контента | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Редактирование дерева | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Управление пользователями | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Финансы / биллинг | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Полный доступ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ (root) |

---

# Часть II. Архитектура Next.js-приложения

## 5. Структура проекта

```
kokorev-platform/
├── .next/                          # Сборка Next.js
├── prisma/
│   ├── schema.prisma               # Схема БД
│   └── migrations/                 # Файлы миграций
├── public/
│   ├── uploads/                    # Загруженные файлы (изображения, PDF)
│   └── static/                     # Статические ресурсы
├── src/
│   ├── app/                        # App Router (Next.js 16)
│   │   ├── layout.tsx              # Корневой layout (html, body, провайдеры)
│   │   ├── page.tsx                # Главная страница (страница 1)
│   │   ├── loading.tsx             # Глобальный loading skeleton
│   │   ├── error.tsx               # Глобальная страница ошибок
│   │   ├── not-found.tsx           # Страница 404
│   │   ├── (public)/               # Группа публичных страниц (без авторизации)
│   │   │   ├── products/           # /products — Продуктовые решения (стр. 2)
│   │   │   ├── suppliers/          # /suppliers — База поставщиков (стр. 3)
│   │   │   ├── matrix/             # /matrix — Матрица материалов (стр. 4)
│   │   │   ├── library/            # /library — Библиотека ТЗ (стр. 5)
│   │   │   ├── conferences/        # /conferences — Конференции (стр. 6)
│   │   │   └── polls/              # /polls — Статистика и опросы (стр. 7)
│   │   ├── (auth)/                 # Группа аутентификации
│   │   │   ├── login/              # /login
│   │   │   ├── register/           # /register
│   │   │   └── register/company/    # /register/company
│   │   ├── (dashboard)/            # Группа личных кабинетов (требуется авторизация)
│   │   │   ├── account/            # /account — ЛК Участника (стр. 8)
│   │   │   │   ├── finances/       # Мои финансы
│   │   │   │   ├── reviews/        # Мои отзывы
│   │   │   │   ├── conferences/    # Мои конференции
│   │   │   │   ├── library/        # Моя библиотека
│   │   │   │   ├── polls/          # Статистика и опросы
│   │   │   │   └── profile/        # Личные данные
│   │   │   ├── company/            # /company — ЛК Компании (стр. 9)
│   │   │   │   ├── finances/
│   │   │   │   ├── reviews/
│   │   │   │   ├── conferences/
│   │   │   │   ├── library/
│   │   │   │   ├── products/       # Мои товары и услуги
│   │   │   │   ├── polls/
│   │   │   │   └── profile/
│   │   │   └── admin/              # /admin — ЛК Модератора (стр. 10)
│   │   │       ├── content/        # Управление контентом
│   │   │       ├── users/          # Управление пользователями
│   │   │       ├── products/       # Продуктовые решения
│   │   │       ├── suppliers/      # База поставщиков
│   │   │       ├── conferences/    # Модерация конференций
│   │   │       ├── library/        # Модерация библиотеки
│   │   │       ├── goods/          # Товары и услуги
│   │   │       ├── polls/          # Опросы
│   │   │       └── finances/       # Финансы и биллинг
│   │   └── api/                    # API Routes (App Router)
│   │       ├── auth/               # NextAuth /api/auth/[...nextauth]
│   │       ├── products/           # CRUD дерева продуктов
│   │       ├── suppliers/          # База поставщиков
│   │       ├── matrix/             # Матрица материалов
│   │       ├── library/            # Библиотека
│   │       ├── conferences/        # Конференции
│   │       ├── polls/              # Опросы
│   │       ├── users/              # Пользователи
│   │       ├── reviews/            # Отзывы
│   │       ├── coins/              # Монетная экономика
│   │       ├── billing/            # Биллинг и счета
│   │       └── upload/             # Загрузка файлов
│   ├── components/                 # Переиспользуемые компоненты
│   │   ├── ui/                     # shadcn/ui компоненты
│   │   ├── layout/                 # Header, Footer, Sidebar, Navbar
│   │   ├── forms/                  # Формы (логин, регистрация, отзывы, etc.)
│   │   ├── tables/                 # Таблицы (поставщики, конференции, etc.)
│   │   ├── cards/                  # Карточки (товар, компания, документ)
│   │   ├── tree/                   # Компонент иерархического дерева
│   │   └── shared/                 # Общие: EyeButton (глазок), StarRating, etc.
│   ├── lib/                        # Библиотеки и утилиты
│   │   ├── prisma.ts               # Клиент Prisma (singleton)
│   │   ├── auth.ts                 # Конфигурация NextAuth
│   │   ├── auth.config.ts          # NextAuth config
│   │   ├── validators/             # Zod-схемы
│   │   ├── utils.ts                # Общие утилиты
│   │   ├── phone.ts                # Работа с телефонами (libphonenumber-js)
│   │   ├── rating.ts               # Расчёт рейтинга
│   │   ├── coins.ts                # Логика монетной экономики
│   │   ├── billing.ts              # Биллинг и счета
│   │   ├── tree.ts                 # Утилиты для ltree
│   │   ├── inn.ts                  # Работа с API ФНС (ИНН)
│   │   └── email.ts                # Отправка email
│   ├── server/                     # Серверные действия (Server Actions)
│   │   ├── auth/                   # Регистрация, логин, логаут
│   │   ├── products/               # CRUD дерева продуктов
│   │   ├── suppliers/              # База поставщиков
│   │   ├── matrix/                 # Матрица материалов
│   │   ├── library/                # Библиотека
│   │   ├── conferences/            # Конференции
│   │   ├── polls/                  # Опросы
│   │   ├── reviews/                # Отзывы
│   │   ├── coins/                  # Монеты
│   │   ├── billing/                # Счета
│   │   └── admin/                  # Административные действия
│   ├── hooks/                      # React-хуки
│   ├── providers/                  # Провайдеры (SessionProvider, ThemeProvider)
│   ├── types/                      # TypeScript-типы
│   └── middleware.ts               # Next.js Middleware (защита маршрутов)
├── emails/                         # React Email шаблоны
│   ├── invoice.tsx
│   ├── welcome.tsx
│   └── notification.tsx
├── tests/
│   ├── unit/                       # Vitest unit-тесты
│   └── e2e/                        # Playwright e2e-тесты
├── .env                            # Переменные окружения (локально)
├── .env.example                    # Пример переменных
├── next.config.ts                  # Конфигурация Next.js 16
├── tailwind.config.ts              # Конфиг Tailwind CSS
├── components.json                 # Конфиг shadcn/ui
├── tsconfig.json                   # TypeScript конфигурация
├── biome.json                      # Конфиг Biome
├── docker-compose.yml              # PostgreSQL для разработки
└── package.json
```

---

## 6. Модель данных (Prisma Schema)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  extensions = [ltree]
}

// ─────────────────────────── ПОЛЬЗОВАТЕЛИ ───────────────────────────

enum UserStatus {
  INACTIVE
  ACTIVE
  BANNED
  DELETED
}

enum UserType {
  COMMON        // обычный участник
  COMPANY       // компания
  MODERATOR     // модератор
  EDITOR        // редактор
  SUPER         // супер-админ
  ROOT          // владелец
}

model User {
  id            String     @id @default(uuid()) @db.Uuid
  username      String     @unique @db.VarChar(63)
  pwdHash       String     @map("pwd_hash")
  email         String     @unique @db.VarChar(255)
  phone         String?    @unique @db.VarChar(20)
  status        UserStatus @default(INACTIVE)
  type          UserType   @default(COMMON)
  createdAt     DateTime   @default(now()) @map("created_at")
  updatedAt     DateTime   @updatedAt @map("updated_at")
  deletedAt     DateTime?  @map("deleted_at")

  // Профиль участника / компании
  profile       UserProfile?
  // Служебные поля
  serviceFields UserServiceFields?
  // Администратор (если type != COMMON/COMPANY)
  admin         Admin?
  // Отзывы (которые оставил)
  givenReviews  Review[]    @relation("ReviewAuthor")
  // Отзывы (которые получил)
  receivedReviews Review[]  @relation("ReviewTarget")
  // Документы в библиотеке
  documents     LibraryDocument[]
  // Конференции (организатор)
  conferences   Conference[]
  // Товары/услуги (для компании)
  products      Product[]
  // Монеты
  wallet        Wallet?
  // Счета
  invoices      Invoice[]
  // Транзакции
  transactions  Transaction[]

  @@map("users")
}

model UserProfile {
  userId        String     @id @db.Uuid
  user          User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  firstName     String?    @map("first_name") @db.VarChar(127)
  lastName      String?    @map("last_name") @db.VarChar(127)
  middleName    String?    @map("middle_name") @db.VarChar(127)
  nick          String?    @unique @db.VarChar(63)
  region        String?    @db.VarChar(255)
  roles         UserProfileRole[]  // роли: продуктолог, тендерный специалист и т.д.
  classifierIds  String[]  @map("classifier_ids") @db.VarChar(31)  // уникальные номера классификатора
  isContactsHidden Boolean  @default(true) @map("is_contacts_hidden")
  
  // Для компании
  inn           String?    @unique @db.VarChar(12)
  companyName   String?    @map("company_name") @db.VarChar(511)
  kpp           String?    @db.VarChar(9)
  legalAddress  String?    @map("legal_address") @db.VarChar(511)
  directorName  String?    @map("director_name") @db.VarChar(255)

  @@map("user_profiles")
}

model UserProfileRole {
  id            String     @id @default(uuid()) @db.Uuid
  profileId     String     @map("profile_id") @db.Uuid
  profile       UserProfile @relation(fields: [profileId], references: [userId], onDelete: Cascade)
  role          ProfileRole

  @@map("user_profile_roles")
}

enum ProfileRole {
  PRODUCTOLOGIST      // продуктолог
  TENDER_SPECIALIST   // тендерный специалист
  DESIGNER           // проектировщик
  COMPANY_OWNER      // владелец компании
  OTHER              // иное
}

model UserServiceFields {
  userId         String     @id @db.Uuid
  user           User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  emailVerifToken String?   @map("email_verif_token") @db.VarChar(255)
  isEmailVerified Boolean   @default(false) @map("is_email_verified")
  isPhoneVerified Boolean   @default(false) @map("is_phone_verified")
  refreshTokenHash String?  @map("refresh_token_hash")

  @@map("user_service_fields")
}

model Admin {
  userId          String      @id @db.Uuid
  user            User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  permissions     Json        @default("{}") @map("admin_permissions") @db.JsonB
  adminType       UserType    @map("admin_type") // MODERATOR | EDITOR | SUPER | ROOT

  @@map("admins")
}

// ─────────────────────────── ПРОДУКТОВОЕ ДЕРЕВО ───────────────────────────

model ProductTreeItem {
  id              String     @id @default(uuid()) @db.Uuid
  name            String     @db.VarChar(255)
  parentId        String?    @map("parent_id") @db.Uuid
  parent          ProductTreeItem? @relation("TreeChildren", fields: [parentId], references: [id], onDelete: Cascade)
  children        ProductTreeItem[] @relation("TreeChildren")
  inBranchNumber  Int        @map("in_branch_number")
  fullNumberPath  String     @map("full_number_path") @db.Ltree
  description     String?    @db.Text
  bannerUrl       String?    @map("banner_url")
  createdAt       DateTime   @default(now()) @map("created_at")
  updatedAt       DateTime   @updatedAt @map("updated_at")
  deletedAt       DateTime?  @map("deleted_at")

  @@unique([parentId, inBranchNumber])
  @@index([parentId])
  @@index([fullNumberPath])
  @@map("product_tree_items")
}

// ─────────────────────────── КОМПАНИИ (БАЗА ПОСТАВЩИКОВ) ───────────────────────────

model Company {
  id              String     @id @default(uuid()) @db.Uuid
  inn             String     @unique @db.VarChar(12)
  name            String     @db.VarChar(511)
  kpp             String?    @db.VarChar(9)
  legalAddress    String?    @map("legal_address") @db.VarChar(511)
  phone           String?    @db.VarChar(20)
  email           String?    @db.VarChar(255)
  website         String?    @db.VarChar(511)
  region          String?    @db.VarChar(255)
  classifierIds   String[]   @map("classifier_ids") @db.VarChar(31)
  addedById       String?    @map("added_by_id") @db.Uuid
  addedBy         User?      @relation("AddedCompanies", fields: [addedById], references: [id])
  ownerUserId     String?    @map("owner_user_id") @unique @db.Uuid
  ownerUser       User?      @relation("OwnedCompany", fields: [ownerUserId], references: [id])
  reviews         Review[]
  products        Product[]
  metrics         CompanyMetrics?
  createdAt       DateTime   @default(now()) @map("created_at")
  updatedAt       DateTime   @updatedAt @map("updated_at")

  @@map("companies")
}

model CompanyMetrics {
  companyId       String  @id @map("company_id") @db.Uuid
  company         Company @relation(fields: [companyId], references: [id], onDelete: Cascade)
  phoneViews      Int     @default(0) @map("phone_views")
  emailViews      Int     @default(0) @map("email_views")
  websiteViews    Int     @default(0) @map("website_views")
  reviewsViews    Int     @default(0) @map("reviews_views")
  ratingViews     Int     @default(0) @map("rating_views")

  @@map("company_metrics")
}

// ─────────────────────────── ОТЗЫВЫ И РЕЙТИНГ ───────────────────────────

model Review {
  id              String   @id @default(uuid()) @db.Uuid
  authorId        String   @map("author_id") @db.Uuid
  author          User     @relation("ReviewAuthor", fields: [authorId], references: [id])
  targetId        String   @map("target_id") @db.Uuid
  target          User     @relation("ReviewTarget", fields: [targetId], references: [id])
  companyId       String?  @map("company_id") @db.Uuid
  company         Company? @relation(fields: [companyId], references: [id])
  comment         String   @db.Text
  signatureType   String   @map("signature_type") @default("nick") // nick | name
  criteria        ReviewCriteria[]  // баллы по 9 критериям
  weightedAverage Float    @map("weighted_average")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  @@map("reviews")
}

model ReviewCriteria {
  id              String   @id @default(uuid()) @db.Uuid
  reviewId        String   @map("review_id") @db.Uuid
  review          Review   @relation(fields: [reviewId], references: [id], onDelete: Cascade)
  criteriaIndex   Int      @map("criteria_index")  // 1-9
  score           Int      // 1-5

  @@map("review_criteria")
}

// ─────────────────────────── МАТРИЦА МАТЕРИАЛОВ ───────────────────────────

enum ProductClass {
  STANDARD
  COMFORT
  BUSINESS
  PREMIUM
}

model Product {
  id              String        @id @default(uuid()) @db.Uuid
  companyId       String        @map("company_id") @db.Uuid
  company         Company       @relation(fields: [companyId], references: [id])
  ownerUserId     String?       @map("owner_user_id") @db.Uuid
  ownerUser       User?         @relation(fields: [ownerUserId], references: [id])
  treeItemId      String        @map("tree_item_id") @db.Uuid
  treeItem        ProductTreeItem @relation(fields: [treeItemId], references: [id])
  name            String        @db.VarChar(511)
  classes         ProductClass[]
  region          String?       @db.VarChar(255)
  imageUrl        String?       @map("image_url")
  unit            String?       @db.VarChar(63)
  characteristics Json          @default("[]") @db.JsonB
  price           Decimal?      @db.Decimal(12, 2)
  views           Int           @default(0)
  createdAt       DateTime      @default(now()) @map("created_at")
  updatedAt       DateTime      @updatedAt @map("updated_at")
  deletedAt       DateTime?     @map("deleted_at")

  @@map("products")
}

// ─────────────────────────── БИБЛИОТЕКА ДОКУМЕНТОВ ───────────────────────────

model LibraryDocument {
  id              String   @id @default(uuid()) @db.Uuid
  userId          String   @map("user_id") @db.Uuid
  user            User     @relation(fields: [userId], references: [id])
  treeItemId      String?  @map("tree_item_id") @db.Uuid
  treeItem        ProductTreeItem? @relation(fields: [treeItemId], references: [id])
  title           String   @db.VarChar(511)
  coinPrice       Int      @map("coin_price") @default(5)
  fileUrl         String   @map("file_url")
  fileSize        Int      @map("file_size")  // байты
  isApproved      Boolean  @default(false) @map("is_approved")
  views           Int      @default(0)
  purchasesCount  Int      @default(0) @map("purchases_count")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")
  deletedAt       DateTime? @map("deleted_at")

  // Пользователи, купившие документ
  purchasedBy     DocumentPurchase[]

  @@map("library_documents")
}

model DocumentPurchase {
  id              String          @id @default(uuid()) @db.Uuid
  documentId      String          @map("document_id") @db.Uuid
  document        LibraryDocument @relation(fields: [documentId], references: [id], onDelete: Cascade)
  userId          String          @map("user_id") @db.Uuid
  user            User            @relation(fields: [userId], references: [id])
  purchasedAt     DateTime        @default(now()) @map("purchased_at")

  @@unique([documentId, userId])
  @@map("document_purchases")
}

// ─────────────────────────── КОНФЕРЕНЦИИ ───────────────────────────

enum ConferenceStatus {
  PENDING
  APPROVED
  REJECTED
  CANCELLED
}

model Conference {
  id              String           @id @default(uuid()) @db.Uuid
  organizerId     String           @map("organizer_id") @db.Uuid
  organizer       User             @relation(fields: [organizerId], references: [id])
  title           String           @db.VarChar(511)
  logoUrl         String?          @map("logo_url")
  date            DateTime
  time            String           @db.VarChar(5)  // HH:mm московское время
  description     String           @db.Text
  treeItemId      String?          @map("tree_item_id") @db.Uuid
  treeItem        ProductTreeItem? @relation(fields: [treeItemId], references: [id])
  coinPrice       Int              @map("coin_price") @default(0)
  isPublic        Boolean          @default(true) @map("is_public")
  connectionLink  String?          @map("connection_link")
  status          ConferenceStatus @default(PENDING)
  moderatorNote   String?          @map("moderator_note")
  views           Int              @default(0)
  createdAt       DateTime         @default(now()) @map("created_at")
  updatedAt       DateTime         @updatedAt @map("updated_at")

  participants    ConferenceParticipant[]

  @@map("conferences")
}

model ConferenceParticipant {
  id              String     @id @default(uuid()) @db.Uuid
  conferenceId    String     @map("conference_id") @db.Uuid
  conference      Conference @relation(fields: [conferenceId], references: [id], onDelete: Cascade)
  userId          String     @map("user_id") @db.Uuid
  user            User       @relation(fields: [userId], references: [id])
  joinedAt        DateTime   @default(now()) @map("joined_at")

  @@unique([conferenceId, userId])
  @@map("conference_participants")
}

// ─────────────────────────── ОПРОСЫ ───────────────────────────

model Poll {
  id              String   @id @default(uuid()) @db.Uuid
  question        String   @db.Text
  treeItemId      String?  @map("tree_item_id") @db.Uuid
  treeItem        ProductTreeItem? @relation(fields: [treeItemId], references: [id])
  pollType        PollType
  coinReward      Float    @map("coin_reward") @default(0.1)
  isActive        Boolean  @default(true) @map("is_active")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  options         PollOption[]
  votes           PollVote[]

  @@map("polls")
}

enum PollType {
  DICHOTOMOUS   // Да / Нет
  MULTIPLE      // Несколько вариантов
}

model PollOption {
  id              String   @id @default(uuid()) @db.Uuid
  pollId          String   @map("poll_id") @db.Uuid
  poll            Poll     @relation(fields: [pollId], references: [id], onDelete: Cascade)
  text            String   @db.VarChar(255)
  sortOrder       Int      @map("sort_order") @default(0)

  @@map("poll_options")
}

model PollVote {
  id              String     @id @default(uuid()) @db.Uuid
  pollId          String     @map("poll_id") @db.Uuid
  poll            Poll       @relation(fields: [pollId], references: [id], onDelete: Cascade)
  optionId        String     @map("option_id") @db.Uuid
  option          PollOption @relation(fields: [optionId], references: [id])
  userId          String     @map("user_id") @db.Uuid
  user            User       @relation(fields: [userId], references: [id])
  createdAt       DateTime   @default(now()) @map("created_at")

  @@unique([pollId, userId])
  @@map("poll_votes")
}

// ─────────────────────────── МОНЕТНАЯ ЭКОНОМИКА ───────────────────────────

model Wallet {
  userId          String   @id @db.Uuid
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  balance         Float    @default(0)
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  @@map("wallets")
}

enum TransactionType {
  ADD_COMPANY           // начисление за добавление компании
  REVIEW                // начисление за отзыв
  POLL_VOTE             // начисление за голосование
  DOCUMENT_SALE         // продажа документа
  DOCUMENT_PURCHASE     // покупка документа
  CONFERENCE_ENTRY      // платный вход на конференцию
  CONFERENCE_ORGANIZER  // доход организатора конференции
  GIFT_RECEIVE          // получение подарка (списание монет)
  GIFT_SEND             // дарение монет
  MODERATOR_ADD         // ручное зачисление модератором
  ADMIN_ADJUSTMENT      // корректировка администратором
  INVOICE_PAID          // пополнение через счёт
}

model Transaction {
  id              String          @id @default(uuid()) @db.Uuid
  userId          String          @map("user_id") @db.Uuid
  user            User            @relation(fields: [userId], references: [id])
  type            TransactionType
  amount          Float           // положительное = начисление, отрицательное = списание
  balanceAfter    Float           @map("balance_after")
  description     String?         @db.Text
  metadata        Json?           @db.JsonB  // связанные id (documentId, conferenceId, pollId...)
  createdAt       DateTime        @default(now()) @map("created_at")

  @@map("transactions")
}

// ─────────────────────────── СУВЕНИРЫ / ПОДАРКИ ───────────────────────────

model Gift {
  id              String   @id @default(uuid()) @db.Uuid
  name            String   @db.VarChar(255)
  coinPrice       Int      @map("coin_price")
  limit           Int      // количество доступных
  imageUrl        String?  @map("image_url")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  // Заявки на получение
  claims          GiftClaim[]

  @@map("gifts")
}

model GiftClaim {
  id              String   @id @default(uuid()) @db.Uuid
  giftId          String   @map("gift_id") @db.Uuid
  gift            Gift     @relation(fields: [giftId], references: [id], onDelete: Cascade)
  userId          String   @map("user_id") @db.Uuid
  user            User     @relation(fields: [userId], references: [id])
  claimDate       DateTime @default(now()) @map("claim_date")

  @@map("gift_claims")
}

// ─────────────────────────── БИЛЛИНГ И СЧЕТА ───────────────────────────

model BillingConfig {
  id                  String   @id @default("default")
  coinPriceRub        Float    @map("coin_price_rub") @default(100)    // цена 1 монеты в рублях
  viewPriceRub        Float    @map("view_price_rub") @default(100)    // цена 1 просмотра в рублях
  addCompanyCoins     Float    @map("add_company_coins") @default(1)   // монет за добавление компании
  reviewCoins         Float    @map("review_coins") @default(1)        // монет за отзыв
  maxMonthlyLimit     Float    @map("max_monthly_limit") @default(1000) // предельная сумма счёта в месяц
  updatedAt           DateTime @updatedAt @map("updated_at")

  // Реквизиты платформы для счёта
  bankName            String?  @map("bank_name")
  bankInn             String?  @map("bank_inn")
  bankBik             String?  @map("bank_bik")
  bankAccount         String?  @map("bank_account")
  bankCorrAccount     String?  @map("bank_corr_account")
  organizationName    String?  @map("organization_name")
  organizationAddress String?  @map("organization_address")
  organizationInn     String?  @map("organization_inn")
  organizationKpp     String?  @map("organization_kpp")
  organizationAccount String?  @map("organization_account")
  directorName        String?  @map("director_name")
  directorPhone       String?  @map("director_phone")
  directorEmail       String?  @map("director_email")
  signatureImage      String?  @map("signature_image")
  stampImage          String?  @map("stamp_image")

  @@map("billing_config")
}

enum InvoiceStatus {
  DRAFT
  SENT
  PAID
  SKIPPED
  OVERDUE
  CANCELLED
}

model Invoice {
  id              String        @id @default(uuid()) @db.Uuid
  userId          String        @map("user_id") @db.Uuid
  user            User          @relation(fields: [userId], references: [id])
  number          String        @unique  // номер счёта
  date            DateTime
  dueDate         DateTime      @map("due_date")
  status          InvoiceStatus @default(DRAFT)
  subtotal        Float         // сумма до лимита
  limit           Float         // применённый лимит
  discount        Float         @default(0) // скидка от лимита
  total           Float         // итого к оплате
  items           InvoiceItem[]
  createdAt       DateTime      @default(now()) @map("created_at")
  updatedAt       DateTime      @updatedAt @map("updated_at")
  sentAt          DateTime?     @map("sent_at")
  paidAt          DateTime?     @map("paid_at")

  @@map("invoices")
}

model InvoiceItem {
  id              String   @id @default(uuid()) @db.Uuid
  invoiceId       String   @map("invoice_id") @db.Uuid
  invoice         Invoice  @relation(fields: [invoiceId], references: [id], onDelete: Cascade)
  description     String   @db.VarChar(511)
  quantity        Int      @default(1)
  unitPrice       Float    @map("unit_price")
  total           Float

  @@map("invoice_items")
}

// ─────────────────────────── БАННЕРЫ И КОНТЕНТ СТРАНИЦ ───────────────────────────

model PageContent {
  id              String   @id @default(uuid()) @db.Uuid
  pageKey         String   @unique @map("page_key") @db.VarChar(63)  // home, products, suppliers, etc.
  content         String   @db.Text
  bannerUrl       String?  @map("banner_url")
  updatedAt       DateTime @updatedAt @map("updated_at")

  @@map("page_contents")
}

// ─────────────────────────── ОБРАЩЕНИЯ В ПОДДЕРЖКУ ───────────────────────────

model SupportTicket {
  id              String   @id @default(uuid()) @db.Uuid
  userId          String?  @map("user_id") @db.Uuid
  user            User?    @relation(fields: [userId], references: [id])
  email           String   @db.VarChar(255)
  subject         String   @db.VarChar(511)
  message         String   @db.Text
  isResolved      Boolean  @default(false) @map("is_resolved")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  @@map("support_tickets")
}
```

---

## 7. Переменные окружения (.env)

```env
# База данных
DATABASE_URL="postgresql://user:password@localhost:5432/kokorev?schema=public"

# NextAuth
AUTH_SECRET="your-secret-here"
AUTH_URL="http://localhost:3000"

# JWT
JWT_ACCESS_SECRET="access-secret"
JWT_REFRESH_SECRET="refresh-secret"
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

# Email (Resend)
RESEND_API_KEY="re_..."

# ФНС API (автозаполнение по ИНН)
FNS_API_KEY="..."
FNS_API_URL="https://api.fns.ru/..."

# Загрузка файлов
UPLOADTHING_TOKEN="..."

# Приложение
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_APP_NAME="ЕЦПР"
```

---

# Часть III. Страницы платформы

## 8. Страница 1 — Главная страница (`/`)

### 8.1. Компоненты
| Компонент | Описание | Рендеринг |
|---|---|---|
| Header | Панель меню (логотип, навигация, вход/ЛК) | Server Component |
| HeroText | Текст модератора (цель, миссия, для кого) | Server Component + Client для редактирования модератором |
| Banner1 | Баннер №1 (загружается модератором) | Server Component |
| ConferenceTicker | Бегущая строка с предстоящими конференциями (макс. 3, автопрокрутка) | Client Component (анимация) |
| ConferenceMetrics | Метрика конференций (количество, участники) | Server Component |
| AccountButtons | Кнопки «Личный кабинет участника» и «Личный кабинет компании» | Client Component |
| SupportButton | Кнопка «Поддержка» → форма обращения | Client Component (модальное окно) |

### 8.2. Бегущая строка конференций
- Отображает до 3 ближайших конференций.
- При >3 — автоматическая прокрутка вверх.
- Если конференций нет: текст «Презентуйте свой продукт, проведите лекцию».

### 8.3. Текст главной страницы (редактируется модератором)
Стандартный текст включает приветствие, цель, миссию, описание целевой аудитории, преимущества платформы, подпись основателя.

### 8.4. Кнопка «Поддержка»
- Открывает модальное окно с формой: тема, email, сообщение.
- Создаёт запись в `SupportTicket`.
- Отправляет email модератору и заявителю.
- Гибридный вариант: через ЛК модератора и электронную почту.

### 8.5. Тип рендеринга
- **SSR (динамический):** бегущая строка конференций (revalidate: 60 секунд).
- **ISR:** текст модератора, баннер (revalidate: 300 секунд).

---

## 9. Страница 2 — Продуктовые решения (`/products`)

### 9.1. Компоненты
| Компонент | Описание |
|---|---|
| Header | Панель меню |
| PageTitle | «Продуктовые решения» |
| ModeratorText | Текст модератора (редактируемый) |
| ProductTree | Иерархическое дерево-классификатор с уникальными номерами |
| Banner2 | Баннер №2 |
| ViewProductsButton | «Посмотреть продукты данной категории» → переход на `/matrix?classifier=X.X.X` |
| ClassFilter | Фильтр по классу товара (Стандарт, Комфорт, Бизнес, Премиум) |
| AddProductButton | «Добавить свой продукт» (требует регистрации/компании) |
| ViewDocsButton | «Посмотреть документы данной категории» → переход на `/library?classifier=X.X.X` |
| AddDocButton | «Добавить документ» (требует регистрации) |

### 9.2. Продуктовое дерево (классификатор)
Иерархическая структура с автонумерацией при вставке/удалении узлов (как в Word).

**Корневые категории:**
1. Работы пред-подготовительного периода разработки проекта
2. Предпроектная подготовка
3. Конструктив
4. Фасад
5. Светопрозрачные конструкции, окна и витражное остекление
6. Двери
7. Инженерные коммуникации
8. Вентиляция и кондиционирование
9. Электроснабжение
10. Слаботочные сети
11. Подъемные механизмы и оборудование
12. Благоустройство
13. Отделочные работы и материалы
14. Навигация в помещениях
15. Сантехнические приборы
16. Моечные станции, автомойка
17. Интерьер общественных пространств
18. Уборка и клининг
19. Подготовка маркетинговых материалов

*Полный классификатор до 6 уровней вложенности — см. Приложение А.*

### 9.3. Механика автонумерации (ltree)
- При вставке элемента между существующими — номера сдвигаются автоматически.
- При удалении — номера схлопываются.
- Ссылки в матрице материалов, библиотеке, профилях компаний обновляются автоматически при изменении нумерации.
- Используется PostgreSQL-расширение `ltree` с путём вида `1.3.2.1`.

### 9.4. Тип рендеринга
- **SSR:** дерево продуктов (revalidate: 120 секунд для публичной части).
- **Client Component:** интерактивное раскрытие/сворачивание узлов дерева.

---

## 10. Страница 3 — База поставщиков и заказчиков (`/suppliers`)

### 10.1. Требует регистрации
Для полного функционала требуется регистрация. Гость видит таблицу со скрытыми контактами (иконка глаза).

### 10.2. Компоненты
| Компонент | Описание |
|---|---|
| Header | Панель меню |
| PageTitle | «База поставщиков и заказчиков» |
| ModeratorText | Текст модератора |
| Banner | Баннер |
| FilterBar | Фильтры: участники/компании, ИНН, ник/фамилия, регион, классификатор, рейтинг |
| AddCompanyButton | «Добавить компанию по ИНН» (+1 монета за добавление) |
| SuppliersTable | Таблица компаний и участников |

### 10.3. Таблица (колонки)

| Колонка | Описание | Видимость |
|---|---|---|
| Ник | Уникальный ник участника | Всем |
| ИНН | ИНН компании | Всем |
| Название компании | Полное наименование | Всем |
| Рейтинг | Средневзвешенный балл (1–100), иконка ☆ | Скрыт за глазком |
| Телефон | Контактный телефон | Скрыт за глазком |
| Метрика телефона | Количество просмотров (видно только владельцу и модератору) | Владелец / модератор |
| Email | Электронная почта | Скрыт за глазком |
| Метрика email | Количество просмотров (владелец / модератор) | Владелец / модератор |
| Классификатор | Привязанные уникальные номера | Всем |
| Роль | Продуктолог, тендерный специалист, etc. | Всем |
| Отзывы | Текстовые отзывы | Скрыт за глазком |
| Оставить отзыв | Кнопка (компании / участнику) | Авторизованным |

### 10.4. Механика «глазка»
- Контакты, рейтинг, отзывы скрыты иконкой глаза 👁️.
- Один клик — раскрытие информации + инкремент метрики просмотра для компании.
- Информация остаётся открытой в рамках сессии браузера. При переходе на другую вкладку, перезагрузке или новом входе — «глазок» снова закрыт.
- Клики и гостей, и зарегистрированных пользователей учитываются в метрике.
- Уникальность: одна сессия = один просмотр (не мультиплицируется при повторных кликах в рамках сессии).

### 10.5. Добавление компании
- Кнопка «Добавить компанию по ИНН».
- Форма: ИНН (обязательно), email (обязательно).
- Название, КПП, юридический адрес — автозаполнение через API ФНС.
- +1 монета на счёт добавившему.
- Проверка на дубликат ИНН.
- Если владелец компании хочет получить доступ к ЛК — обращение в поддержку.

### 10.6. Тип рендеринга
- **SSR:** таблица (revalidate: 60 секунд).
- **Client Component:** фильтры, пагинация, механика глазка.

---

## 11. Страница 4 — Матрица материалов «Даешь аналог!» (`/matrix`)

### 11.1. Требует регистрации
Просмотр доступен всем. Добавление аналога — только зарегистрированным компаниям.

### 11.2. Компоненты
| Компонент | Описание |
|---|---|
| Header | Панель меню |
| PageTitle | «Даешь аналог! Матрица материалов» |
| Banner | Баннер |
| ModeratorText | Текст модератора |
| FilterBar | Регион, классификатор, поиск по названию, класс товара |
| ComparisonTable | Конкурентная таблица (как DNS-сравнение) |
| GiveAnalogButton | «Дать аналог» → ЛК компании |

### 11.3. Конкурентная таблица
- Товары группируются по уникальному номеру классификатора.
- Сортировка: от меньшей цены к большей (слева направо).
- Карточка товара содержит:
  - Название компании, ИНН
  - Название товара
  - Рейтинг компании (☆)
  - Изображение товара
  - Телефон (глазок + метрика)
  - Email (глазок + метрика)
  - Цена за единицу (руб.)
  - Единица измерения
  - Регион
  - Класс товара (может быть несколько)
  - Пункт дерева (номер + название)
  - Характеристики товара (задаются модератором в шаблоне)
- Кнопка «Дать аналог» в последнем столбце.

### 11.4. Референс
dns-shop.ru/compare/ — сравнение товаров.

### 11.5. Тип рендеринга
- **SSR:** данные таблицы (revalidate: 120 секунд).
- **Client Component:** интерактивные фильтры, сортировка, глазок.

---

## 12. Страница 5 — Библиотека технических заданий (`/library`)

### 12.1. Доступ
- Список документов виден всем.
- Покупка (открытие) документа требует регистрации и наличия монет.

### 12.2. Компоненты
| Компонент | Описание |
|---|---|
| Header | Панель меню |
| PageTitle | «Библиотека» |
| ModeratorText | Текст модератора |
| Banner | Баннер |
| SearchBar | Поиск по названию документа |
| ClassifierFilter | Фильтр по уникальному номеру классификатора |
| UploadDocButton | «Загрузить документ» → ЛК |
| DocumentsTable | Табличный список документов |

### 12.3. Карточка документа
- Уникальный номер классификатора
- Название документа
- Стоимость в монетах (устанавливает загрузивший)
- Кнопка «Приобрести» (с подтверждением в модальном окне)
- Метрика просмотров

### 12.4. Механика покупки
- При нажатии «Приобрести» — модальное окно с подтверждением.
- Монеты списываются со счёта покупателя → зачисляются на счёт продавца.
- Документ открывается один раз. Далее остаётся доступным покупателю навсегда (запись в `DocumentPurchase`).
- Документы хранятся по внешней ссылке или загружаются как PDF (до 10 МБ).
- Загружающий устанавливает стоимость (рекомендация: 5–20 монет).

### 12.5. Тип рендеринга
- **SSR:** список документов (revalidate: 120 секунд).
- **Client Component:** поиск, фильтры, модальное окно покупки.

---

## 13. Страница 6 — Конференции (`/conferences`)

### 13.1. Компоненты
| Компонент | Описание |
|---|---|
| Header | Панель меню |
| PageTitle | «Конференции» |
| ModeratorText | Текст модератора |
| Banner | Баннер |
| CreateConferenceButton | «Создать конференцию» (авторизованным) |
| SearchBar | Поиск конференций |
| ConferencesTable | Табличный вид конференций |

### 13.2. Карточка конференции
- Название
- Логотип
- Дата (календарь)
- Время (московское)
- Описание (до 500 слов)
- Уникальный номер классификатора
- Цена в монетах (отображается: `N монет (~X руб.)`)
  - Если 0: вход свободный. Флаг «Только для зарегистрированных» (да/нет).
  - Если >0: требуется аутентификация + достаточно монет.
- Ссылка для подключения («Присоединиться к конференции»)
- Метрика просмотров

### 13.3. Модерация
- Созданная конференция получает статус `PENDING`.
- Модератор в ЛК одобряет (`APPROVED`) или отклоняет (`REJECTED`) с комментарием.
- Только одобренные конференции отображаются публично.

### 13.4. Рассылка
При публикации конференции — автоматическая email-рассылка по пользователям, выбравшим тематику лекций.

### 13.5. Тип рендеринга
- **SSR:** список конференций (revalidate: 60 секунд).
- **Client Component:** создание/редактирование, покупка входа.

---

## 14. Страница 7 — Статистика и опросы (`/polls`)

### 14.1. Требует регистрации
Голосование — только для зарегистрированных. Просмотр — всем.

### 14.2. Компоненты
| Компонент | Описание |
|---|---|
| Header | Панель меню |
| PageTitle | «Статистика и опросы» |
| ModeratorText | Текст модератора |
| Banner | Баннер |
| RequestPollButton | «Хочу разместить опрос» → форма поддержки |
| SearchBar | «Поиск вопроса» |
| PollsTable | Таблица опросов |

### 14.3. Карточка опроса
- Номер классификатора (из выпадающего списка)
- Вопрос (текст)
- Тип: дихотомический (Да/Нет) или множественный выбор
- Цена вознаграждения в монетах (можно дробное, например 0.1)
- Кнопка «Проголосовать» (балл начисляется)
- Кнопка «Редактировать ответ» (балл не начисляется повторно)
- Результаты: процент проголосовавших по каждому варианту
- Статистика по профилю деятельности (продуктолог, тендерный специалист, проектировщик, руководитель, иное)

### 14.4. Тип рендеринга
- **SSR:** список опросов и результаты (revalidate: 120 секунд).
- **Client Component:** голосование, интерактивные графики результатов.

---

## 15. Страница 8 — Личный кабинет участника (`/account`)

### 15.1. Регистрация
- Логин (уникальный)
- Пароль (argon2)
- Согласие на обработку персональных данных
- Согласие с условиями пользовательского соглашения
- После регистрации — заполнение профиля.

### 15.2. Разделы ЛК

#### 15.2.1. Мои финансы (`/account/finances`)
- Баланс монет (визуальное отображение)
- Кнопка «Приобрести монеты» → формирование счета → поддержка
- Кнопка «Подарить монеты» → форма: поиск по нику или ИНН, сумма
- Блок «Мои счета»: таблица счетов со статусами
- Блок «Сувениры»: движущиеся карточки подарков
  - Название, цена в монетах, лимит, изображение
  - Кнопка «Получить»: списание монет, заявка в поддержку

#### 15.2.2. Мои отзывы (`/account/reviews`)
- Рейтинг участника (средневзвешенный)
- Список текстовых отзывов
- Метрика отзывов
- Кнопка «Добавить компанию по ИНН» (+1 монета)
- Кнопка «Оставить отзыв компании» → форма:
  - Выбор подписи: имя или ник
  - Комментарий (≥100 знаков)
  - 9 оценочных критериев (☆ 1–5)
- Кнопка «Оставить отзыв участнику» → форма:
  - Выбор подписи: имя или ник
  - Комментарий (≥100 знаков)
  - 9 критериев оценки участника

#### 15.2.3. Мои конференции (`/account/conferences`)
- Кнопка «Провести лекцию»
- Таблица конференций участия
- Таблица конференций организации
- Карточка конференции:
  - Название, лого, дата, время
  - Текст (до 500 слов)
  - Выбор классификатора
  - Цена монет
  - Ссылка для подключения
  - Кнопки «Удалить», «Редактировать»
  - Метрика

#### 15.2.4. Моя библиотека (`/account/library`)
- Поиск по названию / классификатору
- Кнопка «Загрузить документ»
- Таблица документов пользователя
- Карточка: классификатор, название, цена монет, кнопка «Удалить»

#### 15.2.5. Статистика и опросы (`/account/polls`)
- Текст модератора (сокращённый)
- Баннер
- Кнопка «Хочу разместить опрос» → форма поддержки
- Бегущие блоки с вопросами

#### 15.2.6. Личные данные (`/account/profile`)
- Кнопка «Скрыть свои персональные данные от всех»
- Фамилия, Имя, Отчество
- Ник (уникальный, изменить нельзя)
- Телефон
- Email
- Регион (выпадающий список)
- Классификатор (выбор из дерева, несколько)
- Роль: продуктолог, тендерный специалист, проектировщик, владелец компании, иное (можно несколько)
- Ссылки на документы: согласие на обработку ПД, пользовательское соглашение
- Кнопка «Редактировать профиль»

---

## 16. Страница 9 — Личный кабинет компании (`/company`)

### 16.1. Регистрация
Аналогично участнику +:
- ИНН (автозаполнение названия, КПП, юр. адреса через API ФНС)
- Автоматически назначается роль `COMPANY`

### 16.2. Разделы ЛК

#### 16.2.1. Мои финансы
Аналогично участнику.

#### 16.2.2. Мои отзывы
Аналогично участнику + отзывы о компании как о поставщике.

#### 16.2.3. Мои конференции
Кнопка «Презентовать продукт», остальное аналогично участнику.

#### 16.2.4. Моя библиотека
Аналогично участнику.

#### 16.2.5. Мои товары и услуги (`/company/products`)
- Сокращённый текст модератора
- Поиск по названию товара
- Кнопка «Добавить свой продукт»
- Таблица товаров компании
- Карточка товара:
  - Класс товара (Стандарт, Комфорт, Бизнес, Премиум — можно несколько)
  - Регион
  - Изображение товара
  - Характеристики (текстовые поля)
  - Цена (руб.)
  - Метрика просмотров
  - Кнопки «Редактировать», «Удалить»

#### 16.2.6. Статистика и опросы
Аналогично участнику.

#### 16.2.7. Личные данные
- Ник (изменить нельзя)
- ИНН компании
- Название компании
- КПП
- Юридический адрес
- Телефон
- Email
- Регион
- Классификатор (можно несколько)
- Метрика просмотров телефона
- Метрика просмотров email
- Документы: согласие на обработку ПД, пользовательское соглашение
- Кнопка «Редактировать профиль»

---

## 17. Страница 10 — Личный кабинет модератора (`/admin`)

### 17.1. Блоки ЛК модератора

#### 17.1.1. Управление контентом (`/admin/content`)
- Загрузка логотипа
- Редактирование текста для каждой страницы
- Загрузка баннеров
- Загрузка документов: согласие ПД, пользовательское соглашение
- Массовая email-рассылка

#### 17.1.2. Управление пользователями (`/admin/users`)
- Таблица всех пользователей (участники + компании)
- Фильтры: участник / компания, фамилия, ник, ИНН, классификатор
- Колонки: фамилия, имя, отчество, ник, ИНН, КПП, юр. адрес, роли, телефон, метрика телефона, email, метрика email, регион, логин, пароль (скрыт), монеты
- Кнопки: «Зачислить монеты», «Добавить бесплатно монеты»
- Управление статусами счетов: оплачено / пропустить
- Формирование и отправка счета по клику
- Профиль компании с отчётами по метрикам и счетам

#### 17.1.3. Финансы и биллинг (`/admin/finances`)
- Настройка экономики:
  - Цена 1 монеты (руб.)
  - Цена 1 просмотра (руб.)
  - Начисление монет за добавление компании
  - Предельный лимит счёта в месяц
- Управление реквизитами для счетов:
  - Банк, БИК, счёт, корр. счёт
  - Название организации, ИНН, КПП, юр. адрес
  - Директор, телефон, email
  - Подпись (изображение)
  - Печать (изображение)
- Управление подарками (сувенирами):
  - Таблица: название, цена монет, лимит, изображение
  - Кнопки: добавить, редактировать, удалить

#### 17.1.4. Продуктовые решения (`/admin/products`)
- Редактирование текста страницы
- Конструктор дерева (добавление, редактирование, удаление узлов, автонумерация)
- Загрузка баннера

#### 17.1.5. База поставщиков (`/admin/suppliers`)
- Редактирование текста страницы
- Загрузка баннера

#### 17.1.6. Конференции (`/admin/conferences`)
- Редактирование текста страницы
- Загрузка баннера
- Таблица конференций
- Модерация: кнопки «Одобрено» / «Отклонено» с комментарием
- Редактирование / удаление любой конференции
- Метрика конференций

#### 17.1.7. Библиотека (`/admin/library`)
- Редактирование текста страницы
- Загрузка баннера
- Таблица документов: классификатор, название, цена монет
- Модерация документов (подтверждение перед публикацией)
- Кнопки «Удалить документ», «Добавить документ»
- Метрика просмотров

#### 17.1.8. Товары и услуги (`/admin/goods`)
- Редактирование текста страницы
- Таблица всех товаров с фильтрацией
- Карточка товара: классификатор, название, класс, регион, изображение, характеристики, цена, метрика
- Кнопки «Редактировать», «Удалить», «Добавить»

#### 17.1.9. Опросы (`/admin/polls`)
- Редактирование текста страницы, баннер
- Поиск по вопросу
- Таблица опросов
- Карточка опроса:
  - Номер классификатора (выпадающий список)
  - Вопрос (текст)
  - Тип: дихотомический / множественный выбор
  - Цена монет за ответ
  - Ответы в табличном виде
  - Процент проголосовавших от 100%
  - Ники проголосовавших
  - Статистика по профилям

---

# Часть IV. Бизнес-логика

## 18. Система рейтинга

### 18.1. Критерии оценки компании (9 критериев, каждый 1–5 ☆)
1. Качество оказанной работы / услуги / материала / поставки
2. Организация работы на объекте / организация поставки
3. Взаимодействие со специалистами компании
4. Наличие средств, необходимых для выполнения работ
5. Финансовое состояние предприятия
6. Наличие квалифицированных специалистов и руководителей
7. Срок выполнения работ / поставки
8. Стоимость и условия оплаты
9. Особые условия / гибкость в договорных отношениях

### 18.2. Критерии оценки участника (9 критериев, каждый 1–5 ☆)
1. Качество работы
2. Профессионализм
3. Коммуникабельность
4. Уважительность
5. Организованность
6. Ответственность
7. Гибкость и адаптивность
8. Работа в команде
9. Соблюдение договорённостей

### 18.3. Формула расчёта

**Средневзвешенная оценка одного отзыва:**

```
O = (x₁ + x₂ + x₃ + x₄ + x₅ + x₆ + x₇ + x₈ + x₉) / 9
```

где xₙ — балл по n-му критерию (1–5).

**Средневзвешенный рейтинг компании / участника:**

```
R = (O₁ + O₂ + ... + Oₙ) / n
```

где Oₙ — средневзвешенные оценки отзывов, n — количество отзывов.

**Приведение к 100-балльной шкале:**

```
R₁₀₀ = R × 20
```

(так как максимум O = 5, R_max = 5, 5 × 20 = 100)

### 18.4. Правила
- Оценщик должен оценить все 9 критериев для публикации.
- За публикацию отзыва начисляется 1 монета.
- Участник может изменить свою оценку.
- Текстовый комментарий обязателен (≥100 знаков).

### 18.5. Будущее расширение (задел)
В будущем 100-балльная система может стать составной: отзывы (до 70 баллов) + активность на площадке (конференции, документы) + поддержка платформы (до 100). Прямая покупка баллов исключена.

---

## 19. Монетная экономика

### 19.1. Способы получения монет

| Действие | Начисление | Настраивается |
|---|---|---|
| Добавление компании по ИНН | +1 монета | Да (модератор) |
| Публикация отзыва (компании или участнику) | +1 монета | Да |
| Голосование в опросе | Устанавливается модератором (напр. 0.1) | Да |
| Продажа документа в библиотеке | Устанавливается загрузившим (5–20) | Нет |
| Проведение платной конференции | Устанавливается организатором | Нет |
| Получение подарка от другого пользователя | По сумме перевода | Нет |
| Ручное зачисление модератором | Любое количество | Нет |

### 19.2. Способы траты монет
- Покупка документа в библиотеке
- Вход на платную конференцию
- Получение сувенира (подарка)
- Дарение монет другому пользователю

### 19.3. Валюта
- Монеты не являются денежными средствами.
- Это условные единицы программы лояльности.
- Монеты не являются криптовалютой.
- Курс покупки: 1 монета = N руб. (устанавливается модератором, по умолчанию 100 руб.).

---

## 20. Биллинг и монетизация

### 20.1. Модель монетизации
Платформа зарабатывает на просмотрах контактов компаний (per-click billing).

**Что считается:**
- Просмотр телефона (клик по глазку)
- Просмотр email (клик по глазку)
- Просмотр отзывов (клик по глазку)
- Просмотр рейтинга (клик по глазку)
- Просмотр сайта (клик по глазку)

### 20.2. Стоимость просмотра
- Цена одного просмотра устанавливается модератором (по умолчанию 100 руб.).
- Каждый уникальный просмотр в рамках сессии = +1 к счётчику.

### 20.3. Формирование счёта
- Ежемесячная постоплата.
- Счёт формируется автоматически на основе метрик просмотров за период.
- Применяется предельный лимит (cap):
  - Пример: 5 просмотров = 500 руб., 10 просмотров = 1000 руб., 15+ просмотров = всё равно 1000 руб.
- Лимит настраивается модератором.

### 20.4. Отправка и оплата счёта
- Счёт выставляется из кабинета модератора.
- Отправляется на email компании/участника.
- Статусы: черновик → отправлен → оплачен / просрочен.
- Оплата в течение 5 рабочих банковских дней.
- Просрочка: пени 1/300 ключевой ставки ЦБ РФ с 10-го банковского дня.
- При неуплате — блокировка аккаунта до погашения.

### 20.5. Счёт (реквизиты)
Форма счёта включает:
- **Платформа:** банк, ИНН, БИК, номер счёта
- **Плательщик:** полное наименование, юр. адрес, ИНН, КПП, расчётный счёт, банк, корр. счёт, БИК, директор, телефон, e-mail
- **Счёт:** номер, дата, основание оплаты
- **Услуги:** «Абонентская плата за использование платформы», «Плата за доступ к сервисам»
- **Подпись и печать** (изображения, загружаются модератором)

### 20.6. Стартовый период
Новым компаниям модератор может вручную начислить стартовые монеты для тестирования платформы.

---

## 21. Подарки / Сувениры

- Модератор создаёт карточки подарков: название, цена в монетах, лимит, изображение.
- Пользователь видит движущиеся карточки подарков в разделе «Мои финансы».
- При нажатии «Получить»:
  - Монеты списываются со счёта пользователя.
  - Лимит подарка уменьшается на 1.
  - Создаётся заявка (`GiftClaim`), уведомление уходит модератору.
- Материальные подарки до 4 000 руб./год не облагаются НДФЛ.

---

## 22. Авторизация и аутентификация

### 22.1. NextAuth.js (Auth.js v5)
- **Провайдер:** Credentials (логин + пароль).
- **Сессии:** JWT-стратегия (не БД-сессии).
- **Access Token:** 15 минут.
- **Refresh Token:** 7 дней, хранится в `UserServiceFields.refreshTokenHash`.
- **Роли:** хранятся в JWT-токене, проверяются через middleware + Server Actions.

### 22.2. Middleware (`src/middleware.ts`)
```typescript
// Защита маршрутов /account/*, /company/*, /admin/*
// Редирект на /login для неавторизованных
// Проверка роли для /admin/*
```

### 22.3. Пароли
- Хеширование: argon2id.
- Минимальная длина: 8 символов.

### 22.4. Защита от брутфорса
- Rate limiting на API-роуты `/api/auth/*` (до 5 попыток в минуту с IP).
- Redis / Upstash для хранения счётчиков.

---

## 23. API ФНС (автозаполнение по ИНН)

При регистрации компании или добавлении компании по ИНН:
1. Валидация ИНН по контрольной сумме.
2. Запрос к API ФНС (или DaData / аналогичный сервис).
3. Автозаполнение: название компании, КПП, юридический адрес.
4. Если API недоступен — ручной ввод.

---

## 24. Рассылки (Email)

Отправка через Resend + React Email:
1. **Приветственное письмо** — после регистрации.
2. **Подтверждение email** — ссылка с токеном.
3. **Счёт на оплату** — автоматически при выставлении.
4. **Уведомление о конференции** — рассылка при публикации.
5. **Массовая рассылка** — модератор из ЛК.

---

## 25. Загрузка файлов

- **Изображения:** аватары, логотипы, баннеры, фото товаров (до 5 МБ).
- **Документы:** PDF для библиотеки (до 10 МБ).
- **Хранение:** локально `/public/uploads/` или UploadThing / Vercel Blob.
- **Безопасность:** проверка MIME-типа, сканирование размера.

---

# Часть V. API и Server Actions

## 26. API Routes (App Router)

| Маршрут | Метод | Описание | Аутентификация |
|---|---|---|---|
| `/api/auth/*` | * | NextAuth handler | Нет |
| `/api/products` | GET | Получить ветки дерева | Нет |
| `/api/products` | POST | Создать узел дерева | Admin |
| `/api/products/[id]` | PATCH | Обновить узел | Admin |
| `/api/products/[id]` | DELETE | Удалить узел | Admin |
| `/api/suppliers` | GET | Список компаний/участников | Нет |
| `/api/suppliers` | POST | Добавить компанию | Auth |
| `/api/suppliers/metrics/[companyId]/click` | POST | Зафиксировать клик по глазку | Нет |
| `/api/matrix` | GET | Список товаров (с фильтрами) | Нет |
| `/api/library` | GET | Список документов | Нет |
| `/api/library` | POST | Загрузить документ | Auth |
| `/api/library/[id]/purchase` | POST | Купить документ за монеты | Auth |
| `/api/conferences` | GET | Список конференций | Нет |
| `/api/conferences` | POST | Создать конференцию | Auth |
| `/api/conferences/[id]` | PATCH | Обновить конференцию | Auth (владелец / admin) |
| `/api/conferences/[id]` | DELETE | Удалить конференцию | Auth (владелец / admin) |
| `/api/conferences/[id]/moderate` | PATCH | Модерация конференции | Admin |
| `/api/polls` | GET | Список опросов | Нет |
| `/api/polls/[id]/vote` | POST | Проголосовать | Auth |
| `/api/polls/[id]/results` | GET | Результаты опроса | Нет |
| `/api/reviews` | POST | Оставить отзыв | Auth |
| `/api/users/me` | GET | Профиль текущего пользователя | Auth |
| `/api/users/me` | PATCH | Обновить профиль | Auth |
| `/api/coins/transfer` | POST | Подарить монеты | Auth |
| `/api/gifts/[id]/claim` | POST | Запросить подарок | Auth |
| `/api/admin/*` | * | Административные операции | Admin |
| `/api/upload` | POST | Загрузка файла | Auth |

## 27. Server Actions

Для форм и мутаций, где не нужен отдельный API-роут:

- `createCompany(inn, email)` — добавление компании
- `submitReview(data)` — публикация отзыва
- `createConference(data)` — создание конференции
- `uploadDocument(data)` — загрузка документа
- `votePoll(pollId, optionId)` — голосование
- `purchaseDocument(docId)` — покупка документа
- `giftCoins(targetUserId, amount)` — дарение монет
- `claimGift(giftId)` — получение подарка
- `sendInvoice(userId)` — отправка счёта (admin)
- `addCoins(userId, amount)` — ручное зачисление монет (admin)
- `updatePageContent(pageKey, content)` — редактирование текста (admin)
- `moderateConference(confId, status, note)` — модерация (admin)

---

# Часть VI. Пользовательское соглашение

## 28. Основные положения

Полный текст Пользовательского соглашения (редакция от 15.07.2026) является неотъемлемой частью платформы и размещается:
- На странице регистрации (обязательное принятие)
- В футере каждой страницы
- В личном кабинете (раздел «Личные данные»)

### Ключевые тезисы:
1. **Публичная оферта** (ст. 437 ГК РФ). Регистрация = акцепт оферты.
2. **Администрация не является представителем пользователей** и не отвечает по их обязательствам.
3. **Возраст:** с 14 лет (с согласия законного представителя до 18).
4. **Персональные данные:** обрабатываются в соответствии с 152-ФЗ.
5. **Платные услуги:** постоплата, счета, пени, блокировка при неуплате.
6. **Программа лояльности:** монеты — условные единицы, не деньги, не криптовалюта.
7. **Права на контент:** пользователь сохраняет права, но даёт администрации неисключительную лицензию.
8. **Ответственность:** пользователь отвечает за достоверность данных.
9. **Изменение условий:** администрация вправе менять УИС в одностороннем порядке.

---

# Часть VII. База контактов отрасли

В Приложении Б содержится база из 76+ контактов поставщиков и производителей строительной отрасли (окна, фасады, освещение, оборудование детских площадок и т.д.) для начального наполнения платформы.

---

# Часть VIII. Этапы разработки

## Этап 1. MVP (базовый функционал)
- [x] Next.js 16 + Turbopack инициализация
- [x] База данных PostgreSQL + Prisma (миграции)
- [ ] NextAuth (регистрация, логин, JWT, роли)
- [ ] Главная страница (текст, баннер, бегущая строка)
- [ ] Продуктовое дерево (ltree, автонумерация, CRUD)
- [ ] База поставщиков (таблица, фильтры, глазок)
- [ ] Добавление компании по ИНН
- [ ] Личный кабинет участника (профиль, финансы)
- [ ] Личный кабинет модератора (пользователи, контент)

## Этап 2. Бизнес-логика
- [ ] Матрица материалов (конкурентная таблица)
- [ ] Товары/услуги компании
- [ ] Библиотека документов (загрузка, покупка)
- [ ] Монетная экономика (кошелёк, транзакции)
- [ ] Система отзывов и рейтинга
- [ ] Конференции (создание, модерация, рассылка)

## Этап 3. Монетизация
- [ ] Биллинг (метрики просмотров, счета)
- [ ] Формирование и отправка счетов
- [ ] Лимиты и капы
- [ ] Подарки / сувениры
- [ ] Опросы и статистика

## Этап 4. Расширенный функционал
- [ ] Онлайн-оплата (интеграция с банком)
- [ ] Расширенная аналитика
- [ ] Мобильное PWA
- [ ] Уведомления (push, Telegram)
- [ ] Расширенная система рейтинга (составной балл)
- [ ] API для внешних интеграций

---

# Приложение А. Полный классификатор продуктового дерева

*См. отдельный файл `classifier.md` или импорт из Word-файла основателя.*

Структура классификатора включает 19 корневых категорий с глубиной вложенности до 6 уровней, охватывающих все аспекты строительства: от приобретения участка до отделочных работ, благоустройства и маркетинга.

---

# Приложение Б. База контактов

*См. приложение к оригинальному ТЗ — список из 76+ контактов поставщиков строительной отрасли.*

---

**Документ подготовлен:** 02.08.2026  
**На основе:** Техническое задание от 15.07.2026 (основатель — Кокорев К.В.)  
**Технический стек:** Next.js 16 (Turbopack) · TypeScript · PostgreSQL · Prisma · Tailwind CSS · shadcn/ui · NextAuth.js
