-- Причина бана пользователя (UserServiceFields.banReason)
ALTER TABLE "user_service_fields" ADD COLUMN "banReason" TEXT;

-- Синхронизация с schema.prisma: индексы, отсутствовавшие в init-миграции
-- (база была создана через db push, поэтому индекс может уже существовать)
CREATE INDEX IF NOT EXISTS "support_tickets_isResolved_updatedAt_idx" ON "support_tickets"("isResolved", "updatedAt");
CREATE INDEX IF NOT EXISTS "transactions_userId_createdAt_idx" ON "transactions"("userId", "createdAt");
