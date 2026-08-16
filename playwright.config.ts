import { defineConfig } from "@playwright/test";

// E2E-тесты против production-сборки (npm run start на порту 3001).
// БД — dev.db; тесты создают данные с префиксом «E2E», чистятся скриптом scripts/e2e-cleanup.ts.
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    locale: "ru-RU",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "participant",
      testMatch: /participant\.spec\.ts/,
      use: { storageState: "tests/e2e/.auth/participant.json" },
      dependencies: ["setup"],
    },
    {
      name: "company",
      testMatch: /company\.spec\.ts/,
      use: { storageState: "tests/e2e/.auth/company.json" },
      dependencies: ["setup"],
    },
    {
      name: "admin",
      testMatch: /admin\.spec\.ts/,
      use: { storageState: "tests/e2e/.auth/root.json" },
      dependencies: ["setup"],
    },
    {
      name: "public",
      testMatch: /public\.spec\.ts/,
    },
  ],
});
