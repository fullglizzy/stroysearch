"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, Mail, Globe, Star, MessageSquare, Loader2, Save } from "lucide-react";
import { toastSuccess, toastError } from "@/lib/toast";
import { profileSchema } from "@/lib/validators";
import { FieldError, applyPhoneMask, formatRussianPhone } from "@/components/forms/fields";
import { SearchSelect, type SearchSelectOption } from "@/components/shared/SearchSelect";
import { MultiSelect, type MultiSelectOption } from "@/components/shared/MultiSelect";
import { matchClassifier } from "@/lib/classifier";

// Правила КПП и телефона берём из общей схемы, чтобы сообщения совпадали с сервером
const companyProfileSchema = z.object({
  companyName: z
    .string()
    .trim()
    .max(255, "Название должно быть не более 255 символов")
    .optional()
    .or(z.literal("")),
  kpp: profileSchema.shape.kpp,
  directorName: z
    .string()
    .trim()
    .max(255, "ФИО директора должно быть не более 255 символов")
    .optional()
    .or(z.literal("")),
  legalAddress: z
    .string()
    .trim()
    .max(511, "Адрес должен быть не более 511 символов")
    .optional()
    .or(z.literal("")),
  phone: profileSchema.shape.phone,
  website: z
    .string()
    .trim()
    .max(255, "Сайт должен быть не более 255 символов")
    .refine((v) => !/\s/.test(v), "Ссылка не должна содержать пробелов")
    .optional()
    .or(z.literal("")),
  region: z
    .string()
    .trim()
    .max(255, "Регион должен быть не более 255 символов")
    .optional()
    .or(z.literal("")),
  classifierIds: z.array(z.string().uuid("Некорректный классификатор")),
});

type CompanyProfileData = z.infer<typeof companyProfileSchema>;

interface CompanyProfileFormProps {
  initialData: {
    inn: string;
    companyName: string;
    kpp: string;
    legalAddress: string;
    phone: string;
    email: string;
    website: string;
    region: string;
    classifierIds: string[];
    directorName: string;
  };
  username: string;
  metrics: { phoneViews: number; emailViews: number; websiteViews: number; ratingViews: number; reviewsViews: number } | null;
  regionOptions: SearchSelectOption[];
  classifierOptions: MultiSelectOption[];
}

