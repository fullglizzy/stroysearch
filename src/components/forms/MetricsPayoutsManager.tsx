"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pagination } from "@/components/shared/Pagination";
import { PayoutPrint } from "@/components/shared/PayoutPrint";
import type {
  InvoicePrintData,
  BillingRequisites,
} from "@/components/shared/InvoicePrint";
import { toastSuccess, toastError } from "@/lib/toast";
import { formatRub } from "@/lib/invoices";
import { Search, X, Loader2, FileText, CheckCircle2 } from "lucide-react";

interface MetricState {
  views: number;
  paid: number;
  delta: number;
}

interface PayoutRow {
  userId: string;
  username: string;
  email: string;
  status: string;
  companyName: string | null;
  createdAt: string;
  metrics: {
    phone: MetricState;
    email: MetricState;
    website: MetricState;
    rating: MetricState;
    reviews: MetricState;
  };
  prices: {
    phonePrice: number;
    emailPrice: number;
    websitePrice: number;
    ratingPrice: number;
    reviewsPrice: number;
  };
}

interface HistoryRow {
  id: string;
  number: string;
  kind: string;
  username: string;
  companyName: string | null;
  date: string;
  dueDate: string;
  status: string;
  total: number;
}

interface ActivityRow {
  userId: string;
  username: string;
  status: string;
  companyName: string;
  newProducts: number;
  newReviews: number;
  presenceDays: number;
  prices: {
    productPrice: number;
    reviewPrice: number;
    presencePrice: number;
  };
  billedUntil: string | null;
}

interface Props {
  tab: "rates" | "history" | "activity";
  rows: PayoutRow[];
  total: number;
  page: number;
  totalPages: number;
  initialQuery: { q: string; status: string; sort: string; pending: boolean };
  activityRows: ActivityRow[];
  activityTotal: number;
  activityPage: number;
  activityTotalPages: number;
  activityQuery: { q: string; status: string; sort: string; pending: boolean; start: string; end: string };
  historyRows: HistoryRow[];
  historyTotal: number;
  historyPage: number;
  historyTotalPages: number;
  historyQuery: { q: string; status: string; sort: string };
}

const USER_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Активен",
  INACTIVE: "Не активен",
  BANNED: "Заблокирован",
  DELETED: "Удалён",
};
const USER_STATUS_BADGE: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  INACTIVE: "bg-gray-100 text-gray-700",
  BANNED: "bg-red-100 text-red-700",
  DELETED: "bg-red-100 text-red-700",
};

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

const METRIC_KEYS = ["phone", "email", "website", "rating", "reviews"] as const;
type MetricKey = (typeof METRIC_KEYS)[number];
type PriceKey = "phonePrice" | "emailPrice" | "websitePrice" | "ratingPrice" | "reviewsPrice";

const METRIC_LABELS: Record<MetricKey, string> = {
  phone: "Телефон",
  email: "Email",
  website: "Сайт",
  rating: "Рейтинг",
  reviews: "Отзывы",
};

const priceKey = (k: MetricKey): PriceKey => `${k}Price` as PriceKey;

