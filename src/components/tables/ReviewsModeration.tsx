"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StarRating } from "@/components/shared/StarRating";
import { toastSuccess, toastError } from "@/lib/toast";
import { Eye, EyeOff, Flag, Loader2, MessageSquare, Search } from "lucide-react";

interface ReviewRow {
  id: string;
  comment: string;
  weightedAverage: number;
  createdAt: string;
  authorNick: string;
  targetNick: string;
  companyName: string | null;
  status: string;
  reports: { id: string; reason: string; createdAt: string }[];
}

export function ReviewsModeration() {
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"ACTIVE" | "HIDDEN">("ACTIVE");
  const [search, setSearch] = useState("");
  const [actionId, setActionId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/reviews?status=${tab}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setReviews(d.reviews || []); })
      .catch(() => { if (!cancelled) setReviews([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tab]);

  async function handleAction(id: string, action: "hide" | "restore") {
    setActionId(id);
    try {
      const res = await fetch(`/api/admin/reviews/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        toastSuccess(action === "hide" ? "Отзыв скрыт" : "Отзыв восстановлен");
        setReviews((prev) => prev.filter((r) => r.id !== id));
      } else {
        const d = await res.json().catch(() => ({}));
        toastError("Ошибка", d.error || "Не удалось выполнить действие");
      }
    } catch {
      toastError("Ошибка соединения");
    }
    setActionId(null);
  }

  const filtered = reviews.filter((r) => {
    const s = search.trim().toLowerCase();
    if (!s) return true;
    return [r.comment, r.authorNick, r.targetNick, r.companyName ?? ""].some((f) =>
      f.toLowerCase().includes(s),
    );
  });

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={(v) => setTab(v as "ACTIVE" | "HIDDEN")}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <TabsList>
            <TabsTrigger value="ACTIVE">Опубликованные</TabsTrigger>
            <TabsTrigger value="HIDDEN">Скрытые</TabsTrigger>
          </TabsList>
          <div className="relative sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск по тексту, автору, цели..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <TabsContent value="ACTIVE" className="mt-0">
          <ReviewsList rows={filtered} loading={loading} actionId={actionId} onAction={handleAction} hideAction="hide" />
        </TabsContent>
        <TabsContent value="HIDDEN" className="mt-0">
          <ReviewsList rows={filtered} loading={loading} actionId={actionId} onAction={handleAction} hideAction="restore" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ReviewsList({
  rows,
  loading,
  actionId,
  onAction,
  hideAction,
}: {
  rows: ReviewRow[];
  loading: boolean;
  actionId: string | null;
  onAction: (id: string, action: "hide" | "restore") => void;
  hideAction: "hide" | "restore";
}) {
  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="border rounded-lg p-12 text-center text-muted-foreground">
        <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg">Нет отзывов</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <Card key={r.id}>
          <CardContent className="px-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2 text-sm min-w-0">
                <span className="font-medium">{r.authorNick}</span>
                <span className="text-muted-foreground">→</span>
                <span className="font-medium truncate">{r.targetNick}</span>
                {r.companyName && (
                  <Badge variant="outline" className="text-[10px]">{r.companyName}</Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                <StarRating rating={r.weightedAverage} size="sm" />
                <span className="text-xs text-muted-foreground">{r.weightedAverage.toFixed(1)}</span>
              </div>
            </div>
            <p className="text-sm mb-1 wrap-anywhere whitespace-pre-wrap">{r.comment}</p>
            <p className="text-xs text-muted-foreground mb-2">
              {new Date(r.createdAt).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </p>
            {r.reports.length > 0 && (
              <div className="rounded-md border border-orange-accent/40 bg-orange-accent/5 p-2 mb-2">
                <p className="text-xs font-medium text-orange-accent mb-1 flex items-center gap-1">
                  <Flag className="h-3 w-3" /> Жалобы ({r.reports.length})
                </p>
                {r.reports.map((rep) => (
                  <p key={rep.id} className="text-xs text-muted-foreground mb-0.5">
                    {rep.reason} · {new Date(rep.createdAt).toLocaleDateString("ru-RU")}
                  </p>
                ))}
              </div>
            )}
            <Button
              size="sm"
              variant="outline"
              className={hideAction === "hide" ? "text-red-500" : "text-menthol"}
              onClick={() => onAction(r.id, hideAction)}
              disabled={actionId === r.id}
            >
              {actionId === r.id ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : hideAction === "hide" ? (
                <EyeOff className="h-3 w-3 mr-1" />
              ) : (
                <Eye className="h-3 w-3 mr-1" />
              )}
              {hideAction === "hide" ? "Скрыть отзыв" : "Восстановить"}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
