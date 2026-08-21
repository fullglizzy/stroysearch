/**
 * Разовое заполнение searchText для существующих компаний и товаров.
 * lower() в SQLite не приводит кириллицу к нижнему регистру, поэтому
 * пересчитываем строки поиска на стороне JS (toLowerCase знает кириллицу).
 * Запуск: npx tsx scripts/backfill-searchtext.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const companies = await prisma.company.findMany({
    select: { id: true, name: true, inn: true },
  });

  let updatedCompanies = 0;
  for (const c of companies) {
    const searchText = `${c.name} ${c.inn}`.toLowerCase();
    await prisma.company.update({
      where: { id: c.id },
      data: { searchText },
    });
    updatedCompanies += 1;
  }
  console.log(`Обновлено компаний: ${updatedCompanies}`);

  const products = await prisma.product.findMany({
    select: { id: true, name: true },
  });

  let updatedProducts = 0;
  for (const p of products) {
    await prisma.product.update({
      where: { id: p.id },
      data: { searchText: p.name.toLowerCase() },
    });
    updatedProducts += 1;
  }
  console.log(`Обновлено товаров: ${updatedProducts}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
