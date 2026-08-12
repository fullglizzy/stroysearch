"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
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
import { Loader2, Save, Plus, Trash2, Gift, Package, Upload, X, Pencil } from "lucide-react";

interface BillingConfig {
  id: string;
  coinPriceRub: number;
  addCompanyCoins: number;
  reviewCoins: number;
  maxMonthlyLimit: number;
  vatRate: number;
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
  const [addCompanyCoins, setAddCompanyCoins] = useState(String(config?.addCompanyCoins ?? 1));
  const [reviewCoins, setReviewCoins] = useState(String(config?.reviewCoins ?? 1));
  const [maxMonthlyLimit, setMaxMonthlyLimit] = useState(String(config?.maxMonthlyLimit ?? 1000));
  const [configLoading, setConfigLoading] = useState(false);
  const [configMsg, setConfigMsg] = useState("");

  // Шаблон счёта
  const [tplOrgName, setTplOrgName] = useState(config?.organizationName || "");
  const [tplOrgInn, setTplOrgInn] = useState(config?.organizationInn || "");
  const [tplOrgKpp, setTplOrgKpp] = useState(config?.organizationKpp || "");
  const [tplOrgAddress, setTplOrgAddress] = useState(config?.organizationAddress || "");
  const [tplBankName, setTplBankName] = useState(config?.bankName || "");
  const [tplBankBik, setTplBankBik] = useState(config?.bankBik || "");
  const [tplBankAccount, setTplBankAccount] = useState(config?.bankAccount || "");
  const [tplBankCorr, setTplBankCorr] = useState(config?.bankCorrAccount || "");
  const [tplDirector, setTplDirector] = useState(config?.directorName || "");
  const [tplVatRate, setTplVatRate] = useState(String(config?.vatRate ?? 0));
  const [tplBasis, setTplBasis] = useState(config?.invoiceBasis || "");
  const [tplLoading, setTplLoading] = useState(false);
  const [tplMsg, setTplMsg] = useState("");

  // Gift form
  const [giftOpen, setGiftOpen] = useState(false);
  const [editingGiftId, setEditingGiftId] = useState<string | null>(null);
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

  function resetGiftForm() {
    setEditingGiftId(null);
    setGiftName("");
    setGiftPrice("");
    setGiftLimit("");
    setGiftImageUrl("");
    setGiftError("");
  }

  function openCreateGift() {
    resetGiftForm();
    setGiftOpen(true);
  }

  function openEditGift(g: GiftItem) {
    setEditingGiftId(g.id);
    setGiftName(g.name);
    setGiftPrice(String(g.coinPrice));
    setGiftLimit(String(g.limit));
    setGiftImageUrl(g.imageUrl || "");
    setGiftError("");
    setGiftOpen(true);
  }

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

