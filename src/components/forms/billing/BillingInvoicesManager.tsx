"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { buildBillingItems, type ViewMetric } from "@/lib/billing";
import {
  Search, Loader2, Send, CheckCircle2, SkipForward, XCircle, Eye, RefreshCw,
} from "lucide-react";
import {
  InvoiceStatusBadge, fetchRequisites, formatRubShort, formatDateShort, monthToIso,
} from "./shared";

/** Сегодня в формате YYYY-MM-DD (для input type="date") */
function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** ISO-дата из API → YYYY-MM-DD в локальном часовом поясе */
function toDateInput(v: string | null): string {
  if (!v) return todayStr();
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return todayStr();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Поля ставок в диалоге «Отменить и перевыставить» */
const REISSUE_FIELDS = [
  { key: "maintenanceFee", label: "Абонентская плата (₽/мес)" },
  { key: "phonePrice", label: "Просмотр телефона (₽)" },
  { key: "emailPrice", label: "Просмотр почты (₽)" },
  { key: "websitePrice", label: "Просмотр сайта (₽)" },
  { key: "reviewsPrice", label: "Просмотр отзывов (₽)" },
  { key: "ratingPrice", label: "Просмотр рейтинга (₽)" },
  { key: "monthlyCap", label: "Потолок счёта (₽)" },
] as const;

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
  SKIPPED: "Списан",
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
  const [actViewId, setActViewId] = useState<string | null>(null);
  const [actData, setActData] = useState<ServiceActData | null>(null);
  const [actLoading, setActLoading] = useState(false);

  // Перевыставление: отменить счёт и выставить новый за тот же период
  const [reissue, setReissue] = useState<{ id: string; number: string; periodTo: string | null } | null>(null);
  const [reissueDate, setReissueDate] = useState(todayStr());
  const [reissueRates, setReissueRates] = useState<Record<string, string>>({});
  const [reissueSaveRates, setReissueSaveRates] = useState(false);
  const [reissueLoading, setReissueLoading] = useState(false);
  const [reissueRatesLoading, setReissueRatesLoading] = useState(false);
  /** Эффективные ставки на момент открытия — фолбэк для пустых полей предпросмотра */
  const [reissueFallback, setReissueFallback] = useState<Record<string, number>>({});
  // Живой предпросмотр: счётчики/интервалы/шаблоны с сервера, ставки — из полей
  const [reissuePreview, setReissuePreview] = useState<{
    period: { from: string; to: string } | null;
    counts: Record<string, number> | null;
    hiddenIntervals: { from: string; to: string | null }[];
    templates: { maintenance: string; views: string } | null;
  } | null>(null);
  const [reissuePreviewLoading, setReissuePreviewLoading] = useState(false);
  const reissuePreviewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // ── Перевыставление: счёт не оплачен — отменить и выставить новый ──

  /** Предпросмотр нового счёта: счётчики, интервалы скрытия и шаблоны строк */
  async function loadReissuePreview(id: string, date: string) {
    setReissuePreviewLoading(true);
    try {
      const res = await fetch(`/api/admin/billing/invoices/${id}/preview?date=${encodeURIComponent(date)}`);
      const d = await res.json();
      if (!res.ok) {
        toastError("Ошибка", d.error || "Не удалось загрузить предпросмотр");
        setReissuePreview(null);
        return;
      }
      setReissuePreview(d);
    } catch {
      toastError("Ошибка соединения");
      setReissuePreview(null);
    }
    setReissuePreviewLoading(false);
  }

  /** Открыть диалог: предзаполняем дату, текущий тариф и предпросмотр */
  async function openReissue(i: InvoiceRow) {
    if (!i.company?.id) {
      toastError("Ошибка", "У счёта нет компании");
      return;
    }
    const date = toDateInput(i.periodTo);
    setReissue({ id: i.id, number: i.number, periodTo: i.periodTo });
    setReissueDate(date);
    setReissueSaveRates(false);
    setReissueRatesLoading(true);
    setReissueRates({});
    setReissuePreview(null);
    try {
      const res = await fetch(`/api/admin/companies/${i.company.id}/billing`);
      const d = await res.json();
      if (!res.ok) {
        toastError("Ошибка", d.error || "Не удалось загрузить тариф");
        setReissue(null);
        return;
      }
      const b = d.billing;
      setReissueRates({
        maintenanceFee: b?.maintenanceFee != null ? String(b.maintenanceFee) : String(d.defaults.maintenanceFee),
        phonePrice: b?.phonePrice != null ? String(b.phonePrice) : String(d.defaults.phoneViewPrice),
        emailPrice: b?.emailPrice != null ? String(b.emailPrice) : String(d.defaults.emailViewPrice),
        websitePrice: b?.websitePrice != null ? String(b.websitePrice) : String(d.defaults.websiteViewPrice),
        reviewsPrice: b?.reviewsPrice != null ? String(b.reviewsPrice) : String(d.defaults.reviewsViewPrice),
        ratingPrice: b?.ratingPrice != null ? String(b.ratingPrice) : String(d.defaults.ratingViewPrice),
        monthlyCap: b?.monthlyCap != null ? String(b.monthlyCap) : "",
      });
      // Эффективные ставки — фолбэк для пустых полей в живом предпросмотре
      setReissueFallback({
        maintenanceFee: b?.maintenanceFee != null ? b.maintenanceFee : d.defaults.maintenanceFee,
        phonePrice: b?.phonePrice != null ? b.phonePrice : d.defaults.phoneViewPrice,
        emailPrice: b?.emailPrice != null ? b.emailPrice : d.defaults.emailViewPrice,
        websitePrice: b?.websitePrice != null ? b.websitePrice : d.defaults.websiteViewPrice,
        reviewsPrice: b?.reviewsPrice != null ? b.reviewsPrice : d.defaults.reviewsViewPrice,
        ratingPrice: b?.ratingPrice != null ? b.ratingPrice : d.defaults.ratingViewPrice,
        monthlyCap: b?.monthlyCap != null ? b.monthlyCap : 0,
      });
      void loadReissuePreview(i.id, date);
    } catch {
      toastError("Ошибка соединения");
      setReissue(null);
    }
    setReissueRatesLoading(false);
  }

  // Живой пересчёт нового счёта по введённым ставкам и выбранной дате
  const reissueComputation = useMemo(() => {
    if (!reissuePreview?.period || !reissuePreview.counts || !reissuePreview.templates) return null;
    const num = (key: string, fallback: number) => {
      const raw = (reissueRates[key] ?? "").trim();
      if (raw === "") return fallback;
      const n = parseFloat(raw);
      return Number.isFinite(n) && n >= 0 ? n : fallback;
    };
    const rates = {
      maintenanceFee: num("maintenanceFee", reissueFallback.maintenanceFee ?? 0),
      phonePrice: num("phonePrice", reissueFallback.phonePrice ?? 0),
      emailPrice: num("emailPrice", reissueFallback.emailPrice ?? 0),
      websitePrice: num("websitePrice", reissueFallback.websitePrice ?? 0),
      reviewsPrice: num("reviewsPrice", reissueFallback.reviewsPrice ?? 0),
      ratingPrice: num("ratingPrice", reissueFallback.ratingPrice ?? 0),
      monthlyCap: num("monthlyCap", 0),
      invoiceDueDays: 5,
    };
    return buildBillingItems(
      rates,
      new Date(reissuePreview.period.from),
      new Date(reissuePreview.period.to),
      reissuePreview.counts as Record<ViewMetric, number>,
      reissuePreview.templates,
      reissuePreview.hiddenIntervals.map((h) => ({ from: new Date(h.from), to: h.to ? new Date(h.to) : null })),
    );
  }, [reissuePreview, reissueRates, reissueFallback]);

  async function submitReissue() {
    if (!reissue) return;
    setReissueLoading(true);
    const rates: Record<string, number | null> = {};
    for (const f of REISSUE_FIELDS) {
      const raw = (reissueRates[f.key] ?? "").trim();
      rates[f.key] = raw === "" ? null : parseFloat(raw);
    }
    try {
      const res = await fetch(`/api/admin/billing/invoices/${reissue.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reissue", date: reissueDate, rates, saveRates: reissueSaveRates }),
      });
      const d = await res.json();
      if (res.ok) {
        toastSuccess(
          "Счёт перевыставлен",
          d.reissued ? `Новый счёт ${d.reissued.number} на ${formatRubShort(d.reissued.total)}` : undefined,
        );
        setReissue(null);
        load();
      } else {
        toastError("Ошибка", d.error || "Не удалось перевыставить счёт");
      }
    } catch {
      toastError("Ошибка соединения");
    }
    setReissueLoading(false);
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
          <b>Порядок работы:</b> счета выставляются на выбранную дату — кнопка «Массово выставить счета» на вкладке
          «Компании» (счёт покроет всё накопленное с прошлого счёта: абонплата + просмотры) или в попапе компании.
          Созданные счета сразу получают статус «Выставлен» — компания видит счёт в кабинете и получает уведомление;
          «Выставить» здесь нужен только старым черновикам. После поступления оплаты — «Оплачен», и автоматически
          создастся акт. Если компания не может оплатить: «Перевыставить» — счёт отменяется, метрики возвращаются
          в невыставленные, и новый счёт выставляется с другими ставками, потолком и датой; «Списать» —
          простить долг без возврата метрик. Срок оплаты истёк — счёт становится «Просрочен» <b>автоматически</b>;
          за неуплату администратор вручную применяет санкцию «Скрыть контакты» во вкладке «Компании».
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
            <Label className="text-xs">Месяц счёта</Label>
            <Input type="month" value={month} onChange={(e) => { setMonth(e.target.value); setPage(1); }} className="w-[150px]" />
          </div>
          {month && (
            <Button variant="outline" onClick={() => { setMonth(""); setPage(1); }}>Сбросить месяц</Button>
          )}
        </div>

        {invoices === null ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6">
            Счетов с такими фильтрами нет. Счета создаются кнопкой «Массово выставить счета» на вкладке «Компании»
            или в попапе компании — вкладка «Компании» → «Открыть».
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
                          <Eye className="h-3 w-3" />
                        </Button>
                        {["DRAFT"].includes(i.status) && (
                          <>
                            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setAction({ id: i.id, kind: "send" })}>
                              <Send className="h-3 w-3 mr-1" />Выставить
                            </Button>
                            <Button variant="outline" size="sm" className="h-7 text-xs text-red-600" onClick={() => setAction({ id: i.id, kind: "cancel" })}>
                              <XCircle className="h-3 w-3 mr-1" />Отменить
                            </Button>
                          </>
                        )}
                        {["SENT", "OVERDUE"].includes(i.status) && (
                          <>
                            <Button variant="outline" size="sm" className="h-7 text-xs text-green-700" onClick={() => setAction({ id: i.id, kind: "pay" })}>
                              <CheckCircle2 className="h-3 w-3 mr-1" />Оплачен
                            </Button>
                            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setAction({ id: i.id, kind: "skip" })} title="Списать долг — счёт закроется без оплаты">
                              <SkipForward className="h-3 w-3 mr-1" />Списать
                            </Button>
                            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openReissue(i)} title="Отменить счёт и выставить новый с другими ставками, потолком и датой">
                              <RefreshCw className="h-3 w-3 mr-1" />Перевыставить
                            </Button>
                            <Button variant="outline" size="sm" className="h-7 text-xs text-red-600" onClick={() => setAction({ id: i.id, kind: "cancel" })} title="Отменить: метрики периода вернутся в невыставленные">
                              <XCircle className="h-3 w-3 mr-1" />Отменить
                            </Button>
                          </>
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
                      <Eye className="h-3 w-3 mr-1" />Показать
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
            : action?.kind === "skip" ? "Списать счёт (простить долг)?"
            : "Отменить счёт?"
        }
        message={
          action?.kind === "pay"
            ? "Счёт будет помечен оплаченным, автоматически сформируется акт об оказанных услугах. Если контакты компании были скрыты — верните их вручную во вкладке «Компании»."
            : action?.kind === "send"
              ? "Счёт получит статус «Выставлен»: компания увидит его в кабинете и получит уведомление."
              : action?.kind === "skip"
                ? "Счёт закроется без оплаты — долг прощается. Просмотры периода остаются учтёнными."
                : "Счёт будет отменён, а его период и метрики вернутся в невыставленные — счёт можно сформировать заново (в т.ч. с другими ставками через «Перевыставить»)."
        }
        confirmLabel={
          action?.kind === "pay" ? "Оплачен" : action?.kind === "send" ? "Выставить" : action?.kind === "skip" ? "Списать" : "Отменить"
        }
        onConfirm={runAction}
        loading={actionLoading}
      />

      {/* Перевыставление: отменить счёт и выставить новый с другими ставками */}
      <Dialog open={!!reissue} onOpenChange={(v) => { if (!v && !reissueLoading) setReissue(null); }}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Отменить и перевыставить</DialogTitle>
            <DialogDescription>
              Счёт {reissue?.number ?? ""} будет отменён, его метрики вернутся в невыставленные, и сразу
              сформируется новый счёт за тот же период — с выбранной датой, ставками и потолком.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Новый счёт покроет накопленное до даты</Label>
              <Input
                type="date"
                value={reissueDate}
                max={todayStr()}
                onChange={(e) => {
                  const v = e.target.value;
                  setReissueDate(v);
                  if (reissuePreviewTimer.current) clearTimeout(reissuePreviewTimer.current);
                  if (v && reissue) {
                    reissuePreviewTimer.current = setTimeout(() => { void loadReissuePreview(reissue.id, v); }, 300);
                  }
                }}
                className="w-[190px]"
              />
            </div>
            {reissueRatesLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {REISSUE_FIELDS.map((f) => (
                  <div key={f.key} className="space-y-1">
                    <Label>{f.label}</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={reissueRates[f.key] ?? ""}
                      placeholder="по умолчанию"
                      onChange={(e) => setReissueRates((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Живой предпросмотр нового счёта — пересчитывается при вводе */}
            {reissuePreviewLoading ? (
              <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : reissuePreview && reissuePreview.period === null ? (
              <p className="text-xs text-muted-foreground">
                Нет периода для выставления за выбранную дату — выберите более позднюю дату.
              </p>
            ) : reissueComputation ? (
              <div className="border rounded-lg bg-muted/20 p-3 text-xs space-y-1">
                <p className="text-muted-foreground">
                  Новый счёт, период: {formatDateShort(reissuePreview?.period?.from)} — {formatDateShort(reissuePreview?.period?.to)}
                </p>
                {reissueComputation.items.map((it, idx) => (
                  <p key={idx}>{it.description} — {formatRubShort(it.total)}</p>
                ))}
                <p className="pt-1 border-t">
                  Сумма: {formatRubShort(reissueComputation.subtotal)}
                  {reissueComputation.capDiscount > 0 && (
                    <span className="block text-muted-foreground">
                      Скидка по потолку счёта: −{formatRubShort(reissueComputation.capDiscount)}
                    </span>
                  )}
                </p>
                <p className="font-semibold">
                  Итого: {formatRubShort(reissueComputation.total)}
                </p>
              </div>
            ) : null}

            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={reissueSaveRates} onChange={(e) => setReissueSaveRates(e.target.checked)} className="mt-0.5" />
              <span>
                Сделать эти ставки тарифом компании <b>постоянно</b> (будут применяться и к следующим счетам)
              </span>
            </label>
            <p className="text-xs text-muted-foreground">
              Пустое поле — ставка возьмётся из тарифа компании или настроек по умолчанию.
            </p>
            <div className="flex justify-end">
              <Button className="bg-menthol hover:bg-menthol-dark" onClick={submitReissue} disabled={reissueLoading || reissueRatesLoading || !reissueDate}>
                {reissueLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Отменить и выставить новый
              </Button>
            </div>
          </div>
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
