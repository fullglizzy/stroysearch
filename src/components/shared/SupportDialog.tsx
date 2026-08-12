"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supportTicketSchema } from "@/lib/validators";
import { SUPPORT_TOPICS, SUPPORT_TOPIC_ITEMS } from "@/lib/support";
import { toastSuccess } from "@/lib/toast";

interface SupportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Вызывается после успешного создания обращения */
  onSuccess?: () => void;
}

/**
 * Диалог обращения в поддержку — используется на главной странице
 * (плавающая кнопка) и в дропдауне профиля в хедере.
 */
export function SupportDialog({ open, onOpenChange, onSuccess }: SupportDialogProps) {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [subject, setSubject] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const raw = {
      subject,
      message: (formData.get("message") as string).trim(),
    };

    const parsed = supportTicketSchema.safeParse(raw);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      if (res.ok) {
        setSuccess(true);
        toastSuccess("Обращение отправлено", "Мы ответим вам в ближайшее время");
        onSuccess?.();
        setTimeout(() => {
          onOpenChange(false);
          setTimeout(() => setSuccess(false), 300);
        }, 1500);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Ошибка при отправке. Попробуйте позже.");
      }
    } catch {
      setError("Ошибка соединения. Попробуйте позже.");
    }

    setLoading(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) setSuccess(false);
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Обращение в поддержку</DialogTitle>
          <DialogDescription>
            Опишите ваш вопрос или проблему, и мы свяжемся с вами
          </DialogDescription>
        </DialogHeader>
        {success ? (
          <Alert>
            <AlertDescription>
              Ваше обращение отправлено! Мы свяжемся с вами в ближайшее время.
            </AlertDescription>
          </Alert>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label>Тема обращения</Label>
              <Select
                value={subject}
                items={SUPPORT_TOPIC_ITEMS}
                onValueChange={(v) => setSubject(v ?? "")}
              >
                <SelectTrigger className="w-full justify-between">
                  <SelectValue placeholder="Выберите тему" />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORT_TOPICS.map((t) => (
                    <SelectItem key={t} value={t} label={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="support-message">Сообщение</Label>
              <Textarea
                id="support-message"
                name="message"
                placeholder="Опишите ваш вопрос..."
                rows={4}
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-menthol hover:bg-menthol-dark"
              disabled={loading}
            >
              {loading ? "Отправка..." : "Отправить"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
