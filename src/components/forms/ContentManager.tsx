"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Save } from "lucide-react";

interface ContentManagerProps {
  pages: {
    id: string;
    pageKey: string;
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
  const [content, setContent] = useState(
    pages.find((p) => p.pageKey === activePage)?.content || "",
  );
  const [bannerUrl, setBannerUrl] = useState(
    pages.find((p) => p.pageKey === activePage)?.bannerUrl || "",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function switchPage(key: string) {
    setActivePage(key);
    setContent(pages.find((p) => p.pageKey === key)?.content || "");
    setBannerUrl(pages.find((p) => p.pageKey === key)?.bannerUrl || "");
    setError("");
    setSuccess("");
  }

  async function handleSave() {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/admin/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageKey: activePage,
          content,
          bannerUrl: bannerUrl || null,
        }),
      });

      if (res.ok) {
        setSuccess("Сохранено");
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error || "Ошибка сохранения");
      }
    } catch {
      setError("Ошибка соединения");
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

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{pageLabels[activePage] || activePage}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="content">Текст страницы (HTML)</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={12}
              className="font-mono text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bannerUrl">URL баннера</Label>
            <Input
              id="bannerUrl"
              value={bannerUrl}
              onChange={(e) => setBannerUrl(e.target.value)}
              placeholder="https://..."
            />
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
