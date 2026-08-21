/**
 * Разовое заполнение Company.searchText для существующих компаний.
 * lower() в SQLite не приводит кириллицу к нижнему регистру, поэтому
 * пересчитываем строку поиска на стороне JS (toLowerCase знает кириллицу).
 * Запуск: npx tsx scripts/backfill-company-searchtext.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const companies = await prisma.company.findMany({
    select: { id: true, name: true, inn: true },
  });

  let updated = 0;
  for (const c of companies) {
    const searchText = `${c.name} ${c.inn}`.toLowerCase();
    await prisma.company.update({
      where: { id: c.id },
      data: { searchText },
    });
    updated += 1;
  }

  console.log(`Обновлено компаний: ${updated}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
