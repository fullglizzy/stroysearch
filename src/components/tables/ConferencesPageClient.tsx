"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuthGuard } from "@/components/shared/useAuthGuard";
import { Pagination } from "@/components/shared/Pagination";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageBanner } from "@/components/shared/PageBanner";
import { ImagePreview } from "@/components/shared/ImagePreview";
import { ExpandableText } from "@/components/shared/ExpandableText";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ConferenceCreateDialog } from "@/components/forms/ConferenceCreateDialog";
import { toastError, toastSuccess } from "@/lib/toast";
import { Search, Calendar, Clock, Plus, Coins, ExternalLink, Loader2, AlertCircle } from "lucide-react";

interface ConfRow {
  id: string;
  title: string;
  organizerName: string;
  logoUrl: string | null;
  date: Date;
  time: string;
  description: string;
  treeItemPath: string | null;
  treeItemName: string | null;
  coinPrice: number;
  isPublic: boolean;
  connectionLink: string | null;
  views: number;
  participantCount: number;
}

interface TreeItem {
  id: string;
  name: string;
  fullNumberPath: string;
}

interface Props {
  conferences: ConfRow[];
  total: number;
  page: number;
  totalPages: number;
  showPast: boolean;
  treeItems: TreeItem[];
  moderatorText: string | null;
  pageTitle: string | null;
  bannerUrl: string | null;
  initialQuery: { q: string };
  coinPriceRub: number;
}

