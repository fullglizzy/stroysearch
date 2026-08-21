"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, AlertTriangle, Landmark, Eye } from "lucide-react";
import { METRIC_LABELS, type ViewMetric } from "@/lib/billing";
import { formatRubShort, formatDateShort } from "@/components/forms/billing/shared";
import type { BillingRequisites } from "@/components/shared/InvoicePrint";

interface MyBilling {
  company: { id: string; inn: string; name: string } | null;
  billing: {
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
  } | null;
  defaults: {
    maintenanceFee: number;
    phoneViewPrice: number;
    emailViewPrice: number;
    websiteViewPrice: number;
    reviewsViewPrice: number;
    ratingViewPrice: number;
  };
  period: { from: string; to: string } | null;
  preview: {
    items: { description: string; quantity: number; unitPrice: number; total: number }[];
    maintenanceDays: number;
    viewsCost: number;
    capApplied: boolean;
    subtotal: number;
  } | null;
  metrics: Record<ViewMetric, number> | null;
}

export function CompanyBillingOverview() {
  const [data, setData] = useState<MyBilling | null>(null);
  const [reqs, setReqs] = useState<BillingRequisites | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/billing/my").then((r) => r.json()),
      fetch("/api/billing/info").then((r) => r.json()),
    ])
      .then(([d, r]) => {
        if (cancelled) return;
        if (d.error) setError(d.error);
        else setData(d);
        setReqs(r);
      })
      .catch(() => { if (!cancelled) setError("Ошибка загрузки"); });
    return () => { cancelled = true; };
  }, []);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data || !reqs) {
    return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const b = data.billing;
  const d = data.defaults;
  const effective = {
    maintenanceFee: b?.maintenanceFee ?? d.maintenanceFee,
    phonePrice: b?.phonePrice ?? d.phoneViewPrice,
    emailPrice: b?.emailPrice ?? d.emailViewPrice,
    websitePrice: b?.websitePrice ?? d.websiteViewPrice,
    reviewsPrice: b?.reviewsPrice ?? d.reviewsViewPrice,
    ratingPrice: b?.ratingPrice ?? d.ratingViewPrice,
  };

  const totalViews = data.metrics ? Object.values(data.metrics).reduce((s, n) => s + n, 0) : 0;

  return (
    <div className="space-y-6">
      {b?.status === "HIDDEN" && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Контакты компании скрыты в базе поставщиков</AlertTitle>
          <AlertDescription>
            {b.hiddenReason ? `Причина: ${b.hiddenReason}. ` : ""}
            Оплатите задолженность — счёт оплачивается во вкладке «Счета и акты», после этого администратор вернёт контакты.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Тариф</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between py-1 border-b"><span>Абонентская плата</span><b>{formatRubShort(effective.maintenanceFee)}/мес</b></div>
            <div className="flex justify-between py-1 border-b"><span>Просмотр телефона</span><b>{effective.phonePrice} ₽</b></div>
            <div className="flex justify-between py-1 border-b"><span>Просмотр почты</span><b>{effective.emailPrice} ₽</b></div>
            <div className="flex justify-between py-1 border-b"><span>Просмотр сайта</span><b>{effective.websitePrice} ₽</b></div>
            <div className="flex justify-between py-1 border-b"><span>Просмотр отзывов</span><b>{effective.reviewsPrice} ₽</b></div>
            <div className="flex justify-between py-1"><span>Просмотр рейтинга</span><b>{effective.ratingPrice} ₽</b></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Предстоящий счёт за период</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">
              Период: <b>{formatDateShort(data.period?.from)} — {formatDateShort(data.period?.to)}</b>
            </p>
            {data.preview ? (
              <div className="space-y-1 text-sm">
                <p className="text-xs text-muted-foreground">Что войдёт в счёт (к оплате):</p>
                {data.preview.items.map((i, idx) => (
                  <p key={idx} className="text-xs">{i.description} — {formatRubShort(i.total)}</p>
                ))}
                <p className="font-semibold pt-1 border-t">
                  К оплате: {formatRubShort(data.preview.subtotal)}
                  {data.preview.capApplied && <span className="block text-[10px] font-normal text-muted-foreground">применён потолок счёта</span>}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Счёт формирует администратор платформы — после выставления он появится в вашем кабинете.
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Невыставленных дней нет — счёт за период уже сформирован.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Eye className="h-4 w-4 text-menthol" /> Просмотры</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between py-1 border-b"><span>Всего за всё время</span><b>{totalViews}</b></div>
            {(Object.keys(METRIC_LABELS) as ViewMetric[]).map((m) => (
              <div key={m} className="flex justify-between py-1 border-b last:border-0">
                <span>{METRIC_LABELS[m]}</span>
                <span className="font-medium">{data.metrics?.[m] ?? 0}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Landmark className="h-4 w-4 text-menthol" /> Реквизиты для оплаты</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 text-sm">
          <p>{reqs.organizationName || "—"}</p>
          <p>ИНН: {reqs.organizationInn || "—"}{reqs.organizationKpp ? ` / КПП: ${reqs.organizationKpp}` : ""}</p>
          <p>Банк: {reqs.bankName || "—"}</p>
          <p>БИК: {reqs.bankBik || "—"}</p>
          <p>Расчётный счёт: {reqs.bankAccount || "—"}</p>
          <p>Корр. счёт: {reqs.bankCorrAccount || "—"}</p>
        </CardContent>
      </Card>
    </div>
  );
}
