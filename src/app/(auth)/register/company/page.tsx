"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import { registerCompany } from "@/server/auth/actions";
import { WelcomeDialog } from "@/components/shared/WelcomeDialog";

export default function RegisterCompanyPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [registeredUsername, setRegisteredUsername] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = await registerCompany(formData);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    await signIn("credentials", {
      username: formData.get("username") as string,
      password: formData.get("password") as string,
      redirect: false,
    });

    setRegisteredUsername(formData.get("username") as string);
    setShowWelcome(true);
    setLoading(false);
  }

  return (
    <div className="container-page py-12 flex justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Регистрация компании</CardTitle>
          <CardDescription>
            Зарегистрируйте компанию для доступа к матрице материалов и управления товарами
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="username">Логин</Label>
              <Input id="username" name="username" placeholder="company_login" required minLength={3} disabled={loading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" placeholder="company@mail.ru" required disabled={loading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <Input id="password" name="password" type="password" placeholder="Минимум 8 символов" required minLength={8} disabled={loading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inn">ИНН</Label>
              <Input id="inn" name="inn" placeholder="10 или 12 цифр" required minLength={10} maxLength={12} disabled={loading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyName">Название компании</Label>
              <Input id="companyName" name="companyName" placeholder="ООО «Название»" required disabled={loading} />
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-start gap-2">
                <Checkbox id="agreePersonalData" name="agreePersonalData" required />
                <Label htmlFor="agreePersonalData" className="text-sm leading-tight">
                  Я согласен на обработку персональных данных
                </Label>
              </div>
              <div className="flex items-start gap-2">
                <Checkbox id="agreeTerms" name="agreeTerms" required />
                <Label htmlFor="agreeTerms" className="text-sm leading-tight">
                  Я принимаю условия пользовательского соглашения
                </Label>
              </div>
            </div>

            <Button type="submit" className="w-full bg-menthol hover:bg-menthol-dark" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Зарегистрировать компанию
            </Button>

            <div className="text-center text-sm text-muted-foreground">
              <p>Уже есть аккаунт? <Link href="/login" className="text-menthol hover:underline">Войти</Link></p>
              <p className="mt-1">Регистрация участника? <Link href="/register" className="text-menthol hover:underline">Здесь</Link></p>
            </div>
          </form>
        </CardContent>
      </Card>
      <WelcomeDialog
        open={showWelcome}
        onOpenChange={setShowWelcome}
        username={registeredUsername}
        dashboardHref="/company"
      />
    </div>
  );
}
