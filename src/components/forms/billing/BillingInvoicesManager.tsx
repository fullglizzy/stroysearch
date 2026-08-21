"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { InvoicePrint, type BillingRequisites } from "@/components/shared/InvoicePrint";
import { ServiceActPrint, type ServiceActData } from "@/components/shared/ServiceActPrint";
import { toastSuccess, toastError } from "@/lib/toast";
import {
  Search, Loader2, Send, CheckCircle2, SkipForward, XCircle, Pencil, Printer,
} from "lucide-react";
import {
  InvoiceStatusBadge, fetchRequisites, formatRubShort, formatDateShort, monthToIso,
} from "./shared";

interface InvoiceRow {
  id: string;
  number: string;
  date: string;
  dueDate: string;
  status: string;
  subtotal: number;
  discount: number;
  total: number;
  periodFrom: string | null;
  periodTo: string | null;
  username: string;
  company: { id: string; name: string } | null;
  act: { id: string; number: string; date: string } | null;
}

interface ActRow {
  id: string;
  number: string;
  date: string;
  total: number;
  invoiceNumber: string;
  periodFrom: string | null;
  periodTo: string | null;
  company: string | null;
}

interface InvoiceDetail {
  invoice: {
    id: string;
    number: string;
    date: string;
    dueDate: string;
    status: string;
    subtotal: number;
    discount: number;
    total: number;
    limit: number;
    periodFrom: string | null;
    periodTo: string | null;
    username: string;
    email: string;
    company: { name: string; inn: string; kpp: string | null; legalAddress: string | null } | null;
    act: { id: string; number: string; date: string } | null;
    items: { description: string; quantity: number; unitPrice: number; total: number }[];
  };
}

const STATUS_FILTERS: Record<string, string> = {
  "": "Все статусы",
  DRAFT: "Черновик",
  SENT: "Выставлен",
  PAID: "Оплачен",
  SKIPPED: "Пропущен",
  OVERDUE: "Просрочен",
  CANCELLED: "Отменён",
};

