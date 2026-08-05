"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
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

const profileFormSchema = z.object({
  lastName: z.string().max(255).optional(),
  firstName: z.string().max(255).optional(),
  middleName: z.string().max(255).optional(),
  phone: z.string().max(63).optional(),
  region: z.string().max(255).optional(),
  classifierIds: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileFormSchema>;

interface ProfileFormProps {
  initialData: {
    firstName: string;
    lastName: string;
    middleName: string;
    phone: string;
    email: string;
    region: string;
    isContactsHidden: boolean;
    classifierIds: string[];
    roles: string[];
  };
  username: string;
  nick: string | null;
}

const ROLE_OPTIONS = [
  { value: "PRODUCTOLOGIST", label: "Продуктолог" },
  { value: "TENDER_SPECIALIST", label: "Тендерный специалист" },
  { value: "DESIGNER", label: "Проектировщик" },
  { value: "COMPANY_OWNER", label: "Владелец компании" },
  { value: "OTHER", label: "Иное" },
];

export function ProfileForm({ initialData, username, nick }: ProfileFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [isContactsHidden, setIsContactsHidden] = useState(initialData.isContactsHidden);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      lastName: initialData.lastName,
      firstName: initialData.firstName,
      middleName: initialData.middleName,
      phone: initialData.phone,
      region: initialData.region,
      classifierIds: initialData.classifierIds.join(", "),
    },
  });

  async function onSubmit(data: ProfileFormData) {
    setLoading(true);

    const selectedRoles = ROLE_OPTIONS.filter(
      (r) => (document.getElementById(`role_${r.value}`) as HTMLInputElement)?.checked,
    ).map((r) => r.value);

    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: data.firstName || undefined,
          lastName: data.lastName || undefined,
          middleName: data.middleName || undefined,
          phone: data.phone || undefined,
          region: data.region || undefined,
          isContactsHidden,
          roles: selectedRoles,
          classifierIds: data.classifierIds
            ? data.classifierIds.split(",").map((s) => s.trim()).filter(Boolean)
            : [],
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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-2">
            <Label>Логин (нельзя изменить)</Label>
            <Input value={username} disabled />
          </div>
          <div className="space-y-2">
            <Label>Ник (нельзя изменить после регистрации — ТЗ §11.8)</Label>
            <Input value={nick || "—"} disabled />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={initialData.email} disabled />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <h3 className="font-semibold">Личная информация</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lastName">Фамилия</Label>
              <Input id="lastName" {...register("lastName")} />
              {errors.lastName && (
                <p className="text-xs text-destructive">{errors.lastName.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="firstName">Имя</Label>
              <Input id="firstName" {...register("firstName")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="middleName">Отчество</Label>
              <Input id="middleName" {...register("middleName")} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Телефон (+7 XXX XXX-XX-XX)</Label>
              <Input
                id="phone"
                {...register("phone")}
                placeholder="+7 (999) 123-45-67"
              />
              {errors.phone && (
                <p className="text-xs text-destructive">{errors.phone.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="region">Регион</Label>
              <Input id="region" {...register("region")} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="classifierIds">
              Классификаторы (через запятую, например: 1, 3.2, 5.1.1)
            </Label>
            <Input id="classifierIds" {...register("classifierIds")} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <h3 className="font-semibold">Роли</h3>
          <div className="space-y-3">
            {ROLE_OPTIONS.map((role) => (
              <div key={role.value} className="flex items-center gap-2">
                <Checkbox
                  id={`role_${role.value}`}
                  name={`role_${role.value}`}
                  defaultChecked={initialData.roles.includes(role.value)}
                />
                <Label htmlFor={`role_${role.value}`} className="cursor-pointer">
                  {role.label}
                </Label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <Label htmlFor="isContactsHidden">
              Скрыть мои персональные данные от всех
            </Label>
            <Switch
              id="isContactsHidden"
              checked={isContactsHidden}
              onCheckedChange={setIsContactsHidden}
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
