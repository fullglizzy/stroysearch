"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Search, FileText, Download, Upload, Coins, Eye, CheckCircle, AlertCircle } from "lucide-react";

interface DocRow {
  id: string;
  title: string;
  treeItemPath: string | null;
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
  bannerUrl: string | null;
  purchasedDocIds: string[];
}

export function LibraryPageClient({ documents, treeItems, moderatorText, bannerUrl, purchasedDocIds }: Props) {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [classifier, setClassifier] = useState(searchParams.get("classifier") || "");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadLoading, setUploadLoading] = useState(false);

  const currentClassifierName = classifier ? treeItems.find(t => t.fullNumberPath === classifier)?.name : null;
  const [buyLoading, setBuyLoading] = useState<string | null>(null);
  const [buyTarget, setBuyTarget] = useState<{ id: string; title: string; price: number } | null>(null);
  const [buyError, setBuyError] = useState("");

  const filtered = documents.filter((d) => {
    if (search && !d.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (classifier && d.treeItemPath !== classifier) return false;
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
          coinPrice: parseInt(fd.get("coinPrice") as string) || 5,
          fileUrl,
          fileSize,
        }),
      });
      if (res.ok) { setUploadOpen(false); router.refresh(); }
      else { const d = await res.json(); setUploadError(d.error || "Ошибка"); }
    } catch { setUploadError("Ошибка соединения"); }
    setUploadLoading(false);
  }

  async function handleBuy(docId: string, docTitle: string, coinPrice: number) {
    if (!session?.user) { router.push("/login"); return; }
    setBuyTarget({ id: docId, title: docTitle, price: coinPrice });
  }

  async function confirmBuy() {
    if (!buyTarget) return;
    setBuyLoading(buyTarget.id);
    try {
      const res = await fetch(`/api/library/${buyTarget.id}/purchase`, { method: "POST" });
      if (res.ok) {
        setBuyTarget(null);
        setBuyError("");
        router.refresh();
      } else {
        const d = await res.json();
        setBuyError(d.error || "Ошибка покупки");
      }
    } catch { setBuyError("Ошибка соединения"); }
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

        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <DialogTrigger>
            <Button className="bg-menthol hover:bg-menthol-dark gap-2"><Upload className="h-4 w-4" /> Загрузить документ</Button>
          </DialogTrigger>
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
                <Select name="treeItemId">
                  <SelectTrigger><SelectValue placeholder="Выберите категорию" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Без категории</SelectItem>
                    {treeItems.map((t) => <SelectItem key={t.id} value={t.id}>{t.fullNumberPath} — {t.name.slice(0, 50)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label htmlFor="coinPrice">Цена (монет)</Label><Input id="coinPrice" name="coinPrice" type="number" min={1} max={100} defaultValue={5} /></div>
              <div className="space-y-2"><Label htmlFor="lib-file">PDF файл (до 10 МБ)</Label><Input id="lib-file" name="file" type="file" accept=".pdf,application/pdf" required /></div>
              <Button type="submit" className="w-full bg-menthol hover:bg-menthol-dark" disabled={uploadLoading}>{uploadLoading ? "Загрузка..." : "Загрузить"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Info banner */}
      <div className="bg-menthol/5 border border-menthol/20 rounded-lg p-3 mb-4 flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-menthol flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-menthol">Как пользоваться библиотекой</p>
          <p className="text-muted-foreground">
            <strong>Загрузите</strong> свой документ (PDF до 10 МБ) и установите цену в монетах.
            После одобрения модератором документ появится в общем доступе.
            <strong>Приобретайте</strong> документы других участников за монеты.
          </p>
        </div>
      </div>

      {bannerUrl && <div className="mb-6 rounded-lg overflow-hidden"><img src={bannerUrl} alt="Баннер библиотеки" className="w-full h-auto max-h-48 object-cover" /></div>}
      {moderatorText && <div className="prose prose-gray max-w-none text-muted-foreground mb-6 text-sm" dangerouslySetInnerHTML={{ __html: moderatorText }} />}

      {buyError && <Alert variant="destructive" className="mb-4"><AlertDescription>{buyError}</AlertDescription></Alert>}

      <Card className="mb-6">
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Поиск по названию..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={classifier} onValueChange={(v) => setClassifier(v || "")}>
              <SelectTrigger><SelectValue placeholder="Все категории" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Все категории</SelectItem>
                {treeItems.map((t) => <SelectItem key={t.id} value={t.fullNumberPath}>{t.fullNumberPath} — {t.name.slice(0, 40)}</SelectItem>)}
              </SelectContent>
            </Select>
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
                    {doc.treeItemPath && <Badge variant="secondary" className="text-[10px] font-mono">{doc.treeItemPath}</Badge>}
                    <span>{formatSize(doc.fileSize)}</span>
                    <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {doc.views}</span>
                    <span className="flex items-center gap-1"><Download className="h-3 w-3" /> {doc.purchasesCount}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <Badge variant="secondary" className="gap-1"><Coins className="h-3 w-3" /> {doc.coinPrice}</Badge>
                  {purchasedDocIds.includes(doc.id) ? (
                    <div className="flex items-center gap-2">
                      <Badge className="bg-green-100 text-green-700 gap-1"><CheckCircle className="h-3 w-3" /> Куплено</Badge>
                      <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="outline" className="gap-1"><Download className="h-3 w-3" /> Открыть</Button>
                      </a>
                    </div>
                  ) : (
                    <Button size="sm" className="bg-orange-accent hover:bg-orange-accent/90" onClick={() => handleBuy(doc.id, doc.title, doc.coinPrice)} disabled={buyLoading === doc.id}>
                      Приобрести
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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
