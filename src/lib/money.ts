import { Prisma } from "@prisma/client";

/**
 * Нормализует баланс кошелька до 2 знаков после запятой.
 * Нужно, потому что SQLite выполняет арифметику DECIMAL-колонок в бинарном
 * float (0.2 - 0.05 = 0.15000000000000002), а Postgres считает точно.
 * Вызывать внутри той же транзакции сразу после изменения баланса.
 */
export async function roundWalletBalance(
  tx: Prisma.TransactionClient,
  userId: string,
) {
  await tx.$executeRaw`UPDATE wallets SET balance = ROUND(balance, 2) WHERE "userId" = ${userId}`;
}
