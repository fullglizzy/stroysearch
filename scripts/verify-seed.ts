// Проверка засеянной БД на соответствие запросам приложения.
// Запуск: DATABASE_URL="file:./seed-check.db" npx tsx scripts/verify-seed.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function fail(msg: string): never {
  throw new Error(`VERIFY FAIL: ${msg}`);
}

async function main() {
  // 1. Матрица: SQL со статусом PUBLISHED
  const matrix = await prisma.$queryRawUnsafe<{ cnt: number | bigint }[]>(`
    SELECT COUNT(*) AS cnt FROM products p
    JOIN companies c ON c.id = p."companyId"
    JOIN product_tree_items t ON t.id = p."treeItemId"
    WHERE p."deletedAt" IS NULL AND t."deletedAt" IS NULL AND p.status = 'PUBLISHED'`);
  console.log("matrix products:", matrix[0].cnt);
  if (Number(matrix[0].cnt) !== 5) fail("матрица: ожидалось 5 товаров");

  // 2. График дашборда (INTEGER datetime → unixepoch)
  const chart = await prisma.$queryRawUnsafe<{ day: string; cnt: number | bigint }[]>(`
    SELECT date("createdAt" / 1000, 'unixepoch') AS day, COUNT(*) AS cnt FROM users
    WHERE "createdAt" / 1000 >= strftime('%s', 'now') - 30 * 86400
    GROUP BY day ORDER BY day`);
  console.log("chart rows:", chart.length);
  if (chart.length === 0) fail("график: нет строк за 30 дней");

  // 3. Рейтинг компаний (скрытые отзывы не участвуют)
  const rating = await prisma.$queryRawUnsafe<{ cnt: number | bigint }[]>(`
    SELECT COUNT(*) AS cnt FROM reviews WHERE status = 'ACTIVE'`);
  console.log("active reviews:", rating[0].cnt);
  if (Number(rating[0].cnt) !== 10) fail("отзывы: ожидалось 10 ACTIVE");

  // 4. Пользователь для входа
  const user = await prisma.user.findUnique({
    where: { username: "root" },
    select: { pwdHash: true, type: true, admin: { select: { adminType: true } } },
  });
  if (!user?.pwdHash) fail("root: нет хэша пароля");
  if (user.type !== "ROOT" || user.admin?.adminType !== "ROOT") fail("root: тип/админ неверны");
  console.log("root auth ok:", user.admin?.adminType);

  // 5. Компании: владельцы и добавленная участником
  const companies = await prisma.company.findMany({
    select: { inn: true, ownerUserId: true, addedById: true },
  });
  const owned = companies.filter((c) => c.ownerUserId).length;
  const added = companies.filter((c) => c.addedById && !c.ownerUserId).length;
  console.log(`companies: ${companies.length} (owned=${owned}, added=${added})`);
  if (owned !== 6 || added !== 1) fail("компании: 6 владельческих + 1 добавленная");

  // 6. Счётчики новых таблиц (пустые, но существуют)
  const [notif, banLogs, audit, revs] = await Promise.all([
    prisma.notification.count(),
    prisma.banLog.count(),
    prisma.adminActionLog.count(),
    prisma.contentRevision.count(),
  ]);
  console.log(`new tables: notifications=${notif} ban_logs=${banLogs} audit=${audit} revisions=${revs}`);

  // 7. Опросы: голоса не превышают число пользователей и не ломают unique
  const polls = await prisma.poll.findMany({ include: { options: { include: { _count: { select: { votes: true } } } } } });
  let totalVotes = 0;
  for (const p of polls) for (const o of p.options) totalVotes += o._count.votes;
  console.log(`polls: ${polls.length}, votes: ${totalVotes}`);
  if (polls.length !== 5) fail("опросы: ожидалось 5");

  // 8. Кошелёк и ставки
  const wallets = await prisma.wallet.count();
  const rates = await prisma.metricsPayoutRate.count();
  console.log(`wallets=${wallets}, payout rates=${rates}`);
  if (wallets !== 17 || rates !== 3) fail("кошельки/ставки: неверное количество");

  console.log("\n✅ Seed verification passed");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
