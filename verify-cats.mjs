import { chromium } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const base = "http://localhost:3000";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });

// ── 1. root: admin categories page ──
await page.goto(base + "/login");
await page.fill("#username", "root");
await page.fill("#password", "12345678");
await page.click('button[type="submit"]');
await page.waitForURL("**/admin", { timeout: 20000 });
console.log("nav card:", await page.locator('a[href="/admin/categories"]').count() > 0);
await page.goto(base + "/admin/categories", { waitUntil: "networkidle" });
console.log("page:", await page.locator('h1:has-text("Настройки категорий")').count() > 0);

// select category 4.1.2.2
await page.locator('button[role="combobox"]').first().click();
await page.waitForTimeout(400);
await page.locator('input[placeholder="Поиск категории..."]').fill("4.1.2.2");
await page.waitForTimeout(300);
await page.locator('div.max-h-60 button', { hasText: /^4\.1\.2\.2 —/ }).first().click();
await page.waitForTimeout(400);

// add unit "м²"
await page.fill('input[placeholder="Например: шт, м², кг..."]', "м²");
await page.locator('button:has-text("Добавить")').first().click();
await page.waitForTimeout(300);
// add characteristic
await page.locator('button:has-text("Добавить характеристику")').click();
await page.waitForTimeout(300);
const charInputs = page.locator('input[placeholder="Название"], input[placeholder="Значение"], input[placeholder="Ед. изм."]');
console.log("char inputs:", await charInputs.count());
// fill: name=Плотность, value=1200, unit=кг/м³
const rowInputs = page.locator('div.flex.flex-col.sm\:flex-row input');
console.log("row inputs count:", await rowInputs.count());
await rowInputs.nth(0).fill("Плотность");
await rowInputs.nth(1).fill("1200");
await rowInputs.nth(2).fill("кг/м³");
await page.locator('button:has-text("Сохранить")').first().click();
await page.waitForTimeout(2000);

const tree = await prisma.productTreeItem.findFirst({ where: { fullNumberPath: "4.1.2.2" } });
console.log("saved units:", tree?.unitOptions);
console.log("saved chars:", tree?.characteristics);

// ── 2. company: product form shows units + characteristics ──
await page.goto(base + "/login");
await page.fill("#username", "stroy_boss");
await page.fill("#password", "12345678");
await page.click('button[type="submit"]');
await page.waitForURL("**/company", { timeout: 20000 });
await page.goto(base + "/company/products", { waitUntil: "networkidle" });
await page.locator('button:has-text("Добавить свой продукт")').click();
await page.waitForTimeout(500);
const dialog = page.locator('[data-slot="dialog-content"]');

// region is SearchSelect
console.log("region SearchSelect:", await dialog.locator('button:has-text("Выберите регион")').count() > 0);

// pick category 4.1.2.2
await dialog.locator('button:has-text("Выберите категорию")').click();
await page.waitForTimeout(400);
await dialog.locator('input[placeholder="Поиск категории..."]').fill("4.1.2.2");
await page.waitForTimeout(300);
await page.locator('div.max-h-60 button', { hasText: /^4\.1\.2\.2 —/ }).first().click();
await page.waitForTimeout(400);

// units select shows м²
const unitTrigger = page.locator('button:has-text("Выберите единицу")');
console.log("unit select:", await unitTrigger.count() > 0);
await unitTrigger.click();
await page.waitForTimeout(400);
console.log("unit option м²:", await page.locator('[data-slot="select-item"]:has-text("м²")').count() > 0);
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
console.log("char Плотность prefilled:", await page.locator('input[placeholder="Значение"]').first().inputValue());

// cleanup: clear saved settings
const item = await prisma.productTreeItem.findUnique({ where: { fullNumberPath: "4.1.2.2" } });
if (item) {
  await prisma.productTreeItem.update({ where: { id: item.id }, data: { unitOptions: "[]", characteristics: "[]" } });
  console.log("cleanup done");
}
await browser.close();
await prisma.$disconnect();
