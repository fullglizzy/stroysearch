"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Save } from "lucide-react";
import { toastSuccess, toastError } from "@/lib/toast";
import { profileSchema } from "@/lib/validators";
import { FieldError, applyPhoneMask, formatRussianPhone } from "@/components/forms/fields";
import { MultiSelect, type MultiSelectOption } from "@/components/shared/MultiSelect";
import { matchClassifier } from "@/lib/classifier";
import { toggleAllRegions } from "@/lib/regions";

const ROLE_VALUES = ["PRODUCTOLOGIST", "TENDER_SPECIALIST", "DESIGNER", "COMPANY_OWNER", "OTHER"] as const;
type Role = (typeof ROLE_VALUES)[number];

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "PRODUCTOLOGIST", label: "Продуктолог" },
  { value: "TENDER_SPECIALIST", label: "Тендерный специалист" },
  { value: "DESIGNER", label: "Проектировщик" },
  { value: "COMPANY_OWNER", label: "Владелец компании" },
  { value: "OTHER", label: "Иное" },
];

// Правила телефона берём из общей схемы, чтобы сообщения совпадали с сервером
const profileFormSchema = z.object({
  firstName: z
    .string()
    .trim()
    .max(127, "Имя должно быть не более 127 символов")
    .optional()
    .or(z.literal("")),
  lastName: z
    .string()
    .trim()
    .max(127, "Фамилия должна быть не более 127 символов")
    .optional()
    .or(z.literal("")),
  middleName: z
    .string()
    .trim()
    .max(127, "Отчество должно быть не более 127 символов")
    .optional()
    .or(z.literal("")),
  phone: profileSchema.shape.phone,
  regions: z.array(z.string().min(1).max(255, "Регион должен быть не более 255 символов")),
  classifierIds: z.array(z.string().uuid("Некорректный классификатор")),
  roles: z.array(z.enum(ROLE_VALUES)),
  isContactsHidden: z.boolean(),
});

type ProfileFormData = z.infer<typeof profileFormSchema>;

interface ProfileFormProps {
  initialData: {
    firstName: string;
    lastName: string;
    middleName: string;
    phone: string;
    email: string;
    regions: string[];
    isContactsHidden: boolean;
    classifierIds: string[];
    roles: string[];
  };
  username: string;
  nick: string | null;
  regionOptions: MultiSelectOption[];
  classifierOptions: MultiSelectOption[];
}

