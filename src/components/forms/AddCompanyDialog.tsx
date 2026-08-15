"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MultiSelect } from "@/components/shared/MultiSelect";
import { FieldError, applyPhoneMask, formatRussianPhone } from "@/components/forms/fields";
import { matchClassifier } from "@/lib/classifier";
import { isValidInn } from "@/lib/validators";
import { toastSuccess } from "@/lib/toast";
import { ALL_REGIONS, toggleAllRegions } from "@/lib/regions";
import { Plus } from "lucide-react";

// Сообщения совпадают с серверной схемой addCompanySchema
const addCompanyFormSchema = z.object({
  inn: z
    .string()
    .regex(/^\d{10}$|^\d{12}$/, "ИНН должен содержать ровно 10 или 12 цифр")
    .refine(isValidInn, "Такого ИНН не существует — проверьте номер"),
  name: z
    .string()
    .trim()
    .min(1, "Название компании обязательно")
    .max(255, "Название должно быть не более 255 символов"),
  email: z.string().trim().toLowerCase().email("Некорректный email"),
  phone: z
    .string()
    .regex(
      /^(\+7|8)?[\s-]?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}$/,
      "Неверный формат телефона. Пример: +7 (999) 123-45-67",
    ),
  website: z
    .string()
    .trim()
    .max(255, "Сайт должен быть не более 255 символов")
    .refine((v) => !/\s/.test(v), "Ссылка не должна содержать пробелов")
    .optional()
    .or(z.literal("")),
  regions: z
    .array(z.string().min(1).max(255, "Регион должен быть не более 255 символов"))
    .min(1, "Выберите регион"),
  classifierIds: z
    .array(z.string().uuid("Некорректный классификатор"))
    .min(1, "Выберите хотя бы одну категорию классификатора"),
});

type AddCompanyFormValues = z.infer<typeof addCompanyFormSchema>;

const ADD_COMPANY_FORM_DEFAULTS: AddCompanyFormValues = {
  inn: "",
  name: "",
  email: "",
  phone: "",
  website: "",
  regions: [],
  classifierIds: [],
};

interface AddCompanyDialogProps {
  /** Каталог регионов из БД («Все регионы» добавится первой опцией) */
  regions: string[];
  treeItems: { id: string; name: string; fullNumberPath: string }[];
  buttonLabel?: string;
  buttonClassName?: string;
  /** Кастомный триггер вместо стандартной кнопки (например, с guard авторизации) */
  renderTrigger?: (open: () => void) => React.ReactNode;
}

/**
 * Кнопка «Добавить компанию» + диалог с формой (как в базе поставщиков).
 * После добавления делает router.refresh(), чтобы списки на странице обновились.
 */
