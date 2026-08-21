"use client";

import { Badge } from "@/components/ui/badge";
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_BADGE } from "@/lib/invoices";
import type { BillingRequisites } from "@/components/shared/InvoicePrint";

/** Реквизиты для печатных форм (счёт и акт) */
export async function fetchRequisites(): Promise<BillingRequisites> {
  const res = await fetch("/api/billing/info");
  if (!res.ok) throw new Error("Не удалось загрузить реквизиты");
  return (await res.json()) as BillingRequisites;
}

export function InvoiceStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={INVOICE_STATUS_BADGE[status] || "bg-gray-100 text-gray-700"}>
      {INVOICE_STATUS_LABELS[status] || status}
    </Badge>
  );
}

const BILLING_STATUS_META: Record<string, { label: string; className: string }> = {
  INACTIVE: { label: "Без владельца", className: "bg-gray-100 text-gray-600" },
  ACTIVE: { label: "Активна", className: "bg-green-100 text-green-700" },
  HIDDEN: { label: "Контакты скрыты", className: "bg-red-100 text-red-700" },
};

export function BillingStatusBadge({ status }: { status: string }) {
  const meta = BILLING_STATUS_META[status] || BILLING_STATUS_META.INACTIVE;
  return <Badge variant="outline" className={meta.className}>{meta.label}</Badge>;
}

export function formatRubShort(value: number): string {
  return `${value.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ₽`;
}

export function formatDateShort(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Текущий месяц для полей выбора дат */
export function monthInputValue(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** Последний день месяца из значения <input type="month"> (YYYY-MM) — ISO-строка */
export function monthToIso(monthValue: string): string {
  const [y, m] = monthValue.split("-").map(Number);
  if (!y || !m) return "";
  return new Date(y, m, 0, 23, 59, 59, 999).toISOString();
}
