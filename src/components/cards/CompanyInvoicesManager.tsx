"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { InvoicePrint, type InvoicePrintData, type BillingRequisites } from "@/components/shared/InvoicePrint";
import { ServiceActPrint, type ServiceActData } from "@/components/shared/ServiceActPrint";
import { toastError } from "@/lib/toast";
import { Loader2, Printer, FileText } from "lucide-react";
import { InvoiceStatusBadge, fetchRequisites, formatRubShort, formatDateShort } from "@/components/forms/billing/shared";

interface InvoiceRow {
  id: string;
  number: string;
  kind: string;
  date: string;
  dueDate: string;
  status: string;
  subtotal: number;
  discount: number;
  total: number;
  periodFrom: string | null;
  periodTo: string | null;
  act: { number: string; date: string } | null;
}

interface ActRow {
  id: string;
  number: string;
  date: string;
  total: number;
  invoiceNumber: string;
  periodFrom: string | null;
  periodTo: string | null;
}

interface MyData {
  invoices: InvoiceRow[];
  acts: ActRow[];
}

export function CompanyInvoicesManager() {
  const [data, setData] = useState<MyData | null>(null);
  const [reqs, setReqs] = useState<BillingRequisites | null>(null);
  const [invoiceView, setInvoiceView] = useState<InvoicePrintData | null>(null);
  const [actView, setActView] = useState<ServiceActData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/billing/my").then((r) => r.json()),
      fetchRequisites(),
    ])
      .then(([d, r]) => {
        if (!cancelled) {
          setData(d);
          setReqs(r);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  async function openInvoice(id: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/invoices/${id}`);
      const d = await res.json();
      if (!res.ok || !d.invoice) {
        toastError("Ошибка", "Счёт не найден");
        return;
      }
      setInvoiceView({
        number: d.invoice.number,
        date: d.invoice.date,
        dueDate: d.invoice.dueDate,
        status: d.invoice.status,
        subtotal: d.invoice.subtotal,
        discount: d.invoice.discount,
        total: d.invoice.total,
        kind: d.invoice.kind === "BILLING" ? "BILLING" : "PURCHASE",
        periodFrom: d.invoice.periodFrom,
        periodTo: d.invoice.periodTo,
        buyerName: d.invoice.buyerName,
        buyerInn: d.invoice.buyerInn,
        buyerKpp: d.invoice.buyerKpp,
        buyerAddress: d.invoice.buyerAddress,
        buyerKind: d.invoice.buyerKind,
        buyerUserId: d.invoice.buyerUserId,
        items: d.invoice.items,
      });
    } catch {
      toastError("Ошибка соединения");
    }
    setLoading(false);
  }

  async function openAct(id: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/acts/${id}`);
      const d = await res.json();
      if (!res.ok || !d.act) {
        toastError("Ошибка", "Акт не найден");
        return;
      }
      setActView({
        number: d.act.number,
        date: d.act.date,
        total: d.act.total,
        invoiceNumber: d.act.invoiceNumber,
        periodFrom: d.act.periodFrom,
        periodTo: d.act.periodTo,
        items: d.act.items,
        company: d.act.company,
        buyerName: d.act.buyerName,
        buyerEmail: d.act.buyerEmail,
      });
    } catch {
      toastError("Ошибка соединения");
    }
    setLoading(false);
  }

  if (!data || !reqs) {
    return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Счета ({data.invoices.length})</CardTitle></CardHeader>
        <CardContent>
          {data.invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">Счетов пока нет</p>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                    <th className="py-2 px-3 font-normal">Счёт</th>
                    <th className="py-2 px-3 font-normal">Назначение</th>
                    <th className="py-2 px-3 font-normal">Период</th>
                    <th className="py-2 px-3 font-normal">Статус</th>
                    <th className="py-2 px-3 font-normal text-right">Сумма</th>
                    <th className="py-2 px-3 font-normal text-right">Документы</th>
                  </tr>
                </thead>
                <tbody>
                  {data.invoices.map((i) => (
                    <tr key={i.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-2 px-3 font-medium">{i.number}</td>
                      <td className="py-2 px-3 text-xs">{i.kind === "BILLING" ? "Обслуживание платформы" : "Покупка монет"}</td>
                      <td className="py-2 px-3 text-xs">{formatDateShort(i.periodFrom)} — {formatDateShort(i.periodTo)}</td>
                      <td className="py-2 px-3"><InvoiceStatusBadge status={i.status} /></td>
                      <td className="py-2 px-3 text-right font-medium">{formatRubShort(i.total)}</td>
                      <td className="py-2 px-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openInvoice(i.id)}>
                            <Printer className="h-3 w-3 mr-1" />Счёт
                          </Button>
                          {i.act && (
                            <span className="text-xs text-muted-foreground ml-1">акт {i.act.number}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Акты об оказанных услугах ({data.acts.length})</CardTitle></CardHeader>
        <CardContent>
          {data.acts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Акты появляются после оплаты счетов за обслуживание</p>
          ) : (
            <div className="space-y-1">
              {data.acts.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-2 py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{a.number} <span className="text-xs text-muted-foreground font-normal">от {formatDateShort(a.date)}</span></p>
                    <p className="text-xs text-muted-foreground">
                      по счёту {a.invoiceNumber} · {formatDateShort(a.periodFrom)} — {formatDateShort(a.periodTo)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-medium">{formatRubShort(a.total)}</span>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openAct(a.id)}>
                      <FileText className="h-3 w-3 mr-1" />Открыть
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Счёт */}
      <Dialog open={!!invoiceView} onOpenChange={(v) => { if (!v) setInvoiceView(null); }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Счёт {invoiceView?.number ?? ""}</DialogTitle></DialogHeader>
          {loading || !invoiceView ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <InvoicePrint invoice={invoiceView} requisites={reqs} />
          )}
        </DialogContent>
      </Dialog>

      {/* Акт */}
      <Dialog open={!!actView} onOpenChange={(v) => { if (!v) setActView(null); }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Акт {actView?.number ?? ""}</DialogTitle></DialogHeader>
          {loading || !actView ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <ServiceActPrint act={actView} requisites={reqs} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
