-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "pwdHash" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'INACTIVE',
    "type" TEXT NOT NULL DEFAULT 'COMMON',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "firstName" TEXT,
    "lastName" TEXT,
    "middleName" TEXT,
    "nick" TEXT,
    "region" TEXT,
    "classifierIds" TEXT NOT NULL DEFAULT '',
    "isContactsHidden" BOOLEAN NOT NULL DEFAULT true,
    "inn" TEXT,
    "companyName" TEXT,
    "kpp" TEXT,
    "legalAddress" TEXT,
    "directorName" TEXT,
    CONSTRAINT "user_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "user_profile_roles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    CONSTRAINT "user_profile_roles_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "user_profiles" ("userId") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "user_service_fields" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "emailVerifToken" TEXT,
    "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
    "isPhoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "refreshTokenHash" TEXT,
    CONSTRAINT "user_service_fields_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "admins" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "permissions" TEXT NOT NULL DEFAULT '{}',
    "adminType" TEXT NOT NULL,
    CONSTRAINT "admins_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "product_tree_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "inBranchNumber" INTEGER NOT NULL,
    "fullNumberPath" TEXT NOT NULL,
    "description" TEXT,
    "bannerUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "product_tree_items_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "product_tree_items" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "inn" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kpp" TEXT,
    "legalAddress" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "region" TEXT,
    "classifierIds" TEXT NOT NULL DEFAULT '',
    "addedById" TEXT,
    "ownerUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "companies_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "companies_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "company_metrics" (
    "companyId" TEXT NOT NULL PRIMARY KEY,
    "phoneViews" INTEGER NOT NULL DEFAULT 0,
    "emailViews" INTEGER NOT NULL DEFAULT 0,
    "websiteViews" INTEGER NOT NULL DEFAULT 0,
    "reviewsViews" INTEGER NOT NULL DEFAULT 0,
    "ratingViews" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "company_metrics_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "authorId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "companyId" TEXT,
    "comment" TEXT NOT NULL,
    "signatureType" TEXT NOT NULL DEFAULT 'nick',
    "weightedAverage" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "reviews_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "reviews_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "reviews_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "review_criteria" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reviewId" TEXT NOT NULL,
    "criteriaIndex" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    CONSTRAINT "review_criteria_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "reviews" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "treeItemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "classes" TEXT NOT NULL DEFAULT '[]',
    "region" TEXT,
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

-- CreateTable
CREATE TABLE "library_documents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "treeItemId" TEXT,
    "title" TEXT NOT NULL,
    "coinPrice" INTEGER NOT NULL DEFAULT 5,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "views" INTEGER NOT NULL DEFAULT 0,
    "purchasesCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "library_documents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "library_documents_treeItemId_fkey" FOREIGN KEY ("treeItemId") REFERENCES "product_tree_items" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "document_purchases" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purchasedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "document_purchases_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "library_documents" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "document_purchases_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "conferences" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "logoUrl" TEXT,
    "date" DATETIME NOT NULL,
    "time" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "treeItemId" TEXT,
    "coinPrice" INTEGER NOT NULL DEFAULT 0,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "connectionLink" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "moderatorNote" TEXT,
    "views" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "conferences_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "conferences_treeItemId_fkey" FOREIGN KEY ("treeItemId") REFERENCES "product_tree_items" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "conference_participants" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conferenceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "conference_participants_conferenceId_fkey" FOREIGN KEY ("conferenceId") REFERENCES "conferences" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "conference_participants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "polls" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "question" TEXT NOT NULL,
    "treeItemId" TEXT,
    "pollType" TEXT NOT NULL DEFAULT 'DICHOTOMOUS',
    "coinReward" REAL NOT NULL DEFAULT 0.1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "polls_treeItemId_fkey" FOREIGN KEY ("treeItemId") REFERENCES "product_tree_items" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "poll_options" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pollId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "poll_options_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "polls" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "poll_votes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pollId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "poll_votes_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "polls" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "poll_votes_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "poll_options" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "poll_votes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "wallets" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "balance" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "wallets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "balanceAfter" REAL NOT NULL,
    "description" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "gifts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "coinPrice" INTEGER NOT NULL,
    "limit" INTEGER NOT NULL,
    "imageUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "gift_claims" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "giftId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "claimDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "gift_claims_giftId_fkey" FOREIGN KEY ("giftId") REFERENCES "gifts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "gift_claims_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "billing_config" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "coinPriceRub" REAL NOT NULL DEFAULT 100,
    "viewPriceRub" REAL NOT NULL DEFAULT 100,
    "addCompanyCoins" REAL NOT NULL DEFAULT 1,
    "reviewCoins" REAL NOT NULL DEFAULT 1,
    "maxMonthlyLimit" REAL NOT NULL DEFAULT 1000,
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

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "subtotal" REAL NOT NULL,
    "limit" REAL NOT NULL,
    "discount" REAL NOT NULL DEFAULT 0,
    "total" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "sentAt" DATETIME,
    "paidAt" DATETIME,
    CONSTRAINT "invoices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "invoice_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" REAL NOT NULL,
    "total" REAL NOT NULL,
    CONSTRAINT "invoice_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "page_contents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pageKey" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "bannerUrl" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "support_tickets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_nick_key" ON "user_profiles"("nick");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_inn_key" ON "user_profiles"("inn");

-- CreateIndex
CREATE INDEX "product_tree_items_parentId_idx" ON "product_tree_items"("parentId");

-- CreateIndex
CREATE INDEX "product_tree_items_fullNumberPath_idx" ON "product_tree_items"("fullNumberPath");

-- CreateIndex
CREATE UNIQUE INDEX "companies_inn_key" ON "companies"("inn");

-- CreateIndex
CREATE UNIQUE INDEX "companies_ownerUserId_key" ON "companies"("ownerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "document_purchases_documentId_userId_key" ON "document_purchases"("documentId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "conference_participants_conferenceId_userId_key" ON "conference_participants"("conferenceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "poll_votes_pollId_userId_key" ON "poll_votes"("pollId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_number_key" ON "invoices"("number");

-- CreateIndex
CREATE UNIQUE INDEX "page_contents_pageKey_key" ON "page_contents"("pageKey");
