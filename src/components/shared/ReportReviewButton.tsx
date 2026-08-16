"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toastSuccess, toastError } from "@/lib/toast";
import { Flag } from "lucide-react";

/** Кнопка «Пожаловаться» на отзыв — отправляет жалобу модераторам */
export function ReportReviewButton({ reviewId }: { reviewId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!reason.trim()) {
      toastError("Укажите причину", "Коротко опишите, что не так с отзывом");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/reviews/${reviewId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      if (res.ok) {
        setOpen(false);
        setReason("");
        toastSuccess("Жалоба отправлена", "Модераторы рассмотрят отзыв");
      } else {
        const d = await res.json().catch(() => ({}));
        toastError("Ошибка", d.error || "Не удалось отправить жалобу");
      }
    } catch {
      toastError("Ошибка соединения");
    }
    setLoading(false);
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-destructive"
        title="Пожаловаться на отзыв"
        onClick={() => setOpen(true)}
      >
        <Flag className="h-3 w-3 mr-1" />
        Пожаловаться
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Жалоба на отзыв</DialogTitle>
            <DialogDescription>
              Опишите причину — модераторы проверят отзыв и при необходимости скроют его.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="report-reason">Причина</Label>
            <Textarea
              id="report-reason"
              rows={3}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Например: оскорбительное содержание, недостоверная информация"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Отмена
            </Button>
            <Button variant="destructive" onClick={handleSubmit} disabled={loading}>
              {loading ? "Отправка..." : "Отправить жалобу"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
