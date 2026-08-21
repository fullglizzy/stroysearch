-- CreateTable
CREATE TABLE "company_notes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "company_notes_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_companies" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "inn" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kpp" TEXT,
    "legalAddress" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "regions" TEXT NOT NULL DEFAULT '',
    "classifierIds" TEXT NOT NULL DEFAULT '',
    "addedById" TEXT,
    "ownerUserId" TEXT,
    "searchText" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "companies_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "companies_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_companies" ("addedById", "classifierIds", "createdAt", "email", "id", "inn", "kpp", "legalAddress", "name", "ownerUserId", "phone", "regions", "updatedAt", "website") SELECT "addedById", "classifierIds", "createdAt", "email", "id", "inn", "kpp", "legalAddress", "name", "ownerUserId", "phone", "regions", "updatedAt", "website" FROM "companies";
DROP TABLE "companies";
ALTER TABLE "new_companies" RENAME TO "companies";
CREATE UNIQUE INDEX "companies_inn_key" ON "companies"("inn");
CREATE UNIQUE INDEX "companies_ownerUserId_key" ON "companies"("ownerUserId");
CREATE INDEX "companies_searchText_idx" ON "companies"("searchText");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Заполнение searchText для существующих строк. lower() в SQLite не знает
-- кириллицу — строки с кириллицей дообновляются скриптом приложения
-- (см. scripts/backfill-company-searchtext.ts).
UPDATE "companies" SET "searchText" = lower("name") || ' ' || "inn";

-- CreateIndex
CREATE INDEX "company_notes_companyId_createdAt_idx" ON "company_notes"("companyId", "createdAt");
