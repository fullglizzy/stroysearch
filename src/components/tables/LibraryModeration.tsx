"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/shared/Pagination";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { FileText, Eye, Download, Trash2, CheckCircle, XCircle, Loader2 } from "lucide-react";

interface DocRow {
  id: string;
  title: string;
  coinPrice: number;
  isApproved: boolean;
  views: number;
  purchasesCount: number;
  user: { username: string; profile: { nick: string } | null };
  treeItem: { fullNumberPath: string; name: string } | null;
}

interface Props { documents: DocRow[]; total: number; page: number; totalPages: number; }

export function LibraryModeration({ documents, total, page, totalPages }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

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

  async function handleDelete(docId: string) {
    setDeleteId(null);
    await fetch(`/api/library/${docId}`, { method: "DELETE" });
    router.refresh();
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
      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
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
              <TableRow key={d.id}>
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
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      size="sm" variant="outline"
                      className={d.isApproved ? "text-yellow-600" : "text-green-600"}
                      onClick={() => toggleApprove(d.id, !d.isApproved)}
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
