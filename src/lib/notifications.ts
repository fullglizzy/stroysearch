import { prisma } from "@/lib/prisma";

export type NotificationType =
  | "REVIEW"
  | "MODERATION"
  | "COINS"
  | "SUPPORT"
  | "INVOICE"
  | "PAYOUT";

/**
 * Создаёт уведомление для пользователя. Никогда не бросает исключение —
 * уведомление не должно ломать основную операцию.
 */
export async function notifyUser(input: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}) {
  try {
    await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        link: input.link ?? null,
      },
    });
  } catch {
    // Сбой уведомления не должен откатывать основную операцию
  }
}

/** Ссылка на кабинет по типу пользователя (COMPANY → /company, иначе /account) */
export function cabinetHome(type: string | null | undefined): string {
  return type === "COMPANY" ? "/company" : "/account";
}
