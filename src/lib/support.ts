/**
 * Фиксированный список тем обращений в поддержку
 */
export const SUPPORT_TOPICS = [
  "Работа платформы",
  "Регистрация и вход",
  "Оплата и монеты",
  "Покупка монет",
  "Отзывы и рейтинг",
  "База поставщиков",
  "Библиотека и документы",
  "Конференции",
  "Опросы и статистика",
  "Жалоба на пользователя",
  "Другое",
] as const;

export type SupportTopic = (typeof SUPPORT_TOPICS)[number];

export const SUPPORT_TOPIC_ITEMS: Record<string, string> = Object.fromEntries(
  SUPPORT_TOPICS.map((t) => [t, t]),
);
