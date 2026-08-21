"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toastSuccess, toastError } from "@/lib/toast";
import { Loader2, FilePlus2, CheckCircle2, Search } from "lucide-react";
import { formatRubShort, formatDateShort } from "./shared";

interface PreviewCompany {
  companyId: string;
  companyName: string;
  owner: string | null;
  period: { from: string; to: string };
  /** Итог с учётом скидки по потолку счёта */
  total: number;
}

interface PreviewData {
  companies: PreviewCompany[];
  skipped: { companyId: string; companyName: string; reason: string }[];
  total: number;
}

/** Сегодня в формате YYYY-MM-DD (для input type="date") */
function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Массовое выставление счетов: одна дата для всех компаний, счёт покрывает
 * всё накопленное с прошлого счёта (абонплата + просмотры). Перед созданием
 * показывается предпросмотр с возможностью снять отметку с отдельных компаний.
 */
export function MassInvoiceDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Вызывается после успешного создания счетов — обновить таблицу компаний */
  onCreated: () => void;
}) {
  const [date, setDate] = useState(todayStr());
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: { companyName: string; reason: string }[] } | null>(null);
  const dateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Поиск и сортировка по списку компаний в диалоге
  const [companyQuery, setCompanyQuery] = useState("");
  const [sortMode, setSortMode] = useState("sum");

  const loadPreview = useCallback((d: string) => {
    setLoading(true);
    fetch(`/api/admin/billing/invoices/preview?periodTo=${encodeURIComponent(d)}`)
      .then((r) => r.json())
      .then((data) => {
        // Свежий предпросмотр сбрасывает результат предыдущего создания
        setResult(null);
        if (data.error) {
          toastError("Ошибка", data.error);
          setPreview(null);
          return;
        }
        setPreview(data);
        // Все компании с суммой к оплате отмечены по умолчанию
        setChecked(Object.fromEntries(data.companies.map((c: PreviewCompany) => [c.companyId, true])));
      })
      .catch(() => toastError("Ошибка соединения"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!open) return;
    // Дату предпросмотра при открытии не сбрасываем — она уже стоит «сегодня»
    const t = setTimeout(() => loadPreview(date), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function changeDate(d: string) {
    setDate(d);
    setResult(null);
    if (dateTimer.current) clearTimeout(dateTimer.current);
    dateTimer.current = setTimeout(() => loadPreview(d), 300);
  }

  const selectedIds = Object.entries(checked).filter(([, v]) => v).map(([id]) => id);
  const selectedTotal = preview
    ? preview.companies.filter((c) => checked[c.companyId]).reduce((s, c) => s + c.total, 0)
    : 0;

  // Отфильтрованный и отсортированный список — длинный список удобно сузить
  const visibleCompanies = preview
    ? preview.companies
        .filter((c) => {
          const q = companyQuery.trim().toLowerCase();
          if (!q) return true;
          return c.companyName.toLowerCase().includes(q) || (c.owner ?? "").toLowerCase().includes(q);
        })
        .sort((a, b) =>
          sortMode === "name"
            ? a.companyName.localeCompare(b.companyName, "ru")
            : b.total - a.total || a.companyName.localeCompare(b.companyName, "ru"),
        )
    : [];

  async function createAll() {
    if (selectedIds.length === 0) return;
    setCreating(true);
    try {
      const res = await fetch("/api/admin/billing/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyIds: selectedIds, periodTo: date }),
      });
      const d = await res.json();
      if (res.ok) {
        setResult({ created: d.created?.length ?? 0, skipped: d.skipped ?? [] });
        toastSuccess("Счета выставлены", `Выставлено: ${d.created?.length ?? 0}`);
        onCreated();
      } else {
        toastError("Ошибка", d.error || "Не удалось выставить счета");
      }
    } catch {
      toastError("Ошибка соединения");
    }
    setCreating(false);
  }

  const allChecked = visibleCompanies.length > 0 && visibleCompanies.every((c) => checked[c.companyId]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !creating) onOpenChange(false); }}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Массовое выставление счетов</DialogTitle>
          <DialogDescription>
            Каждый счёт выставляется по дату и включает обслуживание и просмотры с прошлого счёта компании
            до этой даты. Счета сразу получают статус «Выставлен»: компании увидят их в кабинетах и
            получат уведомления. По умолчанию отмечены все компании с суммой к оплате.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label>Счета по дату</Label>
              <Input type="date" value={date} max={todayStr()} onChange={(e) => changeDate(e.target.value)} className="w-[190px]" />
            </div>
            {date !== todayStr() && (
              <Button variant="outline" size="sm" onClick={() => changeDate(todayStr())}>Сегодня</Button>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : !preview ? null : preview.companies.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              На выбранную дату нет компаний с суммой к оплате — все периоды уже выставлены или биллинг не начат.
            </p>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <div className="relative flex-1 min-w-[180px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Поиск по компании или владельцу..."
                    value={companyQuery}
                    onChange={(e) => setCompanyQuery(e.target.value)}
                    className="pl-8 h-8 text-sm"
                  />
                </div>
                <Select value={sortMode} items={{ sum: "По сумме", name: "По названию" }} onValueChange={(v) => setSortMode(v ?? "sum")}>
                  <SelectTrigger className="w-[150px] h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sum" label="По сумме">По сумме</SelectItem>
                    <SelectItem value="name" label="По названию">По названию</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {visibleCompanies.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">Поиск не нашёл компаний</p>
              ) : (
                <div className="border rounded-lg max-h-[45vh] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted/40">
                      <tr className="text-left text-xs text-muted-foreground">
                        <th className="py-2 px-3 font-normal w-8">
                          <input
                            type="checkbox"
                            checked={allChecked}
                            onChange={(e) => setChecked((prev) => {
                              const next = { ...prev };
                              for (const c of visibleCompanies) next[c.companyId] = e.target.checked;
                              return next;
                            })}
                            title="Отметить все найденные"
                          />
                        </th>
                        <th className="py-2 px-3 font-normal">Компания</th>
                        <th className="py-2 px-3 font-normal">Период</th>
                        <th className="py-2 px-3 font-normal text-right">Сумма</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleCompanies.map((c) => (
                        <tr key={c.companyId} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="py-2 px-3">
                            <input
                              type="checkbox"
                              checked={!!checked[c.companyId]}
                              onChange={(e) => setChecked((prev) => ({ ...prev, [c.companyId]: e.target.checked }))}
                            />
                          </td>
                          <td className="py-2 px-3">
                            <p className="font-medium">{c.companyName}</p>
                            <p className="text-xs text-muted-foreground">{c.owner ?? "—"}</p>
                          </td>
                          <td className="py-2 px-3 text-xs">{formatDateShort(c.period.from)} — {formatDateShort(c.period.to)}</td>
                          <td className="py-2 px-3 text-right font-medium" title="Итог с учётом скидки по потолку счёта">{formatRubShort(c.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {preview && preview.skipped.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Без суммы к оплате (пропущены): {preview.skipped.map((s) => s.companyName).join(", ")}.
            </p>
          )}

          {result && (
            <Alert>
              <AlertDescription className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                <span>
                  Выставлено счетов: <b>{result.created}</b>.
                  {result.skipped.length > 0 && (
                    <> Не создано: {result.skipped.map((s) => `${s.companyName} (${s.reason})`).join("; ")}.</>
                  )}
                </span>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-center justify-between gap-3">
            <p className="text-sm">
              Выбрано компаний: <b>{selectedIds.length}</b> на сумму <b>{formatRubShort(selectedTotal)}</b>
            </p>
            <Button className="bg-menthol hover:bg-menthol-dark" onClick={createAll} disabled={creating || selectedIds.length === 0 || loading}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FilePlus2 className="h-4 w-4 mr-2" />}
              Выставить счета
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