export function AddCompanyDialog({
  regions,
  treeItems,
  buttonLabel = "Добавить компанию",
  buttonClassName,
  renderTrigger,
}: AddCompanyDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  const regionOptions = useMemo(
    () => [{ value: ALL_REGIONS, label: ALL_REGIONS }, ...regions.map((r) => ({ value: r, label: r }))],
    [regions],
  );
  const classifierOptions = useMemo(
    () => treeItems.map((t) => ({ value: t.id, label: `${t.fullNumberPath} — ${t.name}` })),
    [treeItems],
  );

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    setError: setFieldError,
    setFocus,
    formState: { errors },
  } = useForm<AddCompanyFormValues>({
    resolver: zodResolver(addCompanyFormSchema),
    // Валидируем после первого «касания» поля, а не сразу при наборе
    mode: "onTouched",
    defaultValues: ADD_COMPANY_FORM_DEFAULTS,
  });

  async function onSubmit(values: AddCompanyFormValues) {
    setFormError("");
    setLoading(true);

    try {
      const res = await fetch("/api/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inn: values.inn,
          name: values.name,
          email: values.email,
          phone: values.phone,
          website: values.website,
          regions: values.regions,
          classifierIds: values.classifierIds,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const message = data.error || "Ошибка добавления";
        // Конфликт ИНН привязываем к полю
        if (message.includes("ИНН")) {
          setFieldError("inn", { message });
          setFocus("inn");
        } else {
          setFormError(message);
        }
      } else {
        setOpen(false);
        reset(ADD_COMPANY_FORM_DEFAULTS);
        toastSuccess("Компания добавлена", "+1 монета начислена на ваш счёт");
        router.refresh();
      }
    } catch {
      setFormError("Ошибка соединения");
    }
    setLoading(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setFormError("");
          reset(ADD_COMPANY_FORM_DEFAULTS);
        }
      }}
    >
      {renderTrigger ? (
        renderTrigger(() => setOpen(true))
      ) : (
        <Button
          className={buttonClassName || "bg-menthol hover:bg-menthol-dark gap-2"}
          onClick={() => setOpen(true)}
        >
          <Plus className="h-4 w-4" />
          {buttonLabel}
        </Button>
      )}
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Добавить компанию</DialogTitle>
          <DialogDescription>
            Заполните данные компании. За добавление начисляется +1 монета
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {formError && (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="inn">ИНН</Label>
            <Input
              id="inn"
              inputMode="numeric"
              placeholder="10 или 12 цифр"
              maxLength={12}
              disabled={loading}
              aria-invalid={!!errors.inn}
              aria-describedby={errors.inn ? "inn-error" : "inn-hint"}
              {...register("inn", {
                // Маска: только цифры, не более 12
                setValueAs: (value: string) => value.replace(/\D/g, "").slice(0, 12),
                onChange: (e) => {
                  e.target.value = e.target.value.replace(/\D/g, "").slice(0, 12);
                },
              })}
            />
            {errors.inn ? (
              <FieldError id="inn-error" message={errors.inn.message} />
            ) : (
              <p id="inn-hint" className="text-xs text-muted-foreground">
                10 цифр для организации, 12 — для ИП
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Название</Label>
            <Input
              id="name"
              placeholder="ООО «Компания»"
              maxLength={255}
              disabled={loading}
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? "name-error" : undefined}
              {...register("name", {
                setValueAs: (value: string) => value.replace(/\s{2,}/g, " "),
                onChange: (e) => {
                  e.target.value = e.target.value.replace(/\s{2,}/g, " ");
                },
                onBlur: (e) => {
                  e.target.value = e.target.value.trim();
                },
              })}
            />
            {errors.name && <FieldError id="name-error" message={errors.name.message} />}
          </div>
          <div className="space-y-2">
            <Label>Регион</Label>
            <Controller
              name="regions"
              control={control}
              render={({ field }) => (
                <MultiSelect
                  options={regionOptions}
                  value={field.value ?? []}
                  onChange={(v) => field.onChange(toggleAllRegions(field.value ?? [], v))}
                  placeholder="Регион"
                  searchPlaceholder="Поиск региона..."
                  disabled={loading}
                  ariaInvalid={!!errors.regions}
                />
              )}
            />
            {errors.regions && (
              <FieldError
                id="regions-error"
                message={(errors.regions as { message?: string }).message}
              />
            )}
          </div>
          <div className="space-y-2">
            <Label>Классификатор</Label>
            <Controller
              name="classifierIds"
              control={control}
              render={({ field }) => (
                <MultiSelect
                  options={classifierOptions}
                  value={field.value ?? []}
                  onChange={field.onChange}
                  placeholder="Выберите категории классификатора"
                  searchPlaceholder="Поиск по классификатору..."
                  filter={matchClassifier}
                  hideSelectedLabels
                  disabled={loading}
                  ariaInvalid={!!errors.classifierIds}
                />
              )}
            />
            {errors.classifierIds && (
              <FieldError
                id="classifierIds-error"
                message={(errors.classifierIds as { message?: string }).message}
              />
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Эл. почта</Label>
            <Input
              id="email"
              type="email"
              placeholder="company@mail.ru"
              disabled={loading}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "email-error" : undefined}
              {...register("email", {
                // Маска: без пробелов, в нижнем регистре
                setValueAs: (value: string) => value.replace(/\s/g, "").toLowerCase(),
                onChange: (e) => {
                  e.target.value = e.target.value.replace(/\s/g, "").toLowerCase();
                },
              })}
            />
            {errors.email && <FieldError id="email-error" message={errors.email.message} />}
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Телефон</Label>
            <Input
              id="phone"
              type="tel"
              inputMode="tel"
              placeholder="+7 (999) 123-45-67"
              maxLength={18}
              disabled={loading}
              aria-invalid={!!errors.phone}
              aria-describedby={errors.phone ? "phone-error" : undefined}
              {...register("phone", {
                setValueAs: (value: string) => formatRussianPhone(value),
                onChange: (e) => applyPhoneMask(e.target),
                onBlur: (e) => {
                  const formatted = formatRussianPhone(e.target.value);
                  e.target.value = formatted;
                  setValue("phone", formatted, { shouldValidate: true, shouldDirty: true });
                },
              })}
            />
            {errors.phone && <FieldError id="phone-error" message={errors.phone.message} />}
          </div>
          <div className="space-y-2">
            <Label htmlFor="website">Сайт (необязательно)</Label>
            <Input
              id="website"
              placeholder="example.ru"
              maxLength={255}
              disabled={loading}
              aria-invalid={!!errors.website}
              aria-describedby={errors.website ? "website-error" : undefined}
              {...register("website", {
                onChange: (e) => {
                  e.target.value = e.target.value.replace(/\s/g, "");
                },
                onBlur: (e) => {
                  e.target.value = e.target.value.trim();
                },
              })}
            />
            {errors.website && (
              <FieldError id="website-error" message={errors.website.message} />
            )}
          </div>
          <Button
            type="submit"
            className="w-full bg-menthol hover:bg-menthol-dark"
            disabled={loading}
          >
            {loading ? "Добавление..." : "Добавить (+1 монета)"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
