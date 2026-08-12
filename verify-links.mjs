import { chromium } from "@playwright/test";
const base = "http://localhost:3000";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

// suppliers: reveal phone+email for first company row, check hrefs
await page.goto(base + "/suppliers", { waitUntil: "networkidle" });
const rows = page.locator("tbody tr");
for (let i = 0; i < await rows.count(); i++) {
  const row = rows.nth(i);
  const eyes = row.locator('button[aria-label*="Показать телефон"], button[aria-label*="Показать email"]');
  if (await eyes.count() < 2) continue;
  for (let j = 0; j < await eyes.count(); j++) await eyes.nth(j).click();
  await page.waitForTimeout(500);
  const tel = await row.locator('a[href^="tel:"]').first().getAttribute("href");
  const mail = await row.locator('a[href^="mailto:"]').first().getAttribute("href");
  console.log("suppliers tel:", tel);
  console.log("suppliers mailto:", mail);
  break;
}

// matrix: reveal contacts in first card with phone/email
await page.goto(base + "/matrix?classifier=4.1.2.2", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
const eye = page.locator('button[aria-label*="Показать телефон"], button[aria-label*="Показать email"]').first();
if (await eye.count() > 0) {
  await eye.click();
  await page.waitForTimeout(500);
  const hrefs = await page.evaluate(() => ({
    tel: document.querySelector('a[href^="tel:"]')?.getAttribute("href"),
    mail: document.querySelector('a[href^="mailto:"]')?.getAttribute("href"),
  }));
  console.log("matrix links:", JSON.stringify(hrefs));
}
await browser.close();
