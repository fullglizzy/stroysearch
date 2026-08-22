import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Сравнивает два fullNumberPath числово (не лексикографически).
 * "2.6.4.10" > "2.6.4.2" — каждый сегмент сравнивается как число.
 */
export function comparePath(a: string, b: string): number {
  const aParts = a.split(".").map(Number);
  const bParts = b.split(".").map(Number);
  const len = Math.max(aParts.length, bParts.length);
  for (let i = 0; i < len; i++) {
    const ai = aParts[i] ?? 0;
    const bi = bParts[i] ?? 0;
    if (ai !== bi) return ai - bi;
  }
  return 0;
}

/**
 * Форматирует размер файла в человекочитаемый вид: 512 КБ, 1.5 МБ
 */
export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 КБ";
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} КБ`;
  return `${(kb / 1024).toFixed(1)} МБ`;
}

/**
 * Ссылка tel: из строки телефона (оставляет только цифры и ведущий +)
 */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

/**
 * Ссылка mailto: из строки email
 */
export function mailtoHref(email: string): string {
  return `mailto:${email}`;
}

/** Разбирает строку характеристики «Название: значение ед.» на пару */
export function parseCharacteristic(raw: string): { name: string; value: string } {
  const idx = raw.indexOf(": ");
  if (idx === -1) return { name: raw, value: "" };
  return { name: raw.slice(0, idx), value: raw.slice(idx + 2).trim() };
}

/**
 * Безопасно достаёт сообщение из неизвестного исключения
 * (catch (e) даёт unknown, а не Error).
 */
export function getErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
