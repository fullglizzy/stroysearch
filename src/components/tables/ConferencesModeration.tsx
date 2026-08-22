"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/shared/Pagination";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ImagePreview } from "@/components/shared/ImagePreview";
import { ExpandableText } from "@/components/shared/ExpandableText";
import { Calendar, Clock, Users, Eye, CheckCircle, XCircle, Loader2, Coins, ExternalLink, Search } from "lucide-react";

interface ConfRow {
  id: string;
  title: string;
  organizerName: string;
  date: Date;
  time: string;
  description: string;
  coinPrice: number;
  status: string;
  moderatorNote: string | null;
  views: number;
  participantCount: number;
  connectionLink: string | null;
  logoUrl: string | null;
  treeItemPath: string | null;
  treeItemName: string | null;
}

interface Props {
  conferences: ConfRow[];
  total: number;
  page: number;
  totalPages: number;
  q: string;
  statusFilter: string;
}

const statusLabels: Record<string, string> = {
  PENDING: "Ожидает", APPROVED: "Одобрена", REJECTED: "Отклонена", CANCELLED: "Отменена",
};
const statusBadge: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700", APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700", CANCELLED: "bg-gray-100 text-gray-700",
};

export function ConferencesModeration({ conferences, total, page, totalPages, q, statusFilter }: Props) {
  const router = useRouter();
  const [noteOpen, setNoteOpen] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [detail, setDetail] = useState<ConfRow | null>(null);
  const [search, setSearch] = useState(q);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Поиск и фильтр по статусу живут в URL (серверная фильтрация)
  function updateQuery(next: Record<string, string | null>) {
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(next)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    const qs = params.toString();
    router.replace(qs ? `/admin/conferences?${qs}` : "/admin/conferences", { scroll: false });
  }

  function handleSearchChange(value: string) {
    setSearch(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      updateQuery({ q: value, page: null });
    }, 300);
  }

  async function handleModerate(confId: string, status: string) {
    if (status === "REJECTED" && !note.trim()) return;
    setLoading(confId);
    try {
      await fetch(`/api/conferences/${confId}/moderate`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, moderatorNote: status === "REJECTED" ? note : null }),
      });
      router.refresh();
    } catch { /* handled by refresh */ }
    setLoading(null);
    setNoteOpen(null);
  }

  if (conferences.length === 0) {
    return (
      <div className="border rounded-lg p-12 text-center text-muted-foreground">
        <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg">Нет конференций</p>
        <p className="text-sm mt-2">Конференции, требующие модерации, появятся здесь</p>
      </div>
    );
  }

  return (
    <>
      {/* Поиск + фильтр по статусу */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по названию или организатору..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[
            { value: "", label: "Все" },
            { value: "PENDING", label: "Ожидают" },
            { value: "APPROVED", label: "Одобрены" },
            { value: "REJECTED", label: "Отклонены" },
            { value: "CANCELLED", label: "Отменены" },
          ].map((f) => (
            <Button
              key={f.value}
              size="sm"
              variant={statusFilter === f.value ? "default" : "outline"}
              onClick={() => updateQuery({ status: f.value, page: null })}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Название</TableHead>
              <TableHead>Организатор</TableHead>
              <TableHead>Дата</TableHead>
              <TableHead>Цена</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Метрика</TableHead>
              <TableHead>Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {conferences.map((c) => (
              <TableRow
                key={c.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => setDetail(c)}
              >
                <TableCell className="font-medium max-w-[200px] truncate">{c.title}</TableCell>
                <TableCell className="text-sm">{c.organizerName}</TableCell>
                <TableCell className="text-sm">
                  {new Date(c.date).toLocaleDateString("ru-RU")} {c.time}
                </TableCell>
                <TableCell>{c.coinPrice > 0 ? `${c.coinPrice} мон.` : "Бесплатно"}</TableCell>
                <TableCell><Badge variant="secondary" className={statusBadge[c.status]}>{statusLabels[c.status] || c.status}</Badge></TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  <Eye className="h-3 w-3 inline mr-1" />{c.views} <Users className="h-3 w-3 inline ml-1 mr-1" />{c.participantCount}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  {c.status === "PENDING" && (
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" className="text-green-600" onClick={() => handleModerate(c.id, "APPROVED")} disabled={loading === c.id}>
                        {loading === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                      </Button>
                      <Button size="sm" variant="outline" className="text-red-600" onClick={() => { setNoteOpen(c.id); setNote(""); }} disabled={loading === c.id}>
                        <XCircle className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Dialog open={!!noteOpen} onOpenChange={() => setNoteOpen(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Причина отклонения</DialogTitle>
              <DialogDescription>Укажите комментарий для организатора</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Причина отклонения..." />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setNoteOpen(null)}>Отмена</Button>
                <Button className="bg-red-600 hover:bg-red-700" onClick={() => noteOpen && handleModerate(noteOpen, "REJECTED")} disabled={!note.trim()}>
                  Отклонить
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Попап с полной информацией о конференции */}
      <Dialog open={!!detail} onOpenChange={(v) => { if (!v) setDetail(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="break-words">{detail.title}</DialogTitle>
                <DialogDescription>
                  {detail.organizerName} · {new Date(detail.date).toLocaleDateString("ru-RU")} в {detail.time} МСК
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                {detail.logoUrl && (
                  <ImagePreview src={detail.logoUrl} alt={detail.title} className="h-24 w-24 rounded-md border" />
                )}
                <ExpandableText text={detail.description} />
                <div className="flex flex-wrap gap-2 text-sm">
                  <Badge variant="secondary" className={statusBadge[detail.status]}>{statusLabels[detail.status] || detail.status}</Badge>
                  {detail.coinPrice > 0 ? (
                    <Badge className="gap-1"><Coins className="h-3 w-3" />{detail.coinPrice} мон.</Badge>
                  ) : (
                    <Badge variant="outline" className="text-menthol">Бесплатно</Badge>
                  )}
                  {detail.treeItemPath && (
                    <Badge variant="outline" className="text-[10px]">
                      {detail.treeItemPath}{detail.treeItemName ? ` — ${detail.treeItemName}` : ""}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {detail.views} просмотров</span>
                  <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {detail.participantCount} участников</span>
                </div>
                {detail.connectionLink && (
                  <a
                    href={detail.connectionLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-menthol hover:underline inline-flex items-center gap-1 break-all"
                  >
                    <ExternalLink className="h-3 w-3 shrink-0" />
                    {detail.connectionLink}
                  </a>
                )}
                {detail.moderatorNote && (
                  <div className="text-sm text-muted-foreground border-t pt-2">
                    <span className="font-medium text-foreground">Комментарий модератора:</span> {detail.moderatorNote}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center sm:justify-between gap-2 mt-4 text-sm text-muted-foreground">
          <span>Всего: {total} конференций</span>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={(p) => {
              const params = new URLSearchParams(window.location.search);
              params.set("page", String(p));
              router.replace(`/admin/conferences?${params.toString()}`, { scroll: false });
            }}
          />
        </div>
      )}
    </>
  );
}
