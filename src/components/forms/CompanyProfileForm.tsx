"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, Mail, Globe, Loader2, Save } from "lucide-react";
import { toastSuccess, toastError } from "@/lib/toast";

const companyProfileSchema = z.object({
  companyName: z.string().max(255).optional(),
  kpp: z
    .string()
    .regex(/^\d{9}$/, "КПП должен состоять из 9 цифр")
    .optional()
    .or(z.literal("")),
  directorName: z.string().max(255).optional(),
  legalAddress: z.string().max(500).optional(),
  phone: z.string().max(63).optional(),
  region: z.string().max(255).optional(),
  classifierIds: z.string().optional(),
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
    region: string;
    classifierIds: string[];
    directorName: string;
  };
  username: string;
  metrics: { phoneViews: number; emailViews: number; websiteViews: number } | null;
}

export function CompanyProfileForm({ initialData, username, metrics }: CompanyProfileFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CompanyProfileData>({
    resolver: zodResolver(companyProfileSchema),
    defaultValues: {
      companyName: initialData.companyName,
      kpp: initialData.kpp,
      directorName: initialData.directorName,
      legalAddress: initialData.legalAddress,
      phone: initialData.phone,
      region: initialData.region,
      classifierIds: initialData.classifierIds.join(", "),
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
          region: data.region || undefined,
          classifierIds: data.classifierIds
            ? data.classifierIds.split(",").map((s) => s.trim()).filter(Boolean)
            : [],
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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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
            <Input id="companyName" {...register("companyName")} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="kpp">КПП (9 цифр)</Label>
              <Input
                id="kpp"
                {...register("kpp")}
                placeholder="XXXXXXXXX"
                maxLength={9}
                className={errors.kpp ? "border-destructive" : ""}
              />
              {errors.kpp && (
                <p className="text-xs text-destructive">{errors.kpp.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="directorName">Директор</Label>
              <Input id="directorName" {...register("directorName")} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="legalAddress">Юридический адрес</Label>
            <Input id="legalAddress" {...register("legalAddress")} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Контакты</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Телефон (+7 XXX XXX-XX-XX)</Label>
            <Input id="phone" {...register("phone")} placeholder="+7 (999) 123-45-67" />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={initialData.email} disabled />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Классификация</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="region">Регион</Label>
            <Input id="region" {...register("region")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="classifierIds">
              Классификаторы (через запятую, например: 1, 3.2, 5.1.1)
            </Label>
            <Input id="classifierIds" {...register("classifierIds")} />
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