export function CompanyProfileForm({
  initialData,
  username,
  metrics,
  regionOptions,
  classifierOptions,
}: CompanyProfileFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<CompanyProfileData>({
    resolver: zodResolver(companyProfileSchema),
    // Валидируем после первого «касания» поля, а не сразу при наборе
    mode: "onTouched",
    defaultValues: {
      companyName: initialData.companyName,
      kpp: initialData.kpp,
      directorName: initialData.directorName,
      legalAddress: initialData.legalAddress,
      phone: initialData.phone,
      website: initialData.website,
      region: initialData.region,
      classifierIds: initialData.classifierIds,
    },
  });

  async function onSubmit(data: CompanyProfileData) {
    setLoading(true);

    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: data.phone || undefined,
          website: data.website || undefined,
          region: data.region || undefined,
          classifierIds: data.classifierIds,
          companyName: data.companyName || undefined,
          kpp: data.kpp || undefined,
          legalAddress: data.legalAddress || undefined,
          directorName: data.directorName || undefined,
        }),
      });

      if (res.ok) {
        toastSuccess("Профиль компании обновлён");
        router.refresh();
      } else {
        const resData = await res.json().catch(() => ({}));
        toastError("Ошибка", resData.error || "Не удалось обновить профиль");
      }
    } catch {
      toastError("Ошибка соединения", "Проверьте подключение к интернету");
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      {/* Метрики просмотров (ТЗ §12.8) */}
      {metrics && (
        <Card>
          <CardHeader><CardTitle className="text-base">Метрики просмотров</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Телефон: <strong>{metrics.phoneViews}</strong> просмотров</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Email: <strong>{metrics.emailViews}</strong> просмотров</span>
              </div>
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Сайт: <strong>{metrics.websiteViews}</strong> просмотров</span>
              </div>
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Рейтинг: <strong>{metrics.ratingViews}</strong> просмотров</span>
              </div>
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Отзывы: <strong>{metrics.reviewsViews}</strong> просмотров</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Основная информация</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Логин (нельзя изменить)</Label>
            <Input value={username} disabled />
          </div>
          <div className="space-y-2">
            <Label>ИНН (нельзя изменить)</Label>
            <Input value={initialData.inn} disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="companyName">Название компании</Label>
            <Input
              id="companyName"
              autoComplete="organization"
              maxLength={255}
              disabled={loading}
              aria-invalid={!!errors.companyName}
              aria-describedby={errors.companyName ? "companyName-error" : undefined}
              {...register("companyName", {
                setValueAs: (value: string) => value.replace(/\s{2,}/g, " "),
                onChange: (e) => {
                  e.target.value = e.target.value.replace(/\s{2,}/g, " ");
                },
                onBlur: (e) => {
                  e.target.value = e.target.value.trim();
                },
              })}
            />
            {errors.companyName && (
              <FieldError id="companyName-error" message={errors.companyName.message} />
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="kpp">КПП (9 цифр)</Label>
              <Input
                id="kpp"
                type="text"
                inputMode="numeric"
                placeholder="XXXXXXXXX"
                maxLength={9}
                disabled={loading}
                aria-invalid={!!errors.kpp}
                aria-describedby={errors.kpp ? "kpp-error" : undefined}
                {...register("kpp", {
                  setValueAs: (value: string) => value.replace(/\D/g, "").slice(0, 9),
                  onChange: (e) => {
                    e.target.value = e.target.value.replace(/\D/g, "").slice(0, 9);
                  },
                })}
              />
              {errors.kpp && <FieldError id="kpp-error" message={errors.kpp.message} />}
            </div>
            <div className="space-y-2">
              <Label htmlFor="directorName">Директор</Label>
              <Input
                id="directorName"
                maxLength={255}
                disabled={loading}
                aria-invalid={!!errors.directorName}
                aria-describedby={errors.directorName ? "directorName-error" : undefined}
                {...register("directorName", {
                  setValueAs: (value: string) => value.replace(/\s{2,}/g, " "),
                  onChange: (e) => {
                    e.target.value = e.target.value.replace(/\s{2,}/g, " ");
                  },
                  onBlur: (e) => {
                    e.target.value = e.target.value.trim();
                  },
                })}
              />
              {errors.directorName && (
                <FieldError id="directorName-error" message={errors.directorName.message} />
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="legalAddress">Юридический адрес</Label>
            <Input
              id="legalAddress"
              autoComplete="street-address"
              maxLength={511}
              disabled={loading}
              aria-invalid={!!errors.legalAddress}
              aria-describedby={errors.legalAddress ? "legalAddress-error" : undefined}
              {...register("legalAddress", {
                setValueAs: (value: string) => value.replace(/\s{2,}/g, " "),
                onChange: (e) => {
                  e.target.value = e.target.value.replace(/\s{2,}/g, " ");
                },
                onBlur: (e) => {
                  e.target.value = e.target.value.trim();
                },
              })}
            />
            {errors.legalAddress && (
              <FieldError id="legalAddress-error" message={errors.legalAddress.message} />
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Контакты</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Телефон (+7 XXX XXX-XX-XX)</Label>
            <Input
              id="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
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
            <Label>Email</Label>
            <Input value={initialData.email} disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="website">Сайт (необязательно)</Label>
            <Input
              id="website"
              type="url"
              autoComplete="url"
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
            {errors.website && <FieldError id="website-error" message={errors.website.message} />}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Классификация</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Регион</Label>
            <Controller
              name="region"
              control={control}
              render={({ field }) => (
                <SearchSelect
                  options={regionOptions}
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  placeholder="Выберите регион"
                  searchPlaceholder="Поиск региона..."
                  disabled={loading}
                  ariaInvalid={!!errors.region}
                />
              )}
            />
            {errors.region && <FieldError id="region-error" message={errors.region.message} />}
          </div>
          <div className="space-y-2">
            <Label>Классификаторы</Label>
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
              <FieldError id="classifierIds-error" message={errors.classifierIds.message} />
            )}
          </div>
        </CardContent>
      </Card>

      <Button type="submit" className="bg-menthol hover:bg-menthol-dark" disabled={loading}>
        {loading ? (
          <><Loader2 className="h-4 w-4 animate-spin mr-2" />Сохранение...</>
        ) : (
          <><Save className="h-4 w-4 mr-2" />Сохранить изменения</>
        )}
      </Button>
    </form>
  );
}
