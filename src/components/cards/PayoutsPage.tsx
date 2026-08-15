"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  PayoutPrint,
} from "@/components/shared/PayoutPrint";
import type {
  InvoicePrintData,
  BillingRequisites,
} from "@/components/shared/InvoicePrint";
import { formatRub } from "@/lib/invoices";
import { FileText, Loader2, Receipt } from "lucide-react";

const PAYOUT_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Ожидает выплаты",
  SENT: "Выставлен",
  PAID: "Выплачен",
  SKIPPED: "Пропущен",
  OVERDUE: "Просрочен",
  CANCELLED: "Отменён",
};
const PAYOUT_STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-orange-100 text-orange-700",
  SENT: "bg-blue-100 text-blue-700",
  PAID: "bg-green-100 text-green-700",
  SKIPPED: "bg-gray-100 text-gray-700",
  OVERDUE: "bg-red-100 text-red-700",
  CANCELLED: "bg-gray-100 text-gray-700",
};

/**
 * Страница «Мои выплаты» в ЛК компании: счета на выплату за просмотры.
 * Данные догружаются клиентом с /api/payouts.
 */
export function PayoutsPage() {
  const [invoices, setInvoices] = useState<
    { id: string; number: string; date: string; dueDate: string; status: string; total: number }[]
  >([]);
  const [loaded, setLoaded] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState<string | null>(null);
  const [invoiceData, setInvoiceData] = useState<InvoicePrintData | null>(null);
  const [requisites, setRequisites] = useState<BillingRequisites | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/payouts")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) {
          setInvoices(d.invoices || []);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function openInvoice(invoiceId: string) {
    setInvoiceOpen(invoiceId);
    setInvoiceData(null);
    try {
      const [invRes, reqRes] = await Promise.all([
        fetch(`/api/invoices/${invoiceId}`),
        fetch("/api/billing/info"),
      ]);
      const inv = await invRes.json().catch(() => ({}));
      const req = await reqRes.json().catch(() => ({}));
      if (invRes.ok) setInvoiceData(inv.invoice);
      if (reqRes.ok) setRequisites(req);
    } catch {
      // silent
    }
  }

  return (
    <div>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Выплаты за просмотры</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!loaded ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : invoices.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <Receipt className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>Выплат пока нет</p>
            </div>
          ) : (
            invoices.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between py-2 border-b last:border-0"
              >
                <div>
                  <p className="text-sm font-medium">Счёт на выплату № {inv.number}</p>
                  <p className="text-xs text-muted-foreground">
                    от {new Date(inv.date).toLocaleDateString("ru-RU")} · выплатить до{" "}
                    {new Date(inv.dueDate).toLocaleDateString("ru-RU")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className={PAYOUT_STATUS_BADGE[inv.status] || ""}>
                    {PAYOUT_STATUS_LABELS[inv.status] || inv.status}
                  </Badge>
                  <span className="text-sm font-medium">{formatRub(inv.total)}</span>
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => openInvoice(inv.id)}>
                    <FileText className="h-3 w-3" /> Показать
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Печатный вид счёта */}
      <Dialog open={!!invoiceOpen} onOpenChange={(o) => { if (!o) setInvoiceOpen(null); }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Счёт на выплату</DialogTitle>
            <DialogDescription>Документ для получения выплаты по реквизитам</DialogDescription>
          </DialogHeader>
          {invoiceData && requisites ? (
            <PayoutPrint invoice={invoiceData} requisites={requisites} />
          ) : (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
