"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { Search, FileText, Download, Upload, Coins, Eye } from "lucide-react";

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
}

export function LibraryPageClient({ documents, treeItems }: Props) {
  const { data: session } = useSession();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [classifier, setClassifier] = useState("all");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadLoading, setUploadLoading] = useState(false);
  const [buyLoading, setBuyLoading] = useState<string | null>(null);

  const filtered = documents.filter((d) => {
    if (search && !d.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (classifier !== "all" && d.treeItemPath !== classifier) return false;
    return true;
  });

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!session?.user) {
      setUploadError("Требуется авторизация");
      return;
    }
    setUploadLoading(true);
    setUploadError("");

    const formData = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.get("title"),
          treeItemId: formData.get("treeItemId") || null,
          coinPrice: parseInt(formData.get("coinPrice") as string) || 5,
          fileUrl: formData.get("fileUrl"),
          fileSize: parseInt(formData.get("fileSize") as string) || 0,
        }),
      });

      if (res.ok) {
        setUploadOpen(false);
        router.refresh();
      } else {
        const d = await res.json();
        setUploadError(d.error || "Ошибка");
      }
    } catch {
      setUploadError("Ошибка соединения");
    }
    setUploadLoading(false);
  }

  async function handleBuy(docId: string) {
    if (!session?.user) {
      router.push("/login");
      return;
    }
    setBuyLoading(docId);
    try {
      const res = await fetch(`/api/library/${docId}/purchase`, { method: "POST" });
      if (res.ok) {
        router.refresh();
      } else {
        const d = await res.json();
        alert(d.error || "Ошибка покупки");
      }
    } catch {
      alert("Ошибка соединения");
    }
    setBuyLoading(null);
  }

  function formatSize(bytes: number): string {
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
            <Button className="bg-menthol hover:bg-menthol-dark gap-2">
              <Upload className="h-4 w-4" /> Загрузить документ
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Загрузить документ</DialogTitle>
              <DialogDescription>
                Загрузите техническое задание или спецификацию. PDF до 10 МБ.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpload} className="space-y-4">
              {uploadError && (
                <Alert variant="destructive"><AlertDescription>{uploadError}</AlertDescription></Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="title">Название документа</Label>
                <Input id="title" name="title" placeholder="ТЗ на фасадные работы" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="treeItemId">Классификатор</Label>
                <Select name="treeItemId">
                  <SelectTrigger><SelectValue placeholder="Выберите категорию" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Без категории</SelectItem>
                    {treeItems.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.fullNumberPath} — {t.name.slice(0, 50)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="coinPrice">Цена (монет)</Label>
                  <Input id="coinPrice" name="coinPrice" type="number" min={1} max={100} defaultValue={5} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fileSize">Размер (байт)</Label>
                  <Input id="fileSize" name="fileSize" type="number" defaultValue={0} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fileUrl">Ссылка на файл</Label>
                <Input id="fileUrl" name="fileUrl" placeholder="https://..." required />
              </div>
              <Button type="submit" className="w-full bg-menthol hover:bg-menthol-dark" disabled={uploadLoading}>
                {uploadLoading ? "Загрузка..." : "Загрузить"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Поиск по названию..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={classifier} onValueChange={(v) => setClassifier(v || "all")}>
              <SelectTrigger><SelectValue placeholder="Классификатор" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все категории</SelectItem>
                {treeItems.map((t) => (
                  <SelectItem key={t.id} value={t.fullNumberPath}>{t.fullNumberPath} — {t.name.slice(0, 40)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Documents list */}
      {filtered.length === 0 ? (
        <div className="border rounded-lg p-12 text-center text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg">Документы не найдены</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((doc) => (
            <Card key={doc.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="pt-4 flex items-center justify-between gap-4">
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
                  <Badge variant="secondary" className="gap-1">
                    <Coins className="h-3 w-3" /> {doc.coinPrice}
                  </Badge>
                  <Button
                    size="sm"
                    className="bg-orange-accent hover:bg-orange-accent/90"
                    onClick={() => handleBuy(doc.id)}
                    disabled={buyLoading === doc.id}
                  >
                    Приобрести
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
