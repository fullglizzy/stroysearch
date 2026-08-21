"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Printer, Download, Loader2 } from "lucide-react";
import { formatRub, formatInvoiceDate, rublesInWords } from "@/lib/invoices";
import { printHtmlNode } from "@/lib/print";
import { downloadHtmlNodeAsPdf } from "@/lib/pdf";

interface InvoiceItemRow {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface InvoicePrintData {
  number: string;
  date: Date | string;
  dueDate: Date | string;
  status: string;
  subtotal: number;
  discount: number;
  total: number;
  /** PURCHASE — покупка монет, BILLING — абонплата и просмотры */
  kind?: "PURCHASE" | "BILLING";
  periodFrom?: Date | string | null;
  periodTo?: Date | string | null;
  buyerName: string;
  buyerInn: string | null;
  buyerKpp: string | null;
  buyerAddress: string | null;
  /** company — юр.лицо/ИП, individual — физ.лицо */
  buyerKind?: "company" | "individual";
  buyerUserId?: string;
  items: InvoiceItemRow[];
}

export interface BillingRequisites {
  organizationName: string | null;
  organizationInn: string | null;
  organizationKpp: string | null;
  organizationAddress: string | null;
  bankName: string | null;
  bankBik: string | null;
  bankAccount: string | null;
  bankCorrAccount: string | null;
  directorName: string | null;
  signatureImage: string | null;
  stampImage: string | null;
  vatRate: number;
  invoiceBasis: string | null;
  /** Дата публикации оферты (/terms), ISO */
  offerDate?: string | null;
  /** Названия счетов и примечания из шаблонов (редактируются в админке) */
  docTemplates?: {
    billing_invoice?: { title?: { text: string; enabled: boolean }; note?: { text: string; enabled: boolean } };
    coin_invoice?: { title?: { text: string; enabled: boolean }; note?: { text: string; enabled: boolean } };
  };
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

// Число с двумя знаками без символа валюты («100,00») — для колонок таблицы
function formatNumber(v: number): string {
  return v.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatShortDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Стандартные название и примечание счёта (если шаблон не задан)
const DEFAULT_TITLE = "Счёт на оплату № {number} от {date}";
const DEFAULT_NOTE =
  "Оплата данного счёта означает полное и безоговорочное согласие с условиями Публичной оферты (акцепт оферты согласно ст. 438 ГК РФ).\n*Упрощенная система налогообложения (УСН) / ст. 346.11 НК РФ (или пп. 26 п. 2 ст. 149 НК РФ, если софт в реестре РФ).";

function fillTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? vars[key] : match));
}

/**
 * Печатный вид счёта. При печати (window.print) печатается только этот блок —
 * см. правила @media print в globals.css (.invoice-print).
 */
