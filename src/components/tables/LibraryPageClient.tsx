"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MultiSelect } from "@/components/shared/MultiSelect";
import { SearchSelect } from "@/components/shared/SearchSelect";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useAuthGuard } from "@/components/shared/useAuthGuard";
import { GuestGuard } from "@/components/shared/GuestGuard";
import { Search, FileText, Download, Upload, Coins, CheckCircle, AlertCircle } from "lucide-react";
import { toastSuccess, toastError } from "@/lib/toast";
import { PageBanner } from "@/components/shared/PageBanner";

interface DocRow {
  id: string;
  title: string;
  treeItemPath: string | null;
  treeItemName: string | null;
  coinPrice: number;
  uploaderName: string;
  fileSize: number;
  fileUrl: string;
  views: number;
  purchasesCount: number;
}

interface TreeItem {
  id: string;
  name: string;
  fullNumberPath: string;
}

interface Props {
  documents: DocRow[];
  treeItems: TreeItem[];
  moderatorText: string | null;
  pageTitle: string | null;
  bannerUrl: string | null;
  purchasedDocIds: string[];
}

export function LibraryPageClient({ documents, treeItems, moderatorText, pageTitle, bannerUrl, purchasedDocIds }: Props) {
  const { data: session } = useSession();
  const router = useRouter();
  const { guard, dialog: authDialog } = useAuthGuard();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const initialClassifiers = searchParams.get("classifier")?.split(",").filter(Boolean) || [];
  const [classifiers, setClassifiers] = useState<string[]>(initialClassifiers);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadCategory, setUploadCategory] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [uploadLoading, setUploadLoading] = useState(false);

  const [buyLoading, setBuyLoading] = useState<string | null>(null);
  const [buyTarget, setBuyTarget] = useState<{ id: string; title: string; price: number } | null>(null);
  const [buyError, setBuyError] = useState("");

  const filtered = documents.filter((d) => {
    if (search && !d.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (classifiers.length > 0 && (!d.treeItemPath || !classifiers.includes(d.treeItemPath))) return false;
    return true;
  });

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!session?.user) { setUploadError("Требуется авторизация"); return; }
    setUploadLoading(true);
    setUploadError("");

    const fd = new FormData(e.currentTarget);
    const file = fd.get("file") as File;
    if (!file || !(file instanceof File) || file.size === 0) {
      setUploadError("Выберите PDF файл");
      setUploadLoading(false);
      return;
    }

    try {
      const uploadForm = new FormData();
      uploadForm.append("file", file);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: uploadForm });
      if (!uploadRes.ok) { const d = await uploadRes.json(); setUploadError(d.error || "Ошибка загрузки"); setUploadLoading(false); return; }
      const { fileUrl, fileSize } = await uploadRes.json();

      const res = await fetch("/api/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: fd.get("title"),
          treeItemId: fd.get("treeItemId") || null,
          // 0 = бесплатно, поэтому нельзя использовать `|| 5`
          coinPrice: (() => {
            const price = parseInt(fd.get("coinPrice") as string, 10);
            return Number.isFinite(price) ? Math.max(0, price) : 5;
          })(),
          fileUrl,
          fileSize,
        }),
      });
      if (res.ok) {
        setUploadOpen(false);
        toastSuccess("Документ загружен", "Документ отправлен на модерацию");
        router.refresh();
      }
      else { const d = await res.json(); setUploadError(d.error || "Ошибка"); }
    } catch { setUploadError("Ошибка соединения"); }
    setUploadLoading(false);
  }

  async function handleBuy(docId: string, docTitle: string, coinPrice: number) {
    setBuyTarget({ id: docId, title: docTitle, price: coinPrice });
  }

  const guardedBuy = guard(handleBuy);

  async function confirmBuy() {
    if (!buyTarget) return;
    setBuyLoading(buyTarget.id);
    try {
      const res = await fetch(`/api/library/${buyTarget.id}/purchase`, { method: "POST" });
      if (res.ok) {
        toastSuccess("Документ приобретён!", `«${buyTarget.title}» открыт в вашей библиотеке`);
        setBuyTarget(null);
        setBuyError("");
        router.refresh();
      } else {
        const d = await res.json();
        setBuyError(d.error || "Ошибка покупки");
        toastError("Ошибка", d.error || "Не удалось приобрести документ");
        setBuyTarget(null);
      }
    } catch {
      setBuyError("Ошибка соединения");
      toastError("Ошибка соединения");
    }
    setBuyLoading(null);
  }

  function formatSize(bytes: number): string {
    if (!bytes || bytes === 0) return "—";
    if (bytes < 1024) return bytes + " Б";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " КБ";
    return (bytes / (1024 * 1024)).toFixed(1) + " МБ";
  }

  return (
    <div className="container-page py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">Библиотека технических заданий</h1>
          <p className="text-muted-foreground mt-1">Загружайте и приобретайте документы за монеты</p>
        </div>

        {/* GuestGuard и его диалог стоят ВНЕ корня Dialog формы загрузки:
            вложенные диалоги Base UI рендерит без оверлея */}
        <GuestGuard actionLabel="Загрузить документ">
          <Button
            className="bg-menthol hover:bg-menthol-dark gap-2"
            onClick={() => setUploadOpen(true)}
          >
            <Upload className="h-4 w-4" /> Загрузить документ
          </Button>
        </GuestGuard>
        <Dialog open={uploadOpen} onOpenChange={(v) => { setUploadOpen(v); if (!v) setUploadCategory(""); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Загрузить документ</DialogTitle>
              <DialogDescription>PDF до 10 МБ. Документ пройдёт модерацию.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpload} className="space-y-4">
              {uploadError && <Alert variant="destructive"><AlertDescription>{uploadError}</AlertDescription></Alert>}
              <div className="space-y-2"><Label htmlFor="title">Название документа</Label><Input id="title" name="title" placeholder="ТЗ на фасадные работы" required /></div>
              <div className="space-y-2">
                <Label htmlFor="treeItemId">Классификатор</Label>
                <SearchSelect
                  name="treeItemId"
                  options={[
                    { value: "", label: "Без категории" },
                    ...treeItems.map(t => ({ value: t.id, label: `${t.fullNumberPath} — ${t.name}` })),
                  ]}
                  value={uploadCategory}
                  onChange={setUploadCategory}
                  placeholder="Выберите категорию"
                  searchPlaceholder="Поиск категории..."
                />
              </div>
              <div className="space-y-2"><Label htmlFor="coinPrice">Цена (монет, 0 = бесплатно)</Label><Input id="coinPrice" name="coinPrice" type="number" min={0} max={100} defaultValue={5} /></div>
              <div className="space-y-2"><Label htmlFor="lib-file">PDF файл (до 10 МБ)</Label><Input id="lib-file" name="file" type="file" accept=".pdf,application/pdf" required /></div>
              <Button type="submit" className="w-full bg-menthol hover:bg-menthol-dark" disabled={uploadLoading}>{uploadLoading ? "Загрузка..." : "Загрузить"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Info banner */}
      {(pageTitle || moderatorText) && (
        <div className="bg-menthol/5 border border-menthol/20 rounded-lg p-3 mb-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-menthol flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            {pageTitle && <p className="font-medium text-menthol">{pageTitle}</p>}
            {moderatorText && (
              <div className="text-muted-foreground" dangerouslySetInnerHTML={{ __html: moderatorText }} />
            )}
          </div>
        </div>
      )}

      {bannerUrl && <PageBanner url={bannerUrl} alt="Баннер библиотеки" />}

      {buyError && <Alert variant="destructive" className="mb-4"><AlertDescription>{buyError}</AlertDescription></Alert>}

      <Card className="mb-6">
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Поиск по названию..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <MultiSelect
              options={treeItems.map((t) => ({ value: t.fullNumberPath, label: `${t.fullNumberPath} — ${t.name}` }))}
              value={classifiers}
              onChange={setClassifiers}
              placeholder="Все категории"
              searchPlaceholder="Поиск категории..."
            />
          </div>
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <div className="border rounded-lg p-12 text-center text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg">Документы не найдены</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((doc) => (
            <Card key={doc.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="h-4 w-4 text-menthol flex-shrink-0" />
                    <h3 className="font-medium truncate">{doc.title}</h3>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{doc.uploaderName}</span>
                    {doc.treeItemPath && <Badge variant="secondary" className="text-[10px]">{doc.treeItemPath}{doc.treeItemName ? ` — ${doc.treeItemName}` : ""}</Badge>}
                    <span>{formatSize(doc.fileSize)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {doc.coinPrice > 0 ? (
                    <Badge variant="secondary" className="gap-1"><Coins className="h-3 w-3" /> {doc.coinPrice}</Badge>
                  ) : (
                    <Badge variant="outline" className="text-menthol">Бесплатно</Badge>
                  )}
                  {purchasedDocIds.includes(doc.id) ? (
                    <div className="flex items-center gap-2">
                      <Badge className="bg-green-100 text-green-700 gap-1"><CheckCircle className="h-3 w-3" /> Куплено</Badge>
                      <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="outline" className="gap-1"><Download className="h-3 w-3" /> Открыть</Button>
                      </a>
                    </div>
                  ) : doc.coinPrice === 0 ? (
                    <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="gap-1"><Download className="h-3 w-3" /> Открыть</Button>
                    </a>
                  ) : (
                    <Button size="sm" className="bg-orange-accent hover:bg-orange-accent/90" onClick={() => guardedBuy(doc.id, doc.title, doc.coinPrice)} disabled={buyLoading === doc.id}>
                      Приобрести
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {authDialog}

      <ConfirmDialog
        open={!!buyTarget}
        onOpenChange={(v) => { if (!v) setBuyTarget(null); }}
        title="Приобрести документ?"
        message={buyTarget ? `Документ «${buyTarget.title}» за ${buyTarget.price} монет. Монеты спишутся с вашего счёта.` : ""}
        variant="info"
        confirmLabel="Приобрести"
        onConfirm={confirmBuy}
        loading={!!buyLoading}
      />
    </div>
  );
}
