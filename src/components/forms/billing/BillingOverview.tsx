"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Wallet, CalendarDays, AlertTriangle, Eye, Building2, UserX } from "lucide-react";
import { formatRubShort } from "./shared";

interface Overview {
  byStatus: Record<string, { count: number; sum: number }>;
  debt: number;
  month: { createdCount: number; createdSum: number };
  overdue: { count: number; sum: number };
  companies: { active: number; hidden: number; inactive: number; noOwner: number };
  viewsMonth: number;
}

export function BillingOverview() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/billing/overview")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) {
          if (d.error) setError(d.error);
          else setData(d);
        }
      })
      .catch(() => { if (!cancelled) setError("Ошибка загрузки"); });
    return () => { cancelled = true; };
  }, []);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) {
    return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const cards = [
    { icon: Wallet, label: "Долг (не оплачено)", value: formatRubShort(data.debt), hint: "черновики + выставленные + просроченные" },
    { icon: CalendarDays, label: "Выставлено за месяц", value: formatRubShort(data.month.createdSum), hint: `${data.month.createdCount} счетов` },
    { icon: AlertTriangle, label: "Просрочено", value: `${data.overdue.count} счетов`, hint: `на сумму ${formatRubShort(data.overdue.sum)}` },
    { icon: Eye, label: "Просмотры за месяц", value: data.viewsMonth.toLocaleString("ru-RU"), hint: "все метрики" },
    { icon: Building2, label: "Компании в биллинге", value: String(data.companies.active), hint: `скрыты: ${data.companies.hidden}` },
    { icon: UserX, label: "Компании без владельца", value: String(data.companies.noOwner), hint: "биллинг не начисляется" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent>
            <div className="flex items-start gap-3">
              <c.icon className="h-5 w-5 text-menthol shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">{c.label}</p>
                <p className="text-2xl font-bold">{c.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{c.hint}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
