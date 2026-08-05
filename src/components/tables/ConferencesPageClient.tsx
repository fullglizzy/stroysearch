"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuthGuard } from "@/components/shared/useAuthGuard";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { Search, Calendar, Clock, Users, Eye, Plus, Coins, ExternalLink, Loader2, AlertCircle } from "lucide-react";

interface ConfRow {
  id: string;
  title: string;
  organizerName: string;
  logoUrl: string | null;
  date: Date;
  time: string;
  description: string;
  treeItemPath: string | null;
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
  treeItems: TreeItem[];
  moderatorText: string | null;
  bannerUrl: string | null;
  joinedConfIds: string[];
}

export function ConferencesPageClient({ conferences, treeItems, moderatorText, bannerUrl, joinedConfIds }: Props) {
  const { data: session } = useSession();
  const router = useRouter();
  const { guard, dialog: authDialog } = useAuthGuard();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [joinLoading, setJoinLoading] = useState<string | null>(null);
  const [joinError, setJoinError] = useState("");

  const filtered = conferences.filter((c) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return c.title.toLowerCase().includes(s) || c.organizerName.toLowerCase().includes(s);
  });

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!session?.user) { setCreateError("Требуется авторизация"); return; }
    setCreateLoading(true);
    setCreateError("");
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/conferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: fd.get("title"),
          date: fd.get("date"),
          time: fd.get("time"),
          description: fd.get("description"),
          treeItemId: fd.get("treeItemId") || null,
          coinPrice: parseInt(fd.get("coinPrice") as string) || 0,
          isPublic: fd.get("isPublic") === "on",
          connectionLink: fd.get("connectionLink") || null,
        }),
      });
      if (res.ok) { setCreateOpen(false); router.refresh(); }
      else { const d = await res.json(); setCreateError(d.error || "Ошибка"); }
    } catch { setCreateError("Ошибка соединения"); }
    setCreateLoading(false);
  }

  async function handleJoin(confId: string, coinPrice: number) {
    setJoinLoading(confId);
    try {
      const res = await fetch(`/api/conferences/${confId}/join`, { method: "POST" });
      if (res.ok) { router.refresh(); setJoinError(""); }
      else { const d = await res.json(); setJoinError(d.error || "Недостаточно монет"); }
    } catch { setJoinError("Ошибка соединения"); }
    setJoinLoading(null);
  }

  const formatDate = (d: Date) => new Date(d).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="container-page py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">Конференции</h1>
          <p className="text-muted-foreground mt-1">Вебинары, лекции и презентации продуктов</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger>
            <Button className="bg-menthol hover:bg-menthol-dark gap-2">
              <Plus className="h-4 w-4" /> Создать конференцию
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Создать конференцию</DialogTitle>
              <DialogDescription>После создания конференция будет отправлена на модерацию</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              {createError && <Alert variant="destructive"><AlertDescription>{createError}</AlertDescription></Alert>}
              <div className="space-y-2"><Label htmlFor="title">Название</Label><Input id="title" name="title" required /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label htmlFor="date">Дата</Label><Input id="date" name="date" type="date" required /></div>
                <div className="space-y-2"><Label htmlFor="time">Время (МСК)</Label><Input id="time" name="time" type="time" defaultValue="10:00" required /></div>
              </div>
              <div className="space-y-2"><Label htmlFor="description">Описание (до 500 слов)</Label><Textarea id="description" name="description" rows={3} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label htmlFor="coinPrice">Цена (монет, 0 = бесплатно)</Label><Input id="coinPrice" name="coinPrice" type="number" min={0} defaultValue={0} /></div>
                <div className="space-y-2"><Label>Категория</Label><Select name="treeItemId"><SelectTrigger><SelectValue placeholder="Выбрать" /></SelectTrigger><SelectContent><SelectItem value="">Без категории</SelectItem>{treeItems.slice(0, 20).map(t => <SelectItem key={t.id} value={t.id}>{t.fullNumberPath} — {t.name.slice(0, 40)}</SelectItem>)}</SelectContent></Select></div>
              </div>
              <div className="space-y-2"><Label htmlFor="connectionLink">Ссылка для подключения</Label><Input id="connectionLink" name="connectionLink" placeholder="https://..." /></div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isPublic" defaultChecked /> Только для зарегистрированных</label>
              <Button type="submit" className="w-full bg-menthol hover:bg-menthol-dark" disabled={createLoading}>{createLoading ? "Создание..." : "Создать"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Info banner */}
      <div className="bg-menthol/5 border border-menthol/20 rounded-lg p-3 mb-4 flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-menthol flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-menthol">Как пользоваться конференциями</p>
          <p className="text-muted-foreground">
            <strong>Создайте</strong> свою конференцию — она появится после одобрения модератором.
            Для платных конференций укажите цену в монетах.
            <strong> Участвуйте</strong> в конференциях других организаторов.
          </p>
        </div>
      </div>

      {/* Баннер (ТЗ §9) */}
      {bannerUrl && (
        <div className="mb-6 rounded-lg overflow-hidden">
          <img src={bannerUrl} alt="Баннер конференций" className="w-full h-auto max-h-48 object-cover" />
        </div>
      )}

      {/* Текст модератора (ТЗ §9) */}
      {moderatorText && (
        <div
          className="prose prose-gray max-w-none text-muted-foreground mb-6 text-sm"
          dangerouslySetInnerHTML={{ __html: moderatorText }}
        />
      )}

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Поиск конференций..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
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
                <h3 className="font-semibold text-lg mb-2">{conf.title}</h3>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mb-3">
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {formatDate(conf.date)}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {conf.time} МСК</span>
                  <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {conf.participantCount}</span>
                  <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {conf.views}</span>
                </div>
                <p className="text-sm text-muted-foreground mb-3 line-clamp-3">{conf.description}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">{conf.organizerName}</Badge>
                    {conf.treeItemPath && <Badge variant="outline" className="font-mono text-[10px]">{conf.treeItemPath}</Badge>}
                  </div>
                  <div className="flex items-center gap-2">
                    {conf.coinPrice > 0 ? (
                      <Badge className="gap-1"><Coins className="h-3 w-3" /> {conf.coinPrice}</Badge>
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
                      <Button size="sm" className="bg-orange-accent hover:bg-orange-accent/90" onClick={guard(() => handleJoin(conf.id, conf.coinPrice))} disabled={joinLoading === conf.id}>
                        {joinLoading === conf.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Участвовать"}
                      </Button>
                    ) : conf.connectionLink ? (
                      <a href={conf.connectionLink} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="outline" className="gap-1"><ExternalLink className="h-3 w-3" /> Подключиться</Button>
                      </a>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => handleJoin(conf.id, conf.coinPrice)} disabled={joinLoading === conf.id}>
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

      {authDialog}
    </div>
  );
}
