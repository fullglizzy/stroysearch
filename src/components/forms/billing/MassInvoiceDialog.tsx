"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toastSuccess, toastError } from "@/lib/toast";
import { Loader2, FilePlus2, CheckCircle2 } from "lucide-react";
import { formatRubShort } from "./shared";

interface PreviewData {
  companies: { companyId: string; total: number }[];
}

/** Сегодня в формате YYYY-MM-DD (для input type="date") */
function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Массовое выставление счетов: одна дата для всех компаний, счёт покрывает
 * всё накопленное с прошлого счёта (абонплата + просмотры). Счета выставляются
 * всем компаниям с суммой к оплате на выбранную дату.
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
  const [creating, setCreating] = useState(false);
  const [createdCount, setCreatedCount] = useState<number | null>(null);
  const dateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadPreview = useCallback((d: string) => {
    setLoading(true);
    fetch(`/api/admin/billing/invoices/preview?periodTo=${encodeURIComponent(d)}`)
      .then((r) => r.json())
      .then((data) => {
        // Свежий предпросмотр сбрасывает результат предыдущего создания
        setCreatedCount(null);
        if (data.error) {
          toastError("Ошибка", data.error);
          setPreview(null);
          return;
        }
        setPreview(data);
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
    setCreatedCount(null);
    if (dateTimer.current) clearTimeout(dateTimer.current);
    dateTimer.current = setTimeout(() => loadPreview(d), 300);
  }

  const companyIds = preview ? preview.companies.map((c) => c.companyId) : [];
  const totalSum = preview ? preview.companies.reduce((s, c) => s + c.total, 0) : 0;

  async function createAll() {
    if (companyIds.length === 0) return;
    setCreating(true);
    try {
      const res = await fetch("/api/admin/billing/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyIds, periodTo: date }),
      });
      const d = await res.json();
      if (res.ok) {
        setCreatedCount(d.created?.length ?? 0);
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

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !creating) onOpenChange(false); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Массовое выставление счетов</DialogTitle>
          <DialogDescription>
            Каждый счёт выставляется по дату и включает обслуживание и просмотры с прошлого счёта компании
            до этой даты. Счета сразу получают статус «Выставлен»: компании увидят их в кабинетах и
            получат уведомления. Счета будут выставлены всем компаниям с суммой к оплате.
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
          ) : preview && preview.companies.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              На выбранную дату нет компаний с суммой к оплате — все периоды уже выставлены или биллинг не начат.
            </p>
          ) : null}

          {createdCount !== null && (
            <Alert>
              <AlertDescription className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                <span>Выставлено счетов: <b>{createdCount}</b>.</span>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              Компаний к выставлению: <b>{companyIds.length}</b> на сумму <b>{formatRubShort(totalSum)}</b>
            </p>
            <Button className="bg-menthol hover:bg-menthol-dark" onClick={createAll} disabled={creating || companyIds.length === 0 || loading}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FilePlus2 className="h-4 w-4 mr-2" />}
              Выставить счета
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
