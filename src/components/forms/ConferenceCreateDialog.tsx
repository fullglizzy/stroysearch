"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SearchSelect } from "@/components/shared/SearchSelect";
import { FieldError } from "@/components/forms/fields";
import { toastSuccess, toastError, toastWarning } from "@/lib/toast";
import { Loader2, Upload, X } from "lucide-react";

// Сообщения совпадают с серверной схемой conferenceSchema
const conferenceFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Название обязательно")
    .max(511, "Название должно быть не более 511 символов"),
  date: z.string().min(1, "Укажите дату"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Формат времени: ЧЧ:ММ"),
  description: z
    .string()
    .trim()
    .min(1, "Описание обязательно")
    .max(2500, "Описание должно быть не более 2500 символов"),
  treeItemId: z
    .string()
    .uuid("Некорректная категория")
    .optional()
    .or(z.literal("")),
  coinPrice: z
    .string()
    .trim()
    .regex(/^\d+$/, "Цена — целое число монет")
    .optional()
    .or(z.literal("")),
  isPublic: z.boolean(),
  connectionLink: z
    .string()
    .trim()
    .url("Введите корректную ссылку (https://...)")
    .optional()
    .or(z.literal("")),
});

type ConferenceFormValues = z.infer<typeof conferenceFormSchema>;

const CONFERENCE_FORM_DEFAULTS: ConferenceFormValues = {
  title: "",
  date: "",
  time: "10:00",
  description: "",
  treeItemId: "",
  coinPrice: "0",
  isPublic: true,
  connectionLink: "",
};

