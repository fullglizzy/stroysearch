"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { InvoicePrint, type BillingRequisites } from "@/components/shared/InvoicePrint";
import { ServiceActPrint, type ServiceActData } from "@/components/shared/ServiceActPrint";
import { toastSuccess, toastError } from "@/lib/toast";
import { METRIC_LABELS, VIEW_METRICS } from "@/lib/billing";
import {
  Search, Loader2, KeyRound, Link2, FilePlus2, CheckCircle2, Eye, EyeOff, Save,
  Printer, Trash2, Plus, Ban, ShieldCheck, ArrowUp, ArrowDown, ChevronDown, ChevronUp, Users,
} from "lucide-react";
import { BillingStatusBadge, InvoiceStatusBadge, fetchRequisites, formatRubShort, formatDateShort } from "./shared";
import { MassInvoiceDialog } from "./MassInvoiceDialog";

/** Сегодня в формате YYYY-MM-DD (для input type="date") */
function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface BillingRow {
  status: string;
  maintenanceFee: number | null;
  phonePrice: number | null;
  emailPrice: number | null;
  websitePrice: number | null;
  reviewsPrice: number | null;
  ratingPrice: number | null;
  monthlyCap: number | null;
  billingStartedAt: string | null;
  billedThrough: string | null;
  hiddenReason: string | null;
}

interface CompanyRow {
  id: string;
  inn: string;
  name: string;
  registeredAt: string;
  owner: { id: string; username: string; email: string; status: string } | null;
  billing: {
    status: string;
    hiddenReason: string | null;
    maintenanceFee: number | null;
    phonePrice: number | null;
    emailPrice: number | null;
    websitePrice: number | null;
    reviewsPrice: number | null;
    ratingPrice: number | null;
    monthlyCap: number | null;
    /** Дата, с которой компания активна (начало биллинга) */
    billingStartedAt: string | null;
  } | null;
  metrics: { phoneViews: number; emailViews: number; websiteViews: number; reviewsViews: number; ratingViews: number } | null;
  debt: number;
  pays: boolean | null;
  /** Просмотры, которые попадут в следующий счёт (null — биллинг не начат) */
  pendingViews: number | null;
  lastInvoice: { number: string; status: string; total: number } | null;
  notesCount: number;
}

/** Ставки по умолчанию из настроек — для панели тарифа над таблицей */
interface ListDefaults {
  maintenanceFee: number;
  phoneViewPrice: number;
  emailViewPrice: number;
  websiteViewPrice: number;
  reviewsViewPrice: number;
  ratingViewPrice: number;
  monthlyCap: number | null;
}

interface CompanyDetail {
  company: {
    id: string;
    inn: string;
    name: string;
    phone: string | null;
    email: string | null;
    website: string | null;
    createdAt: string;
    owner: {
      id: string;
      username: string;
      email: string;
      status: string;
      createdAt: string;
      banReason: string | null;
    } | null;
  };
  billing: BillingRow | null;
  defaults: {
    maintenanceFee: number;
    phoneViewPrice: number;
    emailViewPrice: number;
    websiteViewPrice: number;
    reviewsViewPrice: number;
    ratingViewPrice: number;
    monthlyCap: number | null;
  };
  /** Шаблоны строк счёта из настроек */
  templates: { maintenance: string; views: string; cap: string };
  period: { from: string; to: string } | null;
  preview: {
    items: { description: string; quantity: number; unitPrice: number; total: number }[];
    maintenanceDays: number;
    viewsCost: number;
    /** Скидка по потолку счёта: излишек над потолком вычитается из итога */
    capDiscount: number;
    subtotal: number;
    total: number;
  } | null;
  debt: number;
  totalViews: number;
  /** Просмотры в невыставленный период по метрикам (null — период уже выставлен) */
  viewsInPeriod: Record<string, number> | null;
  invoices: {
    id: string;
    number: string;
    status: string;
    total: number;
    periodFrom: string | null;
    periodTo: string | null;
    act: { id: string; number: string } | null;
  }[];
  acts: { id: string; number: string; date: string; total: number; invoiceNumber: string }[];
  notes: { id: string; text: string; createdAt: string }[];
}

interface SanctionTarget {
  id: string;
  name: string;
  hiddenReason: string | null;
}

const RATE_FIELDS = [
  { key: "maintenanceFee", label: "Абонентская плата (₽/мес)" },
  { key: "phonePrice", label: "Просмотр телефона (₽)" },
  { key: "emailPrice", label: "Просмотр почты (₽)" },
  { key: "websitePrice", label: "Просмотр сайта (₽)" },
  { key: "reviewsPrice", label: "Просмотр отзывов (₽)" },
  { key: "ratingPrice", label: "Просмотр рейтинга (₽)" },
  { key: "monthlyCap", label: "Потолок счёта (₽/период)" },
] as const;

/** Глобальные расценки из настроек — дублируются в панель над таблицей.
 *  monthlyCap — nullable: пустое поле = без потолка */
const GLOBAL_FIELDS = [
  { key: "maintenanceFee", label: "Абонентская плата (₽/мес)" },
  { key: "phoneViewPrice", label: "Просмотр телефона (₽)" },
  { key: "emailViewPrice", label: "Просмотр почты (₽)" },
  { key: "websiteViewPrice", label: "Просмотр сайта (₽)" },
  { key: "reviewsViewPrice", label: "Просмотр отзывов (₽)" },
  { key: "ratingViewPrice", label: "Просмотр рейтинга (₽)" },
  { key: "monthlyCap", label: "Потолок счёта (₽)" },
] as const;

const STATUS_ITEMS = {
  INACTIVE: "Без владельца — биллинг выключен, компания бесплатна",
  ACTIVE: "Активна — счета формируются, просмотры считаются",
  HIDDEN: "Контакты скрыты — санкция за неуплату",
} as const;

/** Есть ли у компании хоть одна индивидуальная ставка или потолок (не по умолчанию) */
function hasCustomRates(b: BillingRow | null): boolean {
  return !!b && (
    b.maintenanceFee != null || b.phonePrice != null || b.emailPrice != null ||
    b.websitePrice != null || b.reviewsPrice != null || b.ratingPrice != null || b.monthlyCap != null
  );
}

type SortField = "debt" | "name" | "registeredAt";
interface SortState {
  field: SortField;
  dir: "asc" | "desc";
}

const SORT_DEFAULT: SortState = { field: "debt", dir: "desc" };

function sortParam(sort: SortState): string {
  if (sort.field === "name") return sort.dir === "asc" ? "name" : "nameDesc";
  if (sort.field === "registeredAt") return sort.dir === "asc" ? "registeredAtAsc" : "registeredAt";
  return sort.dir === "asc" ? "debtAsc" : "debt";
}

function PaysBadge({ pays }: { pays: boolean | null }) {
  if (pays === null) {
    return <Badge variant="outline" className="bg-gray-100 text-gray-600">—</Badge>;
  }
  return pays ? (
    <Badge variant="outline" className="bg-green-100 text-green-700">Платит</Badge>
  ) : (
    <Badge variant="outline" className="bg-red-100 text-red-700">Не платит</Badge>
  );
}

function OwnerStatusBadge({ status }: { status: string }) {
  if (status === "BANNED") return <Badge variant="outline" className="bg-red-100 text-red-700">Забанен</Badge>;
  if (status === "ACTIVE") return <Badge variant="outline" className="bg-green-100 text-green-700">Активен</Badge>;
  return <Badge variant="outline" className="bg-gray-100 text-gray-600">—</Badge>;
}

