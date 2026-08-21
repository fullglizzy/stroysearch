-- DropIndex
DROP INDEX "poll_votes_pollId_userId_key";

-- AlterTable
ALTER TABLE "gifts" ADD COLUMN "deletedAt" DATETIME;

-- AlterTable
ALTER TABLE "library_documents" ADD COLUMN "moderatorNote" TEXT;

-- AlterTable
ALTER TABLE "support_tickets" ADD COLUMN "adminLastReadAt" DATETIME;
ALTER TABLE "support_tickets" ADD COLUMN "userLastReadAt" DATETIME;

-- CreateTable
CREATE TABLE "regions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "legal_documents" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL DEFAULT 0,
    "text" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "company_view_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "viewerId" TEXT,
    "ipHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "company_view_events_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "company_billing" (
    "companyId" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'INACTIVE',
    "maintenanceFee" DECIMAL,
    "phonePrice" DECIMAL,
    "emailPrice" DECIMAL,
    "websitePrice" DECIMAL,
    "reviewsPrice" DECIMAL,
    "ratingPrice" DECIMAL,
    "monthlyCap" DECIMAL,
    "billingStartedAt" DATETIME,
    "billedThrough" DATETIME,
    "hiddenReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "company_billing_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "company_invites" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdById" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "company_invites_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "company_invites_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "review_reports" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reviewId" TEXT NOT NULL,
    "userId" TEXT,
    "reason" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "review_reports_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "reviews" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "service_acts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "total" DECIMAL NOT NULL,
    "itemsJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "service_acts_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "number_sequences" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "tree_snapshots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT,
    "data" TEXT NOT NULL,
    "nodeCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tree_snapshots_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "support_messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT,
    "isStaff" BOOLEAN NOT NULL DEFAULT false,
    "message" TEXT NOT NULL,
    "attachments" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "support_messages_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "support_tickets" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "support_messages_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ban_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "admin_action_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "adminId" TEXT NOT NULL,
    "adminName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "payload" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "content_revisions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pageKey" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_billing_config" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "coinPriceRub" DECIMAL NOT NULL DEFAULT 100,
    "addCompanyCoins" DECIMAL NOT NULL DEFAULT 1,
    "reviewCoins" DECIMAL NOT NULL DEFAULT 1,
    "maxMonthlyLimit" DECIMAL NOT NULL DEFAULT 1000,
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
INSERT INTO "new_billing_config" ("addCompanyCoins", "bankAccount", "bankBik", "bankCorrAccount", "bankInn", "bankName", "coinPriceRub", "directorEmail", "directorName", "directorPhone", "id", "maxMonthlyLimit", "organizationAccount", "organizationAddress", "organizationInn", "organizationKpp", "organizationName", "reviewCoins", "signatureImage", "stampImage", "updatedAt") SELECT "addCompanyCoins", "bankAccount", "bankBik", "bankCorrAccount", "bankInn", "bankName", "coinPriceRub", "directorEmail", "directorName", "directorPhone", "id", "maxMonthlyLimit", "organizationAccount", "organizationAddress", "organizationInn", "organizationKpp", "organizationName", "reviewCoins", "signatureImage", "stampImage", "updatedAt" FROM "billing_config";
DROP TABLE "billing_config";
ALTER TABLE "new_billing_config" RENAME TO "billing_config";
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "companies_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "companies_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_companies" ("addedById", "classifierIds", "createdAt", "email", "id", "inn", "kpp", "legalAddress", "name", "ownerUserId", "phone", "updatedAt", "website") SELECT "addedById", "classifierIds", "createdAt", "email", "id", "inn", "kpp", "legalAddress", "name", "ownerUserId", "phone", "updatedAt", "website" FROM "companies";
DROP TABLE "companies";
ALTER TABLE "new_companies" RENAME TO "companies";
CREATE UNIQUE INDEX "companies_inn_key" ON "companies"("inn");
CREATE UNIQUE INDEX "companies_ownerUserId_key" ON "companies"("ownerUserId");
CREATE TABLE "new_invoice_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL NOT NULL,
    "total" DECIMAL NOT NULL,
    CONSTRAINT "invoice_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_invoice_items" ("description", "id", "invoiceId", "quantity", "total", "unitPrice") SELECT "description", "id", "invoiceId", "quantity", "total", "unitPrice" FROM "invoice_items";
DROP TABLE "invoice_items";
ALTER TABLE "new_invoice_items" RENAME TO "invoice_items";
CREATE TABLE "new_invoices" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "kind" TEXT NOT NULL DEFAULT 'PURCHASE',
    "subtotal" DECIMAL NOT NULL,
    "limit" DECIMAL NOT NULL,
    "discount" DECIMAL NOT NULL DEFAULT 0,
    "total" DECIMAL NOT NULL,
    "periodFrom" DATETIME,
    "periodTo" DATETIME,
    "billedThrough" DATETIME,
    "ticketId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "sentAt" DATETIME,
    "paidAt" DATETIME,
    CONSTRAINT "invoices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "invoices_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "support_tickets" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_invoices" ("createdAt", "date", "discount", "dueDate", "id", "limit", "number", "paidAt", "sentAt", "status", "subtotal", "total", "updatedAt", "userId") SELECT "createdAt", "date", "discount", "dueDate", "id", "limit", "number", "paidAt", "sentAt", "status", "subtotal", "total", "updatedAt", "userId" FROM "invoices";
DROP TABLE "invoices";
ALTER TABLE "new_invoices" RENAME TO "invoices";
CREATE UNIQUE INDEX "invoices_number_key" ON "invoices"("number");
CREATE UNIQUE INDEX "invoices_ticketId_key" ON "invoices"("ticketId");
CREATE INDEX "invoices_userId_createdAt_idx" ON "invoices"("userId", "createdAt");
CREATE INDEX "invoices_kind_status_idx" ON "invoices"("kind", "status");
CREATE TABLE "new_page_contents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pageKey" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL,
    "bannerUrl" TEXT,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_page_contents" ("bannerUrl", "content", "id", "pageKey", "updatedAt") SELECT "bannerUrl", "content", "id", "pageKey", "updatedAt" FROM "page_contents";
DROP TABLE "page_contents";
ALTER TABLE "new_page_contents" RENAME TO "page_contents";
CREATE UNIQUE INDEX "page_contents_pageKey_key" ON "page_contents"("pageKey");
CREATE TABLE "new_polls" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "question" TEXT NOT NULL,
    "treeItemId" TEXT,
    "pollType" TEXT NOT NULL DEFAULT 'DICHOTOMOUS',
    "coinReward" DECIMAL NOT NULL DEFAULT 0.1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "polls_treeItemId_fkey" FOREIGN KEY ("treeItemId") REFERENCES "product_tree_items" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_polls" ("coinReward", "createdAt", "id", "isActive", "pollType", "question", "treeItemId", "updatedAt") SELECT "coinReward", "createdAt", "id", "isActive", "pollType", "question", "treeItemId", "updatedAt" FROM "polls";
DROP TABLE "polls";
ALTER TABLE "new_polls" RENAME TO "polls";
CREATE INDEX "polls_isActive_idx" ON "polls"("isActive");
CREATE TABLE "new_product_tree_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "inBranchNumber" INTEGER NOT NULL,
    "fullNumberPath" TEXT NOT NULL,
    "description" TEXT,
    "bannerUrl" TEXT,
    "unitOptions" TEXT NOT NULL DEFAULT '[]',
    "characteristics" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "product_tree_items_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "product_tree_items" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_product_tree_items" ("bannerUrl", "createdAt", "deletedAt", "description", "fullNumberPath", "id", "inBranchNumber", "name", "parentId", "updatedAt") SELECT "bannerUrl", "createdAt", "deletedAt", "description", "fullNumberPath", "id", "inBranchNumber", "name", "parentId", "updatedAt" FROM "product_tree_items";
DROP TABLE "product_tree_items";
ALTER TABLE "new_product_tree_items" RENAME TO "product_tree_items";
CREATE INDEX "product_tree_items_parentId_idx" ON "product_tree_items"("parentId");
CREATE INDEX "product_tree_items_fullNumberPath_idx" ON "product_tree_items"("fullNumberPath");
CREATE TABLE "new_products" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "treeItemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "classes" TEXT NOT NULL DEFAULT '[]',
    "regions" TEXT NOT NULL DEFAULT '',
    "imageUrl" TEXT,
    "unit" TEXT,
    "characteristics" TEXT NOT NULL DEFAULT '[]',
    "price" REAL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "products_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "products_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "products_treeItemId_fkey" FOREIGN KEY ("treeItemId") REFERENCES "product_tree_items" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_products" ("characteristics", "classes", "companyId", "createdAt", "deletedAt", "id", "imageUrl", "name", "ownerUserId", "price", "treeItemId", "unit", "updatedAt", "views") SELECT "characteristics", "classes", "companyId", "createdAt", "deletedAt", "id", "imageUrl", "name", "ownerUserId", "price", "treeItemId", "unit", "updatedAt", "views" FROM "products";
DROP TABLE "products";
ALTER TABLE "new_products" RENAME TO "products";
CREATE INDEX "products_deletedAt_idx" ON "products"("deletedAt");
CREATE INDEX "products_treeItemId_idx" ON "products"("treeItemId");
CREATE TABLE "new_reviews" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "authorId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "companyId" TEXT,
    "comment" TEXT NOT NULL,
    "signatureType" TEXT NOT NULL DEFAULT 'nick',
    "weightedAverage" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "reviews_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "reviews_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "reviews_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_reviews" ("authorId", "comment", "companyId", "createdAt", "id", "signatureType", "targetId", "updatedAt", "weightedAverage") SELECT "authorId", "comment", "companyId", "createdAt", "id", "signatureType", "targetId", "updatedAt", "weightedAverage" FROM "reviews";
DROP TABLE "reviews";
ALTER TABLE "new_reviews" RENAME TO "reviews";
CREATE INDEX "reviews_companyId_idx" ON "reviews"("companyId");
CREATE INDEX "reviews_targetId_idx" ON "reviews"("targetId");
CREATE INDEX "reviews_status_idx" ON "reviews"("status");
CREATE TABLE "new_transactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "balanceAfter" DECIMAL NOT NULL,
    "description" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_transactions" ("amount", "balanceAfter", "createdAt", "description", "id", "metadata", "type", "userId") SELECT "amount", "balanceAfter", "createdAt", "description", "id", "metadata", "type", "userId" FROM "transactions";
DROP TABLE "transactions";
ALTER TABLE "new_transactions" RENAME TO "transactions";
CREATE INDEX "transactions_userId_createdAt_idx" ON "transactions"("userId", "createdAt");
CREATE TABLE "new_user_profiles" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "firstName" TEXT,
    "lastName" TEXT,
    "middleName" TEXT,
    "nick" TEXT,
    "regions" TEXT NOT NULL DEFAULT '',
    "classifierIds" TEXT NOT NULL DEFAULT '',
    "isContactsHidden" BOOLEAN NOT NULL DEFAULT true,
    "inn" TEXT,
    "companyName" TEXT,
    "kpp" TEXT,
    "legalAddress" TEXT,
    "directorName" TEXT,
    CONSTRAINT "user_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_user_profiles" ("classifierIds", "companyName", "directorName", "firstName", "inn", "isContactsHidden", "kpp", "lastName", "legalAddress", "middleName", "nick", "userId") SELECT "classifierIds", "companyName", "directorName", "firstName", "inn", "isContactsHidden", "kpp", "lastName", "legalAddress", "middleName", "nick", "userId" FROM "user_profiles";
DROP TABLE "user_profiles";
ALTER TABLE "new_user_profiles" RENAME TO "user_profiles";
CREATE UNIQUE INDEX "user_profiles_nick_key" ON "user_profiles"("nick");
CREATE UNIQUE INDEX "user_profiles_inn_key" ON "user_profiles"("inn");
CREATE TABLE "new_wallets" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "balance" DECIMAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "wallets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_wallets" ("balance", "createdAt", "updatedAt", "userId") SELECT "balance", "createdAt", "updatedAt", "userId" FROM "wallets";
DROP TABLE "wallets";
ALTER TABLE "new_wallets" RENAME TO "wallets";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "regions_name_key" ON "regions"("name");

-- CreateIndex
CREATE INDEX "company_view_events_companyId_metric_createdAt_idx" ON "company_view_events"("companyId", "metric", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "company_invites_token_key" ON "company_invites"("token");

-- CreateIndex
CREATE INDEX "review_reports_reviewId_idx" ON "review_reports"("reviewId");

-- CreateIndex
CREATE UNIQUE INDEX "service_acts_invoiceId_key" ON "service_acts"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "service_acts_number_key" ON "service_acts"("number");

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_createdAt_idx" ON "notifications"("userId", "isRead", "createdAt");

-- CreateIndex
CREATE INDEX "ban_logs_userId_createdAt_idx" ON "ban_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "admin_action_logs_adminId_createdAt_idx" ON "admin_action_logs"("adminId", "createdAt");

-- CreateIndex
CREATE INDEX "admin_action_logs_action_createdAt_idx" ON "admin_action_logs"("action", "createdAt");

-- CreateIndex
CREATE INDEX "content_revisions_pageKey_createdAt_idx" ON "content_revisions"("pageKey", "createdAt");

-- CreateIndex
CREATE INDEX "conference_participants_userId_idx" ON "conference_participants"("userId");

-- CreateIndex
CREATE INDEX "conferences_status_date_idx" ON "conferences"("status", "date");

-- CreateIndex
CREATE INDEX "document_purchases_userId_idx" ON "document_purchases"("userId");

-- CreateIndex
CREATE INDEX "library_documents_isApproved_deletedAt_idx" ON "library_documents"("isApproved", "deletedAt");

-- CreateIndex
CREATE INDEX "poll_votes_userId_idx" ON "poll_votes"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "poll_votes_pollId_optionId_userId_key" ON "poll_votes"("pollId", "optionId", "userId");

