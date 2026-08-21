-- CreateTable
CREATE TABLE "doc_template_lines" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "docKind" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_billing_config" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "coinPriceRub" DECIMAL NOT NULL DEFAULT 100,
    "addCompanyCoins" DECIMAL NOT NULL DEFAULT 1,
    "reviewCoins" DECIMAL NOT NULL DEFAULT 1,
    "vatRate" DECIMAL NOT NULL DEFAULT 0,
    "invoiceBasis" TEXT,
    "maintenanceFee" DECIMAL NOT NULL DEFAULT 1000,
    "phoneViewPrice" DECIMAL NOT NULL DEFAULT 50,
    "emailViewPrice" DECIMAL NOT NULL DEFAULT 30,
    "websiteViewPrice" DECIMAL NOT NULL DEFAULT 20,
    "reviewsViewPrice" DECIMAL NOT NULL DEFAULT 10,
    "ratingViewPrice" DECIMAL NOT NULL DEFAULT 10,
    "invoiceDueDays" INTEGER NOT NULL DEFAULT 5,
    "updatedAt" DATETIME NOT NULL,
    "bankName" TEXT,
    "bankInn" TEXT,
    "bankBik" TEXT,
    "bankAccount" TEXT,
    "bankCorrAccount" TEXT,
    "organizationName" TEXT,
    "organizationAddress" TEXT,
    "organizationInn" TEXT,
    "organizationKpp" TEXT,
    "organizationAccount" TEXT,
    "directorName" TEXT,
    "directorPhone" TEXT,
    "directorEmail" TEXT,
    "signatureImage" TEXT,
    "stampImage" TEXT
);
INSERT INTO "new_billing_config" ("addCompanyCoins", "bankAccount", "bankBik", "bankCorrAccount", "bankInn", "bankName", "coinPriceRub", "directorEmail", "directorName", "directorPhone", "emailViewPrice", "id", "invoiceBasis", "invoiceDueDays", "maintenanceFee", "organizationAccount", "organizationAddress", "organizationInn", "organizationKpp", "organizationName", "phoneViewPrice", "ratingViewPrice", "reviewCoins", "reviewsViewPrice", "signatureImage", "stampImage", "updatedAt", "vatRate", "websiteViewPrice") SELECT "addCompanyCoins", "bankAccount", "bankBik", "bankCorrAccount", "bankInn", "bankName", "coinPriceRub", "directorEmail", "directorName", "directorPhone", "emailViewPrice", "id", "invoiceBasis", "invoiceDueDays", "maintenanceFee", "organizationAccount", "organizationAddress", "organizationInn", "organizationKpp", "organizationName", "phoneViewPrice", "ratingViewPrice", "reviewCoins", "reviewsViewPrice", "signatureImage", "stampImage", "updatedAt", "vatRate", "websiteViewPrice" FROM "billing_config";
DROP TABLE "billing_config";
ALTER TABLE "new_billing_config" RENAME TO "billing_config";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "doc_template_lines_docKind_code_key" ON "doc_template_lines"("docKind", "code");

-- Строки шаблонов документов по умолчанию
INSERT INTO "doc_template_lines" ("id", "docKind", "code", "label", "description", "enabled", "sortOrder", "createdAt", "updatedAt") VALUES
('tpl_billing_maintenance', 'billing_invoice', 'maintenance', 'Абонентская плата', 'Абонентская плата за использование платформы ({period})', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('tpl_billing_views', 'billing_invoice', 'views', 'Плата за просмотры контактов', 'Плата за просмотры контактов: {metric} ({period})', 1, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('tpl_billing_cap', 'billing_invoice', 'cap', 'Строка при применении потолка', 'Плата за просмотры контактов ({period}; {breakdown}; применён лимит счёта)', 1, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('tpl_act_services', 'service_act', 'services', 'Оказанные услуги', 'Услуги платформы за период {period} по счёту {invoice}', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('tpl_coin_license', 'coin_invoice', 'license', 'Лицензионное вознаграждение', 'Предоставление права использования функционала платформы ЕНЦПР (Лицензионное вознаграждение)', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('tpl_coin_scope', 'coin_invoice', 'scope', 'Объем прав', 'Объем прав: {count} {units} ({coins})', 1, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
