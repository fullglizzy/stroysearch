import { test, expect } from "@playwright/test";
import { prisma, collectErrors } from "./helpers";

// Роль: keram_facade (компания)

const PRODUCT_NAME = "E2E тестовый товар";

test.describe("Кабинет компании", () => {
  test.beforeAll(async () => {
    // Убираем мусор от предыдущих прогонов
    await prisma.product.deleteMany({ where: { name: { contains: "E2E" } } });
    await prisma.conference.deleteMany({ where: { title: { contains: "E2E" } } });
  });
  test("все разделы кабинета рендерятся без ошибок", async ({ page }) => {
    const errors = collectErrors(page);
    for (const url of [
      "/company",
      "/company/profile",
      "/company/products",
      "/company/finances",
      "/company/payouts",
      "/company/library",
      "/company/conferences",
      "/company/reviews",
      "/company/polls",
      "/company/support",
    ]) {
      const res = await page.goto(url);
      expect(res?.status(), url).toBe(200);
      await expect(page.locator("h1").first(), url).toBeVisible();
    }
    await errors.assertNoErrors();
  });

  test("дашборд: сводка с балансом и «К выплате»", async ({ page }) => {
    await page.goto("/company");
    await expect(page.getByText("Баланс").first()).toBeVisible();
    await expect(page.getByText("К выплате").first()).toBeVisible();
    await expect(page.getByText("Активных товаров").first()).toBeVisible();
  });

  test("товары: черновик не виден в матрице, после публикации виден", async ({ page }) => {
    const company = await prisma.company.findFirst({
      where: { ownerUser: { username: "keram_facade" } },
    });
    expect(company).toBeTruthy();

    // Черновик через API
    const ctx = await (await import("./helpers")).loginRequest("keram_facade", "12345678");
    const tree = await prisma.productTreeItem.findFirst({ where: { deletedAt: null } });
    const res = await ctx.post("/api/products", {
      data: {
        companyId: company!.id,
        treeItemId: tree!.id,
        name: PRODUCT_NAME,
        classes: ["STANDARD"],
        regions: [],
        unit: "шт",
        characteristics: [],
        price: 100,
        status: "DRAFT",
        description: "E2E описание",
      },
    });
    expect(res.status()).toBe(200);
    const { id: productId } = await res.json();

    // В кабинете товар есть (черновик)
    await page.goto("/company/products");
    await expect(page.getByText(PRODUCT_NAME).first()).toBeVisible();
    await expect(page.getByText("Черновик").first()).toBeVisible();
    // Бейдж категории — только номер, без названия
    const badge = page.locator("span.font-mono").first();
    const badgeText = (await badge.innerText()).trim();
    expect(badgeText).not.toContain("—");

    // В матрице черновика нет
    await page.goto(`/matrix?q=${encodeURIComponent(PRODUCT_NAME)}`);
    await expect(page.getByText("Товары не найдены").first()).toBeVisible();

    // Массовая публикация через UI: галка в футере + кнопка «Опубликовать»
    await page.goto("/company/products");
    await page.getByLabel(`Выбрать товар ${PRODUCT_NAME}`).check();
    await page.getByRole("button", { name: "Опубликовать" }).click();
    const ownCard = page
      .getByText(PRODUCT_NAME)
      .first()
      .locator("xpath=ancestor::*[@data-slot='card'][1]");
    await expect(ownCard.getByText("Черновик")).toHaveCount(0, { timeout: 10_000 });

    // Теперь товар в матрице
    await page.goto(`/matrix?q=${encodeURIComponent(PRODUCT_NAME)}`);
    await expect(page.getByText(PRODUCT_NAME).first()).toBeVisible();

    // Убираем за собой
    await ctx.delete(`/api/products/${productId}`);
    await ctx.dispose();
  });

  test("товары: дублирование создаёт копию-черновик", async ({ page }) => {
    const company = await prisma.company.findFirst({
      where: { ownerUser: { username: "keram_facade" } },
    });
    const ctx = await (await import("./helpers")).loginRequest("keram_facade", "12345678");
    const tree = await prisma.productTreeItem.findFirst({ where: { deletedAt: null } });
    const res = await ctx.post("/api/products", {
      data: {
        companyId: company!.id,
        treeItemId: tree!.id,
        name: "E2E оригинал для копии",
        classes: ["STANDARD"],
        regions: [],
        status: "PUBLISHED",
      },
    });
    const { id: originalId } = await res.json();

    await page.goto("/company/products");
    await page.getByTitle("Дублировать").first().click();
    await expect(page.getByText("E2E оригинал для копии (копия)")).toBeVisible();

    // Чистим обе
    const all = await prisma.product.findMany({
      where: { name: { contains: "E2E оригинал для копии" } },
    });
    for (const p of all) {
      await ctx.delete(`/api/products/${p.id}`);
    }
    await ctx.dispose();
  });

  test("конференции: создание, редактирование, отмена", async ({ page }) => {
    const title = `E2E конференция ${Date.now()}`;
    await page.goto("/company/conferences");
    await page.getByRole("button", { name: "Создать конференцию" }).click();
    await page.locator("#ccd-title").fill(title);
    await page.locator("#ccd-date").fill("2026-09-01");
    await page.locator("#ccd-time").fill("10:00");
    await page.locator("#ccd-description").fill("E2E описание конференции");
    await page.getByRole("button", { name: "Создать" }).click();
    await expect(page.getByText(title)).toBeVisible();
    await expect(page.getByText("На модерации").first()).toBeVisible();

    // Редактирование: диалог открывается с заполненными полями
    await page.getByRole("button", { name: "Изменить" }).first().click();
    await expect(page.locator("#ccd-title")).toHaveValue(title);
    await page.locator("#ccd-title").fill(`${title} (изменено)`);
    await page.getByRole("button", { name: "Сохранить изменения" }).click();
    await expect(page.getByText(`${title} (изменено)`)).toBeVisible();

    // Отмена — кнопка в карточке именно нашей конференции
    const card = page
      .getByText(`${title} (изменено)`)
      .locator("xpath=../..");
    await card.getByRole("button", { name: "Отменить" }).click();
    await page.getByRole("button", { name: "Отменить" }).last().click();
    await expect(page.getByText("Отменено").first()).toBeVisible();
  });

  test("профиль: ссылка на карточку в базе поставщиков", async ({ page }) => {
    const company = await prisma.company.findFirst({
      where: { ownerUser: { username: "keram_facade" } },
      select: { inn: true },
    });
    await page.goto("/company/profile");
    await expect(page.getByText("Посмотреть карточку в базе поставщиков")).toBeVisible();
    await page.getByText("Посмотреть карточку в базе поставщиков").click();
    await expect(page).toHaveURL(new RegExp(`/suppliers\\?q=${company!.inn}`));
    await expect(page.getByText(company!.inn)).toBeVisible();
  });
});
