-- CreateTable
CREATE TABLE "billing_hidden_periods" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "from" DATETIME NOT NULL,
    "to" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "billing_hidden_periods_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "billing_hidden_periods_companyId_idx" ON "billing_hidden_periods"("companyId");