export function InvoicePrint({ invoice, requisites }: { invoice: InvoicePrintData; requisites: BillingRequisites }) {
  const vatRate = requisites.vatRate || 0;
  const withVat = vatRate > 0;
  const vatTotal = withVat ? round2(invoice.total * vatRate / 100) : 0;
  const toPay = round2(invoice.total + vatTotal);

  const isBilling = invoice.kind === "BILLING";
  const buyerIsCompany = invoice.buyerKind === "company";
  const termsUrl = (typeof window !== "undefined" ? window.location.origin : "") + "/terms";
  const docRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  // Название и примечание — из шаблона (настройки), с фолбэком на стандартные
  const docTpl = requisites.docTemplates?.[isBilling ? "billing_invoice" : "coin_invoice"];
  const titleVars = {
    number: invoice.number,
    date: formatInvoiceDate(invoice.date),
    period:
      invoice.periodFrom && invoice.periodTo
        ? `${formatShortDate(invoice.periodFrom)} — ${formatShortDate(invoice.periodTo)}`
        : "",
    total: formatRub(invoice.total),
  };
  const titleText =
    docTpl?.title && docTpl.title.enabled && docTpl.title.text.trim()
      ? fillTemplate(docTpl.title.text, titleVars)
      : fillTemplate(DEFAULT_TITLE, titleVars);
  const noteText = (() => {
    if (!docTpl?.note) return fillTemplate(DEFAULT_NOTE, titleVars);
    if (!docTpl.note.enabled) return null;
    const text = docTpl.note.text.trim();
    return text ? fillTemplate(text, titleVars) : null;
  })();

  async function handleDownload() {
    if (!docRef.current || downloading) return;
    setDownloading(true);
    try {
      await downloadHtmlNodeAsPdf(docRef.current, `invoice-${invoice.number}.pdf`);
    } catch {
      // ошибка рендера PDF — просто разблокируем кнопку
    }
    setDownloading(false);
  }

  return (
    <div>
      <div className="flex justify-end gap-2 mb-3 print:hidden">
        <Button
          size="sm"
          variant="outline"
          className="gap-1"
          onClick={() => {
            if (docRef.current) printHtmlNode(docRef.current, `Счёт № ${invoice.number}`);
          }}
        >
          <Printer className="h-4 w-4" /> Печать
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-1"
          onClick={handleDownload}
          disabled={downloading}
        >
          {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Скачать
        </Button>
      </div>

      <div ref={docRef} className="invoice-print border rounded-lg p-6 bg-white text-black text-sm">
        {/* Заголовок */}
        <div className="mb-6">
          <p className="text-lg font-bold text-center">{titleText}</p>
          {isBilling && invoice.periodFrom && invoice.periodTo && (
            <p className="text-center text-xs text-gray-600 mt-1">
              Период оказания услуг: {formatShortDate(invoice.periodFrom)} — {formatShortDate(invoice.periodTo)}
            </p>
          )}
          <p className="text-right text-xs text-gray-600 mt-1">
            Оплатить до: {formatInvoiceDate(invoice.dueDate)}
          </p>
        </div>

        {/* Продавец */}
        <div className="flex gap-3">
          <span className="w-44 shrink-0 font-semibold">ПРОДАВЕЦ:</span>
          <div className="min-w-0">
            <p className="font-semibold">{requisites.organizationName || "—"}</p>
            <p>
              ИНН: {requisites.organizationInn || "—"}
              {requisites.organizationKpp ? ` / КПП: ${requisites.organizationKpp}` : ""}
            </p>
            <p>Адрес: {requisites.organizationAddress || "—"}</p>
          </div>
        </div>

        {/* Банковские реквизиты */}
        <div className="flex gap-3 mt-2">
          <span className="w-44 shrink-0 font-semibold">Банковские реквизиты:</span>
          <div className="min-w-0">
            <p>Расчётный счёт: {requisites.bankAccount || "—"}</p>
            <p>Банк: {requisites.bankName || "—"}</p>
            <p>БИК: {requisites.bankBik || "—"}</p>
            <p>Корр. счёт: {requisites.bankCorrAccount || "—"}</p>
          </div>
        </div>

        <hr className="my-4 border-t-2 border-dashed border-gray-400" />

        {/* Покупатель */}
        <div className="flex gap-3">
          <span className="w-44 shrink-0 font-semibold">ПОКУПАТЕЛЬ:</span>
          <div className="min-w-0">
            <p className="font-semibold">
              {buyerIsCompany
                ? `${invoice.buyerName}${invoice.buyerInn ? ` (ИНН ${invoice.buyerInn})` : ""}`
                : `${invoice.buyerName}${invoice.buyerUserId ? ` (ID пользователя: ${invoice.buyerUserId})` : ""}`}
            </p>
            <p>Адрес: {invoice.buyerAddress || "—"}</p>
          </div>
        </div>

        {/* Основание */}
        <div className="flex gap-3 mt-2">
          <span className="w-44 shrink-0 font-semibold">ОСНОВАНИЕ:</span>
          <div className="min-w-0">
            <p>
              Публичная оферта (Пользовательское соглашение)
              {requisites.offerDate ? ` от ${formatShortDate(requisites.offerDate)} г.` : ""}
              , размещённая по адресу:
            </p>
            <p>{termsUrl}</p>
          </div>
        </div>

        <hr className="my-4 border-t-2 border-dashed border-gray-400" />

        {/* Таблица */}
        <table className="w-full border-collapse mb-4">
          <thead>
            <tr className="border-b-2 border-gray-400 text-left text-xs text-gray-600">
              <th className="py-2 pr-2 w-8 font-normal">№</th>
              <th className="py-2 px-2 font-normal">Наименование товара / услуги</th>
              <th className="py-2 px-2 text-right font-normal">Кол-во</th>
              <th className="py-2 px-2 text-right font-normal">Ед.</th>
              <th className="py-2 px-2 text-right font-normal">Цена, руб.</th>
              <th className="py-2 px-2 text-right font-normal">Сумма, руб.</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, i) => (
              <tr key={i} className="align-top">
                <td className="py-2 pr-2">{i + 1}</td>
                <td className="py-2 px-2">
                  {isBilling ? (
                    <p>{item.description}</p>
                  ) : (
                    item.description.split("\n").map((line, li) => <p key={li}>{line}</p>)
                  )}
                </td>
                <td className="py-2 px-2 text-right">{item.quantity}</td>
                <td className="py-2 px-2 text-right">{isBilling ? (item.quantity > 1 ? "шт." : "усл.") : "усл. ед."}</td>
                <td className="py-2 px-2 text-right">{formatNumber(item.unitPrice)}</td>
                <td className="py-2 px-2 text-right">{formatNumber(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Итоги */}
        <div className="flex justify-end mb-4">
          <div className="w-72 text-sm">
            {invoice.discount > 0 && (
              <>
                <div className="flex justify-between py-1">
                  <span>Сумма:</span>
                  <span>{formatRub(invoice.subtotal)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>Скидка:</span>
                  <span>{formatRub(invoice.discount)}</span>
                </div>
              </>
            )}
            <div className="flex justify-between py-1">
              <span>Итого без НДС:</span>
              <span>{formatRub(invoice.total)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span>{withVat ? `НДС (${vatRate}%):` : "НДС (Не облагается*):"}</span>
              <span>{withVat ? formatRub(vatTotal) : "0,00 ₽"}</span>
            </div>
            <div className="flex justify-between py-1 border-t-2 border-gray-400 font-bold">
              <span>Всего к оплате:</span>
              <span>{formatRub(toPay)}</span>
            </div>
          </div>
        </div>

        {/* Сумма прописью */}
        <div className="mb-4 text-xs">
          <p>
            Всего наименований {invoice.items.length}, на сумму {formatNumber(toPay)} руб.
          </p>
          <p>
            {rublesInWords(toPay)}, {withVat ? `в том числе НДС ${formatRub(vatTotal)}` : "без НДС"}.
          </p>
        </div>

        <hr className="my-4 border-t-2 border-dashed border-gray-400" />

        {/* Примечание */}
        {noteText !== null && (
          <div className="mb-6 text-xs">
            <p className="font-semibold mb-1">ВНИМАНИЕ / ПРИМЕЧАНИЕ:</p>
            {noteText.split("\n").map((line, li) => (
              <p key={li}>{line}</p>
            ))}
          </div>
        )}

        {/* Подписи */}
        <div className="flex items-end justify-between">
          <div className="flex-1 min-w-0 mr-6">
            <div className="flex items-end gap-2">
              <span>Генеральный директор</span>
              <span className="flex-1 min-w-24 h-16 flex items-end justify-center border-b border-gray-400">
                {requisites.signatureImage && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={requisites.signatureImage} alt="Подпись" className="h-14 w-auto object-contain" />
                )}
              </span>
              <span>/{requisites.directorName || "____________"}/</span>
            </div>
            
          </div>
          <div className="text-center">
            {requisites.stampImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={requisites.stampImage} alt="Печать" className="h-20 w-auto object-contain mx-auto" />
            ) : (
              <p className="font-semibold">[ М.П. ]</p>
            )}
            <p className="text-xs text-gray-500 mt-1">(при наличии печати)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