export function MetricsPayoutsManager({
  tab,
  rows,
  total,
  page,
  totalPages,
  initialQuery,
  activityRows,
  activityTotal,
  activityPage,
  activityTotalPages,
  activityQuery,
  historyRows,
  historyTotal,
  historyPage,
  historyTotalPages,
  historyQuery,
}: Props) {
  const router = useRouter();

  // ── Поиск/фильтры: состояние живёт в URL ──
  const [search, setSearch] = useState(initialQuery.q);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [aSearch, setASearch] = useState(activityQuery.q);
  const aSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hSearch, setHSearch] = useState(historyQuery.q);
  const hSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function updateQuery(next: Record<string, string | null>) {
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(next)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    const qs = params.toString();
    router.replace(qs ? `/admin/payouts?${qs}` : "/admin/payouts", { scroll: false });
  }

  function handleSearchChange(value: string, key: "q" | "aq" | "hq") {
    if (key === "q") setSearch(value);
    else if (key === "aq") setASearch(value);
    else setHSearch(value);
    const timerRef = key === "q" ? searchTimer : key === "aq" ? aSearchTimer : hSearchTimer;
    const pageKey = key === "q" ? "page" : key === "aq" ? "apage" : "hpage";
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      updateQuery({ [key]: value, [pageKey]: null });
    }, 300);
  }

  // ── Попап ставок и формирования счёта ──
  const [rateRow, setRateRow] = useState<PayoutRow | null>(null);
  const [rateInputs, setRateInputs] = useState<Partial<Record<PriceKey, string>>>({});
  const [rateLoading, setRateLoading] = useState(false);

  function openRateDialog(row: PayoutRow) {
    setRateRow(row);
    setRateInputs({
      phonePrice: String(row.prices.phonePrice),
      emailPrice: String(row.prices.emailPrice),
      websitePrice: String(row.prices.websitePrice),
      ratingPrice: String(row.prices.ratingPrice),
      reviewsPrice: String(row.prices.reviewsPrice),
    });
  }

  function parseInput(raw: string): number | null {
    if (raw === "") return 0;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
  }

  function dialogTotal(): number {
    if (!rateRow) return 0;
    let sum = 0;
    for (const k of METRIC_KEYS) {
      const price = parseInput(rateInputs[priceKey(k)] ?? "") ?? 0;
      if (rateRow.metrics[k].delta > 0 && price > 0) sum += rateRow.metrics[k].delta * price;
    }
    return Math.round(sum * 100) / 100;
  }

  function rowEstimate(row: PayoutRow): number {
    let sum = 0;
    for (const k of METRIC_KEYS) {
      const price = row.prices[priceKey(k)];
      if (row.metrics[k].delta > 0 && price > 0) sum += row.metrics[k].delta * price;
    }
    return Math.round(sum * 100) / 100;
  }

  async function handleCreateInvoice() {
    if (!rateRow) return;
    const body: Record<string, unknown> = { userId: rateRow.userId };
    for (const k of METRIC_KEYS) {
      const price = parseInput(rateInputs[priceKey(k)] ?? "");
      if (price === null) {
        toastError("Ошибка", "Введите корректные цены (только числа)");
        return;
      }
      body[priceKey(k)] = price;
    }

    setRateLoading(true);
    try {
      // Сначала сохраняем ставки из попапа, затем формируем счёт по ним
      const rateRes = await fetch("/api/admin/payouts/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!rateRes.ok) {
        const d = await rateRes.json().catch(() => ({}));
        toastError("Ошибка", d.error || "Не удалось сохранить ставки");
        return;
      }

      const invRes = await fetch("/api/admin/payouts/invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: rateRow.userId }),
      });
      if (invRes.ok) {
        const d = await invRes.json().catch(() => ({}));
        toastSuccess("Счёт сформирован", d.number ? `Счёт № ${d.number} на ${formatRub(d.total)}` : undefined);
        setRateRow(null);
        router.refresh();
      } else {
        const d = await invRes.json().catch(() => ({}));
        toastError("Ошибка", d.error || "Не удалось сформировать счёт");
      }
    } catch {
      toastError("Ошибка соединения", "Проверьте подключение к интернету");
    } finally {
      setRateLoading(false);
    }
  }

  // ── Попап ставок и счёта за активность ──
  const [activityRow, setActivityRow] = useState<ActivityRow | null>(null);
  const [activityInputs, setActivityInputs] = useState<{ productPrice: string; reviewPrice: string; presencePrice: string }>({
    productPrice: "0",
    reviewPrice: "0",
    presencePrice: "0",
  });
  const [activityLoading, setActivityLoading] = useState(false);

  function openActivityDialog(row: ActivityRow) {
    setActivityRow(row);
    setActivityInputs({
      productPrice: String(row.prices.productPrice),
      reviewPrice: String(row.prices.reviewPrice),
      presencePrice: String(row.prices.presencePrice),
    });
  }

  function activityDialogTotal(): number {
    if (!activityRow) return 0;
    const productPrice = parseInput(activityInputs.productPrice) ?? 0;
    const reviewPrice = parseInput(activityInputs.reviewPrice) ?? 0;
    const presencePrice = parseInput(activityInputs.presencePrice) ?? 0;
    return (
      Math.round(
        (activityRow.newProducts * productPrice +
          activityRow.newReviews * reviewPrice +
          activityRow.presenceDays * presencePrice) *
          100,
      ) / 100
    );
  }

  async function handleCreateActivityInvoice() {
    if (!activityRow) return;
    const productPrice = parseInput(activityInputs.productPrice);
    const reviewPrice = parseInput(activityInputs.reviewPrice);
    const presencePrice = parseInput(activityInputs.presencePrice);
    if (productPrice === null || reviewPrice === null || presencePrice === null) {
      toastError("Ошибка", "Введите корректные ставки (только числа)");
      return;
    }

    setActivityLoading(true);
    try {
      // Сначала сохраняем ставки, затем формируем счёт за период из URL
      const rateRes = await fetch("/api/admin/payouts/activity-rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: activityRow.userId, productPrice, reviewPrice, presencePrice }),
      });
      if (!rateRes.ok) {
        const d = await rateRes.json().catch(() => ({}));
        toastError("Ошибка", d.error || "Не удалось сохранить ставки");
        return;
      }

      const invRes = await fetch("/api/admin/payouts/activity-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: activityRow.userId,
          productPrice,
          reviewPrice,
          presencePrice,
          startDate: activityQuery.start,
          endDate: activityQuery.end,
        }),
      });
      if (invRes.ok) {
        const d = await invRes.json().catch(() => ({}));
        toastSuccess("Счёт за активность сформирован", d.number ? `Счёт № ${d.number} на ${formatRub(d.total)}` : undefined);
        setActivityRow(null);
        router.refresh();
      } else {
        const d = await invRes.json().catch(() => ({}));
        toastError("Ошибка", d.error || "Не удалось сформировать счёт");
      }
    } catch {
      toastError("Ошибка соединения", "Проверьте подключение к интернету");
    } finally {
      setActivityLoading(false);
    }
  }

  // ── История выплат: печать и отметка выплаты ──
  const [printOpen, setPrintOpen] = useState<string | null>(null);
  const [printData, setPrintData] = useState<InvoicePrintData | null>(null);
  const [requisites, setRequisites] = useState<BillingRequisites | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);

  async function openPrint(invoiceId: string) {
    setPrintOpen(invoiceId);
    setPrintData(null);
    try {
      const [invRes, reqRes] = await Promise.all([
        fetch(`/api/invoices/${invoiceId}`),
        fetch("/api/billing/info"),
      ]);
      const inv = await invRes.json().catch(() => ({}));
      const req = await reqRes.json().catch(() => ({}));
      if (invRes.ok) setPrintData(inv.invoice);
      if (reqRes.ok) setRequisites(req);
    } catch {
      // silent
    }
  }

  async function handleMarkPaid(invoiceId: string) {
    setPayingId(invoiceId);
    try {
      const res = await fetch("/api/admin/payouts/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId }),
      });
      if (res.ok) {
        toastSuccess("Выплата отмечена");
        router.refresh();
      } else {
        const d = await res.json().catch(() => ({}));
        toastError("Ошибка", d.error || "Не удалось отметить выплату");
      }
    } catch {
      toastError("Ошибка соединения", "Проверьте подключение к интернету");
    }
    setPayingId(null);
  }

  const hasRatesFilters = !!(
    initialQuery.q ||
    initialQuery.status ||
    initialQuery.sort !== "created" ||
    initialQuery.pending
  );
  const hasActivityFilters = !!(
    activityQuery.q ||
    activityQuery.status !== "ACTIVE" ||
    activityQuery.sort !== "created" ||
    activityQuery.pending ||
    activityQuery.start !== "" ||
    activityQuery.end !== ""
  );
  const hasHistoryFilters = !!(historyQuery.q || historyQuery.status || historyQuery.sort !== "desc");

  return (
    <div>
      <Tabs value={tab} onValueChange={(v) => updateQuery({ tab: v === "rates" ? null : v })}>
        <TabsList>
          <TabsTrigger value="rates">Ставки и счета</TabsTrigger>
          <TabsTrigger value="activity">Активность</TabsTrigger>
          <TabsTrigger value="history">История выплат</TabsTrigger>
        </TabsList>

        {/* ── Вкладка «Ставки и счета» ── */}
        <TabsContent value="rates" className="pt-4">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Поиск: логин, email, ник, ФИО, компания..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value, "q")}
                className="pl-9"
              />
            </div>
            <Select
              value={initialQuery.status || "all"}
              items={{ all: "Все статусы", ...USER_STATUS_LABELS }}
              onValueChange={(v) => updateQuery({ status: v === "all" ? null : v, page: null })}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Статус" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" label="Все статусы">Все статусы</SelectItem>
                {Object.entries(USER_STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value} label={label}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={initialQuery.sort}
              items={{ created: "Сначала новые", name: "По имени" }}
              onValueChange={(v) => updateQuery({ sort: v === "created" ? null : v })}
            >
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="Сортировка" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created" label="Сначала новые">Сначала новые</SelectItem>
                <SelectItem value="name" label="По имени">По имени</SelectItem>
              </SelectContent>
            </Select>
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <Checkbox
                checked={initialQuery.pending}
                onCheckedChange={(v) => updateQuery({ pending: v === true ? "1" : null, page: null })}
              />
              Только с новыми просмотрами
            </label>
            {hasRatesFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  updateQuery({ q: null, status: null, sort: null, pending: null });
                }}
              >
                <X className="h-3 w-3 mr-1" />
                Сбросить
              </Button>
            )}
          </div>

          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Пользователь</TableHead>
                  {METRIC_KEYS.map((k) => (
                    <TableHead key={k} className="min-w-[110px]">
                      {METRIC_LABELS[k]}
                      <span className="block text-[10px] font-normal text-muted-foreground">
                        новых · всего
                      </span>
                    </TableHead>
                  ))}
                  <TableHead>К выплате</TableHead>
                  <TableHead>Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      Пользователи не найдены
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => {
                    const hasDelta = METRIC_KEYS.some((k) => row.metrics[k].delta > 0);
                    return (
                      <TableRow key={row.userId}>
                        <TableCell className="max-w-[220px]">
                          <div className="font-medium truncate">{row.companyName || row.username}</div>
                          <div className="text-xs text-muted-foreground truncate">@{row.username}</div>
                          <Badge variant="secondary" className={`mt-1 text-xs ${USER_STATUS_BADGE[row.status] || ""}`}>
                            {USER_STATUS_LABELS[row.status] || row.status}
                          </Badge>
                        </TableCell>
                        {METRIC_KEYS.map((k) => {
                          const m = row.metrics[k];
                          return (
                            <TableCell key={k}>
                              <span className={m.delta > 0 ? "text-sm font-medium" : "text-sm text-muted-foreground"}>
                                {m.delta}
                              </span>
                              <span className="text-xs text-muted-foreground"> · {m.views}</span>
                            </TableCell>
                          );
                        })}
                        <TableCell>
                          <span className="font-medium">{formatRub(rowEstimate(row))}</span>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            className="h-7 text-xs bg-menthol hover:bg-menthol-dark"
                            disabled={!hasDelta}
                            onClick={() => openRateDialog(row)}
                          >
                            <FileText className="h-3 w-3" />
                            Ставки и счёт
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
              <span>Всего: {total} пользователей</span>
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={(p) => updateQuery({ page: String(p) })}
              />
            </div>
          )}

          {/* Попап ставок */}
          <Dialog open={!!rateRow} onOpenChange={(o) => { if (!o) setRateRow(null); }}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Ставки и счёт на выплату</DialogTitle>
                <DialogDescription>
                  {rateRow ? `${rateRow.companyName || rateRow.username} (@${rateRow.username})` : ""}
                </DialogDescription>
              </DialogHeader>
              {rateRow && (
                <div className="space-y-4">
                  <div className="space-y-3">
                    {METRIC_KEYS.map((k) => {
                      const m = rateRow.metrics[k];
                      const key = priceKey(k);
                      return (
                        <div key={k} className="flex items-center gap-3">
                          <div className="w-36 shrink-0">
                            <Label className="text-sm">{METRIC_LABELS[k]}</Label>
                            <p className="text-xs text-muted-foreground">
                              {m.delta > 0 ? `${m.delta} новых` : "нет новых"} · всего {m.views}
                            </p>
                          </div>
                          <Input
                            value={rateInputs[key] ?? ""}
                            onChange={(e) =>
                              setRateInputs((prev) => ({
                                ...prev,
                                [key]: e.target.value.replace(/[^0-9.]/g, ""),
                              }))
                            }
                            placeholder="0"
                            inputMode="decimal"
                            className="h-8 w-24 text-sm"
                          />
                          <span className="text-xs text-muted-foreground">₽ / просмотр</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between border-t pt-3">
                    <span className="text-sm font-medium">Итого к выплате</span>
                    <span className="font-bold">{formatRub(dialogTotal())}</span>
                  </div>
                  <Button
                    className="w-full bg-menthol hover:bg-menthol-dark"
                    disabled={rateLoading || dialogTotal() <= 0}
                    onClick={handleCreateInvoice}
                  >
                    {rateLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <FileText className="h-4 w-4 mr-2" />
                    )}
                    Сформировать счёт
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ── Вкладка «Активность» ── */}
        <TabsContent value="activity" className="pt-4">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Поиск: логин, email, ник, компания..."
                value={aSearch}
                onChange={(e) => handleSearchChange(e.target.value, "aq")}
                className="pl-9"
              />
            </div>
            <Select
              value={activityQuery.status || "all"}
              items={{ all: "Все статусы", ...USER_STATUS_LABELS }}
              onValueChange={(v) => updateQuery({ astatus: v === "all" ? null : v, apage: null })}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Статус" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" label="Все статусы">Все статусы</SelectItem>
                {Object.entries(USER_STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value} label={label}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 text-sm">
              <Input
                type="date"
                value={activityQuery.start}
                onChange={(e) => {
                  const v = e.target.value;
                  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) updateQuery({ astart: v, apage: null });
                }}
                className="w-[150px] h-9"
                title="Начало периода"
              />
              <span className="text-muted-foreground">—</span>
              <Input
                type="date"
                value={activityQuery.end}
                onChange={(e) => {
                  const v = e.target.value;
                  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) updateQuery({ aend: v, apage: null });
                }}
                className="w-[150px] h-9"
                title="Конец периода"
              />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <Checkbox
                checked={activityQuery.pending}
                onCheckedChange={(v) => updateQuery({ apending: v === true ? "1" : null, apage: null })}
              />
              Только с активностью
            </label>
            {hasActivityFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setASearch("");
                  updateQuery({ aq: null, astatus: null, asort: null, apending: null, astart: null, aend: null });
                }}
              >
                <X className="h-3 w-3 mr-1" />
                Сбросить
              </Button>
            )}
          </div>

          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Компания</TableHead>
                  <TableHead>Дней на платформе</TableHead>
                  <TableHead>Товаров за период</TableHead>
                  <TableHead>Отзывов за период</TableHead>
                  <TableHead>Ставки (день · товар · отзыв)</TableHead>
                  <TableHead>К выплате</TableHead>
                  <TableHead>Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activityRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Компании не найдены
                    </TableCell>
                  </TableRow>
                ) : (
                  activityRows.map((row) => {
                    const hasActivity = row.newProducts > 0 || row.newReviews > 0 || row.presenceDays > 0;
                    const estimate =
                      Math.round(
                        (row.newProducts * row.prices.productPrice +
                          row.newReviews * row.prices.reviewPrice +
                          row.presenceDays * row.prices.presencePrice) *
                          100,
                      ) / 100;
                    return (
                      <TableRow key={row.userId}>
                        <TableCell className="max-w-[240px]">
                          <div className="font-medium truncate">{row.companyName}</div>
                          <div className="text-xs text-muted-foreground truncate">@{row.username}</div>
                          <Badge variant="secondary" className={`mt-1 text-xs ${USER_STATUS_BADGE[row.status] || ""}`}>
                            {USER_STATUS_LABELS[row.status] || row.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{row.presenceDays}</span>
                        </TableCell>
                        <TableCell>
                          <span className={row.newProducts > 0 ? "text-sm font-medium" : "text-sm text-muted-foreground"}>
                            {row.newProducts}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={row.newReviews > 0 ? "text-sm font-medium" : "text-sm text-muted-foreground"}>
                            {row.newReviews}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatRub(row.prices.presencePrice)} · {formatRub(row.prices.productPrice)} · {formatRub(row.prices.reviewPrice)}
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{formatRub(estimate)}</span>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            className="h-7 text-xs bg-menthol hover:bg-menthol-dark"
                            disabled={!hasActivity}
                            onClick={() => openActivityDialog(row)}
                          >
                            <FileText className="h-3 w-3" />
                            Ставки и счёт
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {activityTotalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
              <span>Всего: {activityTotal} компаний</span>
              <Pagination
                currentPage={activityPage}
                totalPages={activityTotalPages}
                onPageChange={(p) => updateQuery({ apage: String(p) })}
              />
            </div>
          )}

          {/* Попап ставок и счёта за активность */}
          <Dialog open={!!activityRow} onOpenChange={(o) => { if (!o) setActivityRow(null); }}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Ставки и счёт за активность</DialogTitle>
                <DialogDescription>
                  {activityRow ? `${activityRow.companyName} (@${activityRow.username})` : ""}
                </DialogDescription>
              </DialogHeader>
              {activityRow && (
                <div className="space-y-4">
                  <div className="rounded-lg border p-3 text-sm space-y-1">
                    <p className="text-muted-foreground">
                      Период: с {new Date(`${activityQuery.start}T00:00:00`).toLocaleDateString("ru-RU")} по{" "}
                      {new Date(`${activityQuery.end}T00:00:00`).toLocaleDateString("ru-RU")}
                    </p>
                    <p className="text-muted-foreground">
                      Дней на платформе: {activityRow.presenceDays} · Товаров: {activityRow.newProducts} · Отзывов: {activityRow.newReviews}
                    </p>
                    {activityRow.billedUntil && (
                      <p className="text-muted-foreground">
                        Уже выставлено по: {new Date(activityRow.billedUntil).toLocaleDateString("ru-RU")}
                      </p>
                    )}
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-36 shrink-0">
                        <Label className="text-sm">День на платформе</Label>
                        <p className="text-xs text-muted-foreground">
                          {activityRow.presenceDays > 0 ? `${activityRow.presenceDays} дн. в периоде` : "нет дней в периоде"}
                        </p>
                      </div>
                      <Input
                        value={activityInputs.presencePrice}
                        onChange={(e) =>
                          setActivityInputs((prev) => ({
                            ...prev,
                            presencePrice: e.target.value.replace(/[^0-9.]/g, ""),
                          }))
                        }
                        placeholder="0"
                        inputMode="decimal"
                        className="h-8 w-24 text-sm"
                      />
                      <span className="text-xs text-muted-foreground">₽ / день</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-36 shrink-0">
                        <Label className="text-sm">Товар</Label>
                        <p className="text-xs text-muted-foreground">
                          {activityRow.newProducts > 0 ? `${activityRow.newProducts} за период` : "нет за период"}
                        </p>
                      </div>
                      <Input
                        value={activityInputs.productPrice}
                        onChange={(e) =>
                          setActivityInputs((prev) => ({
                            ...prev,
                            productPrice: e.target.value.replace(/[^0-9.]/g, ""),
                          }))
                        }
                        placeholder="0"
                        inputMode="decimal"
                        className="h-8 w-24 text-sm"
                      />
                      <span className="text-xs text-muted-foreground">₽ / товар</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-36 shrink-0">
                        <Label className="text-sm">Отзыв</Label>
                        <p className="text-xs text-muted-foreground">
                          {activityRow.newReviews > 0 ? `${activityRow.newReviews} за период` : "нет за период"}
                        </p>
                      </div>
                      <Input
                        value={activityInputs.reviewPrice}
                        onChange={(e) =>
                          setActivityInputs((prev) => ({
                            ...prev,
                            reviewPrice: e.target.value.replace(/[^0-9.]/g, ""),
                          }))
                        }
                        placeholder="0"
                        inputMode="decimal"
                        className="h-8 w-24 text-sm"
                      />
                      <span className="text-xs text-muted-foreground">₽ / отзыв</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t pt-3">
                    <span className="text-sm font-medium">Итого к выплате</span>
                    <span className="font-bold">{formatRub(activityDialogTotal())}</span>
                  </div>
                  <Button
                    className="w-full bg-menthol hover:bg-menthol-dark"
                    disabled={activityLoading || activityDialogTotal() <= 0}
                    onClick={handleCreateActivityInvoice}
                  >
                    {activityLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <FileText className="h-4 w-4 mr-2" />
                    )}
                    Сформировать счёт
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ── Вкладка «История выплат» ── */}
        <TabsContent value="history" className="pt-4">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Поиск: номер счёта, логин, компания..."
                value={hSearch}
                onChange={(e) => handleSearchChange(e.target.value, "hq")}
                className="pl-9"
              />
            </div>
            <Select
              value={historyQuery.status || "all"}
              items={{ all: "Все статусы", ...PAYOUT_STATUS_LABELS }}
              onValueChange={(v) => updateQuery({ hstatus: v === "all" ? null : v, hpage: null })}
            >
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="Статус" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" label="Все статусы">Все статусы</SelectItem>
                {Object.entries(PAYOUT_STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value} label={label}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={historyQuery.sort}
              items={{ desc: "Сначала новые", asc: "Сначала старые" }}
              onValueChange={(v) => updateQuery({ hsort: v === "desc" ? null : v })}
            >
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="Сортировка" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc" label="Сначала новые">Сначала новые</SelectItem>
                <SelectItem value="asc" label="Сначала старые">Сначала старые</SelectItem>
              </SelectContent>
            </Select>
            {hasHistoryFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setHSearch("");
                  updateQuery({ hq: null, hstatus: null, hsort: null });
                }}
              >
                <X className="h-3 w-3 mr-1" />
                Сбросить
              </Button>
            )}
          </div>

          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Счёт</TableHead>
                  <TableHead>Компания</TableHead>
                  <TableHead>Дата</TableHead>
                  <TableHead>Выплатить до</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Сумма</TableHead>
                  <TableHead>Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Счетов на выплату пока нет
                    </TableCell>
                  </TableRow>
                ) : (
                  historyRows.map((inv) => {
                    const paying = payingId === inv.id;
                    return (
                      <TableRow key={inv.id}>
                        <TableCell className="font-mono text-sm">
                          {inv.number}
                          {inv.kind === "ACTIVITY" && (
                            <Badge variant="outline" className="ml-1 text-[10px] px-1 h-4">
                              активность
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {inv.companyName || `@${inv.username}`}
                        </TableCell>
                        <TableCell className="text-sm">
                          {new Date(inv.date).toLocaleDateString("ru-RU")}
                        </TableCell>
                        <TableCell className="text-sm">
                          {new Date(inv.dueDate).toLocaleDateString("ru-RU")}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={PAYOUT_STATUS_BADGE[inv.status] || ""}>
                            {PAYOUT_STATUS_LABELS[inv.status] || inv.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{formatRub(inv.total)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => openPrint(inv.id)}
                            >
                              Показать
                            </Button>
                            {inv.status !== "PAID" && (
                              <Button
                                size="sm"
                                className="h-7 text-xs bg-menthol hover:bg-menthol-dark"
                                disabled={paying}
                                onClick={() => handleMarkPaid(inv.id)}
                              >
                                {paying ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="h-3 w-3" />
                                )}
                                Выплачено
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {historyTotalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
              <span>Всего: {historyTotal} счетов</span>
              <Pagination
                currentPage={historyPage}
                totalPages={historyTotalPages}
                onPageChange={(p) => updateQuery({ hpage: String(p) })}
              />
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Печатный вид счёта на выплату */}
      <Dialog open={!!printOpen} onOpenChange={(o) => { if (!o) setPrintOpen(null); }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Акт об оказании услуг</DialogTitle>
            <DialogDescription>Документ для выплаты по реквизитам</DialogDescription>
          </DialogHeader>
          {printData && requisites ? (
            <PayoutPrint invoice={printData} requisites={requisites} />
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
