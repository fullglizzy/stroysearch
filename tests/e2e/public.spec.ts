import { test, expect } from "@playwright/test";
import { prisma, collectErrors } from "./helpers";

test.describe("Публичная часть", () => {
  const pages = [
    ["/", "ЕНЦПР"],
    ["/products", "Продуктовые решения"],
    ["/suppliers", "База поставщиков и заказчиков"],
    ["/matrix", "Матрица материалов"],
    ["/library", "Библиотека"],
    ["/conferences", "Конференции"],
    ["/polls", "Статистика и опросы"],
    ["/terms", "Пользовательское соглашение"],
    ["/privacy", "Согласие"],
  ];

  for (const [url, marker] of pages) {
    test(`страница ${url} рендерится без ошибок`, async ({ page }) => {
      const errors = collectErrors(page);
      const res = await page.goto(url);
      expect(res?.status()).toBe(200);
      await expect(page.locator("body")).toContainText(marker);
      await errors.assertNoErrors();
    });
  }

  test("страницы компаний и товаров с JSON-LD", async ({ page }) => {
    const company = await prisma.company.findFirst();
    const product = await prisma.product.findFirst({
      where: { deletedAt: null, status: "PUBLISHED" },
    });
    expect(company).toBeTruthy();
    expect(product).toBeTruthy();

    await page.goto(`/suppliers/${company!.id}`);
    expect(await page.locator('script[type="application/ld+json"]').count()).toBeGreaterThan(0);
    await expect(page.locator("h1")).toContainText(company!.name);

    await page.goto(`/products/${product!.id}`);
    expect(await page.locator('script[type="application/ld+json"]').count()).toBeGreaterThan(0);
    await expect(page.locator("h1")).toContainText(product!.name);
  });

  test("гостевые CTA открывают модалку «Требуется регистрация» (вариант Б)", async ({ page }) => {
    await page.goto("/products");
    await page.getByRole("button", { name: "Добавить свой продукт" }).click();
    await expect(page.getByText("Требуется регистрация")).toBeVisible();
    await expect(page.getByRole("button", { name: "Зарегистрироваться" })).toBeVisible();
    await page.getByRole("button", { name: "Войти" }).first().click();
    await expect(page).toHaveURL(/\/login/);

    await page.goto("/matrix");
    await page.locator("text=Дать аналог").first().click();
    await expect(page.getByText("Требуется регистрация")).toBeVisible();
  });

  test("карточка «Дать аналог» видна гостям в матрице", async ({ page }) => {
    await page.goto("/matrix");
    await expect(page.locator("text=Дать аналог").first()).toBeVisible();
  });

  test("счётчик просмотров документа инкрементится при открытии", async ({ request }) => {
    const doc = await prisma.libraryDocument.findFirst({
      where: { deletedAt: null, isApproved: true },
      select: { id: true, views: true },
    });
    test.skip(!doc, "нет опубликованного документа");
    const before = doc!.views;
    const res = await request.get(`/api/library/${doc!.id}/open`, { maxRedirects: 0 });
    expect([302, 307]).toContain(res.status());
    const after = await prisma.libraryDocument.findUnique({ where: { id: doc!.id } });
    expect(after!.views).toBe(before + 1);
  });
});
