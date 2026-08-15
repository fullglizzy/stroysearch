"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Printer, Download, Loader2 } from "lucide-react";
import { formatRub, formatInvoiceDate, rublesInWords } from "@/lib/invoices";
import { printHtmlNode } from "@/lib/print";
import { downloadHtmlNodeAsPdf } from "@/lib/pdf";
import type { InvoicePrintData, BillingRequisites } from "@/components/shared/InvoicePrint";

// Читаемые названия метрик для акта (описания позиций начинаются с этих префиксов)
const METRIC_LABELS: Record<string, string> = {
  "Просмотры: телефон": "Просмотр номера телефона",
  "Просмотры: email": "Просмотр Email",
  "Просмотры: сайт": "Переход на сайт компании",
  "Просмотры: рейтинг": "Просмотр рейтинга компании",
  "Просмотры: отзывы": "Просмотр отзывов",
  "Активность: товары": "Добавленные товары",
  "Активность: отзывы": "Полученные отзывы",
  "Активность: нахождение на платформе": "Нахождение на платформе (дни)",
};

function metricLabel(description: string): string {
  for (const [prefix, label] of Object.entries(METRIC_LABELS)) {
    if (description.startsWith(prefix)) return label;
  }
  return description;
}

function formatShortDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// «31 августа 2026 г.» — день в кавычках-ёлочках, как принято в актах
function formatActDate(d: Date | string): string {
  return formatInvoiceDate(d).replace(/^(\d+)/, "«$1»");
}

/**
 * Акт об оказании услуг по программе монетизации (просмотры контактов).
 * Платформа выплачивает компании вознаграждение за показ контактной информации.
 * При печати (window.print) печатается только этот блок — см. @media print.
 */
export function PayoutPrint({
  invoice,
  requisites,
}: {
  invoice: InvoicePrintData;
  requisites: BillingRequisites;
}) {
  // Период учёта метрик — с 1-го числа месяца по дату акта
  const invDate = new Date(invoice.date);
  const periodStart = new Date(invDate.getFullYear(), invDate.getMonth(), 1);
  const isActivity = invoice.kind === "ACTIVITY";
  const docRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    if (!docRef.current || downloading) return;
    setDownloading(true);
    try {
      await downloadHtmlNodeAsPdf(docRef.current, `act-${invoice.number}.pdf`);
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
            if (docRef.current) printHtmlNode(docRef.current, `Акт № ${invoice.number}`);
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
        <div className="text-center mb-6">
          <p className="text-lg font-bold">АКТ № {invoice.number}</p>
          <p className="text-sm">
            {isActivity
              ? "об оказании услуг по программе активности (нахождение на платформе, товары и отзывы)"
              : "об оказании услуг по программе монетизации (просмотры контактов)"}
          </p>
          <p className="mt-1">от {formatActDate(invoice.date)}</p>
        </div>

        {/* Стороны */}
        <div className="space-y-1 mb-4">
          <p>
            <span className="font-semibold">ПЛАТФОРМА (Заказчик):</span>{" "}
            {requisites.organizationName || "—"}
            {requisites.organizationInn ? `, ИНН ${requisites.organizationInn}` : ""}
          </p>
          <p>
            <span className="font-semibold">ИСПОЛНИТЕЛЬ (Компания):</span>{" "}
            {invoice.buyerName || "—"}
            {invoice.buyerInn ? `, ИНН ${invoice.buyerInn}` : ""}
          </p>
          <p>
            <span className="font-semibold">Основание:</span> Правила программы монетизации
            (Публичная оферта)
            {requisites.offerDate ? ` от ${formatShortDate(requisites.offerDate)} г.` : ""}
          </p>
        </div>

        <p className="mb-4">
          Настоящий Акт составлен о том, что Исполнитель в период с{" "}
          {formatShortDate(periodStart)} по {formatShortDate(invoice.date)} г.{" "}
          {isActivity
            ? "проявлял активность на Платформе"
            : "обеспечил показ контактной информации на Платформе"}{" "}
          со следующими показателями:
        </p>

        {/* Таблица метрик */}
        <table className="w-full border-collapse mb-4">
          <thead>
            <tr className="border-b-2 border-gray-400 text-left text-xs text-gray-600">
              <th className="py-2 pr-2 w-8 font-normal">№</th>
              <th className="py-2 px-2 font-normal">
                {isActivity ? "Тип активности" : "Тип метрики / Просмотры"}
              </th>
              <th className="py-2 px-2 text-right font-normal">Кол-во</th>
              <th className="py-2 px-2 text-right font-normal">Тариф за 1 ед., руб.</th>
              <th className="py-2 px-2 text-right font-normal">Сумма, руб.</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, i) => (
              <tr key={i} className="align-top">
                <td className="py-2 pr-2">{i + 1}</td>
                <td className="py-2 px-2">{metricLabel(item.description)}</td>
                <td className="py-2 px-2 text-right">
                  {item.quantity.toLocaleString("ru-RU")}
                </td>
                <td className="py-2 px-2 text-right">
                  {item.unitPrice.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="py-2 px-2 text-right">
                  {item.total.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Итоги */}
        <div className="flex justify-end mb-4">
          <div className="text-sm text-right">
            <p className="font-semibold">
              Итого к выплате вознаграждения: {formatRub(invoice.total)}
            </p>
            <p className="text-xs text-gray-600">
              {requisites.vatRate > 0 ? `В т.ч. НДС (${requisites.vatRate}%)` : "Без НДС"}
            </p>
          </div>
        </div>

        <p className="mb-4">
          Всего оказано услуг на сумму: {rublesInWords(invoice.total)}.
        </p>

        <p className="mb-6">Стороны претензий к объему и качеству учтённых метрик не имеют.</p>

        {/* Подписи */}
        <div className="flex justify-between gap-6">
          <div className="text-center">
            <p className="font-semibold mb-2">ОТ ПЛАТФОРМЫ:</p>
            {requisites.signatureImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={requisites.signatureImage} alt="Подпись" className="h-14 w-auto object-contain mx-auto mb-1" />
            )}
            <p>/{requisites.directorName || "____________"}/</p>
          </div>
          <div className="text-center">
            <p className="font-semibold mb-2">ИСПОЛНИТЕЛЬ (КОМПАНИЯ):</p>
            <p>/Подпись / ЭДО /</p>
          </div>
        </div>
      </div>
    </div>
  );
}
