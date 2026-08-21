export const INVOICE_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Черновик",
  SENT: "Выставлен",
  PAID: "Оплачен",
  SKIPPED: "Списан",
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

/** Склонение: pluralRu(1, "монета", "монеты", "монет") → "монета" */
export function pluralRu(n: number, one: string, few: string, many: string): string {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return one;
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return few;
  return many;
}

const DIGITS = ["", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
const DIGITS_FEM = ["", "одна", "две", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
const TEENS = [
  "десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать",
  "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать",
];
const TENS = ["", "", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят", "восемьдесят", "девяносто"];
const HUNDREDS = ["", "сто", "двести", "триста", "четыреста", "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот"];

function threeDigitsRu(n: number, feminine = false): string {
  const h = Math.floor(n / 100);
  const t = Math.floor((n % 100) / 10);
  const u = n % 10;
  const parts: string[] = [];
  if (h) parts.push(HUNDREDS[h]);
  if (t === 1) parts.push(TEENS[u]);
  else {
    if (t) parts.push(TENS[t]);
    if (u) parts.push(feminine ? DIGITS_FEM[u] : DIGITS[u]);
  }
  return parts.join(" ");
}

/**
 * Сумма прописью: «Сто рублей 00 копеек». Используется в счёте и акте выплат.
 */
export function rublesInWords(amount: number): string {
  const totalKopecks = Math.round(amount * 100);
  const rub = Math.floor(totalKopecks / 100);
  const kop = totalKopecks % 100;

  let words = "ноль рублей";
  if (rub > 0) {
    const billions = Math.floor(rub / 1_000_000_000);
    const millions = Math.floor((rub % 1_000_000_000) / 1_000_000);
    const thousands = Math.floor((rub % 1_000_000) / 1_000);
    const rest = rub % 1_000;
    const parts: string[] = [];
    if (billions) parts.push(`${threeDigitsRu(billions)} ${pluralRu(billions, "миллиард", "миллиарда", "миллиардов")}`);
    if (millions) parts.push(`${threeDigitsRu(millions)} ${pluralRu(millions, "миллион", "миллиона", "миллионов")}`);
    if (thousands) parts.push(`${threeDigitsRu(thousands, true)} ${pluralRu(thousands, "тысяча", "тысячи", "тысяч")}`);
    if (rest) parts.push(threeDigitsRu(rest));
    words = `${parts.join(" ")} ${pluralRu(rub, "рубль", "рубля", "рублей")}`;
  }
  const capitalized = words.charAt(0).toUpperCase() + words.slice(1);
  return `${capitalized} ${String(kop).padStart(2, "0")} ${pluralRu(kop, "копейка", "копейки", "копеек")}`;
}

export interface InvoiceBuyerProfileData {
  inn: string | null;
  companyName: string | null;
  legalAddress: string | null;
  firstName: string | null;
  lastName: string | null;
  middleName: string | null;
  regions: string | null;
  /** Название/адрес связанной компании владельца — если их нет в профиле */
  linkedCompanyName?: string | null;
  linkedCompanyAddress?: string | null;
}

/**
 * Поля, без которых в печатном виде счёта не заполнить покупателя и адрес.
 * Набор зависит от типа покупателя: у юрлица/ИП (есть ИНН) — название компании
 * и адрес, у физлица — фамилия, имя и регион.
 */
export function getMissingInvoiceProfileFields(p: InvoiceBuyerProfileData | null): string[] {
  const missing: string[] = [];
  const isCompany = !!p?.inn?.trim();
  const regionList = (p?.regions || "").split(",").map((r) => r.trim()).filter(Boolean);
  const hasAddress =
    !!(p?.legalAddress || "").trim() ||
    !!(p?.linkedCompanyAddress || "").trim() ||
    regionList.length > 0;

  if (isCompany) {
    const companyName = (p?.companyName || "").trim() || (p?.linkedCompanyName || "").trim();
    if (!companyName) missing.push("название компании");
    if (!hasAddress) missing.push("юридический адрес или регион");
  } else {
    if (!(p?.firstName || "").trim() || !(p?.lastName || "").trim()) {
      missing.push("фамилия и имя");
    }
    if (!(p?.middleName || "").trim()) missing.push("отчество");
    if (!hasAddress) missing.push("регион");
  }
  return missing;
}
