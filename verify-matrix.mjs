import { chromium } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const base = "http://localhost:3000";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });

// matrix with all categories (multiple groups) → horizontal scrollers
await page.goto(base + "/matrix", { waitUntil: "networkidle" });
const groups = await page.locator("h2").count();
console.log("category sections:", groups);
console.log("horizontal scrollers:", await page.locator('div.overflow-x-auto').count());
console.log("fixed-width cards (w-72):", await page.locator('div.w-72').count() > 0);

// default sort = by rating: pick the first category, compare ratings order
const firstGroupRatings = await page.evaluate(() => {
  const scroller = document.querySelector("div.overflow-x-auto");
  if (!scroller) return null;
  return [...scroller.querySelectorAll(".text-menthol.text-lg")].map(el => el.textContent);
});

// sort select exists with default "По рейтингу"
const trigger = page.locator('button[role="combobox"]').first();
console.log("sort trigger text:", JSON.stringify((await trigger.textContent())?.trim()));

// select a single classifier → single category → grid of 4 columns
await page.locator('button:has-text("Фильтры")').first().click();
await page.waitForTimeout(400);
const classifierMulti = page.locator('button:has-text("Все категории")').first();
await classifierMulti.click();
await page.waitForTimeout(400);
await page.locator('input[placeholder="Поиск категории..."]').fill("4.1.2");
await page.waitForTimeout(300);
await page.locator('div.max-h-60 button', { hasText: /^4\.1\.2 —/ }).first().click();
await page.waitForTimeout(400);
await page.locator("h1").click({ force: true });
await page.waitForTimeout(400);

const scrollerCount = await page.locator('div.overflow-x-auto').count();
console.log("single category scrollers:", scrollerCount);
const grid = page.locator('div.grid.lg\:grid-cols-4');
console.log("4-col grid present:", await grid.count() > 0);
const cols = await page.evaluate(() => {
  const g = document.querySelector('div.grid');
  if (!g) return null;
  return getComputedStyle(g).gridTemplateColumns.split(" ").length;
});
console.log("grid column count:", cols);
console.log("cards in grid:", await grid.locator('div.flex.flex-col').count());

await browser.close();
await prisma.$disconnect();