function SortHeader({
  label, field, sort, onSort, className,
}: {
  label: string;
  field: SortField;
  sort: SortState;
  onSort: (field: SortField) => void;
  className?: string;
}) {
  const active = sort.field === field;
  return (
    <th className={`py-2 px-3 font-normal ${className ?? ""}`}>
      <button
        type="button"
        className={`flex items-center gap-1 hover:text-foreground ${active ? "text-foreground font-medium" : ""}`}
        onClick={() => onSort(field)}
        title="Сортировать"
      >
        {label}
        {active && (sort.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
      </button>
    </th>
  );
}

// Раскрываемая секция попапа компании: заголовок с шевроном + содержимое
function Section({
  id,
  title,
  badge,
  open,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  badge?: string;
  open: boolean;
  onToggle: (id: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border rounded-lg">
      <button
        type="button"
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm font-medium hover:bg-muted/40"
        onClick={() => onToggle(id)}
      >
        <span className="flex items-center gap-2 min-w-0">
          <span className="truncate">{title}</span>
          {badge && <span className="text-xs font-normal text-muted-foreground shrink-0">{badge}</span>}
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>
      {open && <div className="px-3 pb-3 space-y-2">{children}</div>}
    </div>
  );
}

export function CompanyTariffsManager() {
  const [companies, setCompanies] = useState<CompanyRow[] | null>(null);
  const [defaults, setDefaults] = useState<ListDefaults | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(50);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [paysFilter, setPaysFilter] = useState("");
  const [hasOwnerFilter, setHasOwnerFilter] = useState("");
  const [sort, setSort] = useState<SortState>(SORT_DEFAULT);

  const [detailRow, setDetailRow] = useState<CompanyRow | null>(null);
  const [detail, setDetail] = useState<CompanyDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  // Дата, до которой считается предстоящий счёт в попапе (по умолчанию — сегодня)
  const [detailDate, setDetailDate] = useState(todayStr());
  const detailDateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [genLoading, setGenLoading] = useState(false);
  const [genResult, setGenResult] = useState("");
  const [genError, setGenError] = useState("");

  // Тариф компании — редактируется в попапе карточки (кнопка «Открыть» в строке)
  const [tariffValues, setTariffValues] = useState<Record<string, string>>({});
  const [tariffStatus, setTariffStatus] = useState("INACTIVE");
  const [hiddenReason, setHiddenReason] = useState("");
  const [statusSaving, setStatusSaving] = useState(false);
  // Компания, чьи ставки сейчас в полях попапа — чтобы не затирать правки при обновлении карточки
  const [tariffForId, setTariffForId] = useState<string | null>(null);
  // Ставки сохраняются автоматически при вводе (с задержкой)
  const [ratesSaveState, setRatesSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const ratesSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Массовое выставление счетов — диалог над таблицей
  const [massOpen, setMassOpen] = useState(false);

  // Панель «Тариф и расценки» под поисковой строкой — раскрыта по умолчанию
  const [tariffPanelOpen, setTariffPanelOpen] = useState(true);
  // Глобальные расценки (дубль настроек): заполняются один раз из defaults
  const [globalValues, setGlobalValues] = useState<Record<string, string>>({});
  const [globalSaveState, setGlobalSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const globalSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const globalValuesRef = useRef<Record<string, string>>({});
  const globalFilledRef = useRef(false);
  // «Применить для всех» — сброс индивидуальных расценок компаний
  const [applyAllOpen, setApplyAllOpen] = useState(false);
  const [applyAllLoading, setApplyAllLoading] = useState(false);
  // Предупреждение о несохранённых расценках перед массовым выставлением
  const [unsavedOpen, setUnsavedOpen] = useState(false);
  const [unsavedSaving, setUnsavedSaving] = useState(false);

  // Раскрывающиеся секции попапа (по умолчанию открыт предстоящий счёт)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ period: true });

  // Санкции: скрытие и возврат контактов — отдельные явные действия
  const [sanctionCompany, setSanctionCompany] = useState<SanctionTarget | null>(null);
  const [sanctionReason, setSanctionReason] = useState("");
  const [sanctionLoading, setSanctionLoading] = useState(false);
  const [restoreCompany, setRestoreCompany] = useState<SanctionTarget | null>(null);
  const [restoreLoading, setRestoreLoading] = useState(false);

  // Заметки
  const [noteText, setNoteText] = useState("");
  const [noteLoading, setNoteLoading] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<{ id: string; text: string } | null>(null);
  const [noteDeleting, setNoteDeleting] = useState(false);

  // Владелец: бан и разбан
  const [banOpen, setBanOpen] = useState(false);
  const [banReason, setBanReason] = useState("");
  const [banLoading, setBanLoading] = useState(false);
  const [unbanOpen, setUnbanOpen] = useState(false);
  const [unbanLoading, setUnbanLoading] = useState(false);

  // Печать счёта и акта внутри попапа
  const [invoicePrint, setInvoicePrint] = useState<{ data: InvoicePrintData; reqs: BillingRequisites } | null>(null);
  const [invoicePrintLoading, setInvoicePrintLoading] = useState(false);
  const [actPrint, setActPrint] = useState<{ data: ServiceActData; reqs: BillingRequisites } | null>(null);
  const [actPrintLoading, setActPrintLoading] = useState(false);

  // Доступ
  const [accessOpen, setAccessOpen] = useState(false);
  const [accessCompany, setAccessCompany] = useState<{ id: string; name: string; inn: string } | null>(null);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (statusFilter) params.set("status", statusFilter);
    if (paysFilter) params.set("pays", paysFilter);
    if (hasOwnerFilter) params.set("hasOwner", hasOwnerFilter);
    params.set("sort", sortParam(sort));
    params.set("page", String(page));
    params.set("perPage", String(perPage));
    fetch(`/api/admin/billing/companies?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        setCompanies(d.companies || []);
        setDefaults(d.defaults ?? null);
        setTotal(d.total ?? 0);
        // Глобальные расценки заполняем один раз — дальше их правит только админ
        if (!globalFilledRef.current && d.defaults) {
          globalFilledRef.current = true;
          setGlobalValues({
            maintenanceFee: String(d.defaults.maintenanceFee),
            phoneViewPrice: String(d.defaults.phoneViewPrice),
            emailViewPrice: String(d.defaults.emailViewPrice),
            websiteViewPrice: String(d.defaults.websiteViewPrice),
            reviewsViewPrice: String(d.defaults.reviewsViewPrice),
            ratingViewPrice: String(d.defaults.ratingViewPrice),
            monthlyCap: d.defaults.monthlyCap != null ? String(d.defaults.monthlyCap) : "",
          });
        }
      })
      .catch(() => setCompanies([]));
  }, [q, statusFilter, paysFilter, hasOwnerFilter, sort, page, perPage]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  function changeSort(field: SortField) {
    setPage(1);
    setSort((prev) => {
      if (prev.field !== field) {
        return field === "name" ? { field, dir: "asc" } : { field, dir: "desc" };
      }
      return { field, dir: prev.dir === "asc" ? "desc" : "asc" };
    });
  }

  async function fetchDetail(id: string, date?: string, silent = false) {
    // silent — обновление уже открытой карточки (без спиннера, чтобы правки в полях не «мигали»)
    setDetailLoading(!silent);
    try {
      const params = new URLSearchParams();
      if (date) params.set("date", date);
      const qs = params.toString();
      const res = await fetch(`/api/admin/companies/${id}/billing${qs ? `?${qs}` : ""}`);
      const d = await res.json();
      if (!res.ok) {
        toastError("Ошибка", d.error || "Не удалось загрузить карточку");
        setDetailRow(null);
        return;
      }
      setDetail(d);
      // Поля тарифа заполняем при открытии карточки; при обновлении той же компании
      // несохранённые правки админа в полях не затираем
      if (tariffForId !== id) {
        setTariffForId(id);
        setTariffValues(prefillTariff(d.billing, d.defaults));
        setTariffStatus(d.billing?.status ?? "INACTIVE");
        setHiddenReason(d.billing?.hiddenReason ?? "");
        setRatesSaveState("idle");
      }
    } catch {
      toastError("Ошибка соединения");
      setDetailRow(null);
    }
    setDetailLoading(false);
  }

  function openDetail(c: CompanyRow) {
    setDetailRow(c);
    setDetail(null);
    setGenResult("");
    setGenError("");
    setOpenSections({ period: true });
    setNoteText("");
    setDetailDate(todayStr());
    // Тариф заполняется заново из свежих данных при каждом открытии
    setTariffForId(null);
    fetchDetail(c.id);
  }

  function closeDetail() {
    // Досохраняем ставки, введённые в попапе, если авто-сохранение ещё не сработало
    if (ratesSaveTimer.current) {
      clearTimeout(ratesSaveTimer.current);
      ratesSaveTimer.current = null;
      if (detailRow) void saveRates(detailRow.id);
    }
    if (detailDateTimer.current) {
      clearTimeout(detailDateTimer.current);
      detailDateTimer.current = null;
    }
    setDetailRow(null);
  }

  function toggleSection(id: string) {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  // ── Тариф компании в попапе карточки ──

  /** Значения полей тарифа компании: индивидуальные или из глобальных настроек */
  function prefillTariff(b: CompanyRow["billing"], defs: ListDefaults | null): Record<string, string> {
    return {
      maintenanceFee: b?.maintenanceFee != null ? String(b.maintenanceFee) : String(defs?.maintenanceFee ?? ""),
      phonePrice: b?.phonePrice != null ? String(b.phonePrice) : String(defs?.phoneViewPrice ?? ""),
      emailPrice: b?.emailPrice != null ? String(b.emailPrice) : String(defs?.emailViewPrice ?? ""),
      websitePrice: b?.websitePrice != null ? String(b.websitePrice) : String(defs?.websiteViewPrice ?? ""),
      reviewsPrice: b?.reviewsPrice != null ? String(b.reviewsPrice) : String(defs?.reviewsViewPrice ?? ""),
      ratingPrice: b?.ratingPrice != null ? String(b.ratingPrice) : String(defs?.ratingViewPrice ?? ""),
      monthlyCap: b?.monthlyCap != null
        ? String(b.monthlyCap)
        : defs?.monthlyCap != null
          ? String(defs.monthlyCap)
          : "",
    };
  }

  // Актуальные значения ставок для отложенного сохранения (замыкание таймера не видит свежий стейт)
  const tariffValuesRef = useRef<Record<string, string>>({});
  useEffect(() => {
    tariffValuesRef.current = tariffValues;
  }, [tariffValues]);

  useEffect(() => {
    globalValuesRef.current = globalValues;
  }, [globalValues]);

  useEffect(() => () => {
    if (ratesSaveTimer.current) clearTimeout(ratesSaveTimer.current);
    if (globalSaveTimer.current) clearTimeout(globalSaveTimer.current);
  }, []);

  // Ставки: сохраняются автоматически при вводе, без отдельной кнопки «Сохранить»
  function onRateChange(key: string, value: string) {
    setTariffValues((prev) => ({ ...prev, [key]: value }));
    setRatesSaveState("saving");
    if (ratesSaveTimer.current) clearTimeout(ratesSaveTimer.current);
    ratesSaveTimer.current = setTimeout(() => { if (detailRow) void saveRates(detailRow.id); }, 600);
  }

  async function saveRates(companyId?: string): Promise<boolean> {
    const id = companyId ?? detailRow?.id;
    if (!id) return true;
    const payload: Record<string, unknown> = {};
    for (const f of RATE_FIELDS) {
      const raw = (tariffValuesRef.current[f.key] ?? "").trim();
      payload[f.key] = raw === "" ? null : parseFloat(raw);
    }
    try {
      const res = await fetch(`/api/admin/companies/${id}/billing`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (res.ok) {
        setRatesSaveState("saved");
        // Предстоящий счёт в попапе зависит от ставок — тихо обновляем карточку
        if (detailRow && detailRow.id === id) fetchDetail(id, detailDate, true);
        return true;
      }
      setRatesSaveState("error");
      toastError("Ошибка", d.error || "Не удалось сохранить ставки");
      return false;
    } catch {
      setRatesSaveState("error");
      toastError("Ошибка соединения");
      return false;
    }
  }

  // Статус биллинга и причина скрытия — отдельное явное действие
  async function saveStatus() {
    if (!detailRow) return;
    setStatusSaving(true);
    try {
      const payload: Record<string, unknown> = { status: tariffStatus };
      if (tariffStatus === "HIDDEN") payload.hiddenReason = hiddenReason.trim() || null;
      const res = await fetch(`/api/admin/companies/${detailRow.id}/billing`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (res.ok) {
        toastSuccess("Сохранено", "Статус биллинга обновлён");
        load();
        fetchDetail(detailRow.id, detailDate, true);
      } else {
        toastError("Ошибка", d.error || "Не удалось сохранить статус");
      }
    } catch {
      toastError("Ошибка соединения");
    }
    setStatusSaving(false);
  }

  // ── Глобальные расценки (дубль настроек экономики) ──

  // Расценки сохраняются автоматически при вводе, как и ставки компании
  function onGlobalChange(key: string, value: string) {
    setGlobalValues((prev) => ({ ...prev, [key]: value }));
    setGlobalSaveState("saving");
    if (globalSaveTimer.current) clearTimeout(globalSaveTimer.current);
    globalSaveTimer.current = setTimeout(() => { void saveGlobalRates(); }, 600);
  }

  /** Сохраняет глобальные расценки; возвращает сохранённые значения или null при ошибке */
  async function saveGlobalRates(): Promise<Partial<ListDefaults> | null> {
    const payload: Partial<ListDefaults> = {};
    const revert: Record<string, string> = {};
    for (const f of GLOBAL_FIELDS) {
      const raw = (globalValuesRef.current[f.key] ?? "").trim();
      const n = parseFloat(raw);
      if (f.key === "monthlyCap" && raw === "") {
        payload.monthlyCap = null; // пустой потолок — снять ограничение
      } else if (raw !== "" && Number.isFinite(n) && n >= 0) {
        payload[f.key] = Math.round(n * 100) / 100;
      } else {
        // Пустая/некорректная расценка невозможна — откат к сохранённому
        const stored = defaults?.[f.key as keyof ListDefaults];
        revert[f.key] = stored != null ? String(stored) : "";
      }
    }
    if (Object.keys(revert).length > 0) {
      setGlobalValues((prev) => ({ ...prev, ...revert }));
    }
    if (Object.keys(payload).length === 0) {
      setGlobalSaveState("idle");
      return {};
    }
    try {
      const res = await fetch("/api/admin/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (res.ok) {
        setGlobalSaveState("saved");
        setDefaults((prev) => (prev ? { ...prev, ...payload } : prev));
        return payload;
      }
      setGlobalSaveState("error");
      toastError("Ошибка", d.error || "Не удалось сохранить расценки");
      return null;
    } catch {
      setGlobalSaveState("error");
      toastError("Ошибка соединения");
      return null;
    }
  }

  /** «Применить для всех»: сбросить индивидуальные расценки и установить
   *  всем компаниям одинаковый потолок — выставление пойдёт по значениям выше */
  async function confirmApplyAll() {
    setApplyAllLoading(true);
    // Сначала фиксируем несохранённые правки глобальных расценок
    if (globalSaveTimer.current) {
      clearTimeout(globalSaveTimer.current);
      globalSaveTimer.current = null;
    }
    const savedGlobals = await saveGlobalRates();
    if (savedGlobals === null) {
      setApplyAllLoading(false);
      setApplyAllOpen(false);
      return;
    }
    // Потолок из общего поля панели: пустое — снять потолок всем, число — установить всем
    const capRaw = (globalValuesRef.current.monthlyCap ?? "").trim();
    let monthlyCap: number | null = null;
    if (capRaw !== "") {
      const n = parseFloat(capRaw);
      if (!Number.isFinite(n) || n < 0) {
        toastError("Ошибка", "Некорректный потолок счёта — введите неотрицательное число или оставьте поле пустым");
        setApplyAllLoading(false);
        setApplyAllOpen(false);
        return;
      }
      monthlyCap = Math.round(n * 100) / 100;
    }
    try {
      const res = await fetch("/api/admin/billing/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resetRates", monthlyCap }),
      });
      const d = await res.json();
      if (res.ok) {
        const capNote = monthlyCap != null
          ? `потолок счёта ${formatRubShort(monthlyCap)} установлен всем`
          : "потолок счёта снят у всех";
        toastSuccess(
          "Применено",
          d.updated
            ? `${d.updated} компаний: расценки по умолчанию, ${capNote}`
            : `Компаний с индивидуальными расценками не было; ${capNote}`,
        );
        load();
        // Открытый попап компании тоже обновляем — в нём прежние цифры.
        // Индивидуальных ставок у компании больше нет — показываем глобальные расценки
        if (detailRow) {
          const defs = defaults ? { ...defaults, ...savedGlobals } : null;
          setTariffValues({ ...prefillTariff(null, defs), monthlyCap: monthlyCap != null ? String(monthlyCap) : "" });
          setRatesSaveState("idle");
          fetchDetail(detailRow.id, detailDate, true);
        }
      } else {
        toastError("Ошибка", d.error || "Не удалось применить расценки");
      }
    } catch {
      toastError("Ошибка соединения");
    }
    setApplyAllLoading(false);
    setApplyAllOpen(false);
  }

  // ── Предупреждение о несохранённых расценках перед массовым выставлением ──

  /** Есть ли правки расценок, которые ещё не сохранились */
  function hasUnsavedRates(): boolean {
    // Правка ещё в отложенном сохранении, идёт или не удалась
    if (globalSaveTimer.current || globalSaveState === "saving" || globalSaveState === "error") return true;
    if (detailRow && (ratesSaveTimer.current || ratesSaveState === "saving" || ratesSaveState === "error")) return true;
    // Значение в поле отличается от сохранённого
    if (defaults) {
      for (const f of GLOBAL_FIELDS) {
        const raw = (globalValuesRef.current[f.key] ?? "").trim();
        const saved = defaults[f.key as keyof ListDefaults];
        const rawNum = parseFloat(raw);
        if (raw === "") {
          // Пустая расценка — несохранённое состояние; пустой потолок законен,
          // только если сохранённого потолка нет
          if (f.key !== "monthlyCap" || saved != null) return true;
          continue;
        }
        if (!Number.isFinite(rawNum)) return true;
        if (saved == null || Math.round(rawNum * 100) !== Math.round(saved * 100)) return true;
      }
    }
    return false;
  }

  /** Кнопка массового выставления: сначала убеждаемся, что расценки сохранены */
  function openMassInvoicing() {
    if (hasUnsavedRates()) setUnsavedOpen(true);
    else setMassOpen(true);
  }

  /** Сохранить правки расценок и открыть массовое выставление */
  async function saveAndContinue() {
    setUnsavedSaving(true);
    if (globalSaveTimer.current) { clearTimeout(globalSaveTimer.current); globalSaveTimer.current = null; }
    if (ratesSaveTimer.current) { clearTimeout(ratesSaveTimer.current); ratesSaveTimer.current = null; }
    const g = await saveGlobalRates();
    const r = detailRow ? await saveRates(detailRow.id) : true;
    setUnsavedSaving(false);
    if (g === null || r === false) return; // ошибка сохранения — остаёмся в диалоге
    setUnsavedOpen(false);
    setMassOpen(true);
  }

  /** Продолжить по сохранённым значениям: правки отбрасываются */
  function continueWithoutSaving() {
    if (globalSaveTimer.current) { clearTimeout(globalSaveTimer.current); globalSaveTimer.current = null; }
    if (ratesSaveTimer.current) { clearTimeout(ratesSaveTimer.current); ratesSaveTimer.current = null; }
    if (defaults) {
      setGlobalValues({
        maintenanceFee: String(defaults.maintenanceFee),
        phoneViewPrice: String(defaults.phoneViewPrice),
        emailViewPrice: String(defaults.emailViewPrice),
        websiteViewPrice: String(defaults.websiteViewPrice),
        reviewsViewPrice: String(defaults.reviewsViewPrice),
        ratingViewPrice: String(defaults.ratingViewPrice),
        monthlyCap: defaults.monthlyCap != null ? String(defaults.monthlyCap) : "",
      });
    }
    if (detailRow) setTariffValues(prefillTariff(detail?.billing ?? null, defaults));
    setGlobalSaveState("idle");
    setRatesSaveState("idle");
    setUnsavedOpen(false);
    setMassOpen(true);
  }

  // Выставление счёта до выбранной даты — внутри попапа компании
  async function generateInDetail() {
    if (!detailRow) return;
    setGenLoading(true);
    setGenResult("");
    setGenError("");
    try {
      const res = await fetch("/api/admin/billing/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: detailRow.id, periodTo: detailDate }),
      });
      const d = await res.json();
      if (res.ok && d.created?.length) {
        const inv = d.created[0] as { invoiceNumber: string; total: number };
        setGenResult(`Счёт ${inv.invoiceNumber} на сумму ${formatRubShort(inv.total)} выставлен — компания увидит его в кабинете и получит уведомление. Отметить оплату можно во вкладке «Счета и акты».`);
        toastSuccess("Счёт выставлен", `${inv.invoiceNumber} на ${formatRubShort(inv.total)}`);
        fetchDetail(detailRow.id, detailDate);
        load();
      } else if (res.ok) {
        setGenError(d.skipped?.[0]?.reason || "Нет периода для выставления");
      } else {
        setGenError(d.error || "Не удалось сформировать счёт");
      }
    } catch {
      setGenError("Ошибка соединения");
    }
    setGenLoading(false);
  }

  // Санкция: скрыть контакты компании в базе поставщиков (за неуплату)
  async function hideContacts() {
    if (!sanctionCompany) return;
    setSanctionLoading(true);
    try {
      const res = await fetch(`/api/admin/companies/${sanctionCompany.id}/billing`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "HIDDEN", hiddenReason: sanctionReason.trim() || "Неуплата" }),
      });
      const d = await res.json();
      if (res.ok) {
        toastSuccess("Санкция применена", `Контакты «${sanctionCompany.name}» скрыты в базе поставщиков`);
        setSanctionCompany(null);
        setSanctionReason("");
        // Поля тарифа в попапе должны показывать новый статус
        setTariffStatus("HIDDEN");
        setHiddenReason(sanctionReason.trim() || "Неуплата");
        load();
        if (detailRow) fetchDetail(detailRow.id);
      } else {
        toastError("Ошибка", d.error || "Не удалось скрыть контакты");
      }
    } catch {
      toastError("Ошибка соединения");
    }
    setSanctionLoading(false);
  }

  // Возврат контактов после оплаты — вручную, ничего не восстанавливается само
  async function restoreContacts() {
    if (!restoreCompany) return;
    setRestoreLoading(true);
    try {
      const res = await fetch(`/api/admin/companies/${restoreCompany.id}/billing`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ACTIVE", hiddenReason: null }),
      });
      const d = await res.json();
      if (res.ok) {
        toastSuccess("Контакты возвращены", `«${restoreCompany.name}» снова видна в базе поставщиков`);
        setRestoreCompany(null);
        // Поля тарифа в попапе должны показывать новый статус
        setTariffStatus("ACTIVE");
        setHiddenReason("");
        load();
        if (detailRow) fetchDetail(detailRow.id);
      } else {
        toastError("Ошибка", d.error || "Не удалось вернуть контакты");
      }
    } catch {
      toastError("Ошибка соединения");
    }
    setRestoreLoading(false);
  }

  // ── Заметки ──

  async function addNote() {
    if (!detailRow) return;
    const text = noteText.trim();
    if (!text) return;
    setNoteLoading(true);
    try {
      const res = await fetch(`/api/admin/companies/${detailRow.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const d = await res.json();
      if (res.ok) {
        toastSuccess("Заметка добавлена");
        setNoteText("");
        fetchDetail(detailRow.id);
        load();
      } else {
        toastError("Ошибка", d.error || "Не удалось добавить заметку");
      }
    } catch {
      toastError("Ошибка соединения");
    }
    setNoteLoading(false);
  }

  async function deleteNote() {
    if (!detailRow || !noteToDelete) return;
    setNoteDeleting(true);
    try {
      const res = await fetch(`/api/admin/companies/${detailRow.id}/notes/${noteToDelete.id}`, {
        method: "DELETE",
      });
      const d = await res.json();
      if (res.ok) {
        toastSuccess("Заметка удалена");
        setNoteToDelete(null);
        fetchDetail(detailRow.id);
        load();
      } else {
        toastError("Ошибка", d.error || "Не удалось удалить заметку");
      }
    } catch {
      toastError("Ошибка соединения");
    }
    setNoteDeleting(false);
  }

  // ── Владелец: бан и разбан ──

  async function banOwner() {
    if (!detail?.company.owner) return;
    setBanLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${detail.company.owner.id}/ban`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: banReason.trim() }),
      });
      const d = await res.json();
      if (res.ok) {
        toastSuccess("Владелец заблокирован", "Вход для этого аккаунта запрещён");
        setBanOpen(false);
        setBanReason("");
        fetchDetail(detail.company.id);
        load();
      } else {
        toastError("Ошибка", d.error || "Не удалось заблокировать");
      }
    } catch {
      toastError("Ошибка соединения");
    }
    setBanLoading(false);
  }

  async function unbanOwner() {
    if (!detail?.company.owner) return;
    setUnbanLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${detail.company.owner.id}/unban`, { method: "POST" });
      const d = await res.json();
      if (res.ok) {
        toastSuccess("Разблокирован", "Владелец снова может входить в кабинет");
        setUnbanOpen(false);
        fetchDetail(detail.company.id);
        load();
      } else {
        toastError("Ошибка", d.error || "Не удалось разблокировать");
      }
    } catch {
      toastError("Ошибка соединения");
    }
    setUnbanLoading(false);
  }

  // ── Печать счёта и акта ──

  async function openInvoicePrint(invoiceId: string) {
    setInvoicePrintLoading(true);
    setInvoicePrint(null);
    try {
      const [invRes, reqs] = await Promise.all([
        fetch(`/api/admin/billing/invoices/${invoiceId}`),
        fetchRequisites(),
      ]);
      const d = await invRes.json();
      if (!invRes.ok) {
        toastError("Ошибка", d.error || "Не удалось загрузить счёт");
        setInvoicePrintLoading(false);
        return;
      }
      const inv = d.invoice;
      setInvoicePrint({
        data: {
          number: inv.number,
          date: inv.date,
          dueDate: inv.dueDate,
          status: inv.status,
          subtotal: inv.subtotal,
          discount: inv.discount,
          total: inv.total,
          kind: "BILLING",
          periodFrom: inv.periodFrom,
          periodTo: inv.periodTo,
          buyerName: inv.company?.name ?? inv.username,
          buyerInn: inv.company?.inn ?? null,
          buyerKpp: inv.company?.kpp ?? null,
          buyerAddress: inv.company?.legalAddress ?? null,
          buyerKind: "company",
          items: inv.items,
        },
        reqs,
      });
    } catch {
      toastError("Ошибка соединения");
    }
    setInvoicePrintLoading(false);
  }

  async function openActPrint(actId: string) {
    setActPrintLoading(true);
    setActPrint(null);
    try {
      const [actRes, reqs] = await Promise.all([
        fetch(`/api/acts/${actId}`),
        fetchRequisites(),
      ]);
      const d = await actRes.json();
      if (!actRes.ok || !d.act) {
        toastError("Ошибка", "Акт не найден");
        setActPrintLoading(false);
        return;
      }
      setActPrint({
        data: {
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
        },
        reqs,
      });
    } catch {
      toastError("Ошибка соединения");
    }
    setActPrintLoading(false);
  }

  const totalViews = (m: CompanyRow["metrics"]) =>
    m ? m.phoneViews + m.emailViews + m.websiteViews + m.reviewsViews + m.ratingViews : 0;

  const pages = Math.max(1, Math.ceil(total / perPage));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск: название, ИНН, логин или email владельца..."
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} items={{ "": "Все статусы", ACTIVE: "Активна", HIDDEN: "Контакты скрыты", INACTIVE: "Без владельца" }} onValueChange={(v) => { setStatusFilter(v ?? ""); setPage(1); }}>
          <SelectTrigger className="w-[190px]"><SelectValue placeholder="Статус" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="" label="Все статусы">Все статусы</SelectItem>
            <SelectItem value="ACTIVE" label="Активна">Активна</SelectItem>
            <SelectItem value="HIDDEN" label="Контакты скрыты">Контакты скрыты</SelectItem>
            <SelectItem value="INACTIVE" label="Без владельца">Без владельца</SelectItem>
          </SelectContent>
        </Select>
        <Select value={paysFilter} items={{ "": "Оплата: все", pays: "Платит", nopays: "Не платит" }} onValueChange={(v) => { setPaysFilter(v ?? ""); setPage(1); }}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Оплата" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="" label="Оплата: все">Оплата: все</SelectItem>
            <SelectItem value="pays" label="Платит">Платит</SelectItem>
            <SelectItem value="nopays" label="Не платит">Не платит</SelectItem>
          </SelectContent>
        </Select>
        <Select value={hasOwnerFilter} items={{ "": "Владелец: любой", yes: "Есть владелец", no: "Без владельца" }} onValueChange={(v) => { setHasOwnerFilter(v ?? ""); setPage(1); }}>
          <SelectTrigger className="w-[170px]"><SelectValue placeholder="Владелец" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="" label="Владелец: любой">Владелец: любой</SelectItem>
            <SelectItem value="yes" label="Есть владелец">Есть владелец</SelectItem>
            <SelectItem value="no" label="Без владельца">Без владельца</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Панель тарифа и расценок под поисковой строкой: раскрываемая; рядом — массовое выставление */}
      <div className="border rounded-lg bg-muted/20">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
          <button
            type="button"
            className="flex items-center gap-2 min-w-0 text-left group"
            onClick={() => setTariffPanelOpen((v) => !v)}
          >
            {tariffPanelOpen ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
            <span className="text-sm font-semibold truncate group-hover:text-menthol">Тариф и расценки</span>
            {!tariffPanelOpen && (
              <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline">
                расценки для выставления счетов · тариф компании — в её карточке (кнопка «Открыть»)
              </span>
            )}
          </button>
          <Button size="sm" className="bg-menthol hover:bg-menthol-dark shrink-0" onClick={openMassInvoicing}>
            <FilePlus2 className="h-4 w-4 mr-1" />Массово выставить счета
          </Button>
        </div>

        {tariffPanelOpen && (
          <div className="px-4 pb-4 space-y-5">
            {/* Глобальные расценки: по ним считаются счета компаний без индивидуальных значений */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">Расценки по умолчанию — для всех компаний</p>
                <Button variant="outline" size="sm" onClick={() => setApplyAllOpen(true)} disabled={applyAllLoading}>
                  <Users className="h-3 w-3 mr-1" />Применить для всех
                </Button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
                {GLOBAL_FIELDS.map((f) => (
                  <div key={f.key} className="space-y-1">
                    <Label className="text-[11px] leading-tight">{f.label}</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={globalValues[f.key] ?? ""}
                      onChange={(e) => onGlobalChange(f.key, e.target.value)}
                      className="h-8"
                      title={f.key === "monthlyCap" ? "Потолок по умолчанию для компаний без своего; пустое поле — без потолка" : undefined}
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                По этим расценкам считаются счета компаний без индивидуальных значений; потолок — общий
                лимит счёта за период (пустое поле — без потолка). «Применить для всех» сбрасывает
                индивидуальные расценки всех компаний и устанавливает всем потолок из поля выше.
                Индивидуальный тариф — в карточке компании, кнопка «Открыть» в строке таблицы.
                {" "}
                {globalSaveState === "saving"
                  ? "Сохранение…"
                  : globalSaveState === "saved"
                    ? "Сохранено ✓"
                    : globalSaveState === "error"
                      ? "Ошибка сохранения"
                      : ""}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Пояснение статусов — чтобы каждый бейдж был понятен без инструкций */}
      <Alert>
        <AlertDescription className="text-xs">
          <b>Статусы:</b> <span className="text-green-700">Активна</span> — счета формируются, просмотры считаются.{" "}
          <span className="text-red-700">Контакты скрыты</span> — санкция за неуплату: телефон, почта и сайт скрыты в базе поставщиков.{" "}
          <span className="text-gray-600">Без владельца</span> — биллинг выключен, компания бесплатна.{" "}
          <b>Оплата:</b> <span className="text-green-700">Платит</span> — долга нет; <span className="text-red-700">Не платит</span> — есть долг или просроченный счёт; «—» — счетов ещё не было.
        </AlertDescription>
      </Alert>

      {companies === null ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : companies.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6">Компании не найдены — измените поиск или фильтры</p>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <SortHeader label="Компания" field="name" sort={sort} onSort={changeSort} />
                <SortHeader label="Регистрация" field="registeredAt" sort={sort} onSort={changeSort} />
                <th className="py-2 px-3 font-normal">Владелец</th>
                <th className="py-2 px-3 font-normal">Статус</th>
                <th className="py-2 px-3 font-normal">Оплата</th>
                <SortHeader label="Долг" field="debt" sort={sort} onSort={changeSort} className="text-right [&>button]:ml-auto" />
                <th className="py-2 px-3 font-normal text-right" title="Сколько просмотров попадут в следующий счёт и сколько всего за всё время">Просмотры</th>
                <th className="py-2 px-3 font-normal">Последний счёт</th>
                <th className="py-2 px-3 font-normal">Заметки</th>
                <th className="py-2 px-3 font-normal text-right">Действия</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => {
                const b = c.billing;
                return (
                  <tr
                    key={c.id}
                    className={`border-b last:border-0 hover:bg-muted/30 cursor-pointer ${detailRow?.id === c.id ? "bg-menthol/5" : ""}`}
                    onClick={() => openDetail(c)}
                    title="Клик — карточка компании"
                  >
                    <td className="py-2 px-3">
                      <p className="font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">ИНН {c.inn}</p>
                    </td>
                    <td className="py-2 px-3 text-xs">{formatDateShort(c.registeredAt)}</td>
                    <td className="py-2 px-3">
                      {c.owner ? (
                        <div>
                          <div className="flex items-center gap-2">
                            <p>{c.owner.username}</p>
                            {/*<OwnerStatusBadge status={c.owner.status} />*/}
                          </div>
                          <p className="text-xs text-muted-foreground">{c.owner.email}</p>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      <BillingStatusBadge status={b?.status ?? "INACTIVE"} />
                      {b?.status === "ACTIVE" && b.billingStartedAt && (
                        <p className="text-[10px] text-muted-foreground mt-1">с {formatDateShort(b.billingStartedAt)}</p>
                      )}
                      {b?.status === "HIDDEN" && b.hiddenReason && (
                        <p className="text-[10px] text-muted-foreground mt-1 max-w-[160px] truncate" title={b.hiddenReason}>
                          {b.hiddenReason}
                        </p>
                      )}
                    </td>
                    <td className="py-2 px-3"><PaysBadge pays={c.pays} /></td>
                    <td className={`py-2 px-3 text-right font-medium ${c.debt > 0 ? "text-red-600" : ""}`}>
                      {c.debt > 0 ? formatRubShort(c.debt) : "—"}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {c.pendingViews != null ? (
                        <div>
                          <p className="font-medium" title="Попадут в следующий счёт">{c.pendingViews} к счёту</p>
                          <p className="text-xs text-muted-foreground" title="Всего за всё время">{totalViews(c.metrics)} всего</p>
                        </div>
                      ) : (
                        <span>{totalViews(c.metrics).toLocaleString("ru-RU")}</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-xs">
                      {c.lastInvoice ? (
                        <div>
                          <p className="font-medium">{c.lastInvoice.number}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <InvoiceStatusBadge status={c.lastInvoice.status} />
                            <span>{formatRubShort(c.lastInvoice.total)}</span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-xs">
                      {c.notesCount > 0 ? `📝 ${c.notesCount}` : "—"}
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex items-center justify-end gap-1 flex-wrap">
                        {!c.owner && (
                          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); setAccessCompany({ id: c.id, name: c.name, inn: c.inn }); setAccessOpen(true); }}>
                            <KeyRound className="h-3 w-3 mr-1" />Доступ
                          </Button>
                        )}
                        {b?.status === "ACTIVE" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs text-red-600"
                            title="Санкция: скрыть контакты в базе поставщиков"
                            onClick={(e) => { e.stopPropagation(); setSanctionCompany({ id: c.id, name: c.name, hiddenReason: b?.hiddenReason ?? null }); setSanctionReason(b?.hiddenReason ?? ""); }}
                          >
                            <EyeOff className="h-3 w-3 mr-1" />Скрыть контакты
                          </Button>
                        )}
                        {b?.status === "HIDDEN" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs text-green-700"
                            title="Вернуть контакты в базу поставщиков (после оплаты)"
                            onClick={(e) => { e.stopPropagation(); setRestoreCompany({ id: c.id, name: c.name, hiddenReason: null }); }}
                          >
                            <Eye className="h-3 w-3 mr-1" />Вернуть контакты
                          </Button>
                        )}
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); openDetail(c); }}>
                          Открыть
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Пагинация */}
      {companies !== null && total > 0 && (
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

      {/* ── Попап компании ── */}
      <Dialog open={!!detailRow} onOpenChange={(v) => { if (!v) closeDetail(); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detail?.company.name ?? "…"}</DialogTitle>
            <DialogDescription>
              ИНН {detail?.company.inn ?? "…"} · зарегистрирована {formatDateShort(detail?.company.createdAt)}
            </DialogDescription>
          </DialogHeader>
          {detailLoading || !detail ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="space-y-4">
              {/* 1. Шапка: владелец, статус, долг, просмотры */}
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Владелец</p>
                  {detail.company.owner ? (
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{detail.company.owner.username}</p>
                      <OwnerStatusBadge status={detail.company.owner.status} />
                    </div>
                  ) : (
                    <p className="text-muted-foreground">нет — компания бесплатна</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Статус</p>
                  <BillingStatusBadge status={detail.billing?.status ?? "INACTIVE"} />
                  {detail.billing?.status === "ACTIVE" && detail.billing.billingStartedAt && (
                    <p className="text-xs text-muted-foreground mt-1">с {formatDateShort(detail.billing.billingStartedAt)}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Долг</p>
                  <p className={`font-medium ${detail.debt > 0 ? "text-red-600" : ""}`}>
                    {detail.debt > 0 ? formatRubShort(detail.debt) : "нет"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Просмотры за всё время</p>
                  <p className="font-medium">{detail.totalViews.toLocaleString("ru-RU")}</p>
                </div>
              </div>

              {/* Быстрые действия в шапке */}
              <div className="flex flex-wrap gap-2">
                {!detail.company.owner && (
                  <Button variant="outline" size="sm" onClick={() => { setAccessCompany({ id: detail.company.id, name: detail.company.name, inn: detail.company.inn }); setAccessOpen(true); }}>
                    <KeyRound className="h-3 w-3 mr-1" />Выдать доступ владельцу
                  </Button>
                )}
                {detail.billing?.status === "ACTIVE" && (
                  <Button
                    variant="outline" size="sm" className="text-red-600"
                    onClick={() => { setSanctionCompany({ id: detail.company.id, name: detail.company.name, hiddenReason: detail.billing?.hiddenReason ?? null }); setSanctionReason(detail.billing?.hiddenReason ?? ""); }}
                  >
                    <EyeOff className="h-3 w-3 mr-1" />Скрыть контакты
                  </Button>
                )}
                {detail.billing?.status === "HIDDEN" && (
                  <Button variant="outline" size="sm" className="text-green-700" onClick={() => setRestoreCompany({ id: detail.company.id, name: detail.company.name, hiddenReason: null })}>
                    <Eye className="h-3 w-3 mr-1" />Вернуть контакты
                  </Button>
                )}
              </div>

              {/* 1.5 Тариф и расценки компании */}
              <Section
                id="tariff"
                title="Тариф и расценки"
                badge={hasCustomRates(detail.billing) ? "· индивидуальные" : "· по умолчанию"}
                open={!!openSections.tariff}
                onToggle={toggleSection}
              >
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 gap-x-6">
                    {RATE_FIELDS.map((f) => (
                      <div key={f.key} className="space-y-1">
                        <Label className="text-xs leading-tight">{f.label}</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={tariffValues[f.key] ?? ""}
                          placeholder="по умолчанию"
                          onChange={(e) => onRateChange(f.key, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="space-y-1 min-w-[220px] flex-1">
                      <Label className="text-xs">Статус биллинга</Label>
                      <Select value={tariffStatus} items={STATUS_ITEMS} onValueChange={(v) => setTariffStatus(v ?? "INACTIVE")}>
                        <SelectTrigger className="w-full justify-between"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(STATUS_ITEMS).map(([k, label]) => (
                            <SelectItem key={k} value={k} label={label}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {tariffStatus === "HIDDEN" && (
                      <div className="space-y-1 min-w-[220px] flex-1">
                        <Label className="text-xs">Причина скрытия (видна компании)</Label>
                        <Input value={hiddenReason} onChange={(e) => setHiddenReason(e.target.value)} placeholder="Неоплаченный счёт №…" className="h-9" />
                      </div>
                    )}
                    <Button className="bg-menthol hover:bg-menthol-dark" onClick={saveStatus} disabled={statusSaving}>
                      {statusSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}Сохранить статус
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Значения подставлены из настроек по умолчанию. Ставки сохраняются автоматически при вводе; пустое
                    поле — вернуть значение по умолчанию. По ставкам ниже пересчитывается предстоящий счёт.{" "}
                    {ratesSaveState === "saving"
                      ? "Сохранение…"
                      : ratesSaveState === "saved"
                        ? "Сохранено ✓"
                        : ratesSaveState === "error"
                          ? "Ошибка сохранения"
                          : ""}
                  </p>
                </div>
              </Section>

              {/* 2. Предстоящий счёт */}
              <Section
                id="period"
                title="Предстоящий счёт"
                badge={detail.preview ? `итого ${formatRubShort(detail.preview.total)}` : ""}
                open={!!openSections.period}
                onToggle={toggleSection}
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Счёт по дату — войдёт всё с прошлого счёта до неё</Label>
                      <Input
                        type="date"
                        value={detailDate}
                        max={todayStr()}
                        onChange={(e) => {
                          const v = e.target.value;
                          setDetailDate(v);
                          if (detailDateTimer.current) clearTimeout(detailDateTimer.current);
                          detailDateTimer.current = setTimeout(() => {
                            if (detailRow) fetchDetail(detailRow.id, v || todayStr());
                          }, 400);
                        }}
                        className="w-[180px]"
                      />
                    </div>
                    {detailDate !== todayStr() && (
                      <Button variant="outline" size="sm" onClick={() => { setDetailDate(todayStr()); if (detailRow) fetchDetail(detailRow.id); }}>
                        Сегодня
                      </Button>
                    )}
                  </div>
                  {detail.period && detail.preview ? (
                    <div className="text-xs space-y-0.5">
                      <p className="text-muted-foreground">
                        Период: {formatDateShort(detail.period.from)} — {formatDateShort(detail.period.to)}
                      </p>
                      {(() => {
                        const pendingViews = detail.viewsInPeriod
                          ? Object.values(detail.viewsInPeriod).reduce((s, n) => s + n, 0)
                          : 0;
                        const excludedViews = detail.totalViews - pendingViews;
                        const breakdown = VIEW_METRICS
                          .map((m) => ({ label: METRIC_LABELS[m], n: detail.viewsInPeriod?.[m] ?? 0 }))
                          .filter((x) => x.n > 0)
                          .map((x) => `${x.label}: ${x.n}`)
                          .join(", ");
                        return (
                          <>
                            <p className="text-muted-foreground">
                              <b>Идут в счёт:</b> {pendingViews}{breakdown ? ` (${breakdown})` : ""} — накоплены
                              с {formatDateShort(detail.period.from)} и попадут в этот счёт.
                            </p>
                            <p className="text-muted-foreground">
                              <b>Не идут в счёт:</b> {excludedViews} — уже учтены в выставленных счетах или набраны
                              до начала биллинга.
                            </p>
                          </>
                        );
                      })()}
                      {detail.preview.items.map((i, idx) => (
                        <p key={idx}>{i.description} — {formatRubShort(i.total)}</p>
                      ))}
                      <p className="mt-1">
                        Сумма: {formatRubShort(detail.preview.subtotal)}
                        {detail.preview.capDiscount > 0 && (
                          <span className="block text-muted-foreground">
                            Скидка по потолку счёта: −{formatRubShort(detail.preview.capDiscount)}
                          </span>
                        )}
                      </p>
                      <p className="font-semibold mt-1">
                        Итого: {formatRubShort(detail.preview.total)}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Невыставленных просмотров нет — всё уже учтено в счетах. Всего просмотров за всё время:{" "}
                      <b>{detail.totalViews}</b>.
                    </p>
                  )}
                  {genResult ? (
                    <Alert>
                      <AlertDescription className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                        {genResult}
                      </AlertDescription>
                    </Alert>
                  ) : detail.billing?.status !== "ACTIVE" ? (
                    <p className="text-xs text-muted-foreground">
                      Счёт формируется только для активных компаний — смените статус в разделе «Тариф и расценки» этой карточки.
                    </p>
                  ) : !detail.preview || detail.preview.subtotal <= 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Счёт за выбранную дату получится пустым — с прошлого счёта ещё не было оплачиваемых
                      дней и просмотров, менять дату не нужно.
                    </p>
                  ) : (
                    <Button size="sm" className="bg-menthol hover:bg-menthol-dark" onClick={generateInDetail} disabled={genLoading}>
                      {genLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FilePlus2 className="h-4 w-4 mr-2" />}
                      Сформировать счёт
                    </Button>
                  )}
                  {genError && <p className="text-xs text-red-600">{genError}</p>}
                </div>
              </Section>

              {/* 4. Счета компании */}
              <Section
                id="invoices"
                title="Счета компании"
                badge={detail.invoices.length > 0 ? `· ${detail.invoices.length}` : ""}
                open={!!openSections.invoices}
                onToggle={toggleSection}
              >
                {detail.invoices.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Счетов пока нет</p>
                ) : (
                  <div className="space-y-1">
                    {detail.invoices.map((i) => (
                      <div key={i.id} className="flex items-center justify-between gap-2 py-1 border-b last:border-0 text-sm">
                        <div className="min-w-0 flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{i.number}</span>
                          <span className="text-xs text-muted-foreground">{formatDateShort(i.periodFrom)} — {formatDateShort(i.periodTo)}</span>
                          <InvoiceStatusBadge status={i.status} />
                          {i.act && (
                            <span className="text-xs text-muted-foreground">акт {i.act.number}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-medium">{formatRubShort(i.total)}</span>
                          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openInvoicePrint(i.id)} title="Показать и распечатать">
                            <Printer className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Все счета и массовые действия — во вкладке «Счета и акты».
                </p>
              </Section>

              {/* 5. Акты компании */}
              <Section
                id="acts"
                title="Акты компании"
                badge={detail.acts.length > 0 ? `· ${detail.acts.length}` : ""}
                open={!!openSections.acts}
                onToggle={toggleSection}
              >
                {detail.acts.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Акты создаются при отметке счёта «Оплачен»</p>
                ) : (
                  <div className="space-y-1">
                    {detail.acts.map((a) => (
                      <div key={a.id} className="flex items-center justify-between gap-2 py-1 border-b last:border-0 text-sm">
                        <div className="min-w-0">
                          <span className="font-medium">{a.number}</span>{" "}
                          <span className="text-xs text-muted-foreground">от {formatDateShort(a.date)} · по счёту {a.invoiceNumber}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-medium">{formatRubShort(a.total)}</span>
                          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openActPrint(a.id)} title="Показать и распечатать">
                            <Printer className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              {/* 7. Заметки администратора */}
              <Section
                id="notes"
                title="Заметки администратора"
                badge={detail.notes.length > 0 ? `· ${detail.notes.length}` : ""}
                open={!!openSections.notes}
                onToggle={toggleSection}
              >
                <div className="flex gap-2">
                  <Input
                    placeholder="Например: зарегистрировался по телефону, договорились об отсрочке…"
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !noteLoading) addNote(); }}
                  />
                  <Button size="sm" className="shrink-0 bg-menthol hover:bg-menthol-dark" onClick={addNote} disabled={noteLoading || !noteText.trim()}>
                    {noteLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                    Добавить
                  </Button>
                </div>
                {detail.notes.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Заметок пока нет — сюда удобно записывать, как зарегистрировалась компания и о чём договорились.</p>
                ) : (
                  <div className="space-y-1">
                    {detail.notes.map((n) => (
                      <div key={n.id} className="flex items-start justify-between gap-2 py-1 border-b last:border-0 text-sm">
                        <div className="min-w-0">
                          <p className="whitespace-pre-wrap">{n.text}</p>
                          <p className="text-xs text-muted-foreground">{formatDateShort(n.createdAt)}</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs text-red-600 shrink-0"
                          onClick={() => setNoteToDelete({ id: n.id, text: n.text })}
                          title="Удалить заметку"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              {/* 8. Владелец */}
              <Section
                id="owner"
                title="Владелец"
                badge={detail.company.owner ? `· ${detail.company.owner.username}` : "· нет"}
                open={!!openSections.owner}
                onToggle={toggleSection}
              >
                {detail.company.owner ? (
                  <div className="text-sm space-y-1">
                    <p>
                      Логин: <b>{detail.company.owner.username}</b> · Email: {detail.company.owner.email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Зарегистрирован {formatDateShort(detail.company.owner.createdAt)}
                    </p>
                    {detail.company.owner.status === "BANNED" && (
                      <p className="text-xs text-red-600">
                        Заблокирован. Причина: {detail.company.owner.banReason || "не указана"}
                      </p>
                    )}
                    <div className="flex gap-2 pt-1">
                      {detail.company.owner.status === "BANNED" ? (
                        <Button variant="outline" size="sm" className="text-green-700" onClick={() => setUnbanOpen(true)}>
                          <ShieldCheck className="h-3 w-3 mr-1" />Разблокировать
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" className="text-red-600" onClick={() => { setBanOpen(true); setBanReason(""); }}>
                          <Ban className="h-3 w-3 mr-1" />Заблокировать
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Владельца нет — биллинг выключен. Нажмите «Выдать доступ владельцу», чтобы привязать
                    существующего пользователя или создать нового с логином и паролем.
                  </p>
                )}
              </Section>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={closeDetail}>Закрыть</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Диалог доступа */}
      {accessOpen && accessCompany && (
        <AccessDialog
          key={accessCompany.id}
          company={accessCompany}
          onClose={() => { setAccessOpen(false); setAccessCompany(null); }}
          onDone={() => {
            load();
            if (detailRow) fetchDetail(detailRow.id);
          }}
        />
      )}

      {/* Санкция: скрыть контакты компании в базе поставщиков */}
      <Dialog open={!!sanctionCompany} onOpenChange={(v) => { if (!v && !sanctionLoading) { setSanctionCompany(null); setSanctionReason(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><EyeOff className="h-5 w-5 text-red-600" /> Скрыть контакты — {sanctionCompany?.name ?? ""}</DialogTitle>
            <DialogDescription>
              Санкция за неуплату. Телефон, почта и сайт компании будут скрыты в базе поставщиков,
              новые просмотры контактов перестанут считаться. Компания увидит причину в своём кабинете.
              Возврат контактов — вручную, кнопкой «Вернуть контакты» после оплаты.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label>Причина (видна компании)</Label>
            <Input value={sanctionReason} onChange={(e) => setSanctionReason(e.target.value)} placeholder="Неоплаченный счёт №…" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setSanctionCompany(null); setSanctionReason(""); }} disabled={sanctionLoading}>Отмена</Button>
            <Button variant="destructive" onClick={hideContacts} disabled={sanctionLoading}>
              {sanctionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <EyeOff className="h-4 w-4 mr-2" />}
              Скрыть контакты
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Возврат контактов после оплаты */}
      <Dialog open={!!restoreCompany} onOpenChange={(v) => { if (!v && !restoreLoading) setRestoreCompany(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Eye className="h-5 w-5 text-green-600" /> Вернуть контакты — {restoreCompany?.name ?? ""}</DialogTitle>
            <DialogDescription>
              Контакты снова станут видны в базе поставщиков, просмотры продолжат считаться,
              биллинг перейдёт в статус «Активна».
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRestoreCompany(null)} disabled={restoreLoading}>Отмена</Button>
            <Button className="bg-menthol hover:bg-menthol-dark" onClick={restoreContacts} disabled={restoreLoading}>
              {restoreLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
              Вернуть контакты
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Бан владельца */}
      <Dialog open={banOpen} onOpenChange={(v) => { if (!v && !banLoading) setBanOpen(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Ban className="h-5 w-5 text-red-600" /> Заблокировать владельца — {detail?.company.owner?.username ?? ""}</DialogTitle>
            <DialogDescription>
              Владелец не сможет входить в кабинет. Компания останется в таблице, её счета и данные не пропадут.
              Причина будет показана владельцу при попытке входа. Разблокировка — вручную, в этом же попапе.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label>Причина (видна владельцу)</Label>
            <Input value={banReason} onChange={(e) => setBanReason(e.target.value)} placeholder="Например: нарушение правил платформы" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setBanOpen(false)} disabled={banLoading}>Отмена</Button>
            <Button variant="destructive" onClick={banOwner} disabled={banLoading || !banReason.trim()}>
              {banLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Ban className="h-4 w-4 mr-2" />}
              Заблокировать
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Разбан владельца */}
      <ConfirmDialog
        open={unbanOpen}
        onOpenChange={(v) => { if (!v) setUnbanOpen(false); }}
        title="Разблокировать владельца?"
        message={`Владелец ${detail?.company.owner?.username ?? ""} снова сможет входить в кабинет компании.`}
        confirmLabel="Разблокировать"
        onConfirm={unbanOwner}
        loading={unbanLoading}
      />

      {/* Удаление заметки */}
      <ConfirmDialog
        open={!!noteToDelete}
        onOpenChange={(v) => { if (!v) setNoteToDelete(null); }}
        title="Удалить заметку?"
        message={noteToDelete ? `Заметка «${noteToDelete.text.length > 80 ? noteToDelete.text.slice(0, 80) + "…" : noteToDelete.text}» будет удалена безвозвратно.` : ""}
        confirmLabel="Удалить"
        onConfirm={deleteNote}
        loading={noteDeleting}
      />

      {/* Печать счёта из попапа */}
      <Dialog open={!!invoicePrint || invoicePrintLoading} onOpenChange={(v) => { if (!v) setInvoicePrint(null); }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Счёт {invoicePrint?.data.number ?? ""}</DialogTitle>
          </DialogHeader>
          {!invoicePrint ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <InvoicePrint invoice={invoicePrint.data} requisites={invoicePrint.reqs} />
          )}
        </DialogContent>
      </Dialog>

      {/* Печать акта из попапа */}
      <Dialog open={!!actPrint || actPrintLoading} onOpenChange={(v) => { if (!v) setActPrint(null); }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Акт {actPrint?.data.number ?? ""}</DialogTitle>
          </DialogHeader>
          {!actPrint ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <ServiceActPrint act={actPrint.data} requisites={actPrint.reqs} />
          )}
        </DialogContent>
      </Dialog>

      {/* Массовое выставление счетов — из панели над таблицей */}
      <MassInvoiceDialog
        open={massOpen}
        onOpenChange={setMassOpen}
        onCreated={() => { load(); }}
      />

      {/* Несохранённые расценки перед массовым выставлением */}
      <Dialog open={unsavedOpen} onOpenChange={(v) => { if (!v && !unsavedSaving) setUnsavedOpen(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Расценки не сохранены</DialogTitle>
            <DialogDescription>
              В полях расценок есть несохранённые изменения. Сохранить их перед массовым выставлением
              или продолжить по ранее сохранённым значениям?
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => setUnsavedOpen(false)}>Отмена</Button>
            <Button variant="outline" onClick={continueWithoutSaving}>Продолжить без сохранения</Button>
            <Button className="bg-menthol hover:bg-menthol-dark" onClick={saveAndContinue} disabled={unsavedSaving}>
              {unsavedSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Сохранить и продолжить
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Подтверждение «Применить для всех» */}
      <ConfirmDialog
        open={applyAllOpen}
        onOpenChange={setApplyAllOpen}
        variant="danger"
        title="Применить расценки и потолок для всех компаний?"
        message="Индивидуальные расценки всех компаний будут сброшены (все считать по расценкам по умолчанию), а потолок счёта — установлен всем из поля выше (пустое поле — без потолка). Выставление счетов, включая массовое, пойдёт по этим значениям. Вернуть прежние индивидуальные значения будет невозможно."
        confirmLabel="Применить для всех"
        onConfirm={confirmApplyAll}
        loading={applyAllLoading}
      />
    </div>
  );
}

// Тип данных для печати счёта (совпадает с пропсами InvoicePrint)
interface InvoicePrintData {
  number: string;
  date: string;
  dueDate: string;
  status: string;
  subtotal: number;
  discount: number;
  total: number;
  kind: "BILLING";
  periodFrom: string | null;
  periodTo: string | null;
  buyerName: string;
  buyerInn: string | null;
  buyerKpp: string | null;
  buyerAddress: string | null;
  buyerKind: "company";
  items: { description: string; quantity: number; unitPrice: number; total: number }[];
}

// ── Выдача доступа владельцу: привязка, создание аккаунта, приглашение ──
function AccessDialog({
  company,
  onClose,
  onDone,
}: {
  company: { id: string; name: string; inn: string };
  onClose: () => void;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<"create" | "invite">("create");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [credentials, setCredentials] = useState<{ username: string; password: string } | null>(null);
  const [inviteUrl, setInviteUrl] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [error, setError] = useState("");

  function generatePassword() {
    const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
    const arr = new Uint32Array(12);
    crypto.getRandomValues(arr);
    setPassword(Array.from(arr, (n) => chars[n % chars.length]).join(""));
  }

  async function createUser() {
    if (!company) return;
    setCreateLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/companies/${company.id}/owner`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "create", username, email, password: password || undefined }),
      });
      const d = await res.json();
      if (res.ok) {
        setCredentials(d.credentials);
        onDone();
      } else {
        setError(d.error || "Не удалось создать аккаунт");
      }
    } catch {
      setError("Ошибка соединения");
    }
    setCreateLoading(false);
  }

  async function createInvite() {
    if (!company) return;
    setInviteLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/companies/${company.id}/invite`, {
        method: "POST",
      });
      const d = await res.json();
      if (res.ok) {
        setInviteUrl(d.inviteUrl);
      } else {
        setError(d.error || "Не удалось создать приглашение");
      }
    } catch {
      setError("Ошибка соединения");
    }
    setInviteLoading(false);
  }

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toastSuccess("Скопировано", label);
    } catch {
      toastError("Не удалось скопировать");
    }
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Доступ владельца — {company.name}</DialogTitle>
          <DialogDescription>Компания без владельца: выберите способ передачи доступа. Письма не отправляются — данные передаёте вручную.</DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 flex-wrap">
          <Button variant={mode === "create" ? "default" : "outline"} size="sm" className={mode === "create" ? "bg-menthol" : ""} onClick={() => { setMode("create"); setError(""); }}>
            <KeyRound className="h-3 w-3 mr-1" />Логин + пароль
          </Button>
          <Button variant={mode === "invite" ? "default" : "outline"} size="sm" className={mode === "invite" ? "bg-menthol" : ""} onClick={() => { setMode("invite"); setError(""); }}>
            <Link2 className="h-3 w-3 mr-1" />Ссылка
          </Button>
        </div>

        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

        {mode === "create" && (
          credentials ? (
            <Card>
              <CardContent className="pt-4 space-y-2">
                <p className="text-sm font-medium">Аккаунт создан. Передайте владельцу логин и пароль:</p>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-base">Логин: <b>{credentials.username}</b></span>
                  <Button size="sm" variant="outline" onClick={() => copy(credentials.username, "Логин скопирован")}>Копировать</Button>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-base">Пароль: <b className="font-mono">{credentials.password}</b></span>
                  <Button size="sm" variant="outline" onClick={() => copy(credentials.password, "Пароль скопирован")}>Копировать</Button>
                </div>
                <p className="text-xs text-red-600 font-medium">
                  Пароль показан только сейчас — повторно он не отображается. Скопируйте его и передайте владельцу (по телефону или почте).
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Логин</Label>
                <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="company_login" />
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="info@company.ru" />
              </div>
              <div className="space-y-1">
                <Label>Пароль (можно сгенерировать)</Label>
                <div className="flex gap-2">
                  <Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="минимум 8 символов" />
                  <Button type="button" variant="outline" className="shrink-0" onClick={generatePassword}>
                    <KeyRound className="h-3 w-3 mr-1" />Сгенерировать
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Пустое поле — пароль сгенерируется сам. Готовый пароль будет показан один раз после создания.
                </p>
              </div>
              <Button className="bg-menthol hover:bg-menthol-dark w-full" onClick={createUser} disabled={createLoading}>
                {createLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Создать аккаунт
              </Button>
            </div>
          )
        )}

        {mode === "invite" && (
          inviteUrl ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Скопируйте ссылку и передайте владельцу (одноразовая, 7 дней):</p>
              <div className="flex items-center gap-2">
                <Input readOnly value={inviteUrl} className="font-mono text-xs" />
                <Button size="sm" variant="outline" className="shrink-0" onClick={() => copy(inviteUrl, "Ссылка скопирована")}>Копировать</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Сгенерируем одноразовую ссылку регистрации, привязанную к карточке компании (по ИНН {company.inn}).
              </p>
              <Button className="bg-menthol hover:bg-menthol-dark w-full" onClick={createInvite} disabled={inviteLoading}>
                {inviteLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Link2 className="h-4 w-4 mr-2" />}Создать ссылку
              </Button>
            </div>
          )
        )}
      </DialogContent>
    </Dialog>
  );
}
