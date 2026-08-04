"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Calendar, Clock, Users, Eye, CheckCircle, XCircle } from "lucide-react";

interface ConfRow {
  id: string;
  title: string;
  organizerName: string;
  date: Date;
  time: string;
  coinPrice: number;
  status: string;
  moderatorNote: string | null;
  views: number;
  participantCount: number;
}

interface Props { conferences: ConfRow[]; }

const statusBadge: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700", APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700", CANCELLED: "bg-gray-100 text-gray-700",
};

export function ConferencesModeration({ conferences }: Props) {
  const router = useRouter();
  const [noteOpen, setNoteOpen] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState<string | null>(null);

  async function handleModerate(confId: string, status: string) {
    setLoading(confId);
    try {
      await fetch(`/api/conferences/${confId}/moderate`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, moderatorNote: status === "REJECTED" ? note : null }),
      });
      router.refresh();
    } catch { alert("Ошибка"); }
    setLoading(null);
    setNoteOpen(null);
  }

  return (
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
            <TableRow key={c.id}>
              <TableCell className="font-medium max-w-[200px] truncate">{c.title}</TableCell>
              <TableCell className="text-sm">{c.organizerName}</TableCell>
              <TableCell className="text-sm">
                {new Date(c.date).toLocaleDateString("ru-RU")} {c.time}
              </TableCell>
              <TableCell>{c.coinPrice > 0 ? `${c.coinPrice} мон.` : "Бесплатно"}</TableCell>
              <TableCell><Badge variant="secondary" className={statusBadge[c.status]}>{c.status}</Badge></TableCell>
              <TableCell className="text-xs text-muted-foreground">
                <Eye className="h-3 w-3 inline mr-1" />{c.views} <Users className="h-3 w-3 inline ml-1 mr-1" />{c.participantCount}
              </TableCell>
              <TableCell>
                {c.status === "PENDING" && (
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" className="text-green-600" onClick={() => handleModerate(c.id, "APPROVED")} disabled={loading === c.id}>
                      <CheckCircle className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-600" onClick={() => { setNoteOpen(c.id); setNote(""); }}>
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
              <Button className="bg-red-600 hover:bg-red-700" onClick={() => noteOpen && handleModerate(noteOpen, "REJECTED")}>
                Отклонить
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