/** Дата YYYY-MM-DD из Date (локальная, как у поля type=date) */
function toDateInput(date: Date): string {
  const d = new Date(date);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function initialToDefaults(initial: ConferenceEditData): ConferenceFormValues {
  return {
    title: initial.title,
    date: initial.date ? toDateInput(new Date(initial.date)) : "",
    time: initial.time,
    description: initial.description,
    treeItemId: initial.treeItemId || "",
    coinPrice: String(initial.coinPrice),
    isPublic: initial.isPublic,
    connectionLink: initial.connectionLink || "",
  };
}

interface TreeItem {
  id: string;
  name: string;
  fullNumberPath: string;
}

/** Данные существующей конференции — режим редактирования */
export interface ConferenceEditData {
  id: string;
  title: string;
  date: Date | string; // Date из БД или YYYY-MM-DD
  time: string;
  description: string;
  treeItemId: string | null;
  coinPrice: number;
  isPublic: boolean;
  connectionLink: string | null;
  logoUrl: string | null;
}

/**
 * Диалог создания/редактирования конференции — общий для публичной страницы
 * и личных кабинетов (участника и компании).
 * При передаче initial открывается в режиме редактирования.
 */
export function ConferenceCreateDialog({
  treeItems,
  open,
  onOpenChange,
  initial,
}: {
  treeItems: TreeItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: ConferenceEditData | null;
}) {
  const { data: session } = useSession();
  const router = useRouter();
  const [createError, setCreateError] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createLogo, setCreateLogo] = useState("");
  const [logoLoading, setLogoLoading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const isEdit = !!initial;

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<ConferenceFormValues>({
    resolver: zodResolver(conferenceFormSchema),
    mode: "onTouched",
    defaultValues: CONFERENCE_FORM_DEFAULTS,
  });

  // При открытии диалога подставляем значения: черновик или данные конференции
  useEffect(() => {
    if (open) {
      reset(initial ? initialToDefaults(initial) : CONFERENCE_FORM_DEFAULTS);
      setCreateLogo(initial?.logoUrl || "");
      setCreateError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial?.id]);

  async function handleLogoUpload(file: File) {
    if (!file.type.startsWith("image/")) {
      toastWarning("Проверьте файл", "Фото должно быть изображением");
      return;
    }
    setLogoLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setCreateLogo(data.fileUrl);
      } else {
        toastError("Ошибка загрузки", data.error || "Не удалось загрузить фото");
      }
    } catch {
      toastError("Ошибка соединения");
    }
    setLogoLoading(false);
  }

  async function handleCreate(data: ConferenceFormValues) {
    if (!session?.user) { setCreateError("Требуется авторизация"); return; }
    setCreateLoading(true);
    setCreateError("");
    try {
      const payload = {
        title: data.title,
        date: data.date,
        time: data.time,
        description: data.description,
        treeItemId: data.treeItemId || null,
        coinPrice: data.coinPrice ? parseInt(data.coinPrice, 10) : 0,
        isPublic: data.isPublic,
        connectionLink: data.connectionLink || null,
        logoUrl: createLogo || null,
      };
      const res = await fetch(isEdit ? `/api/conferences/${initial.id}` : "/api/conferences", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        onOpenChange(false);
        setCreateLogo("");
        reset(CONFERENCE_FORM_DEFAULTS);
        toastSuccess(
          isEdit ? "Конференция обновлена" : "Конференция создана",
          isEdit ? "Изменения отправлены на модерацию" : "Конференция отправлена на модерацию",
        );
        router.refresh();
      } else {
        const d = await res.json().catch(() => ({}));
        setCreateError(d.error || "Ошибка");
      }
    } catch { setCreateError("Ошибка соединения"); }
    setCreateLoading(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setCreateLogo(""); reset(CONFERENCE_FORM_DEFAULTS); } }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Редактировать конференцию" : "Создать конференцию"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "После сохранения изменений конференция вернётся на модерацию"
              : "После создания конференция будет отправлена на модерацию"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(handleCreate)} className="space-y-4" noValidate>
          {createError && <Alert variant="destructive"><AlertDescription>{createError}</AlertDescription></Alert>}

          <div className="space-y-2">
            <Label htmlFor="ccd-title">Название</Label>
            <Input
              id="ccd-title"
              maxLength={511}
              aria-invalid={!!errors.title}
              aria-describedby={errors.title ? "ccd-title-error" : undefined}
              {...register("title", {
                setValueAs: (value: string) => value.replace(/\s{2,}/g, " "),
                onChange: (e) => {
                  e.target.value = e.target.value.replace(/\s{2,}/g, " ");
                },
                onBlur: (e) => {
                  e.target.value = e.target.value.trim();
                },
              })}
            />
            {errors.title && <FieldError id="ccd-title-error" message={errors.title.message} />}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ccd-date">Дата</Label>
              <Input id="ccd-date" type="date" aria-invalid={!!errors.date} {...register("date")} />
              {errors.date && <FieldError id="ccd-date-error" message={errors.date.message} />}
            </div>
            <div className="space-y-2">
              <Label htmlFor="ccd-time">Время (МСК)</Label>
              <Input id="ccd-time" type="time" aria-invalid={!!errors.time} {...register("time")} />
              {errors.time && <FieldError id="ccd-time-error" message={errors.time.message} />}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ccd-description">Описание</Label>
            <Textarea
              id="ccd-description"
              rows={3}
              maxLength={2500}
              aria-invalid={!!errors.description}
              {...register("description")}
            />
            {errors.description && <FieldError id="ccd-description-error" message={errors.description.message} />}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ccd-price">Цена (монет, 0 = бесплатно)</Label>
              <Input id="ccd-price" type="number" min={0} aria-invalid={!!errors.coinPrice} {...register("coinPrice")} />
              {errors.coinPrice && <FieldError id="ccd-price-error" message={errors.coinPrice.message} />}
            </div>
            <div className="space-y-2">
              <Label>Категория</Label>
              <Controller
                name="treeItemId"
                control={control}
                render={({ field }) => (
                  <SearchSelect
                    options={[
                      { value: "", label: "Без категории" },
                      ...treeItems.map((t) => ({ value: t.id, label: `${t.fullNumberPath} — ${t.name}` })),
                    ]}
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    placeholder="Выбрать"
                    searchPlaceholder="Поиск категории..."
                    ariaInvalid={!!errors.treeItemId}
                  />
                )}
              />
              {errors.treeItemId && <FieldError id="ccd-cat-error" message={errors.treeItemId.message} />}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Фото конференции</Label>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleLogoUpload(file);
                e.target.value = "";
              }}
            />
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => logoInputRef.current?.click()}
                disabled={logoLoading}
              >
                {logoLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                {createLogo ? "Заменить фото" : "Загрузить фото"}
              </Button>
              {createLogo && (
                <>
                  <img src={createLogo} alt="Фото конференции" className="h-12 w-12 rounded-md border object-cover" loading="lazy" decoding="async" />
                  <Button type="button" variant="ghost" size="sm" onClick={() => setCreateLogo("")}>
                    <X className="h-4 w-4 mr-1" />
                    Убрать
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ccd-link">Ссылка для подключения</Label>
            <Input
              id="ccd-link"
              placeholder="https://..."
              aria-invalid={!!errors.connectionLink}
              {...register("connectionLink", {
                onChange: (e) => {
                  e.target.value = e.target.value.replace(/\s/g, "");
                },
              })}
            />
            {errors.connectionLink && <FieldError id="ccd-link-error" message={errors.connectionLink.message} />}
          </div>

          <Controller
            name="isPublic"
            control={control}
            render={({ field }) => (
              <div className="flex items-center gap-2 text-sm">
                <Checkbox
                  id="ccd-isPublic"
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                />
                <Label htmlFor="ccd-isPublic" className="cursor-pointer font-normal">
                  Только для зарегистрированных
                </Label>
              </div>
            )}
          />

          <Button type="submit" className="w-full bg-menthol hover:bg-menthol-dark" disabled={createLoading}>
            {createLoading ? "Сохранение..." : isEdit ? "Сохранить изменения" : "Создать"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
