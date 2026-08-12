"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ImagePreview } from "@/components/shared/ImagePreview";
import { toastError, toastWarning } from "@/lib/toast";
import { Loader2, Save, Plus, Trash2, Gift, Package, Upload, X } from "lucide-react";

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
  const [giftOpen, setGiftOpen] = useState(false);
  const [giftName, setGiftName] = useState("");
  const [giftPrice, setGiftPrice] = useState("");
  const [giftLimit, setGiftLimit] = useState("");
  const [giftImageUrl, setGiftImageUrl] = useState("");
  const [giftPhotoLoading, setGiftPhotoLoading] = useState(false);
  const [giftLoading, setGiftLoading] = useState(false);
  const giftPhotoInputRef = useRef<HTMLInputElement>(null);
  const [deleteGiftId, setDeleteGiftId] = useState<string | null>(null);
  const [deleteGiftLoading, setDeleteGiftLoading] = useState(false);
  const [giftError, setGiftError] = useState("");

  async function handleGiftPhoto(file: File) {
    if (!file.type.startsWith("image/")) {
      toastWarning("Проверьте файл", "Фото должно быть изображением");
      return;
    }
    setGiftPhotoLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setGiftImageUrl(data.fileUrl);
      } else {
        toastError("Ошибка загрузки", data.error || "Не удалось загрузить фото");
      }
    } catch {
      toastError("Ошибка соединения");
    }
    setGiftPhotoLoading(false);
  }

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
    setGiftError("");
    try {
      const res = await fetch("/api/admin/gifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: giftName,
          coinPrice: parseInt(giftPrice),
          limit: parseInt(giftLimit),
          imageUrl: giftImageUrl || null,
        }),
      });
      if (res.ok) {
        setGiftOpen(false);
        setGiftName(""); setGiftPrice(""); setGiftLimit(""); setGiftImageUrl("");
        setGiftError("");
        router.refresh();
      } else {
        const d = await res.json();
        setGiftError(d.error || "Ошибка");
      }
    } catch { setGiftError("Ошибка соединения"); }
    setGiftLoading(false);
  }

  async function handleDeleteGift() {
    if (!deleteGiftId) return;
    setDeleteGiftLoading(true);
    await fetch(`/api/admin/gifts?id=${deleteGiftId}`, { method: "DELETE" });
    setDeleteGiftId(null);
    setDeleteGiftLoading(false);
    router.refresh();
  }

  return (
    <>
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
              <div className="space-y-2"><Label>Цена 1 монеты (₽)</Label><Input type="number" min="0" step="0.01" value={coinPriceRub} onChange={(e) => setCoinPriceRub(e.target.value)} /></div>
              <div className="space-y-2"><Label>Цена 1 просмотра (₽)</Label><Input type="number" min="0" step="0.01" value={viewPriceRub} onChange={(e) => setViewPriceRub(e.target.value)} /></div>
              <div className="space-y-2"><Label>Монет за добавление компании</Label><Input type="number" min="0" step="0.1" value={addCompanyCoins} onChange={(e) => setAddCompanyCoins(e.target.value)} /></div>
              <div className="space-y-2"><Label>Монет за отзыв</Label><Input type="number" min="0" step="0.1" value={reviewCoins} onChange={(e) => setReviewCoins(e.target.value)} /></div>
              <div className="space-y-2"><Label>Предельный лимит счёта (₽/мес)</Label><Input type="number" min="0" step="0.01" value={maxMonthlyLimit} onChange={(e) => setMaxMonthlyLimit(e.target.value)} /></div>
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
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2"><Gift className="h-5 w-5 text-orange-accent" /> Управление подарками</CardTitle>
            <Dialog open={giftOpen} onOpenChange={(o) => {
              setGiftOpen(o);
              if (!o) { setGiftError(""); setGiftName(""); setGiftPrice(""); setGiftLimit(""); setGiftImageUrl(""); }
            }}>
              <DialogTrigger>
                <Button className="bg-menthol hover:bg-menthol-dark gap-2" onClick={() => setGiftError("")}>
                  <Plus className="h-4 w-4" />
                  Добавить подарок
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Новый подарок</DialogTitle>
                  <DialogDescription>
                    Подарок появится в разделе «Сувениры» у пользователей
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={addGift} className="space-y-4">
                  {giftError && (
                    <Alert variant="destructive">
                      <AlertDescription>{giftError}</AlertDescription>
                    </Alert>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="gift-name">Название</Label>
                    <Input id="gift-name" value={giftName} onChange={(e) => setGiftName(e.target.value)} placeholder="Сувенир" required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="gift-price">Цена (мон.)</Label>
                      <Input id="gift-price" type="number" min="1" value={giftPrice} onChange={(e) => setGiftPrice(e.target.value)} placeholder="10" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="gift-limit">Лимит</Label>
                      <Input id="gift-limit" type="number" min="0" value={giftLimit} onChange={(e) => setGiftLimit(e.target.value)} placeholder="100" required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Фото подарка</Label>
                    <input
                      ref={giftPhotoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleGiftPhoto(file);
                        e.target.value = "";
                      }}
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => giftPhotoInputRef.current?.click()}
                        disabled={giftPhotoLoading}
                      >
                        {giftPhotoLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Upload className="h-4 w-4 mr-2" />
                        )}
                        {giftImageUrl ? "Заменить фото" : "Загрузить фото"}
                      </Button>
                      {giftImageUrl && (
                        <>
                          <img src={giftImageUrl} alt="Фото подарка" className="h-12 w-12 rounded-md border object-cover" />
                          <Button type="button" variant="ghost" size="sm" onClick={() => setGiftImageUrl("")}>
                            <X className="h-4 w-4 mr-1" />
                            Убрать
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  <Button type="submit" className="w-full bg-menthol hover:bg-menthol-dark" disabled={giftLoading}>
                    {giftLoading ? "Создание..." : "Создать подарок"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="space-y-6">
            {gifts.length === 0 ? (
              <div className="border rounded-lg p-8 text-center text-muted-foreground">
                <Package className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>Нет подарков</p>
                <p className="text-xs mt-1">Добавьте сувениры для участников</p>
              </div>
            ) : (
              <div className="space-y-2">
                {gifts.map((g) => (
                  <div key={g.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex items-center gap-3">
                      {g.imageUrl ? (
                        <ImagePreview
                          src={g.imageUrl}
                          alt={g.name}
                          className="h-12 w-12 rounded-md border shrink-0"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-md bg-secondary flex items-center justify-center shrink-0">
                          <Gift className="h-5 w-5 text-orange-accent" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-sm">{g.name}</p>
                        <p className="text-xs text-muted-foreground">{g.coinPrice} монет • лимит: {g.limit}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="text-red-500" onClick={() => setDeleteGiftId(g.id)}>
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

    <ConfirmDialog
      open={!!deleteGiftId}
      onOpenChange={(v) => { if (!v) setDeleteGiftId(null); }}
      title="Удалить подарок?"
      message="Подарок будет удалён из каталога."
      confirmLabel="Удалить"
      onConfirm={handleDeleteGift}
      loading={deleteGiftLoading}
    />
  </>
);
}
