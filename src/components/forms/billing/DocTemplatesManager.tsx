"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Save, Eye } from "lucide-react";
import { toastSuccess, toastError } from "@/lib/toast";
import { InvoicePrint, type BillingRequisites } from "@/components/shared/InvoicePrint";
import { ServiceActPrint, type ServiceActData } from "@/components/shared/ServiceActPrint";
import { fetchRequisites } from "./shared";

interface TemplateLine {
  id: string;
  docKind: string;
  code: string;
  label: string;
  description: string;
  enabled: boolean;
  sortOrder: number;
}

type PreviewKind = "billing_invoice" | "coin_invoice" | "service_act";

const GROUPS: { kind: string; title: string; hint: string; previewLabel: string }[] = [
  {
    kind: "billing_invoice",
    title: "Счёт за обслуживание и просмотры (единый)",
    hint: "Строки счёта, который формируется для компании за период. Суммы считаются автоматически — здесь редактируются только тексты строк.",
    previewLabel: "Предпросмотр счёта",
  },
  {
    kind: "service_act",
    title: "Акт об оказанных услугах",
    hint: "Строки акта, который создаётся автоматически при отметке счёта «Оплачен». Сумма акта всегда равна сумме счёта.",
    previewLabel: "Предпросмотр акта",
  },
  {
    kind: "coin_invoice",
    title: "Счёт на покупку монет",
    hint: "Строки счёта за покупку монет (заявка через поддержку).",
    previewLabel: "Предпросмотр счёта",
  },
];

const PLACEHOLDER_HINTS: Record<string, string> = {
  title: "Плейсхолдеры: {number} — номер, {date} — дата, {period} — период. Пустое поле — стандартное название.",
  note: "Плейсхолдеры: {number}, {date}, {period}, {total} — сумма. Пустое примечание не выводится.",
  maintenance: "Плейсхолдеры: {period} — период, {days} — дней, {fee} — сумма абонплаты",
  views: "Плейсхолдеры: {metric} — метрика, {count} — просмотров, {price} — ставка, {period} — период",
  cap: "Плейсхолдеры: {period}, {breakdown} — раскладка по метрикам, {cap} — потолок",
  services: "Плейсхолдеры: {period}, {invoice} — номер счёта, {total} — сумма",
  license: "Строка без плейсхолдеров",
  scope: "Плейсхолдеры: {count} — монет, {units} — условные единицы, {coins} — монеты",
};

// Шаблонные данные для предпросмотра
const SAMPLE_PERIOD = "01.08.2026 — 31.08.2026";
const SAMPLE_DATE = new Date(2026, 7, 15);
const SAMPLE_COMPANY = {
  name: "ООО «Пример»",
  inn: "7700000000",
  kpp: null,
  legalAddress: "г. Москва, ул. Примерная, д. 1",
};

function fillSample(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? vars[key] : match));
}