  async function saveTemplate() {
    setTplLoading(true);
    setTplMsg("");
    try {
      const res = await fetch("/api/admin/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationName: tplOrgName,
          organizationInn: tplOrgInn,
          organizationKpp: tplOrgKpp,
          organizationAddress: tplOrgAddress,
          bankName: tplBankName,
          bankBik: tplBankBik,
          bankAccount: tplBankAccount,
          bankCorrAccount: tplBankCorr,
          directorName: tplDirector,
          vatRate: parseFloat(tplVatRate) || 0,
          invoiceBasis: tplBasis,
        }),
      });
      if (res.ok) { setTplMsg("✅ Сохранено"); router.refresh(); }
      else { const d = await res.json(); setTplMsg("❌ " + d.error); }
    } catch { setTplMsg("❌ Ошибка"); }
    setTplLoading(false);
  }

  async function submitGift(e: React.FormEvent) {
    e.preventDefault();
    setGiftLoading(true);
    setGiftError("");
    try {
      const res = await fetch("/api/admin/gifts", {
        method: editingGiftId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingGiftId || undefined,
          name: giftName,
          coinPrice: parseInt(giftPrice),
          limit: parseInt(giftLimit),
          imageUrl: giftImageUrl || null,
        }),
      });
      if (res.ok) {
        setGiftOpen(false);
        resetGiftForm();
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
        <TabsTrigger value="template">Шаблон счёта</TabsTrigger>
        <TabsTrigger value="gifts">Подарки</TabsTrigger>
      </TabsList>

      <TabsContent value="economy">
        <Card>
          <CardHeader><CardTitle>Настройка экономики</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Цена 1 монеты (₽)</Label><Input type="number" min="0" step="0.01" value={coinPriceRub} onChange={(e) => setCoinPriceRub(e.target.value)} /></div>
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

      <TabsContent value="template">
        <Card>
          <CardHeader><CardTitle>Шаблон счёта</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Организация (продавец)</Label><Input value={tplOrgName} onChange={(e) => setTplOrgName(e.target.value)} placeholder="ООО «ЕЦПР»" /></div>
              <div className="space-y-2"><Label>ИНН организации</Label><Input value={tplOrgInn} onChange={(e) => setTplOrgInn(e.target.value)} placeholder="7700000001" /></div>
              <div className="space-y-2"><Label>КПП</Label><Input value={tplOrgKpp} onChange={(e) => setTplOrgKpp(e.target.value)} placeholder="770001001" /></div>
              <div className="space-y-2"><Label>Адрес организации</Label><Input value={tplOrgAddress} onChange={(e) => setTplOrgAddress(e.target.value)} placeholder="г. Москва, ул. Строителей, д. 1" /></div>
              <div className="space-y-2"><Label>Банк</Label><Input value={tplBankName} onChange={(e) => setTplBankName(e.target.value)} placeholder="ПАО Сбербанк" /></div>
              <div className="space-y-2"><Label>БИК</Label><Input value={tplBankBik} onChange={(e) => setTplBankBik(e.target.value)} placeholder="044525225" /></div>
              <div className="space-y-2"><Label>Расчётный счёт</Label><Input value={tplBankAccount} onChange={(e) => setTplBankAccount(e.target.value)} placeholder="40702810000000000001" /></div>
              <div className="space-y-2"><Label>Корр. счёт</Label><Input value={tplBankCorr} onChange={(e) => setTplBankCorr(e.target.value)} placeholder="30101810400000000225" /></div>
              <div className="space-y-2"><Label>Подписант (ФИО)</Label><Input value={tplDirector} onChange={(e) => setTplDirector(e.target.value)} placeholder="Кокорев Кирилл Владимирович" /></div>
              <div className="space-y-2">
                <Label>Ставка НДС</Label>
                <Select value={tplVatRate} items={{ "0": "Без НДС", "20": "20%" }} onValueChange={(v) => setTplVatRate(v || "0")}>
                  <SelectTrigger className="w-full justify-between"><SelectValue placeholder="Ставка НДС" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0" label="Без НДС">Без НДС</SelectItem>
                    <SelectItem value="20" label="20%">20%</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Основание в счёте</Label>
                <Input value={tplBasis} onChange={(e) => setTplBasis(e.target.value)} placeholder="Договор №1 от 01.01.2026" />
              </div>
            </div>
            {tplMsg && <Alert><AlertDescription>{tplMsg}</AlertDescription></Alert>}
            <Button onClick={saveTemplate} className="bg-menthol hover:bg-menthol-dark" disabled={tplLoading}>
              {tplLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}Сохранить шаблон
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
              if (!o) resetGiftForm();
            }}>
              <DialogTrigger>
                <Button className="bg-menthol hover:bg-menthol-dark gap-2" onClick={openCreateGift}>
                  <Plus className="h-4 w-4" />
                  Добавить подарок
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>{editingGiftId ? "Изменить подарок" : "Новый подарок"}</DialogTitle>
                  <DialogDescription>
                    {editingGiftId
                      ? "Изменения сразу применятся к подарку в каталоге"
                      : "Подарок появится в разделе «Сувениры» у пользователей"}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={submitGift} className="space-y-4">
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
                          <img src={giftImageUrl} alt="Фото подарка" className="h-12 w-12 rounded-md border object-cover" loading="lazy" decoding="async" />
                          <Button type="button" variant="ghost" size="sm" onClick={() => setGiftImageUrl("")}>
                            <X className="h-4 w-4 mr-1" />
                            Убрать
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  <Button type="submit" className="w-full bg-menthol hover:bg-menthol-dark" disabled={giftLoading}>
                    {giftLoading ? "Сохранение..." : editingGiftId ? "Сохранить изменения" : "Создать подарок"}
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
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEditGift(g)} title="Изменить">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-red-500" onClick={() => setDeleteGiftId(g.id)} title="Удалить">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
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
