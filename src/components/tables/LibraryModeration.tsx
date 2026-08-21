"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Pagination } from "@/components/shared/Pagination";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { FileText, Eye, Download, Trash2, CheckCircle, XCircle, Loader2, Search } from "lucide-react";
import { docHref } from "@/lib/doc-url";

interface DocRow {
  id: string;
  title: string;
  coinPrice: number;
  isApproved: boolean;
  moderatorNote: string | null;
  views: number;
  purchasesCount: number;
  fileUrl: string;
  fileSize: number;
  createdAt: Date;
  updatedAt: Date;
  user: { username: string; profile: { nick: string } | null };
  treeItem: { fullNumberPath: string; name: string } | null;
}

interface Props {
  documents: DocRow[];
  total: number;
  page: number;
  totalPages: number;
  q: string;
  statusFilter: string;
}

export function LibraryModeration({ documents, total, page, totalPages, q, statusFilter }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DocRow | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [rejectLoading, setRejectLoading] = useState(false);
  const [search, setSearch] = useState(q);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  function updateQuery(next: Record<string, string | null>) {
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(next)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    const qs = params.toString();
    router.replace(qs ? `/admin/library?${qs}` : "/admin/library", { scroll: false });
  }

  function handleSearchChange(value: string) {
    setSearch(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      updateQuery({ q: value, page: null });
    }, 300);
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulkApprove() {
    setBulkLoading(true);
    for (const id of Array.from(selected)) {
      await fetch(`/api/library/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isApproved: true }),
      });
    }
    setBulkLoading(false);
    setSelected(new Set());
    router.refresh();
  }

  async function toggleApprove(docId: string, approved: boolean) {
    setLoading(docId);
    await fetch(`/api/library/${docId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isApproved: approved }),
    });
    router.refresh();
    setLoading(null);
  }

  async function handleReject() {
    if (!rejectId) return;
    setRejectLoading(true);
    await fetch(`/api/library/${rejectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isApproved: false, moderatorNote: rejectNote.trim() || undefined }),
    });
    setRejectLoading(false);
    setRejectId(null);
    setRejectNote("");
    router.refresh();
  }

  async function handleDelete(docId: string) {
    setDeleteId(null);
    await fetch(`/api/library/${docId}`, { method: "DELETE" });
    router.refresh();
  }

  function formatSize(bytes: number): string {
    if (!bytes || bytes === 0) return "—";
    if (bytes < 1024) return bytes + " Б";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " КБ";
    return (bytes / (1024 * 1024)).toFixed(1) + " МБ";
  }

  if (documents.length === 0) {
    return (
      <div className="border rounded-lg p-12 text-center text-muted-foreground">
        <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg">Нет документов</p>
        <p className="text-sm mt-2">Загруженные документы появятся здесь</p>
      </div>
    );
  }

  return (
    <>
      {/* Поиск + фильтр по статусу + массовое одобрение */}
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск по названию или автору..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[
              { value: "", label: "Все" },
              { value: "pending", label: "На модерации" },
              { value: "approved", label: "Одобрены" },
            ].map((f) => (
              <Button
                key={f.value}
                size="sm"
                variant={statusFilter === f.value ? "default" : "outline"}
                onClick={() => {
                  updateQuery({ status: f.value, page: null });
                  setSelected(new Set());
                }}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </div>
        {selected.size > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-menthol/50 bg-menthol/5 p-3">
            <span className="text-sm font-medium">Выбрано: {selected.size}</span>
            <Button size="sm" className="bg-menthol hover:bg-menthol-dark" onClick={handleBulkApprove} disabled={bulkLoading}>
              {bulkLoading && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
              Одобрить выбранные
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} disabled={bulkLoading}>
              Сбросить
            </Button>
          </div>
        )}
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={documents.length > 0 && documents.every((d) => selected.has(d.id))}
                  onCheckedChange={() => {
                    const all = documents.every((d) => selected.has(d.id));
                    setSelected(all ? new Set() : new Set(documents.map((d) => d.id)));
                  }}
                  aria-label="Выбрать все"
                />
              </TableHead>
              <TableHead>Название</TableHead>
              <TableHead>Автор</TableHead>
              <TableHead>Класс.</TableHead>
              <TableHead>Цена</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Метрика</TableHead>
              <TableHead>Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.map((d) => (
              <TableRow
                key={d.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => setDetail(d)}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selected.has(d.id)}
                    onCheckedChange={() => toggleSelect(d.id)}
                    aria-label={`Выбрать документ ${d.title}`}
                  />
                </TableCell>
                <TableCell className="font-medium max-w-[200px] truncate">
                  <FileText className="h-3 w-3 inline mr-1 text-menthol" />{d.title}
                </TableCell>
                <TableCell className="text-sm">{d.user.profile?.nick || d.user.username}</TableCell>
                <TableCell className="text-xs">{d.treeItem ? `${d.treeItem.fullNumberPath} — ${d.treeItem.name}` : "—"}</TableCell>
                <TableCell>{d.coinPrice} мон.</TableCell>
                <TableCell>
                  <Badge variant="secondary" className={d.isApproved ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}>
                    {d.isApproved ? "Одобрен" : "На модерации"}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  <Eye className="h-3 w-3 inline mr-1" />{d.views} <Download className="h-3 w-3 inline ml-1 mr-1" />{d.purchasesCount}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex gap-1">
                    <Button
                      size="sm" variant="outline"
                      className={d.isApproved ? "text-yellow-600" : "text-green-600"}
                      onClick={() => {
                        if (d.isApproved) {
                          setRejectId(d.id);
                          setRejectNote("");
                        } else {
                          toggleApprove(d.id, true);
                        }
                      }}
                      disabled={loading === d.id}
                    >
                      {loading === d.id
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : d.isApproved ? <XCircle className="h-3 w-3" /> : <CheckCircle className="h-3 w-3" />
                      }
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-500" onClick={() => setDeleteId(d.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Детали документа (клик по строке) */}
      <Dialog open={!!detail} onOpenChange={(v) => { if (!v) setDetail(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="break-words">{detail.title}</DialogTitle>
                <DialogDescription>
                  {detail.user.profile?.nick || detail.user.username} · загружен{" "}
                  {new Date(detail.createdAt).toLocaleDateString("ru-RU")}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2 text-sm">
                  <Badge variant="secondary" className={detail.isApproved ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}>
                    {detail.isApproved ? "Одобрен" : "На модерации"}
                  </Badge>
                  {detail.coinPrice > 0 ? (
                    <Badge className="gap-1">Монет: {detail.coinPrice}</Badge>
                  ) : (
                    <Badge variant="outline" className="text-menthol">Бесплатно</Badge>
                  )}
                  {detail.treeItem && (
                    <Badge variant="outline" className="text-[10px]">
                      {detail.treeItem.fullNumberPath} — {detail.treeItem.name}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {detail.views} просмотров</span>
                  <span className="flex items-center gap-1"><Download className="h-3 w-3" /> {detail.purchasesCount} покупок</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Размер файла: {formatSize(detail.fileSize)}
                </p>
                {!detail.isApproved && detail.moderatorNote && (
                  <div className="border border-orange-accent/40 bg-orange-accent/5 rounded-md p-3">
                    <p className="text-xs font-medium text-orange-accent mb-1">Причина снятия с публикации</p>
                    <p className="text-sm">{detail.moderatorNote}</p>
                  </div>
                )}
                <a
                  href={docHref(detail.fileUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-menthol hover:underline inline-flex items-center gap-1 break-all"
                >
                  <Download className="h-3 w-3 shrink-0" />
                  Открыть документ
                </a>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Снятие с публикации: причина */}
      <Dialog open={!!rejectId} onOpenChange={(v) => { if (!v) setRejectId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Снять документ с публикации?</DialogTitle>
            <DialogDescription>
              Укажите причину — автор увидит её в своей библиотеке.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-note">Причина (необязательно)</Label>
            <Textarea
              id="reject-note"
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="Например: файл не открывается, не соответствует категории"
              rows={3}
              maxLength={500}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setRejectId(null)} disabled={rejectLoading}>Отмена</Button>
            <Button variant="destructive" onClick={handleReject} disabled={rejectLoading}>
              {rejectLoading && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
              Снять с публикации
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить документ?</DialogTitle>
            <DialogDescription>Это действие нельзя отменить. Документ будет скрыт из библиотеки.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setDeleteId(null)}>Отмена</Button>
            <Button variant="destructive" onClick={() => deleteId && handleDelete(deleteId)}>Удалить</Button>
          </div>
        </DialogContent>
      </Dialog>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
          <span>Всего: {total} документов</span>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={(p) => {
              const params = new URLSearchParams(window.location.search);
              params.set("page", String(p));
              router.replace(`/admin/library?${params.toString()}`, { scroll: false });
            }}
          />
        </div>
      )}
    </>
  );
}