export function DocTemplatesManager() {
  const [lines, setLines] = useState<TemplateLine[] | null>(null);
  const [savingKind, setSavingKind] = useState<string | null>(null);
  const [previewKind, setPreviewKind] = useState<PreviewKind | null>(null);
  const [previewReqs, setPreviewReqs] = useState<BillingRequisites | null>(null);

  useEffect(() => {
    fetch("/api/admin/billing/templates")
      .then((r) => r.json())
      .then((d) => setLines(d.lines || []))
      .catch(() => setLines([]));
  }, []);

  function updateLine(id: string, patch: Partial<Pick<TemplateLine, "description" | "enabled">>) {
    setLines((prev) => (prev ? prev.map((l) => (l.id === id ? { ...l, ...patch } : l)) : prev));
  }

  function groupOf(kind: string): TemplateLine[] {
    return (lines ?? []).filter((l) => l.docKind === kind);
  }

  async function saveGroup(kind: string) {
    const groupLines = groupOf(kind);
    if (groupLines.length === 0) return;
    setSavingKind(kind);
    try {
      const res = await fetch("/api/admin/billing/templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: groupLines.map((l) => ({ id: l.id, description: l.description, enabled: l.enabled })),
        }),
      });
      const d = await res.json();
      if (res.ok) {
        toastSuccess("Сохранено", "Шаблон обновлён");
      } else {
        toastError("Ошибка", d.error || "Не удалось сохранить шаблон");
      }
    } catch {
      toastError("Ошибка соединения");
    }
    setSavingKind(null);
  }

  // Название и примечание из текущего (возможно, ещё не сохранённого) состояния
  function currentTitleNote(kind: "billing_invoice" | "coin_invoice") {
    const group = groupOf(kind);
    const title = group.find((l) => l.code === "title");
    const note = group.find((l) => l.code === "note");
    return {
      title: { text: title?.description ?? "", enabled: title?.enabled ?? true },
      note: { text: note?.description ?? "", enabled: note?.enabled ?? true },
    };
  }

  async function openPreview(kind: PreviewKind) {
    setPreviewKind(kind);
    setPreviewReqs(null);
    try {
      const reqs = await fetchRequisites();
      if (kind !== "service_act") {
        reqs.docTemplates = {
          ...(reqs.docTemplates ?? {}),
          [kind]: currentTitleNote(kind),
        };
      }
      setPreviewReqs(reqs);
    } catch {
      toastError("Не удалось загрузить реквизиты");
      setPreviewKind(null);
    }
  }

  // Шаблонные данные счёта — строки берутся из текущего состояния редактора
  function sampleInvoice(kind: "billing_invoice" | "coin_invoice") {
    const itemLines = groupOf(kind).filter(
      (l) => l.enabled && l.code !== "title" && l.code !== "note",
    );
    let items: { description: string; quantity: number; unitPrice: number; total: number }[] = [];
    if (kind === "billing_invoice") {
      items = itemLines
        .map((l) => {
          if (l.code === "maintenance") {
            return {
              description: fillSample(l.description, { period: SAMPLE_PERIOD, days: "31", fee: "1 000" }),
              quantity: 1,
              unitPrice: 1000,
              total: 1000,
            };
          }
          if (l.code === "views") {
            return {
              description: fillSample(l.description, { metric: "телефон", count: "12", price: "50", period: SAMPLE_PERIOD }),
              quantity: 12,
              unitPrice: 50,
              total: 600,
            };
          }
          if (l.code === "cap") {
            return {
              description: fillSample(l.description, { period: SAMPLE_PERIOD, breakdown: "телефон: 12, эл.почта: 3", cap: "1 000" }),
              quantity: 1,
              unitPrice: 1000,
              total: 1000,
            };
          }
          return null;
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);
    } else {
      const desc = itemLines
        .filter((l) => l.code === "license" || l.code === "scope")
        .map((l) =>
          fillSample(l.description, { count: "100", units: "условных единиц", coins: "монет", price: "100", total: "10 000" }),
        )
        .join("\n");
      items = desc ? [{ description: desc, quantity: 100, unitPrice: 100, total: 10000 }] : [];
    }
    const subtotal = items.reduce((s, i) => s + i.total, 0);
    return {
      number: kind === "billing_invoice" ? "СЧ-2026-001" : "INV-DEMO001",
      date: SAMPLE_DATE,
      dueDate: new Date(2026, 7, 20),
      status: "SENT",
      subtotal,
      discount: 0,
      total: subtotal,
      kind: kind === "billing_invoice" ? "BILLING" : "PURCHASE",
      periodFrom: kind === "billing_invoice" ? new Date(2026, 7, 1) : null,
      periodTo: kind === "billing_invoice" ? new Date(2026, 7, 31, 23, 59, 59) : null,
      buyerName: SAMPLE_COMPANY.name,
      buyerInn: SAMPLE_COMPANY.inn,
      buyerKpp: null,
      buyerAddress: SAMPLE_COMPANY.legalAddress,
      buyerKind: "company",
      items,
    };
  }

  function sampleAct(): ServiceActData {
    const services = groupOf("service_act").find((l) => l.code === "services");
    const description = fillSample(
      services?.description ?? "Услуги платформы за период {period} по счёту {invoice}",
      { period: SAMPLE_PERIOD, invoice: "СЧ-2026-001", total: "1 000 ₽" },
    );
    return {
      number: "АКТ-2026-001",
      date: SAMPLE_DATE,
      total: 1000,
      invoiceNumber: "СЧ-2026-001",
      periodFrom: new Date(2026, 7, 1),
      periodTo: new Date(2026, 7, 31, 23, 59, 59),
      items: [{ description, quantity: 1, unitPrice: 1000, total: 1000 }],
      company: SAMPLE_COMPANY,
      buyerName: SAMPLE_COMPANY.name,
      buyerEmail: null,
    };
  }

  if (lines === null) {
    return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Каждая строка и каждый текст документов (счета и акты) редактируются здесь. Кнопка
        «Предпросмотр» показывает документ с шаблонными данными — включая ещё не сохранённые правки.
      </p>
      {GROUPS.map((group) => {
        const groupLines = groupOf(group.kind);
        if (groupLines.length === 0) return null;
        return (
          <Card key={group.kind}>
            <CardHeader><CardTitle className="text-base">{group.title}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">{group.hint}</p>
              {groupLines.map((l) => {
                if (l.code === "title") {
                  return (
                    <div key={l.id} className="border rounded-lg p-3 space-y-2">
                      <p className="text-sm font-medium">Название счёта</p>
                      <Input
                        value={l.description}
                        onChange={(e) => updateLine(l.id, { description: e.target.value })}
                      />
                      <p className="text-[11px] text-muted-foreground">{PLACEHOLDER_HINTS.title}</p>
                    </div>
                  );
                }
                if (l.code === "note") {
                  return (
                    <div key={l.id} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">Примечание</p>
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Checkbox
                            checked={l.enabled}
                            onCheckedChange={(v) => updateLine(l.id, { enabled: v === true })}
                          />
                          Показывать в документе
                        </label>
                      </div>
                      <Textarea
                        rows={4}
                        value={l.description}
                        onChange={(e) => updateLine(l.id, { description: e.target.value })}
                      />
                      <p className="text-[11px] text-muted-foreground">{PLACEHOLDER_HINTS.note}</p>
                    </div>
                  );
                }
                return (
                  <div key={l.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{l.label}</p>
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Checkbox
                          checked={l.enabled}
                          onCheckedChange={(v) => updateLine(l.id, { enabled: v === true })}
                        />
                        Показывать в документе
                      </label>
                    </div>
                    <Input
                      value={l.description}
                      onChange={(e) => updateLine(l.id, { description: e.target.value })}
                      disabled={!l.enabled}
                    />
                    <p className="text-[11px] text-muted-foreground">{PLACEHOLDER_HINTS[l.code] ?? ""}</p>
                  </div>
                );
              })}
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => openPreview(group.kind as PreviewKind)}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  {group.previewLabel}
                </Button>
                <Button
                  className="bg-menthol hover:bg-menthol-dark"
                  onClick={() => saveGroup(group.kind)}
                  disabled={savingKind === group.kind}
                >
                  {savingKind === group.kind ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Сохранить шаблон
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Предпросмотр счёта (шаблонные данные) */}
      <Dialog open={previewKind !== null && previewKind !== "service_act"} onOpenChange={(v) => { if (!v) setPreviewKind(null); }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Предпросмотр счёта — шаблонные данные</DialogTitle>
          </DialogHeader>
          {previewKind === null || previewKind === "service_act" || !previewReqs ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <InvoicePrint invoice={sampleInvoice(previewKind)} requisites={previewReqs} />
          )}
        </DialogContent>
      </Dialog>

      {/* Предпросмотр акта (шаблонные данные) */}
      <Dialog open={previewKind === "service_act"} onOpenChange={(v) => { if (!v) setPreviewKind(null); }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Предпросмотр акта — шаблонные данные</DialogTitle>
          </DialogHeader>
          {!previewReqs ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <ServiceActPrint act={sampleAct()} requisites={previewReqs} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
