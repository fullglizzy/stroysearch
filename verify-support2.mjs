import { chromium } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const base = "http://localhost:3000";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

// ── 1. User creates ticket with topic from fixed list ──
await page.goto(base + "/login");
await page.fill("#username", "guest_test");
await page.fill("#password", "12345678");
await page.click('button[type="submit"]');
await page.waitForURL("**/account", { timeout: 20000 });
await page.goto(base + "/account/support", { waitUntil: "networkidle" });
await page.locator('button:has-text("Новое обращение")').click();
await page.waitForTimeout(500);
// subject is now a Select, no text input
console.log("no subject input:", (await page.locator('input#support-subject').count()) === 0);
await page.locator('[data-slot="dialog-content"] [data-slot="select-trigger"]').click();
await page.waitForTimeout(400);
await page.locator('[data-slot="select-item"]:has-text("Оплата и монеты")').first().click();
await page.waitForTimeout(300);
await page.fill('input#support-email', "guest@test.ru");
await page.fill('textarea#support-message', "Вопрос по монетам");
await page.locator('[data-slot="dialog-content"] button:has-text("Отправить")').click();
await page.waitForTimeout(2500);
console.log("ticket with topic:", await page.locator('button:has-text("Оплата и монеты")').count() > 0);

// ── 2. Root: filters + message sides ──
await page.goto(base + "/login");
await page.fill("#username", "root");
await page.fill("#password", "12345678");
await page.click('button[type="submit"]');
await page.waitForURL("**/admin", { timeout: 20000 });
await page.goto(base + "/admin/support", { waitUntil: "networkidle" });

// filters present
const selects = page.locator('button[role="combobox"]');
console.log("filter selects:", await selects.count());

// filter by topic "Оплата и монеты"
await selects.nth(0).click();
await page.waitForTimeout(400);
await page.locator('[data-slot="select-item"]:has-text("Оплата и монеты")').first().click();
await page.waitForTimeout(400);
console.log("filtered shows ticket:", await page.locator('button:has-text("Оплата и монеты")').count() > 0);

// open ticket, check sides: first message (user) left, then reply as staff → right
await page.locator('button:has-text("Оплата и монеты")').first().click();
await page.waitForTimeout(1000);
await page.fill('textarea[placeholder="Ответить пользователю..."]', "Ответ поддержки справа");
await page.locator('button:has-text("Отправить")').first().click();
await page.waitForTimeout(1000);
const sides = await page.evaluate(() => {
  const bubbles = [...document.querySelectorAll('div.rounded-lg.bg-secondary, div.rounded-lg.bg-menthol\/10')];
  return bubbles.map((b) => {
    const parent = b.parentElement;
    return parent?.className.includes("justify-end") ? "right" : "left";
  });
});
console.log("bubble sides in root:", JSON.stringify(sides));

// status filter: closed
const ticketId = (await prisma.supportTicket.findFirst({ where: { subject: "Оплата и монеты" }, select: { id: true } }))?.id;
await page.locator('button:has-text("Закрыть")').first().click();
await page.waitForTimeout(800);
await selects.nth(1).click();
await page.waitForTimeout(400);
await page.locator('[data-slot="select-item"]:has-text("Закрытые")').first().click();
await page.waitForTimeout(400);
console.log("closed filter shows ticket:", await page.locator('button:has-text("Оплата и монеты")').count() > 0);

// cleanup
if (ticketId) {
  await prisma.supportTicket.delete({ where: { id: ticketId } });
  console.log("cleanup done");
}
await browser.close();
await prisma.$disconnect();
