"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Save, Upload, Eye, History, AlertCircle } from "lucide-react";
import Image from "next/image";
import { toastSuccess, toastError, toastWarning } from "@/lib/toast";

interface ContentManagerProps {
  pages: {
    id: string;
    pageKey: string;
    title: string;
    content: string;
    bannerUrl: string | null;
  }[];
}

// Страницы из шапки + главная + личные кабинеты
const pageLabels: Record<string, string> = {
  home: "Главная страница",
  products: "Продуктовые решения",
  suppliers: "База поставщиков",
  matrix: "Матрица материалов",
  library: "Библиотека",
  conferences: "Конференции",
  polls: "Статистика и опросы",
  account: "ЛК участника",
  company: "ЛК компании",
};

const PAGE_KEYS = Object.keys(pageLabels);

export function ContentManager({ pages }: ContentManagerProps) {
  const router = useRouter();

  // Вкладки строим по полному списку известных страниц, а не по строкам БД:
  // на чистой БД pageContent пуст, но вкладки должны отображаться.
  // Отсутствующие страницы считаются пустыми и создаются при сохранении (API — upsert).
  const pagesByKey = useMemo(
    () => new Map(pages.map((p) => [p.pageKey, p])),
    [pages],
  );

  const [activePage, setActivePage] = useState(
    pages[0] && pageLabels[pages[0].pageKey] ? pages[0].pageKey : PAGE_KEYS[0],
  );
  const [title, setTitle] = useState(pagesByKey.get(activePage)?.title || "");
  const [content, setContent] = useState(pagesByKey.get(activePage)?.content || "");
  const [bannerUrl, setBannerUrl] = useState(pagesByKey.get(activePage)?.bannerUrl || "");
  const [loading, setLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [revisions, setRevisions] = useState<
    { id: string; content: string; changedBy: string; createdAt: string }[]
  >([]);
  const [revLoading, setRevLoading] = useState(false);
  const [contentError, setContentError] = useState("");
  const [bannerUploading, setBannerUploading] = useState(false);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  async function handleBannerUpload(file: File) {
    if (!file.type.startsWith("image/")) {
      toastWarning("Проверьте файл", "Баннер должен быть изображением (PNG, JPEG, WEBP, GIF)");
      return;
    }
    setBannerUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setBannerUrl(data.fileUrl);
        toastSuccess("Файл загружен", "Не забудьте сохранить страницу");
      } else {
        toastError("Ошибка загрузки", data.error || "Не удалось загрузить файл");
      }
    } catch {
      toastError("Ошибка соединения");
    }
    setBannerUploading(false);
  }

  function switchPage(key: string) {
    setActivePage(key);
    setTitle(pagesByKey.get(key)?.title || "");
    setContent(pagesByKey.get(key)?.content || "");
    setBannerUrl(pagesByKey.get(key)?.bannerUrl || "");
    setContentError("");
  }

  async function handleSave() {
    if (!content.trim()) {
      setContentError("Текст страницы не может быть пустым");
      toastWarning("Проверьте данные", "Текст страницы обязателен");
      return;
    }

    setContentError("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageKey: activePage,
          title,
          content,
          bannerUrl: bannerUrl || null,
        }),
      });

      if (res.ok) {
        toastSuccess(`Страница «${pageLabels[activePage] || activePage}» сохранена`);
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        toastError("Ошибка сохранения", data.error);
      }
    } catch {
      toastError("Ошибка соединения");
    }
    setLoading(false);
  }

  async function loadHistory() {
    setHistoryOpen(true);
    setRevLoading(true);
    try {
      const res = await fetch(`/api/admin/content/revisions?pageKey=${encodeURIComponent(activePage)}`);
      const d = await res.json().catch(() => ({}));
      setRevisions(d.revisions || []);
    } catch {
      setRevisions([]);
    }
    setRevLoading(false);
  }

  function restoreRevision(raw: string) {
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed.title === "string") setTitle(parsed.title);
      if (typeof parsed.content === "string") setContent(parsed.content);
      if (parsed.bannerUrl !== undefined) setBannerUrl(parsed.bannerUrl || "");
      toastSuccess("Версия восстановлена", "Не забудьте нажать «Сохранить»");
    } catch {
      toastError("Не удалось прочитать версию");
    }
    setHistoryOpen(false);
  }

  return (
    <div className="space-y-6">
      <Tabs value={activePage} onValueChange={switchPage}>
        <TabsList className="flex-wrap h-auto">
          {PAGE_KEYS.map((key) => (
            <TabsTrigger key={key} value={key} className="text-xs">
              {pageLabels[key]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>{pageLabels[activePage] || activePage}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Заголовок инфоблока</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Например: Важная информация"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="content">
              Текст страницы (HTML)
              {contentError && (
                <span className="text-destructive text-xs ml-2">{contentError}</span>
              )}
            </Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                if (contentError) setContentError("");
              }}
              rows={12}
              className={`font-mono text-sm ${contentError ? "border-destructive" : ""}`}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bannerUrl">Баннер страницы</Label>
            <Input
              id="bannerUrl"
              value={bannerUrl}
              onChange={(e) => setBannerUrl(e.target.value)}
              placeholder="https://... или загрузите файл"
            />
            <div className="flex items-center gap-2">
              <input
                ref={bannerInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleBannerUpload(file);
                  e.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => bannerInputRef.current?.click()}
                disabled={bannerUploading}
              >
                {bannerUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Загрузить файл
              </Button>
              {bannerUrl && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setBannerUrl("")}>
                  Убрать
                </Button>
              )}
            </div>
            {bannerUrl && (
              <Image
                src={bannerUrl}
                alt="Превью баннера"
                width={1200}
                height={400}
                className="w-full h-auto max-h-32 object-cover rounded-lg border"
                sizes="100vw"
              />
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleSave}
              className="bg-menthol hover:bg-menthol-dark"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Сохранить
            </Button>
            <Button variant="outline" onClick={() => setPreviewOpen(true)}>
              <Eye className="h-4 w-4 mr-2" />
              Предпросмотр
            </Button>
            <Button variant="outline" onClick={loadHistory}>
              <History className="h-4 w-4 mr-2" />
              История версий
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Предпросмотр HTML — точная копия информационного блока со страниц */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Предпросмотр: {pageLabels[activePage] || activePage}</DialogTitle>
            <DialogDescription>Блок выглядит на странице точно так же</DialogDescription>
          </DialogHeader>
          <div className="bg-menthol/5 border border-menthol/20 rounded-lg p-3 mb-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-menthol flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              {title && <p className="font-medium text-menthol">{title}</p>}
              <div className="text-muted-foreground" dangerouslySetInnerHTML={{ __html: content }} />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* История версий */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>История версий</DialogTitle>
            <DialogDescription>Последние 20 сохранений. Восстановление подставит текст в форму.</DialogDescription>
          </DialogHeader>
          {revLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : revisions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Версий пока нет</p>
          ) : (
            <div className="space-y-2">
              {revisions.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-2 border rounded-lg px-3 py-2">
                  <div>
                    <p className="text-sm">{r.changedBy}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => restoreRevision(r.content)}>
                    Восстановить
                  </Button>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
