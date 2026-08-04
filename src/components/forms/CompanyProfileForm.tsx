"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Eye, Phone, Mail, Globe, Loader2, Save } from "lucide-react";

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
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: formData.get("phone") || undefined,
          region: formData.get("region") || undefined,
          classifierIds: (formData.get("classifierIds") as string).split(",").map((s) => s.trim()).filter(Boolean),
          companyName: formData.get("companyName") || undefined,
          kpp: formData.get("kpp") || undefined,
          legalAddress: formData.get("legalAddress") || undefined,
          directorName: formData.get("directorName") || undefined,
        }),
      });

      if (res.ok) {
        setSuccess("Профиль обновлён");
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error || "Ошибка обновления");
      }
    } catch {
      setError("Ошибка соединения");
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      {success && <Alert><AlertDescription>{success}</AlertDescription></Alert>}

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
          <div>
            <Label>Логин (нельзя изменить)</Label>
            <Input value={username} disabled />
          </div>
          <div>
            <Label>ИНН (нельзя изменить)</Label>
            <Input value={initialData.inn} disabled />
          </div>
          <div>
            <Label>Название компании</Label>
            <Input name="companyName" defaultValue={initialData.companyName} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>КПП (9 цифр)</Label>
              <Input name="kpp" defaultValue={initialData.kpp} maxLength={9} pattern="\d{9}" placeholder="XXXXXXXXX" />
            </div>
            <div className="space-y-2">
              <Label>Директор</Label>
              <Input name="directorName" defaultValue={initialData.directorName} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Юридический адрес</Label>
            <Input name="legalAddress" defaultValue={initialData.legalAddress} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Контакты</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Телефон (+7 XXX XXX-XX-XX)</Label>
            <Input name="phone" defaultValue={initialData.phone} placeholder="+7 (999) 123-45-67" />
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
            <Label>Регион</Label>
            <Input name="region" defaultValue={initialData.region} />
          </div>
          <div className="space-y-2">
            <Label>Классификаторы (через запятую, например: 1, 3.2, 5.1.1)</Label>
            <Input name="classifierIds" defaultValue={initialData.classifierIds.join(", ")} />
          </div>
        </CardContent>
      </Card>

      <Button type="submit" className="bg-menthol hover:bg-menthol-dark" disabled={loading}>
        {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Сохранение...</> : <><Save className="h-4 w-4 mr-2" />Сохранить изменения</>}
      </Button>
    </form>
  );
}
