import { test as setup, expect, request } from "@playwright/test";
import { mkdirSync } from "fs";

const AUTH_DIR = "tests/e2e/.auth";
const BASE = "http://localhost:3000";

async function login(username: string, password: string, statePath: string) {
  const ctx = await request.newContext({ baseURL: BASE });
  const csrfRes = await ctx.get("/api/auth/csrf");
  const { csrfToken } = await csrfRes.json();
  expect(csrfToken).toBeTruthy();
  const res = await ctx.post("/api/auth/callback/credentials", {
    form: { csrfToken, username, password },
    maxRedirects: 0,
  });
  // 302 на любой адрес = успешный вход; ошибка была бы CredentialsSignin
  expect(res.status()).toBe(302);
  await ctx.storageState({ path: statePath });
  await ctx.dispose();
}

setup("сохранить сессии ролей", async () => {
  mkdirSync(AUTH_DIR, { recursive: true });
  await login("petrov_engineer", "12345678", `${AUTH_DIR}/participant.json`);
  await login("keram_facade", "12345678", `${AUTH_DIR}/company.json`);
  await login("root", "12345678", `${AUTH_DIR}/root.json`);
});
