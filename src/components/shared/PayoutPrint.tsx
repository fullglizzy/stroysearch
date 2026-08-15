"use client";

import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { formatRub, formatInvoiceDate } from "@/lib/invoices";
import type { InvoicePrintData, BillingRequisites } from "@/components/shared/InvoicePrint";

const PAYOUT_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Ожидает выплаты",
  SENT: "Выставлен",
  PAID: "Выплачен",
  SKIPPED: "Пропущен",
  OVERDUE: "Просрочен",
  CANCELLED: "Отменён",
};

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/**
 * Печатный вид счёта на выплату: платформа выплачивает компании
 * вознаграждение за просмотры контактов. При печати (window.print)
 * печатается только этот блок — см. @media print в globals.css.
 */
export function PayoutPrint({
  invoice,
  requisites,
}: {
  invoice: InvoicePrintData;
  requisites: BillingRequisites;
}) {
  const vatRate = requisites.vatRate || 0;
  const withVat = vatRate > 0;
  const vatTotal = withVat ? round2(invoice.total * vatRate / 100) : 0;
  const toPay = round2(invoice.total + vatTotal);

  return (
    <div>
      <div className="flex justify-end mb-3 print:hidden">
        <Button size="sm" variant="outline" className="gap-1" onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Печать
        </Button>
      </div>

      <div className="invoice-print border rounded-lg p-6 bg-white text-black text-sm">
        {/* Заголовок */}
        <div className="text-center mb-6">
          <p className="text-lg font-bold">
            Счёт на выплату № {invoice.number} от {formatInvoiceDate(invoice.date)}
          </p>
          <p className="text-xs text-gray-600">Выплатить до {formatInvoiceDate(invoice.dueDate)}</p>
        </div>

        {/* Плательщик и получатель */}
        <div className="grid grid-cols-2 gap-6 mb-4">
          <div>
            <p className="text-xs text-gray-500 uppercase mb-1">Плательщик</p>
            <p className="font-semibold">{requisites.organizationName || "—"}</p>
            <p className="text-xs text-gray-700">
              ИНН {requisites.organizationInn || "—"}
              {requisites.organizationKpp ? ` · КПП ${requisites.organizationKpp}` : ""}
            </p>
            <p className="text-xs text-gray-700">Адрес: {requisites.organizationAddress || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase mb-1">Получатель</p>
            <p className="font-semibold">{invoice.buyerName || "—"}</p>
            <p className="text-xs text-gray-700">
              ИНН {invoice.buyerInn || "—"}
              {invoice.buyerKpp ? ` · КПП ${invoice.buyerKpp}` : ""}
            </p>
            <p className="text-xs text-gray-700">Адрес: {invoice.buyerAddress || "—"}</p>
          </div>
        </div>

        {/* Банк плательщика */}
        <div className="mb-4 text-xs text-gray-700">
          <p className="text-gray-500 uppercase mb-1">Банковские реквизиты плательщика</p>
          <p>
            {requisites.bankName || "—"} · БИК {requisites.bankBik || "—"} · р/с{" "}
            {requisites.bankAccount || "—"} · к/с {requisites.bankCorrAccount || "—"}
          </p>
        </div>

        {/* Основание */}
        <div className="mb-4 text-xs text-gray-700">
          <p>Основание: вознаграждение за просмотры контактов компании на платформе ЕНЦПР</p>
          {requisites.invoiceBasis && <p>Договор: {requisites.invoiceBasis}</p>}
        </div>

        {/* Таблица */}
        <table className="w-full border-collapse mb-4">
          <thead>
            <tr className="border-b-2 border-gray-400 text-left text-xs text-gray-600">
              <th className="py-2 pr-2">Метрика</th>
              <th className="py-2 px-2 text-right">Просмотров</th>
              <th className="py-2 px-2 text-right">Цена за просмотр</th>
              <th className="py-2 px-2 text-right">Сумма</th>
              {withVat && <th className="py-2 pl-2 text-right">НДС</th>}
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, i) => (
              <tr key={i} className="border-b border-gray-200">
                <td className="py-2 pr-2">{item.description}</td>
                <td className="py-2 px-2 text-right">{item.quantity}</td>
                <td className="py-2 px-2 text-right">{formatRub(item.unitPrice)}</td>
                <td className="py-2 px-2 text-right">{formatRub(item.total)}</td>
                {withVat && (
                  <td className="py-2 pl-2 text-right">
                    {formatRub(round2(item.total * vatRate / 100))}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Итоги */}
        <div className="flex justify-end mb-4">
          <div className="w-64 text-sm">
            <div className="flex justify-between py-1">
              <span>Итого</span>
              <span>{formatRub(invoice.total)}</span>
            </div>
            {withVat && (
              <div className="flex justify-between py-1">
                <span>НДС ({vatRate}%)</span>
                <span>{formatRub(vatTotal)}</span>
              </div>
            )}
            <div className="flex justify-between py-1 border-t-2 border-gray-400 font-bold">
              <span>К выплате</span>
              <span>{formatRub(toPay)}</span>
            </div>
          </div>
        </div>

        {/* Срок и статус */}
        <div className="mb-6 text-xs text-gray-700">
          <p>Срок выплаты: до {formatInvoiceDate(invoice.dueDate)}</p>
          <p className="text-gray-500">Статус: {PAYOUT_STATUS_LABELS[invoice.status] || invoice.status}</p>
        </div>

        {/* Подпись и печать */}
        <div className="flex items-end justify-between">
          <div />
          <div className="text-center">
            {requisites.signatureImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={requisites.signatureImage} alt="Подпись" className="h-14 w-auto object-contain mx-auto mb-1" />
            ) : (
              <p className="text-gray-500 mb-1">____________</p>
            )}
            <div className="border-t border-gray-400 pt-1 mt-2 w-56 text-xs text-center">
              {requisites.directorName ? `/${requisites.directorName}/` : "/ФИО/"}
            </div>
            {requisites.stampImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={requisites.stampImage} alt="Печать" className="h-20 w-auto object-contain mx-auto mt-1" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