export function ProfileForm({
  initialData,
  username,
  nick,
  regionOptions,
  classifierOptions,
}: ProfileFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
    // Валидируем после первого «касания» поля, а не сразу при наборе
    mode: "onTouched",
    defaultValues: {
      firstName: initialData.firstName,
      lastName: initialData.lastName,
      middleName: initialData.middleName,
      phone: initialData.phone,
      regions: initialData.regions,
      classifierIds: initialData.classifierIds,
      roles: initialData.roles.filter((r): r is Role => ROLE_VALUES.includes(r as Role)),
      isContactsHidden: initialData.isContactsHidden,
    },
  });

  async function onSubmit(data: ProfileFormData) {
    setLoading(true);

    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: data.firstName || undefined,
          lastName: data.lastName || undefined,
          middleName: data.middleName || undefined,
          phone: data.phone || undefined,
          regions: data.regions,
          isContactsHidden: data.isContactsHidden,
          roles: data.roles,
          classifierIds: data.classifierIds,
        }),
      });

      if (res.ok) {
        toastSuccess("Профиль обновлён");
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
      <Card>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Логин (нельзя изменить)</Label>
            <Input value={username} disabled />
          </div>
          <div className="space-y-2">
            <Label>Ник (нельзя изменить после регистрации)</Label>
            <Input value={nick || "—"} disabled />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={initialData.email} disabled />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4">
          <h3 className="font-semibold">Личная информация</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lastName">Фамилия</Label>
              <Input
                id="lastName"
                autoComplete="family-name"
                maxLength={127}
                disabled={loading}
                aria-invalid={!!errors.lastName}
                aria-describedby={errors.lastName ? "lastName-error" : undefined}
                {...register("lastName", {
                  setValueAs: (value: string) => value.replace(/\s{2,}/g, " "),
                  onChange: (e) => {
                    e.target.value = e.target.value.replace(/\s{2,}/g, " ");
                  },
                  onBlur: (e) => {
                    e.target.value = e.target.value.trim();
                  },
                })}
              />
              {errors.lastName && (
                <FieldError id="lastName-error" message={errors.lastName.message} />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="firstName">Имя</Label>
              <Input
                id="firstName"
                autoComplete="given-name"
                maxLength={127}
                disabled={loading}
                aria-invalid={!!errors.firstName}
                aria-describedby={errors.firstName ? "firstName-error" : undefined}
                {...register("firstName", {
                  setValueAs: (value: string) => value.replace(/\s{2,}/g, " "),
                  onChange: (e) => {
                    e.target.value = e.target.value.replace(/\s{2,}/g, " ");
                  },
                  onBlur: (e) => {
                    e.target.value = e.target.value.trim();
                  },
                })}
              />
              {errors.firstName && (
                <FieldError id="firstName-error" message={errors.firstName.message} />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="middleName">Отчество</Label>
              <Input
                id="middleName"
                autoComplete="additional-name"
                maxLength={127}
                disabled={loading}
                aria-invalid={!!errors.middleName}
                aria-describedby={errors.middleName ? "middleName-error" : undefined}
                {...register("middleName", {
                  setValueAs: (value: string) => value.replace(/\s{2,}/g, " "),
                  onChange: (e) => {
                    e.target.value = e.target.value.replace(/\s{2,}/g, " ");
                  },
                  onBlur: (e) => {
                    e.target.value = e.target.value.trim();
                  },
                })}
              />
              {errors.middleName && (
                <FieldError id="middleName-error" message={errors.middleName.message} />
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <Label>Регион</Label>
              <Controller
                name="regions"
                control={control}
                render={({ field }) => (
                  <MultiSelect
                    options={regionOptions}
                    value={field.value ?? []}
                    onChange={(v) => field.onChange(toggleAllRegions(field.value ?? [], v))}
                    placeholder="Выберите регионы"
                    searchPlaceholder="Поиск региона..."
                    disabled={loading}
                    ariaInvalid={!!errors.regions}
                  />
                )}
              />
              {errors.regions && <FieldError id="regions-error" message={errors.regions.message} />}
            </div>
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

      <Card>
        <CardContent className="space-y-4">
          <h3 className="font-semibold">Роли</h3>
          <div className="space-y-3">
            <Controller
              name="roles"
              control={control}
              render={({ field }) => (
                <>
                  {ROLE_OPTIONS.map((role) => {
                    const checked = field.value.includes(role.value);
                    return (
                      <div key={role.value} className="flex items-center gap-2">
                        <Checkbox
                          id={`role_${role.value}`}
                          checked={checked}
                          onCheckedChange={(v) => {
                            const next = v === true
                              ? [...field.value, role.value]
                              : field.value.filter((r) => r !== role.value);
                            field.onChange(next);
                          }}
                          disabled={loading}
                        />
                        <Label htmlFor={`role_${role.value}`} className="cursor-pointer">
                          {role.label}
                        </Label>
                      </div>
                    );
                  })}
                </>
              )}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <div className="flex items-center justify-between">
            <Label htmlFor="isContactsHidden">
              Скрыть мои персональные данные от всех
            </Label>
            <Controller
              name="isContactsHidden"
              control={control}
              render={({ field }) => (
                <Switch
                  id="isContactsHidden"
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                  disabled={loading}
                />
              )}
            />
          </div>
        </CardContent>
      </Card>

      <Button
        type="submit"
        className="bg-menthol hover:bg-menthol-dark"
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <Save className="h-4 w-4 mr-2" />
        )}
        Сохранить изменения
      </Button>
    </form>
  );
}
