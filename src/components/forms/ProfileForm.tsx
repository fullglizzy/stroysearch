"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Save } from "lucide-react";

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
}

const ROLE_OPTIONS = [
  { value: "PRODUCTOLOGIST", label: "Продуктолог" },
  { value: "TENDER_SPECIALIST", label: "Тендерный специалист" },
  { value: "DESIGNER", label: "Проектировщик" },
  { value: "COMPANY_OWNER", label: "Владелец компании" },
  { value: "OTHER", label: "Иное" },
];

export function ProfileForm({ initialData, username }: ProfileFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isContactsHidden, setIsContactsHidden] = useState(initialData.isContactsHidden);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const selectedRoles = ROLE_OPTIONS.filter(
      (r) => formData.get(`role_${r.value}`) === "on",
    ).map((r) => r.value);

    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: formData.get("firstName") || undefined,
          lastName: formData.get("lastName") || undefined,
          middleName: formData.get("middleName") || undefined,
          phone: formData.get("phone") || undefined,
          region: formData.get("region") || undefined,
          isContactsHidden,
          roles: selectedRoles,
          classifierIds: (formData.get("classifierIds") as string)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
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
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div>
            <Label>Логин (нельзя изменить)</Label>
            <Input value={username} disabled className="mt-1" />
          </div>
          <div>
            <Label>Email</Label>
            <Input value={initialData.email} disabled className="mt-1" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <h3 className="font-semibold">Личная информация</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lastName">Фамилия</Label>
              <Input id="lastName" name="lastName" defaultValue={initialData.lastName} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="firstName">Имя</Label>
              <Input id="firstName" name="firstName" defaultValue={initialData.firstName} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="middleName">Отчество</Label>
              <Input id="middleName" name="middleName" defaultValue={initialData.middleName} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Телефон</Label>
              <Input id="phone" name="phone" defaultValue={initialData.phone} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="region">Регион</Label>
              <Input id="region" name="region" defaultValue={initialData.region} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="classifierIds">
              Классификаторы (через запятую, например: 1, 3.2, 5.1.1)
            </Label>
            <Input
              id="classifierIds"
              name="classifierIds"
              defaultValue={initialData.classifierIds.join(", ")}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <h3 className="font-semibold">Роли</h3>
          <div className="space-y-3">
            {ROLE_OPTIONS.map((role) => (
              <div key={role.value} className="flex items-center gap-2">
                <Checkbox
                  id={`role_${role.value}`}
                  name={`role_${role.value}`}
                  defaultChecked={initialData.roles.includes(role.value)}
                />
                <Label htmlFor={`role_${role.value}`}>{role.label}</Label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-4">
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
