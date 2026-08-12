export const INVOICE_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Ожидает оплаты",
  SENT: "Выставлен",
  PAID: "Оплачен",
  SKIPPED: "Пропущен",
  OVERDUE: "Просрочен",
  CANCELLED: "Отменён",
};

export const INVOICE_STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  SENT: "bg-blue-100 text-blue-700",
  PAID: "bg-green-100 text-green-700",
  SKIPPED: "bg-gray-100 text-gray-500",
  OVERDUE: "bg-red-100 text-red-700",
  CANCELLED: "bg-red-100 text-red-500",
};

export function formatRub(value: number): string {
  return `${value.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽`;
}

export function formatInvoiceDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}
