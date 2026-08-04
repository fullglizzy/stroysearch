"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Save, Plus, Trash2, Gift } from "lucide-react";

interface BillingConfig {
  id: string;
  coinPriceRub: number;
  viewPriceRub: number;
  addCompanyCoins: number;
  reviewCoins: number;
  maxMonthlyLimit: number;
}

interface GiftItem {
  id: string;
  name: string;
  coinPrice: number;
  limit: number;
  imageUrl: string | null;
}

interface Props {
  config: BillingConfig | null;
  gifts: GiftItem[];
}

export function FinancesManager({ config, gifts }: Props) {
  const router = useRouter();
  const [coinPriceRub, setCoinPriceRub] = useState(String(config?.coinPriceRub ?? 100));
  const [viewPriceRub, setViewPriceRub] = useState(String(config?.viewPriceRub ?? 100));
  const [addCompanyCoins, setAddCompanyCoins] = useState(String(config?.addCompanyCoins ?? 1));
  const [reviewCoins, setReviewCoins] = useState(String(config?.reviewCoins ?? 1));
  const [maxMonthlyLimit, setMaxMonthlyLimit] = useState(String(config?.maxMonthlyLimit ?? 1000));
  const [configLoading, setConfigLoading] = useState(false);
  const [configMsg, setConfigMsg] = useState("");

  // Gift form
  const [giftName, setGiftName] = useState("");
  const [giftPrice, setGiftPrice] = useState("");
  const [giftLimit, setGiftLimit] = useState("");
  const [giftLoading, setGiftLoading] = useState(false);

  async function saveConfig() {
    setConfigLoading(true);
    setConfigMsg("");
    try {
      const res = await fetch("/api/admin/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coinPriceRub: parseFloat(coinPriceRub),
          viewPriceRub: parseFloat(viewPriceRub),
          addCompanyCoins: parseFloat(addCompanyCoins),
          reviewCoins: parseFloat(reviewCoins),
          maxMonthlyLimit: parseFloat(maxMonthlyLimit),
        }),
      });
      if (res.ok) { setConfigMsg("✅ Сохранено"); router.refresh(); }
      else { const d = await res.json(); setConfigMsg("❌ " + d.error); }
    } catch { setConfigMsg("❌ Ошибка"); }
    setConfigLoading(false);
  }

  async function addGift(e: React.FormEvent) {
    e.preventDefault();
    setGiftLoading(true);
    try {
      const res = await fetch("/api/admin/gifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: giftName,
          coinPrice: parseInt(giftPrice),
          limit: parseInt(giftLimit),
        }),
      });
      if (res.ok) {
        setGiftName(""); setGiftPrice(""); setGiftLimit("");
        router.refresh();
      }
    } catch { alert("Ошибка"); }
    setGiftLoading(false);
  }

  async function deleteGift(id: string) {
    if (!confirm("Удалить подарок?")) return;
    await fetch(`/api/admin/gifts?id=${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <Tabs defaultValue="economy">
      <TabsList className="mb-6">
        <TabsTrigger value="economy">Экономика</TabsTrigger>
        <TabsTrigger value="gifts">Подарки</TabsTrigger>
      </TabsList>

      <TabsContent value="economy">
        <Card>
          <CardHeader><CardTitle>Настройка экономики</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Цена 1 монеты (₽)</Label><Input type="number" value={coinPriceRub} onChange={(e) => setCoinPriceRub(e.target.value)} /></div>
              <div className="space-y-2"><Label>Цена 1 просмотра (₽)</Label><Input type="number" value={viewPriceRub} onChange={(e) => setViewPriceRub(e.target.value)} /></div>
              <div className="space-y-2"><Label>Монет за добавление компании</Label><Input type="number" value={addCompanyCoins} onChange={(e) => setAddCompanyCoins(e.target.value)} /></div>
              <div className="space-y-2"><Label>Монет за отзыв</Label><Input type="number" value={reviewCoins} onChange={(e) => setReviewCoins(e.target.value)} /></div>
              <div className="space-y-2"><Label>Предельный лимит счёта (₽/мес)</Label><Input type="number" value={maxMonthlyLimit} onChange={(e) => setMaxMonthlyLimit(e.target.value)} /></div>
            </div>
            {configMsg && <Alert><AlertDescription>{configMsg}</AlertDescription></Alert>}
            <Button onClick={saveConfig} className="bg-menthol hover:bg-menthol-dark" disabled={configLoading}>
              {configLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}Сохранить
            </Button>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="gifts">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Gift className="h-5 w-5 text-orange-accent" /> Управление подарками</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={addGift} className="flex gap-3 items-end flex-wrap">
              <div className="space-y-1"><Label>Название</Label><Input value={giftName} onChange={(e) => setGiftName(e.target.value)} placeholder="Сувенир" required /></div>
              <div className="space-y-1"><Label>Цена (мон.)</Label><Input type="number" value={giftPrice} onChange={(e) => setGiftPrice(e.target.value)} placeholder="10" required className="w-24" /></div>
              <div className="space-y-1"><Label>Лимит</Label><Input type="number" value={giftLimit} onChange={(e) => setGiftLimit(e.target.value)} placeholder="100" required className="w-24" /></div>
              <Button type="submit" className="bg-menthol hover:bg-menthol-dark" disabled={giftLoading}>
                <Plus className="h-4 w-4 mr-1" /> Добавить
              </Button>
            </form>

            {gifts.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">Нет подарков</p>
            ) : (
              <div className="space-y-2">
                {gifts.map((g) => (
                  <div key={g.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="font-medium text-sm">{g.name}</p>
                      <p className="text-xs text-muted-foreground">{g.coinPrice} монет • лимит: {g.limit}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="text-red-500" onClick={() => deleteGift(g.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