export function BillingInvoicesManager() {
  const [invoices, setInvoices] = useState<InvoiceRow[] | null>(null);
  const [acts, setActs] = useState<ActRow[] | null>(null);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [month, setMonth] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(50);
  const [total, setTotal] = useState(0);

  const [viewId, setViewId] = useState<string | null>(null);
  const [detail, setDetail] = useState<InvoiceDetail | null>(null);
  const [reqs, setReqs] = useState<BillingRequisites | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [action, setAction] = useState<{ id: string; kind: "send" | "pay" | "skip" | "cancel" } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [discountId, setDiscountId] = useState<string | null>(null);
  const [discountValue, setDiscountValue] = useState("");
  const [discountLoading, setDiscountLoading] = useState(false);
  const [actViewId, setActViewId] = useState<string | null>(null);
  const [actData, setActData] = useState<ServiceActData | null>(null);
  const [actLoading, setActLoading] = useState(false);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (q.trim()) params.set("q", q.trim());
    if (month) {
      const iso = monthToIso(month);
      if (iso) params.set("month", month);
    }
    params.set("page", String(page));
    params.set("perPage", String(perPage));
    fetch(`/api/admin/billing/invoices?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        setInvoices(d.invoices || []);
        setTotal(d.total ?? 0);
      })
      .catch(() => setInvoices([]));
  }, [status, q, month, page, perPage]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  // Список актов — отдельным запросом, секция под счетами
  const loadActs = useCallback(() => {
    fetch("/api/admin/billing/acts")
      .then((r) => r.json())
      .then((d) => setActs(d.acts || []))
      .catch(() => setActs([]));
  }, []);

  useEffect(() => {
    loadActs();
  }, [loadActs]);

  // ── Просмотр счёта ──

  async function openView(id: string) {
    setViewId(id);
    setDetail(null);
    setViewLoading(true);
    try {
      const [invRes, reqsRes] = await Promise.all([
        fetch(`/api/admin/billing/invoices/${id}`),
        fetchRequisites(),
      ]);
      const d = await invRes.json();
      if (!invRes.ok) {
        toastError("Ошибка", d.error || "Не удалось загрузить счёт");
        setViewId(null);
        return;
      }
      setDetail(d);
      setReqs(reqsRes);
    } catch {
      toastError("Ошибка соединения");
      setViewId(null);
    }
    setViewLoading(false);
  }

  async function runAction() {
    if (!action) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/billing/invoices/${action.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: action.kind }),
      });
      const d = await res.json();
      if (res.ok) {
        toastSuccess("Готово", action.kind === "pay" && d.act ? `Сформирован акт ${d.act.number}` : undefined);
        load();
        loadActs();
        if (viewId === action.id) openView(action.id);
      } else {
        toastError("Ошибка", d.error || "Не удалось выполнить действие");
      }
    } catch {
      toastError("Ошибка соединения");
    }
    setAction(null);
    setActionLoading(false);
  }

  async function saveDiscount() {
    if (!discountId) return;
    setDiscountLoading(true);
    try {
      const res = await fetch(`/api/admin/billing/invoices/${discountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "edit", discount: parseFloat(discountValue) || 0 }),
      });
      const d = await res.json();
      if (res.ok) {
        toastSuccess("Скидка применена");
        setDiscountId(null);
        load();
        if (viewId === discountId) openView(discountId);
      } else {
        toastError("Ошибка", d.error || "Не удалось применить скидку");
      }
    } catch {
      toastError("Ошибка соединения");
    }
    setDiscountLoading(false);
  }

  async function openActById(id: string) {
    setActViewId(id);
    setActData(null);
    setActLoading(true);
    try {
      const [actRes, reqsRes] = await Promise.all([
        fetch(`/api/acts/${id}`),
        fetchRequisites(),
      ]);
      const d = await actRes.json();
      if (!actRes.ok || !d.act) {
        toastError("Ошибка", "Акт не найден");
        setActViewId(null);
        return;
      }
      setActData({
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
      setReqs(reqsRes);
    } catch {
      toastError("Ошибка соединения");
      setActViewId(null);
    }
    setActLoading(false);
  }

  const pages = Math.max(1, Math.ceil(total / perPage));

  return (
    <div className="space-y-6">
      {/* Порядок работы — чтобы процесс был прозрачным */}
      <Alert>
        <AlertDescription className="text-xs">
          <b>Порядок работы:</b> счета формируются в попапе компании — вкладка «Компании» → «Открыть» →
          «Сформировать счёт за период». Здесь вы работаете с готовыми счетами: «Выставить» — компания увидит
          счёт в кабинете и получит уведомление; после поступления оплаты — «Оплачен», и автоматически
          создастся акт. Если оплаты нет: «Скидка», «Пропустить» (простить долг) или «Отменить». Срок оплаты
          истёк — счёт становится «Просрочен» <b>автоматически</b>; за неуплату администратор вручную применяет
          санкцию «Скрыть контакты» во вкладке «Компании».
        </AlertDescription>
      </Alert>

      {/* Счета */}
      <div className="space-y-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Номер, компания, владелец..." value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} className="pl-9" />
          </div>
          <Select value={status} items={STATUS_FILTERS} onValueChange={(v) => { setStatus(v ?? ""); setPage(1); }}>
            <SelectTrigger className="w-[170px]"><SelectValue placeholder="Статус" /></SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_FILTERS).map(([k, label]) => (
                <SelectItem key={k} value={k} label={label}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="space-y-1">
            <Label className="text-xs">Период (месяц)</Label>
            <Input type="month" value={month} onChange={(e) => { setMonth(e.target.value); setPage(1); }} className="w-[150px]" />
          </div>
          {month && (
            <Button variant="outline" onClick={() => { setMonth(""); setPage(1); }}>Сбросить период</Button>
          )}
        </div>

        {invoices === null ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6">
            Счетов с такими фильтрами нет. Счета создаются в попапе компании — вкладка «Компании» → «Открыть».
          </p>
        ) : (
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                  <th className="py-2 px-3 font-normal">Счёт</th>
                  <th className="py-2 px-3 font-normal">Компания</th>
                  <th className="py-2 px-3 font-normal">Период</th>
                  <th className="py-2 px-3 font-normal">Статус</th>
                  <th className="py-2 px-3 font-normal text-right">Сумма</th>
                  <th className="py-2 px-3 font-normal">Оплатить до</th>
                  <th className="py-2 px-3 font-normal text-right">Действия</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((i) => (
                  <tr key={i.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-2 px-3 font-medium">
                      {i.number}
                      {i.discount > 0 && <p className="text-[10px] text-muted-foreground font-normal">скидка −{formatRubShort(i.discount)}</p>}
                    </td>
                    <td className="py-2 px-3">
                      <p>{i.company?.name ?? i.username}</p>
                    </td>
                    <td className="py-2 px-3 text-xs">{formatDateShort(i.periodFrom)} — {formatDateShort(i.periodTo)}</td>
                    <td className="py-2 px-3"><InvoiceStatusBadge status={i.status} /></td>
                    <td className="py-2 px-3 text-right font-medium">{formatRubShort(i.total)}</td>
                    <td className="py-2 px-3 text-xs">{formatDateShort(i.dueDate)}</td>
                    <td className="py-2 px-3">
                      <div className="flex items-center justify-end gap-1 flex-wrap">
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openView(i.id)} title="Показать и распечатать">
                          <Printer className="h-3 w-3" />
                        </Button>
                        {["DRAFT"].includes(i.status) && (
                          <>
                            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setAction({ id: i.id, kind: "send" })}>
                              <Send className="h-3 w-3 mr-1" />Выставить
                            </Button>
                            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setDiscountId(i.id); setDiscountValue(String(i.discount)); }}>
                              <Pencil className="h-3 w-3 mr-1" />Скидка
                            </Button>
                            <Button variant="outline" size="sm" className="h-7 text-xs text-red-600" onClick={() => setAction({ id: i.id, kind: "cancel" })}>
                              <XCircle className="h-3 w-3 mr-1" />Отменить
                            </Button>
                          </>
                        )}
                        {["SENT", "OVERDUE"].includes(i.status) && (
                          <Button variant="outline" size="sm" className="h-7 text-xs text-green-700" onClick={() => setAction({ id: i.id, kind: "pay" })}>
                            <CheckCircle2 className="h-3 w-3 mr-1" />Оплачен
                          </Button>
                        )}
                        {["SENT", "OVERDUE"].includes(i.status) && (
                          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setAction({ id: i.id, kind: "skip" })}>
                            <SkipForward className="h-3 w-3 mr-1" />Пропустить
                          </Button>
                        )}
                        {i.act && (
                          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openActById(i.act!.id)}>
                            Акт {i.act.number}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {invoices !== null && total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <p className="text-muted-foreground">
              Показаны {total === 0 ? 0 : (page - 1) * perPage + 1}–{Math.min(page * perPage, total)} из {total}
            </p>
            <div className="flex items-center gap-2">
              <Select value={String(perPage)} items={{ "25": "25", "50": "50", "100": "100" }} onValueChange={(v) => { setPerPage(Number(v)); setPage(1); }}>
                <SelectTrigger className="w-[90px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="25" label="25">25</SelectItem>
                  <SelectItem value="50" label="50">50</SelectItem>
                  <SelectItem value="100" label="100">100</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Назад</Button>
              <span className="text-muted-foreground">{page} / {pages}</span>
              <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Вперёд →</Button>
            </div>
          </div>
        )}
      </div>

      {/* Акты */}
      <Card>
        <CardHeader><CardTitle className="text-base">Акты об оказанных услугах</CardTitle></CardHeader>
        <CardContent>
          {acts === null ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : acts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Акты создаются автоматически при отметке счёта «Оплачен»</p>
          ) : (
            <div className="space-y-1">
              {acts.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-2 py-2 border-b last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{a.number} <span className="text-xs text-muted-foreground font-normal">от {formatDateShort(a.date)}</span></p>
                    <p className="text-xs text-muted-foreground truncate">
                      {a.company ?? "—"} · по счёту {a.invoiceNumber} · {formatDateShort(a.periodFrom)} — {formatDateShort(a.periodTo)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-medium">{formatRubShort(a.total)}</span>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openActById(a.id)}>
                      <Printer className="h-3 w-3 mr-1" />Показать
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Просмотр счёта */}
      <Dialog open={!!viewId} onOpenChange={(v) => { if (!v) setViewId(null); }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Счёт {detail?.invoice.number ?? ""}</DialogTitle>
            <DialogDescription>{detail?.invoice.company?.name} · {detail?.invoice.username}</DialogDescription>
          </DialogHeader>
          {viewLoading || !detail || !reqs ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <InvoicePrint
              invoice={{
                number: detail.invoice.number,
                date: detail.invoice.date,
                dueDate: detail.invoice.dueDate,
                status: detail.invoice.status,
                subtotal: detail.invoice.subtotal,
                discount: detail.invoice.discount,
                total: detail.invoice.total,
                kind: "BILLING",
                periodFrom: detail.invoice.periodFrom,
                periodTo: detail.invoice.periodTo,
                buyerName: detail.invoice.company?.name ?? detail.invoice.username,
                buyerInn: detail.invoice.company?.inn ?? null,
                buyerKpp: detail.invoice.company?.kpp ?? null,
                buyerAddress: detail.invoice.company?.legalAddress ?? null,
                buyerKind: "company",
                items: detail.invoice.items,
              }}
              requisites={reqs}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Подтверждение действия */}
      <ConfirmDialog
        open={!!action}
        onOpenChange={(v) => { if (!v) setAction(null); }}
        title={
          action?.kind === "pay" ? "Отметить счёт оплаченным?"
            : action?.kind === "send" ? "Выставить счёт?"
            : action?.kind === "skip" ? "Пропустить счёт?"
            : "Отменить счёт?"
        }
        message={
          action?.kind === "pay"
            ? "Счёт будет помечен оплаченным, автоматически сформируется акт об оказанных услугах. Если контакты компании были скрыты — верните их вручную во вкладке «Компании»."
            : action?.kind === "send"
              ? "Счёт получит статус «Выставлен»: компания увидит его в кабинете и получит уведомление."
              : action?.kind === "skip"
                ? "Счёт закроется без оплаты — долг прощается. Просмотры периода остаются учтёнными."
                : "Черновик будет отменён, а его период вернётся в невыставленные — счёт можно сформировать заново."
        }
        confirmLabel={
          action?.kind === "pay" ? "Оплачен" : action?.kind === "send" ? "Выставить" : action?.kind === "skip" ? "Пропустить" : "Отменить"
        }
        onConfirm={runAction}
        loading={actionLoading}
      />

      {/* Скидка на черновик */}
      <Dialog open={!!discountId} onOpenChange={(v) => { if (!v) setDiscountId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Скидка на счёт</DialogTitle>
            <DialogDescription>Сумма в рублях, вычитается из итога счёта.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label>Скидка (₽)</Label>
            <Input type="number" min="0" step="0.01" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} />
          </div>
          <Button className="bg-menthol hover:bg-menthol-dark" onClick={saveDiscount} disabled={discountLoading}>
            {discountLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Применить
          </Button>
        </DialogContent>
      </Dialog>

      {/* Акт */}
      <Dialog open={!!actViewId} onOpenChange={(v) => { if (!v) setActViewId(null); }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Акт {actData?.number ?? ""}</DialogTitle>
          </DialogHeader>
          {actLoading || !actData || !reqs ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <ServiceActPrint act={actData} requisites={reqs} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
