import { PrismaClient } from "@prisma/client";
import type { Page } from "@playwright/test";

export const prisma = new PrismaClient();

/** Подключает коллектор ошибок консоли/страницы; в конце теста бросает при ошибках */
export function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
  });
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  return {
    async assertNoErrors() {
      // Даём время асинхронным ошибкам (fetch, эффекты) всплыть
      await page.waitForTimeout(500);
      if (errors.length > 0) {
        throw new Error(`Ошибки консоли:\n${errors.join("\n")}`);
      }
    },
  };
}

export async function loginRequest(username: string, password: string) {
  const { request } = await import("@playwright/test");
  const ctx = await request.newContext({ baseURL: "http://localhost:3000" });
  const csrf = await (await ctx.get("/api/auth/csrf")).json();
  await ctx.post("/api/auth/callback/credentials", {
    form: { csrfToken: csrf.csrfToken, username, password },
  });
  return ctx;
}
