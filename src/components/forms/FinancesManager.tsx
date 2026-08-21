"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Save } from "lucide-react";

interface BillingConfig {
  id: string;
  coinPriceRub: number;
  addCompanyCoins: number;
  reviewCoins: number;
  vatRate: number;
  maintenanceFee: number;
  phoneViewPrice: number;
  emailViewPrice: number;
  websiteViewPrice: number;
  reviewsViewPrice: number;
  ratingViewPrice: number;
  invoiceDueDays: number;
  invoiceBasis: string | null;
  organizationName: string | null;
  organizationInn: string | null;
  organizationKpp: string | null;
  organizationAddress: string | null;
  bankName: string | null;
  bankBik: string | null;
  bankAccount: string | null;
  bankCorrAccount: string | null;
  directorName: string | null;
  signatureImage: string | null;
}

interface Props {
  config: BillingConfig | null;
}

/**
 * Настройка экономики платформы: цены, ставки биллинга и сроки.
 */
export function FinancesManager({ config }: Props) {
  const router = useRouter();
  const [coinPriceRub, setCoinPriceRub] = useState(String(config?.coinPriceRub ?? 100));
  const [addCompanyCoins, setAddCompanyCoins] = useState(String(config?.addCompanyCoins ?? 1));
  const [reviewCoins, setReviewCoins] = useState(String(config?.reviewCoins ?? 1));
  const [maintenanceFee, setMaintenanceFee] = useState(String(config?.maintenanceFee ?? 1000));
  const [phoneViewPrice, setPhoneViewPrice] = useState(String(config?.phoneViewPrice ?? 50));
  const [emailViewPrice, setEmailViewPrice] = useState(String(config?.emailViewPrice ?? 30));
  const [websiteViewPrice, setWebsiteViewPrice] = useState(String(config?.websiteViewPrice ?? 20));
  const [reviewsViewPrice, setReviewsViewPrice] = useState(String(config?.reviewsViewPrice ?? 10));
  const [ratingViewPrice, setRatingViewPrice] = useState(String(config?.ratingViewPrice ?? 10));
  const [invoiceDueDays, setInvoiceDueDays] = useState(String(config?.invoiceDueDays ?? 5));
  const [configLoading, setConfigLoading] = useState(false);
  const [configMsg, setConfigMsg] = useState("");

  async function saveConfig() {
    setConfigLoading(true);
    setConfigMsg("");
    try {
      const res = await fetch("/api/admin/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coinPriceRub: parseFloat(coinPriceRub),
          addCompanyCoins: parseFloat(addCompanyCoins),
          reviewCoins: parseFloat(reviewCoins),
          maintenanceFee: parseFloat(maintenanceFee),
          phoneViewPrice: parseFloat(phoneViewPrice),
          emailViewPrice: parseFloat(emailViewPrice),
          websiteViewPrice: parseFloat(websiteViewPrice),
          reviewsViewPrice: parseFloat(reviewsViewPrice),
          ratingViewPrice: parseFloat(ratingViewPrice),
          invoiceDueDays: parseInt(invoiceDueDays),
        }),
      });
      if (res.ok) { setConfigMsg("✅ Сохранено"); router.refresh(); }
      else { const d = await res.json(); setConfigMsg("❌ " + d.error); }
    } catch { setConfigMsg("❌ Ошибка"); }
    setConfigLoading(false);
  }

  return (
    <Card>
      <CardHeader><CardTitle>Настройка экономики</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Цена 1 монеты (₽)</Label><Input type="number" min="0" step="0.01" value={coinPriceRub} onChange={(e) => setCoinPriceRub(e.target.value)} /></div>
          <div className="space-y-2"><Label>Монет за добавление компании</Label><Input type="number" min="0" step="0.1" value={addCompanyCoins} onChange={(e) => setAddCompanyCoins(e.target.value)} /></div>
          <div className="space-y-2"><Label>Монет за отзыв</Label><Input type="number" min="0" step="0.1" value={reviewCoins} onChange={(e) => setReviewCoins(e.target.value)} /></div>
        </div>

        <p className="text-sm font-medium text-muted-foreground pt-2">Ставки биллинга компаний по умолчанию (на компанию можно задать индивидуальные)</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Абонентская плата (₽/мес)</Label><Input type="number" min="0" step="0.01" value={maintenanceFee} onChange={(e) => setMaintenanceFee(e.target.value)} /></div>
          <div className="space-y-2"><Label>Просмотр телефона (₽)</Label><Input type="number" min="0" step="0.01" value={phoneViewPrice} onChange={(e) => setPhoneViewPrice(e.target.value)} /></div>
          <div className="space-y-2"><Label>Просмотр почты (₽)</Label><Input type="number" min="0" step="0.01" value={emailViewPrice} onChange={(e) => setEmailViewPrice(e.target.value)} /></div>
          <div className="space-y-2"><Label>Просмотр сайта (₽)</Label><Input type="number" min="0" step="0.01" value={websiteViewPrice} onChange={(e) => setWebsiteViewPrice(e.target.value)} /></div>
          <div className="space-y-2"><Label>Просмотр отзывов (₽)</Label><Input type="number" min="0" step="0.01" value={reviewsViewPrice} onChange={(e) => setReviewsViewPrice(e.target.value)} /></div>
          <div className="space-y-2"><Label>Просмотр рейтинга (₽)</Label><Input type="number" min="0" step="0.01" value={ratingViewPrice} onChange={(e) => setRatingViewPrice(e.target.value)} /></div>
          <div className="space-y-2"><Label>Срок оплаты счёта (дней)</Label><Input type="number" min="1" max="90" value={invoiceDueDays} onChange={(e) => setInvoiceDueDays(e.target.value)} /></div>
        </div>
        {configMsg && <Alert><AlertDescription>{configMsg}</AlertDescription></Alert>}
        <Button onClick={saveConfig} className="bg-menthol hover:bg-menthol-dark" disabled={configLoading}>
          {configLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}Сохранить
        </Button>
      </CardContent>
    </Card>
  );
}
