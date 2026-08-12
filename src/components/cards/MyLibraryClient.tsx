"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { SearchSelect } from "@/components/shared/SearchSelect";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileText, Upload, Download, Eye, Trash2, Coins, UploadCloud } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { toastSuccess } from "@/lib/toast";

interface DocRow {
  id: string; title: string; coinPrice: number; fileUrl: string;
  fileSize: number; views: number; purchasesCount: number;
  isApproved: boolean; createdAt: Date;
}

interface PurchaseRow {
  id: string; title: string; fileUrl: string; purchasedAt: Date;
}

interface TreeItem {
  id: string; name: string; fullNumberPath: string;
}

interface Props {
  myDocs: DocRow[];
  treeItems: TreeItem[];
  purchases: PurchaseRow[];
}

export function MyLibraryClient({ myDocs, treeItems, purchases }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  function formatSize(bytes: number): string {
    if (!bytes || bytes === 0) return "—";
    if (bytes < 1024) return bytes + " Б";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " КБ";
    return (bytes / (1024 * 1024)).toFixed(1) + " МБ";
  }

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const file = fd.get("file") as File;

    if (!file || !(file instanceof File) || file.size === 0) {
      setError("Выберите PDF файл");
      setLoading(false);
      return;
    }

    try {
      // 1. Upload file
      const uploadForm = new FormData();
      uploadForm.append("file", file);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: uploadForm });
      if (!uploadRes.ok) {
        const d = await uploadRes.json();
        setError(d.error || "Ошибка загрузки файла");
        setLoading(false);
        return;
      }
      const { fileUrl, fileSize } = await uploadRes.json();

      // 2. Create document
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
        setOpen(false);
        toastSuccess("Документ загружен", "Документ отправлен на модерацию");
        router.refresh();
      }
      else { const d = await res.json(); setError(d.error || "Ошибка"); }
    } catch { setError("Ошибка соединения"); }
    setLoading(false);
  }

  async function handleDeleteDoc() {
    if (!deleteDocId) return;
    setDeleteLoading(true);
    await fetch(`/api/library/${deleteDocId}`, { method: "DELETE" });
    setDeleteDocId(null);
    setDeleteLoading(false);
    router.refresh();
  }

  return (
    <div className="space-y-8">
      {/* Upload button */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setCategory(""); }}>
        <DialogTrigger>
          <Button className="bg-menthol hover:bg-menthol-dark gap-2"><Upload className="h-4 w-4" /> Загрузить документ</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Загрузить документ</DialogTitle>
            <DialogDescription>PDF до 10 МБ. Документ пройдёт модерацию.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpload} className="space-y-4">
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
            <div className="space-y-2"><Label htmlFor="ml-title">Название</Label><Input id="ml-title" name="title" required /></div>
            <div className="space-y-2">
              <Label htmlFor="ml-classifier">Классификатор</Label>
              <SearchSelect
                name="treeItemId"
                options={[
                  { value: "", label: "Без категории" },
                  ...treeItems.map(t => ({ value: t.id, label: `${t.fullNumberPath} — ${t.name}` })),
                ]}
                value={category}
                onChange={setCategory}
                placeholder="Выберите категорию"
                searchPlaceholder="Поиск категории..."
              />
            </div>
            <div className="space-y-2"><Label htmlFor="ml-price">Цена (монет, 0 = бесплатно)</Label><Input id="ml-price" name="coinPrice" type="number" min={0} max={100} defaultValue={5} /></div>
            <div className="space-y-2"><Label htmlFor="ml-file">PDF файл (до 10 МБ)</Label><Input id="ml-file" name="file" type="file" accept=".pdf,application/pdf" required /></div>
            <Button type="submit" className="w-full bg-menthol hover:bg-menthol-dark" disabled={loading}>{loading ? "Загрузка..." : "Загрузить"}</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Uploaded */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Загруженные ({myDocs.length})</h2>
        {myDocs.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <UploadCloud className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>Вы ещё не загрузили ни одного документа</p>
          </div>
        ) : (
          <div className="space-y-3">
            {myDocs.map((doc) => (
              <Card key={doc.id}>
                <CardContent className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="h-4 w-4 text-menthol flex-shrink-0" />
                      <h3 className="font-medium truncate">{doc.title}</h3>
                      {!doc.isApproved && <Badge variant="outline" className="text-[10px] text-orange-accent">На модерации</Badge>}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {doc.views}</span>
                      <span className="flex items-center gap-1"><Download className="h-3 w-3" /> {doc.purchasesCount}</span>
                      {doc.coinPrice > 0 ? (
                        <Badge variant="secondary" className="text-[10px] gap-1"><Coins className="h-2 w-2" />{doc.coinPrice}</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-menthol">Бесплатно</Badge>
                      )}
                      <span>{formatSize(doc.fileSize)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm">Открыть</Button>
                    </a>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => setDeleteDocId(doc.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Purchased */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Приобретённые ({purchases.length})</h2>
        {purchases.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <Download className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>Вы ещё не приобрели ни одного документа</p>
          </div>
        ) : (
          <div className="space-y-3">
            {purchases.map((p) => (
              <Card key={p.id}>
                <CardContent className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-menthol flex-shrink-0" />
                      <h3 className="font-medium truncate">{p.title}</h3>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Приобретён: {new Date(p.purchasedAt).toLocaleDateString("ru-RU")}
                    </p>
                  </div>
                  <a href={p.fileUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm">Открыть</Button>
                  </a>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={!!deleteDocId}
        onOpenChange={(v) => { if (!v) setDeleteDocId(null); }}
        title="Удалить документ?"
        message="Документ будет скрыт из библиотеки."
        confirmLabel="Удалить"
        onConfirm={handleDeleteDoc}
        loading={deleteLoading}
      />
    </div>
  );
}