export function ConferencesPageClient({ conferences, total, page, totalPages, showPast, treeItems, moderatorText, pageTitle, bannerUrl, initialQuery, coinPriceRub }: Props) {
  const { data: session } = useSession();
  const router = useRouter();
  const { guard, dialog: authDialog } = useAuthGuard();

  // Участие пользователя догружаем клиентом, чтобы страница могла кэшироваться
  const [joinedConfIds, setJoinedConfIds] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/conferences/joined")
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setJoinedConfIds(d.ids || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [session?.user]);
  const [search, setSearch] = useState(initialQuery.q);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinLoading, setJoinLoading] = useState<string | null>(null);
  const [joinError, setJoinError] = useState("");
  const [joinTarget, setJoinTarget] = useState<{ id: string; title: string; price: number } | null>(null);

  // Пагинация и архив живут в URL
  function updateQuery(next: Record<string, string | null>) {
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(next)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    const qs = params.toString();
    router.replace(qs ? `/conferences?${qs}` : "/conferences", { scroll: false });
  }

  const filtered = conferences.filter((c) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return c.title.toLowerCase().includes(s) || c.organizerName.toLowerCase().includes(s);
  });

  async function handleJoinFree(confId: string) {
    setJoinLoading(confId);
    try {
      const res = await fetch(`/api/conferences/${confId}/join`, { method: "POST" });
      if (res.ok) {
        // Моментальное обновление кнопки без ожидания перезагрузки
        setJoinedConfIds((prev) => (prev.includes(confId) ? prev : [...prev, confId]));
        setJoinError("");
        fetch(`/api/conferences/${confId}/view`, { method: "POST" }).catch(() => {});
        router.refresh();
      } else {
        const d = await res.json().catch(() => ({}));
        setJoinError(d.error || "Недостаточно монет");
      }
    } catch {
      setJoinError("Ошибка соединения");
    }
    setJoinLoading(null);
  }

  async function confirmJoin() {
    if (!joinTarget) return;
    setJoinLoading(joinTarget.id);
    try {
      const res = await fetch(`/api/conferences/${joinTarget.id}/join`, { method: "POST" });
      if (res.ok) {
        // Моментальное обновление кнопки без ожидания перезагрузки
        setJoinedConfIds((prev) => (prev.includes(joinTarget.id) ? prev : [...prev, joinTarget.id]));
        setJoinTarget(null);
        setJoinError("");
        fetch(`/api/conferences/${joinTarget.id}/view`, { method: "POST" }).catch(() => {});
        toastSuccess("Вы участвуете", `Вы записаны на «${joinTarget.title}»`);
        router.refresh();
      } else {
        const d = await res.json().catch(() => ({}));
        setJoinError(d.error || "Недостаточно монет");
        toastError("Ошибка", d.error || "Не удалось записаться");
        setJoinTarget(null);
      }
    } catch {
      setJoinError("Ошибка соединения");
      toastError("Ошибка соединения");
    }
    setJoinLoading(null);
  }

  const formatDate = (d: Date) => new Date(d).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="container-page py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">Конференции</h1>
          <p className="text-muted-foreground mt-1">Вебинары, лекции и презентации продуктов</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => updateQuery({ past: showPast ? null : "1", page: null })}
          >
            {showPast ? "Показать предстоящие" : "Показать прошедшие"}
          </Button>
        </div>
        <Button
          className="bg-orange-accent hover:bg-orange-accent/90 gap-2"
          onClick={guard(() => setCreateOpen(true))}
        >
          <Plus className="h-4 w-4" /> Создать конференцию
        </Button>
        <ConferenceCreateDialog
          treeItems={treeItems}
          open={createOpen}
          onOpenChange={setCreateOpen}
        />
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

      {/* Баннер (ТЗ §9) */}
      {bannerUrl && <PageBanner url={bannerUrl} alt="Баннер конференций" />}

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Поиск конференций..."
          value={search}
          onChange={(e) => {
            const value = e.target.value;
            setSearch(value);
            if (searchTimer.current) clearTimeout(searchTimer.current);
            searchTimer.current = setTimeout(() => {
              updateQuery({ q: value, page: null });
            }, 300);
          }}
          className="pl-9"
        />
      </div>

      {joinError && <Alert variant="destructive" className="mb-4"><AlertDescription>{joinError}</AlertDescription></Alert>}

      {filtered.length === 0 ? (
        <div className="border rounded-lg p-12 text-center text-muted-foreground">
          <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg">Конференций пока нет</p>
          <p className="text-sm mt-2">Презентуйте свой продукт, проведите лекцию</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((conf) => (
            <Card key={conf.id} className="hover:shadow-md transition-shadow">
              <CardContent>
                <div className="flex items-start gap-3 mb-2">
                  {conf.logoUrl && (
                    <ImagePreview
                      src={conf.logoUrl}
                      alt={conf.title}
                      className="h-14 w-14 rounded-md border shrink-0"
                    />
                  )}
                  <h3 className="font-semibold text-lg flex-1">{conf.title}</h3>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mb-3">
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {formatDate(conf.date)}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {conf.time} МСК</span>
                </div>
                <ExpandableText text={conf.description} />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <Badge variant="secondary" className="text-xs">{conf.organizerName}</Badge>
                    {conf.treeItemPath && <Badge variant="outline" className="text-[10px]">{conf.treeItemPath}{conf.treeItemName ? ` — ${conf.treeItemName}` : ""}</Badge>}
                  </div>
                  <div className="flex items-center gap-2">
                    {conf.coinPrice > 0 ? (
                      <Badge className="gap-1">
                        <Coins className="h-3 w-3" /> {conf.coinPrice}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-menthol">Бесплатно</Badge>
                    )}
                    {joinedConfIds.includes(conf.id) ? (
                      conf.connectionLink ? (
                        <a href={conf.connectionLink} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="outline" className="gap-1"><ExternalLink className="h-3 w-3" /> Подключиться</Button>
                        </a>
                      ) : (
                        <Badge className="bg-green-100 text-green-700">Вы участвуете</Badge>
                      )
                    ) : conf.coinPrice > 0 ? (
                      <Button size="sm" className="bg-orange-accent hover:bg-orange-accent/90" onClick={guard(() => setJoinTarget({ id: conf.id, title: conf.title, price: conf.coinPrice }))} disabled={joinLoading === conf.id}>
                        {joinLoading === conf.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Участвовать"}
                      </Button>
                    ) : conf.connectionLink ? (
                      <a href={conf.connectionLink} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="outline" className="gap-1"><ExternalLink className="h-3 w-3" /> Подключиться</Button>
                      </a>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => handleJoinFree(conf.id)} disabled={joinLoading === conf.id}>
                        {joinLoading === conf.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Участвовать"}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center sm:justify-between gap-2 mt-4 text-sm text-muted-foreground">
          <span>Всего: {total} конференций</span>
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={(p) => updateQuery({ page: String(p) })} />
        </div>
      )}

      {authDialog}

      <ConfirmDialog
        open={!!joinTarget}
        onOpenChange={(v) => { if (!v) setJoinTarget(null); }}
        title="Участвовать в конференции?"
        message={joinTarget ? `Конференция «${joinTarget.title}» за ${joinTarget.price} монет. Монеты спишутся с вашего счёта.` : ""}
        variant="info"
        confirmLabel="Участвовать"
        onConfirm={confirmJoin}
        loading={!!joinLoading}
      />
    </div>
  );
}
