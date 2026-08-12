/**
 * Роли участников платформы (справочник отображения)
 */
export const ROLE_LABELS: Record<string, string> = {
  PRODUCTOLOGIST: "Продуктолог",
  TENDER_SPECIALIST: "Тендерный специалист",
  DESIGNER: "Проектировщик",
  COMPANY_OWNER: "Владелец компании",
  OTHER: "Иное",
};

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] || role;
}
