"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { toastError, toastSuccess, toastWarning } from "@/lib/toast";
import { Loader2, Plus, Trash2, Gift, Package, Upload, X, Pencil } from "lucide-react";
import Image from "next/image";

interface GiftItem {
  id: string;
  name: string;
  coinPrice: number;
  limit: number;
  imageUrl: string | null;
}

interface GiftClaimItem {
  id: string;
  giftName: string;
  userNick: string;
  claimDate: Date;
  issuedAt: Date | null;
}

interface Props {
  gifts: GiftItem[];
  claims: GiftClaimItem[];
}

/**
 * Управление подарками: каталог сувениров и очередь заявок
 * на их получение (с отметкой «Выдан»).
 */
export function GiftsManager({ gifts, claims }: Props) {
  const router = useRouter();

  // Форма подарка
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

  // Заявки на получение подарков (обновляются локально после выдачи)
  const [claimsList, setClaimsList] = useState(claims);
  const [confirmClaimId, setConfirmClaimId] = useState<string | null>(null);
  const [issueLoading, setIssueLoading] = useState(false);

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

  async function handleMarkIssued() {
    if (!confirmClaimId) return;
    setIssueLoading(true);
    try {
      const res = await fetch(`/api/admin/gifts/claims/${confirmClaimId}`, {
        method: "PATCH",
      });
      if (res.ok) {
        const d = await res.json();
        setClaimsList((prev) =>
          prev.map((c) => (c.id === confirmClaimId ? { ...c, issuedAt: d.issuedAt } : c)),
        );
        toastSuccess("Подарок выдан");
        setConfirmClaimId(null);
      } else {
        const d = await res.json().catch(() => ({}));
        toastError("Ошибка", d.error || "Не удалось отметить выдачу");
        setConfirmClaimId(null);
      }
    } catch {
      toastError("Ошибка соединения");
    }
    setIssueLoading(false);
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
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
                        <Image src={giftImageUrl} alt="Фото подарка" width={48} height={48} className="h-12 w-12 rounded-md border object-cover" loading="lazy" decoding="async" />
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

          {/* Очередь заявок на получение сувениров */}
          {claimsList.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Заявки на получение ({claimsList.length})</p>
              <div className="space-y-2">
                {claimsList.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-2 py-2 border-b last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm">{c.giftName}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.userNick} · {new Date(c.claimDate).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    {c.issuedAt ? (
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge className="text-[10px] bg-menthol">Выдан</Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(c.issuedAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="text-[10px]">Ожидает выдачи</Badge>
                        <Button
                          size="sm"
                          className="bg-menthol hover:bg-menthol-dark"
                          onClick={() => setConfirmClaimId(c.id)}
                        >
                          Выдан
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!deleteGiftId}
        onOpenChange={(v) => { if (!v) setDeleteGiftId(null); }}
        title="Удалить подарок?"
        message="Подарок будет удалён из каталога."
        confirmLabel="Удалить"
        onConfirm={handleDeleteGift}
        loading={deleteGiftLoading}
      />

      <ConfirmDialog
        open={!!confirmClaimId}
        onOpenChange={(v) => { if (!v) setConfirmClaimId(null); }}
        title="Отметить подарок выданным?"
        message="После отметки заявка перейдёт в статус «Выдан»."
        confirmLabel="Выдан"
        onConfirm={handleMarkIssued}
        loading={issueLoading}
      />
    </>
  );
}
