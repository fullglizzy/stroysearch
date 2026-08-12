import { chromium } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();
const base = "http://localhost:3000";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });

const pngPath = path.join(process.cwd(), "test-photo.png");
fs.writeFileSync(pngPath, Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c626001000000ffff03000006000557bfabd40000000049454e44ae426082", "hex"));

// company: add product with photo + characteristic template
const item = await prisma.productTreeItem.findFirst({ where: { fullNumberPath: "4.1.2.2" } });
await prisma.productTreeItem.update({
  where: { id: item.id },
  data: { unitOptions: JSON.stringify(["м²"]), characteristics: JSON.stringify([{ name: "Плотность", value: "", unit: "кг/м³" }]) },
});

await page.goto(base + "/login");
await page.fill("#username", "stroy_boss");
await page.fill("#password", "12345678");
await page.click('button[type="submit"]');
await page.waitForURL("**/company", { timeout: 20000 });
await page.goto(base + "/company/products", { waitUntil: "networkidle" });
await page.locator('button:has-text("Добавить свой продукт")').click();
await page.waitForTimeout(500);
const dialog = page.locator('[data-slot="dialog-content"]');
await dialog.locator('input#name').fill("ТестКарточка Фото13");
await dialog.locator('button:has-text("Выберите категорию")').click();
await page.waitForTimeout(400);
await page.locator('input[placeholder="Поиск категории..."]').fill("4.1.2.2");
await page.waitForTimeout(300);
await page.locator('div.max-h-60 button', { hasText: /^4\.1\.2\.2 —/ }).first().click();
await page.waitForTimeout(500);
console.log("name kept after category:", JSON.stringify(await dialog.locator('input#name').inputValue()));
await dialog.locator('input[type="file"]').first().setInputFiles(pngPath);
await page.waitForTimeout(2000);
await dialog.locator('input#price').fill("1234");
await dialog.locator('input[name="class_STANDARD"]').check();
await dialog.locator('input[placeholder="Значение"]').fill("900");
await dialog.locator('button[type="submit"]').first().click();
await page.waitForTimeout(2500);
console.log("dialog closed:", (await page.locator('input#name').count()) === 0);

const product = await prisma.product.findFirst({ where: { name: "ТестКарточка Фото13" } });
console.log("product created:", product ? JSON.stringify({ imageUrl: product.imageUrl, characteristics: product.characteristics, unit: product.unit }) : null);

// matrix: corner photo + preview + parsed characteristic
await page.goto(base + "/matrix?classifier=4.1.2.2", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
const thumb = page.locator('button[title="Открыть фото"]');
console.log("corner photo count:", await thumb.count());
await thumb.first().click();
await page.waitForTimeout(600);
console.log("preview dialog:", await page.locator('[data-slot="dialog-content"] img').count() > 0);
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
console.log("card shows Плотность:", await page.locator('text=Плотность').count() > 0);
console.log("card shows 900:", await page.locator('text=900').count() > 0);

// cleanup
if (product) await prisma.product.delete({ where: { id: product.id } });
await prisma.productTreeItem.update({ where: { id: item.id }, data: { unitOptions: "[]", characteristics: "[]" } });
for (const f of fs.readdirSync(path.join(process.cwd(), "public", "uploads"))) {
  if (f.endsWith(".png")) fs.rmSync(path.join(process.cwd(), "public", "uploads", f));
}
fs.rmSync(pngPath, { force: true });
console.log("cleanup done");
await browser.close();
await prisma.$disconnect();
