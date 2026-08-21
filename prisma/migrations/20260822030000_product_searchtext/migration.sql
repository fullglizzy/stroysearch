-- Название товара в нижнем регистре для регистронезависимого поиска
-- (LIKE в SQLite не приводит кириллицу к нижнему регистру).
-- Заполнение для существующих строк — скриптом scripts/backfill-searchtext.ts.

-- AlterTable
ALTER TABLE "products" ADD COLUMN "searchText" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE INDEX "products_searchText_idx" ON "products"("searchText");
