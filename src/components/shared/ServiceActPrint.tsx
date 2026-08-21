"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Printer, Download, Loader2 } from "lucide-react";
import { formatRub, formatInvoiceDate, rublesInWords } from "@/lib/invoices";
import { printHtmlNode } from "@/lib/print";
import { downloadHtmlNodeAsPdf } from "@/lib/pdf";
import type { BillingRequisites } from "@/components/shared/InvoicePrint";

export interface ServiceActData {
  number: string;
  date: Date | string;
  total: number;
  invoiceNumber: string;
  periodFrom: Date | string | null;
  periodTo: Date | string | null;
  items: { description: string; quantity: number; unitPrice: number; total: number }[];
  company: { name: string; inn: string | null; kpp: string | null; legalAddress: string | null } | null;
  buyerName: string;
  buyerEmail: string | null;
}

function formatShortDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// «31» августа 2026 г. — день в кавычках-ёлочках, как принято в актах
function formatActDate(d: Date | string): string {
  return formatInvoiceDate(d).replace(/^(\d+)/, "«$1»");
}

function formatNumber(v: number): string {
  return v.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Акт об оказанных услугах — формируется при оплате счёта за абонентскую
 * плату и просмотры контактов. Исполнитель — платформа, заказчик — компания.
 */
export function ServiceActPrint({ act, requisites }: { act: ServiceActData; requisites: BillingRequisites }) {
  const withVat = requisites.vatRate > 0;
  const docRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    if (!docRef.current || downloading) return;
    setDownloading(true);
    try {
      await downloadHtmlNodeAsPdf(docRef.current, `act-${act.number}.pdf`);
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
            if (docRef.current) printHtmlNode(docRef.current, `Акт № ${act.number}`);
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
          <p className="text-lg font-bold">АКТ № {act.number}</p>
          <p className="text-sm">об оказанных услугах</p>
          <p className="mt-1">от {formatActDate(act.date)}</p>
        </div>

        {/* Стороны */}
        <div className="space-y-1 mb-4">
          <p>
            <span className="font-semibold">ИСПОЛНИТЕЛЬ (Платформа):</span>{" "}
            {requisites.organizationName || "—"}
            {requisites.organizationInn ? `, ИНН ${requisites.organizationInn}` : ""}
          </p>
          <p>
            <span className="font-semibold">ЗАКАЗЧИК (Компания):</span>{" "}
            {act.company?.name || act.buyerName || "—"}
            {act.company?.inn ? `, ИНН ${act.company.inn}` : ""}
            {act.company?.kpp ? `, КПП ${act.company.kpp}` : ""}
          </p>
          <p>
            <span className="font-semibold">Основание:</span> Публичная оферта (Пользовательское
            соглашение)
            {requisites.offerDate ? ` от ${formatShortDate(requisites.offerDate)} г.` : ""}, счёт на
            оплату № {act.invoiceNumber}
          </p>
        </div>

        <p className="mb-4">
          Настоящий Акт составлен о том, что Исполнитель оказал, а Заказчик принял следующие услуги
          {act.periodFrom && act.periodTo && (
            <>
              {" "}за период с {formatShortDate(act.periodFrom)} по {formatShortDate(act.periodTo)}
            </>
          )}
          :
        </p>

        {/* Таблица услуг */}
        <table className="w-full border-collapse mb-4">
          <thead>
            <tr className="border-b-2 border-gray-400 text-left text-xs text-gray-600">
              <th className="py-2 pr-2 w-8 font-normal">№</th>
              <th className="py-2 px-2 font-normal">Наименование услуги</th>
              <th className="py-2 px-2 text-right font-normal">Кол-во</th>
              <th className="py-2 px-2 text-right font-normal">Ед.</th>
              <th className="py-2 px-2 text-right font-normal">Цена, руб.</th>
              <th className="py-2 px-2 text-right font-normal">Сумма, руб.</th>
            </tr>
          </thead>
          <tbody>
            {act.items.map((item, i) => (
              <tr key={i} className="align-top">
                <td className="py-2 pr-2">{i + 1}</td>
                <td className="py-2 px-2">
                  {item.description.split("\n").map((line, li) => <p key={li}>{line}</p>)}
                </td>
                <td className="py-2 px-2 text-right">{item.quantity}</td>
                <td className="py-2 px-2 text-right">{item.quantity > 1 ? "шт." : "усл."}</td>
                <td className="py-2 px-2 text-right">{formatNumber(item.unitPrice)}</td>
                <td className="py-2 px-2 text-right">{formatNumber(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Итоги */}
        <div className="flex justify-end mb-4">
          <div className="text-sm text-right">
            <p className="font-semibold">Итого оказано услуг на сумму: {formatRub(act.total)}</p>
            <p className="text-xs text-gray-600">
              {withVat ? `В т.ч. НДС (${requisites.vatRate}%)` : "Без НДС"}
            </p>
          </div>
        </div>

        <p className="mb-4">Всего оказано услуг на сумму: {rublesInWords(act.total)}.</p>

        <p className="mb-6">
          Стороны претензий к объему и качеству оказанных услуг не имеют.
        </p>

        {/* Подписи */}
        <div className="flex items-end justify-between">
          <div className="text-center flex-1">
            <p className="font-semibold mb-2">ИСПОЛНИТЕЛЬ:</p>
            {requisites.signatureImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={requisites.signatureImage} alt="Подпись" className="h-14 w-auto object-contain mx-auto mb-1" />
            )}
            <p>/{requisites.directorName || "____________"}/</p>
          </div>
          <div className="text-center flex-1">
            {requisites.stampImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={requisites.stampImage} alt="Печать" className="h-14 w-auto object-contain mx-auto" />
            ) : (
              <p className="font-semibold">[ М.П. ]</p>
            )}
            <p className="text-xs text-gray-500 mt-1">(при наличии печати)</p>
          </div>
          <div className="text-center flex-1">
            <p className="font-semibold mb-2">ЗАКАЗЧИК:</p>
            <p>/Подпись / ЭДО /</p>
          </div>
        </div>
      </div>
    </div>
  );
}
