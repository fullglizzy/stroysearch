import { test, expect } from "@playwright/test";
import { prisma, collectErrors, loginRequest } from "./helpers";

// Роль: petrov_engineer (участник)

test.describe("Кабинет участника", () => {
  test.beforeAll(async () => {
    // Убираем мусор от предыдущих прогонов
    await prisma.supportTicket.deleteMany({ where: { subject: { contains: "E2E" } } });
    const me = await prisma.user.findUnique({ where: { username: "petrov_engineer" } });
    if (me) {
      await prisma.notification.deleteMany({ where: { userId: me.id } });
    }
  });

  test("все разделы кабинета рендерятся без ошибок", async ({ page }) => {
    const errors = collectErrors(page);
    for (const url of [
      "/account",
      "/account/profile",
      "/account/finances",
      "/account/library",
      "/account/conferences",
      "/account/reviews",
      "/account/polls",
      "/account/support",
    ]) {
      const res = await page.goto(url);
      expect(res?.status(), url).toBe(200);
      await expect(page.locator("h1").first(), url).toBeVisible();
    }
    await errors.assertNoErrors();
  });

  test("матрица: карточка «Дать аналог» скрыта для участника", async ({ page }) => {
    await page.goto("/matrix");
    await expect(page.locator("text=Дать аналог")).toHaveCount(0);
  });

  test("дашборд: карточка «Баланс» есть, карточки «Конференций» нет", async ({ page }) => {
    await page.goto("/account");
    await expect(page.getByText("Баланс").first()).toBeVisible();
    await expect(page.locator("text=Конференций")).toHaveCount(0);
    await expect(page.getByText("Получено отзывов")).toBeVisible();
  });

  test("финансы: фильтр истории показывает русские названия", async ({ page }) => {
    await page.goto("/account/finances");
    await page.locator("[data-slot=select-trigger]").first().click();
    await expect(page.locator("text=Все операции").first()).toBeVisible();
    await expect(page.getByText("Отзыв", { exact: true })).toBeVisible();
    await expect(page.locator("text=ADD_COMPANY")).toHaveCount(0);
    await page.keyboard.press("Escape");
  });

  test("покупка монет: «Требуется оплата» появляется сразу, без перезагрузки", async ({ page }) => {
    // Чистим счета от предыдущих прогонов — иначе упираемся в месячный лимит покупок
    const me = await prisma.user.findUnique({
      where: { username: "petrov_engineer" },
      include: { profile: true },
    });
    const oldInvoices = await prisma.invoice.findMany({
      where: { userId: me!.id, kind: "PURCHASE" },
    });
    for (const inv of oldInvoices) {
      if (inv.ticketId) {
        await prisma.supportMessage.deleteMany({ where: { ticketId: inv.ticketId } });
        await prisma.supportTicket.deleteMany({ where: { id: inv.ticketId } });
      }
      await prisma.invoice.deleteMany({ where: { id: inv.id } });
    }
    const original = {
      firstName: me!.profile?.firstName ?? null,
      lastName: me!.profile?.lastName ?? null,
      middleName: me!.profile?.middleName ?? null,
      regions: me!.profile?.regions ?? null,
    };
    const ctx = await loginRequest("petrov_engineer", "12345678");
    const patch = await ctx.patch("/api/users/me", {
      data: {
        firstName: me!.profile?.firstName || "Пётр",
        lastName: me!.profile?.lastName || "Петров",
        middleName: me!.profile?.middleName || "Петрович",
        regions: me!.profile?.regions ? me!.profile.regions.split(",").filter(Boolean) : ["Москва"],
      },
    });
    expect(patch.status()).toBe(200);

    await page.goto("/account/finances");
    await page.getByRole("button", { name: "Купить монеты" }).click();
    await page.locator("#buyAmount").fill("10");
    await page.getByRole("button", { name: "Отправить заявку" }).click();
    await expect(page.getByText("Требуется оплата", { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Счёт №/).first()).toBeVisible();

    // Восстанавливаем профиль
    await ctx.patch("/api/users/me", {
      data: {
        firstName: original.firstName ?? "",
        lastName: original.lastName ?? "",
        middleName: original.middleName ?? "",
        regions: original.regions ? original.regions.split(",").filter(Boolean) : [],
      },
    });
    await ctx.dispose();
  });

  test("опросы: фильтры не выбрасывают из кабинета", async ({ page }) => {
    await page.goto("/account/polls");
    await page.locator('input[placeholder*="Поиск"]').first().fill("строи");
    await page.waitForTimeout(600);
    const url = new URL(page.url());
    expect(url.pathname).toBe("/account/polls");
  });

  test("отзывы: кандидаты не содержат самого себя", async ({ page }) => {
    const me = await prisma.user.findUnique({
      where: { username: "petrov_engineer" },
      select: { profile: { select: { nick: true } } },
    });
    await page.goto("/account/reviews");
    await page.getByRole("tab", { name: "Оставить отзыв" }).click();
    const nick = me?.profile?.nick;
    if (nick) {
      const text = await page.locator("body").innerText();
      expect(text).not.toContain(`Ник: ${nick}`);
    }
  });

  test("уведомления: начисление монет админом даёт бейдж", async ({ page }) => {
    const target = await prisma.user.findUnique({
      where: { username: "petrov_engineer" },
      select: { id: true },
    });
    const adminCtx = await loginRequest("root", "12345678");
    const res = await adminCtx.post("/api/admin/coins", {
      data: { userId: target!.id, amount: 1, operation: "add" },
    });
    expect(res.status()).toBe(200);

    await page.goto("/account");
    await page.locator("button", { has: page.locator("svg.lucide-bell") }).click();
    await expect(page.getByText("Начислены монеты").first()).toBeVisible();

    await adminCtx.post("/api/admin/coins", {
      data: { userId: target!.id, amount: 1, operation: "subtract" },
    });
    await adminCtx.dispose();
  });

  test("поддержка: ответ сотрудника подсвечивается точкой", async ({ page }) => {
    const me = await prisma.user.findUnique({ where: { username: "petrov_engineer" } });
    const ticket = await prisma.supportTicket.create({
      data: {
        userId: me!.id,
        email: me!.email,
        subject: "E2E проверка тикета",
        message: "E2E сообщение",
      },
    });
    const adminCtx = await loginRequest("root", "12345678");
    await adminCtx.post(`/api/support/${ticket.id}/messages`, {
      data: { message: "E2E ответ поддержки", files: [] },
    });
    await adminCtx.dispose();

    await page.goto("/account/support");
    await expect(page.locator("text=E2E проверка тикета").first()).toBeVisible();
    await expect(
      page.locator("span.h-2.w-2.rounded-full.bg-orange-accent").first(),
    ).toBeVisible();
  });
});
