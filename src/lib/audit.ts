import { prisma } from "@/lib/prisma";

/**
 * Пишет действие администратора в журнал аудита.
 * Никогда не бросает исключение — лог не должен ломать основную операцию.
 */
export async function logAdminAction(input: {
  adminId: string;
  adminName: string;
  action: string;
  entityType?: string;
  entityId?: string;
  payload?: Record<string, unknown>;
}) {
  try {
    await prisma.adminActionLog.create({
      data: {
        adminId: input.adminId,
        adminName: input.adminName,
        action: input.action,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        payload: input.payload ? JSON.stringify(input.payload) : null,
      },
    });
  } catch {
    // сбой журнала не должен откатывать основную операцию
  }
}
