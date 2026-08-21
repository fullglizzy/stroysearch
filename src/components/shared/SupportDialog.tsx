"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FieldError, applyPhoneMask, formatRussianPhone } from "@/components/forms/fields";
import { supportTicketSchema } from "@/lib/validators";
import { SUPPORT_TOPICS, SUPPORT_TOPIC_ITEMS } from "@/lib/support";
import { toastSuccess } from "@/lib/toast";

interface SupportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Вызывается после успешного создания обращения */
  onSuccess?: () => void;
}

interface FieldErrors {
  email?: string;
  phone?: string;
  inn?: string;
}

/**
 * Диалог обращения в поддержку — используется на главной странице
 * (плавающая кнопка), в дропдауне профиля в хедере и в футере.
 * Гостям показывается форма с контактами (email, телефон, ИНН для компаний),
 * чтобы поддержка могла связаться с ними; авторизованным — простая форма.
 */
export function SupportDialog({ open, onOpenChange, onSuccess }: SupportDialogProps) {
  const { data: session } = useSession();
  const isGuest = !session?.user;
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [subject, setSubject] = useState("");
  const [guestType, setGuestType] = useState<"person" | "company">("person");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setFieldErrors({});
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = ((formData.get("email") as string | null) ?? "").trim();
    const phone = ((formData.get("phone") as string | null) ?? "").trim();
    const inn = ((formData.get("inn") as string | null) ?? "").trim();

    // Гость обязан оставить контакты для связи
    if (isGuest) {
      if (!email) {
        setFieldErrors({ email: "Укажите email для связи" });
        setLoading(false);
        return;
      }
      if (!phone) {
        setFieldErrors({ phone: "Укажите телефон для связи" });
        setLoading(false);
        return;
      }
      if (guestType === "company" && !inn) {
        setFieldErrors({ inn: "Укажите ИНН компании" });
        setLoading(false);
        return;
      }
    }

    const raw = {
      subject,
      message: (formData.get("message") as string).trim(),
      ...(isGuest
        ? {
            email,
            phone,
            inn: guestType === "company" ? inn : "",
          }
        : {}),
    };

    const parsed = supportTicketSchema.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = issue.path[0] as keyof FieldErrors;
      if (field === "email" || field === "phone" || field === "inn") {
        setFieldErrors({ [field]: issue.message });
      } else {
        setError(issue.message);
      }
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
            {isGuest
              ? "Опишите ваш вопрос и оставьте контакты — мы свяжемся с вами"
              : "Опишите ваш вопрос или проблему, и мы свяжемся с вами"}
          </DialogDescription>
        </DialogHeader>
        {success ? (
          <Alert>
            <AlertDescription>
              Ваше обращение отправлено! Мы свяжемся с вами в ближайшее время.
            </AlertDescription>
          </Alert>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {isGuest && (
              <>
                <div className="space-y-2">
                  <Label>Вы обращаетесь как</Label>
                  <Select
                    value={guestType}
                    items={{ person: "Частное лицо", company: "Компания" }}
                    onValueChange={(v) => setGuestType(v === "company" ? "company" : "person")}
                  >
                    <SelectTrigger className="w-full justify-between">
                      <SelectValue placeholder="Выберите вариант" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="person" label="Частное лицо">Частное лицо</SelectItem>
                      <SelectItem value="company" label="Компания">Компания</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="support-email">Email</Label>
                  <Input
                    id="support-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    aria-invalid={!!fieldErrors.email}
                    aria-describedby={fieldErrors.email ? "support-email-error" : undefined}
                    onChange={(e) => {
                      // Маска: без пробелов, в нижнем регистре
                      e.target.value = e.target.value.replace(/\s/g, "").toLowerCase();
                    }}
                  />
                  {fieldErrors.email && (
                    <FieldError id="support-email-error" message={fieldErrors.email} />
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="support-phone">Телефон</Label>
                  <Input
                    id="support-phone"
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="+7 (999) 123-45-67"
                    maxLength={18}
                    aria-invalid={!!fieldErrors.phone}
                    aria-describedby={fieldErrors.phone ? "support-phone-error" : undefined}
                    onChange={(e) => applyPhoneMask(e.target)}
                    onBlur={(e) => {
                      e.target.value = formatRussianPhone(e.target.value);
                    }}
                  />
                  {fieldErrors.phone && (
                    <FieldError id="support-phone-error" message={fieldErrors.phone} />
                  )}
                </div>
                {guestType === "company" && (
                  <div className="space-y-2">
                    <Label htmlFor="support-inn">ИНН компании</Label>
                    <Input
                      id="support-inn"
                      name="inn"
                      placeholder="ИНН"
                      aria-invalid={!!fieldErrors.inn}
                      aria-describedby={fieldErrors.inn ? "support-inn-error" : undefined}
                    />
                    {fieldErrors.inn && (
                      <FieldError id="support-inn-error" message={fieldErrors.inn} />
                    )}
                  </div>
                )}
              </>
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
