"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Save, Upload } from "lucide-react";
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

const pageLabels: Record<string, string> = {
  home: "Главная страница",
  products: "Продуктовые решения",
  suppliers: "База поставщиков",
  matrix: "Матрица материалов",
  library: "Библиотека",
  conferences: "Конференции",
  polls: "Статистика и опросы",
  account: "ЛК Участника",
  company: "ЛК Компании",
  admin: "Панель управления",
};

export function ContentManager({ pages }: ContentManagerProps) {
  const router = useRouter();
  const [activePage, setActivePage] = useState(pages[0]?.pageKey || "home");
  const [title, setTitle] = useState(
    pages.find((p) => p.pageKey === activePage)?.title || "",
  );
  const [content, setContent] = useState(
    pages.find((p) => p.pageKey === activePage)?.content || "",
  );
  const [bannerUrl, setBannerUrl] = useState(
    pages.find((p) => p.pageKey === activePage)?.bannerUrl || "",
  );
  const [loading, setLoading] = useState(false);
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
    setTitle(pages.find((p) => p.pageKey === key)?.title || "");
    setContent(pages.find((p) => p.pageKey === key)?.content || "");
    setBannerUrl(pages.find((p) => p.pageKey === key)?.bannerUrl || "");
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

  return (
    <div className="space-y-6">
      <Tabs value={activePage} onValueChange={switchPage}>
        <TabsList className="flex-wrap h-auto">
          {pages.map((p) => (
            <TabsTrigger key={p.pageKey} value={p.pageKey} className="text-xs">
              {pageLabels[p.pageKey] || p.pageKey}
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
              <img
                src={bannerUrl}
                alt="Превью баннера"
                className="w-full max-h-32 object-cover rounded-lg border"
              />
            )}
          </div>
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
        </CardContent>
      </Card>
    </div>
  );
}
