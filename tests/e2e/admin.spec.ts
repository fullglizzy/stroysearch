import { test, expect } from "@playwright/test";
import { prisma, collectErrors, loginRequest } from "./helpers";

// Роль: root (админ)

test.describe("Админ-панель", () => {
  test.beforeAll(async () => {
    // Убираем мусор от предыдущих прогонов
    await prisma.conference.deleteMany({ where: { title: { contains: "E2E" } } });
    await prisma.libraryDocument.deleteMany({ where: { title: { contains: "E2E" } } });
    await prisma.review.deleteMany({ where: { comment: { contains: "E2E" } } });
  });

  test("все разделы рендерятся без ошибок", async ({ page }) => {
    const errors = collectErrors(page);
    for (const url of [
      "/admin",
      "/admin/users",
      "/admin/products",
      "/admin/categories",
      "/admin/regions",
      "/admin/content",
      "/admin/documents",
      "/admin/conferences",
      "/admin/library",
      "/admin/reviews",
      "/admin/polls",
      "/admin/finances",
      "/admin/payouts",
      "/admin/audit",
      "/admin/support",
    ]) {
      const res = await page.goto(url);
      expect(res?.status(), url).toBe(200);
      await expect(page.locator("h1").first(), url).toBeVisible();
    }
    await errors.assertNoErrors();
  });

  test("дашборд: бейджи и график активности", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByText("Модерация отзывов").first()).toBeVisible();
    await expect(page.getByText("Активность за 30 дней")).toBeVisible();
  });

  test("опросы: вкладка открывается без ошибки Decimal", async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto("/admin/polls");
    await expect(page.getByText("Управление опросами")).toBeVisible();
    await errors.assertNoErrors();
  });

  test("модерация конференций: фильтры и одобрение", async ({ page }) => {
    const ctx = await loginRequest("petrov_engineer", "12345678");
    const title = `E2E на модерацию ${Date.now()}`;
    const res = await ctx.post("/api/conferences", {
      data: {
        title,
        date: "2026-09-10",
        time: "10:00",
        description: "E2E описание",
        treeItemId: null,
        coinPrice: 0,
        isPublic: true,
      },
    });
    expect(res.status()).toBe(200);
    await ctx.dispose();

    await page.goto("/admin/conferences?status=PENDING");
    await expect(page.getByText(title)).toBeVisible();
    await page.locator("button.text-green-600").first().click();
    // После одобрения конференция уходит из списка ожидающих
    await expect(page.getByText(title)).toHaveCount(0, { timeout: 10_000 });
  });

  test("модерация библиотеки: фильтр «На модерации» и массовое одобрение", async ({ page }) => {
    const ctx = await loginRequest("petrov_engineer", "12345678");
    const title = `E2E документ ${Date.now()}`;
    const res = await ctx.post("/api/library", {
      data: {
        title,
        treeItemId: null,
        coinPrice: 0,
        fileUrl: "/uploads/e2e-test.pdf",
        fileSize: 123,
      },
    });
    expect(res.status()).toBe(200);
    await ctx.dispose();

    await page.goto("/admin/library?status=pending");
    await expect(page.getByText(title).first()).toBeVisible();
    await page.locator("[data-slot=checkbox]").first().click();
    await page.getByRole("button", { name: "Одобрить выбранные" }).click();
    await expect(page.getByText(title).first()).toHaveCount(0, { timeout: 10_000 });
  });

  test("модерация отзывов: скрытие и жалобы", async ({ page }) => {
    const author = await prisma.user.findUnique({ where: { username: "petrov_engineer" } });
    const company = await prisma.company.findFirst({
      where: { ownerUser: { username: "keram_facade" } },
      include: { ownerUser: true },
    });
    const target = company!.ownerUser!;
    const comment = `E2E отзыв для модерации ${Date.now()}`;
    await prisma.review.create({
      data: {
        authorId: author!.id,
        targetId: target.id,
        companyId: company!.id,
        comment,
        signatureType: "nick",
        weightedAverage: 4.5,
        criteria: { create: [{ criteriaIndex: 1, score: 5 }] },
      },
    });

    await page.goto("/admin/reviews");
    await expect(page.getByText(comment)).toBeVisible();
    await page.getByRole("button", { name: "Скрыть отзыв" }).first().click();
    await expect(page.getByText(comment)).toHaveCount(0);

    await page.getByRole("tab", { name: "Скрытые" }).click();
    await expect(page.getByText(comment)).toBeVisible();
    await page.getByRole("button", { name: "Восстановить" }).first().click();
  });

  test("пользователи: экспорт CSV и массовый бан", async ({ page }) => {
    await page.goto("/admin/users");
    await expect(page.getByRole("button", { name: "Экспорт CSV" })).toBeVisible();
    await page.locator("[data-slot=checkbox]").first().click();
    await expect(page.getByText(/Выбрано: \d+/)).toBeVisible();
    await page.getByRole("button", { name: "Сбросить выбор" }).click();
  });

  test("контент: предпросмотр и история версий", async ({ page }) => {
    await page.goto("/admin/content");
    await page.getByRole("button", { name: "Предпросмотр" }).click();
    const dialog = page.locator("[data-slot=dialog-content]").last();
    await expect(dialog.locator("div.bg-menthol\\/5").first()).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "История версий" }).click();
    await expect(page.getByRole("heading", { name: "История версий" })).toBeVisible();
  });

  test("аудит: страница открывается и показывает записи", async ({ page }) => {
    await page.goto("/admin/audit");
    await expect(page.getByRole("heading", { name: "Журнал аудита" })).toBeVisible();
    await page.waitForTimeout(500);
    // Записи от действий в других тестах уже должны быть
    const hasRows = (await page.locator("text=Записей нет").count()) === 0;
    expect(hasRows).toBe(true);
  });

  test("товары: вкладка «Удалённые»", async ({ page }) => {
    await page.goto("/admin/products");
    await page.getByRole("tab", { name: "Удалённые" }).click();
    await expect(page.getByText(/Удалённых товаров нет|Восстановить/).first()).toBeVisible();
  });

  test("ролевые guard'ы: участник не попадает в админку", async () => {
    const ctx = await loginRequest("petrov_engineer", "12345678");
    const res = await ctx.get("/admin", { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    expect(res.headers()["location"]).toContain("/account");
    await ctx.dispose();
  });
});
