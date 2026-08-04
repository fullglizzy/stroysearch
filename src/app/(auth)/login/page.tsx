"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);

    const result = await signIn("credentials", {
      username: formData.get("username") as string,
      password: formData.get("password") as string,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Неверный логин или пароль");
    } else {
      router.push("/account");
      router.refresh();
    }
  }

  return (
    <div className="container-page py-12 flex justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Вход в ЕЦПР</CardTitle>
          <CardDescription>
            Войдите в свой аккаунт для доступа ко всем возможностям платформы
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
              <Input
                id="username"
                name="username"
                type="text"
                placeholder="Введите логин"
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Введите пароль"
                required
                disabled={loading}
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-menthol hover:bg-menthol-dark"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Войти
            </Button>

            <div className="text-center text-sm text-muted-foreground">
              <p>
                Нет аккаунта?{" "}
                <Link href="/register" className="text-menthol hover:underline">
                  Зарегистрироваться
                </Link>
              </p>
              <p className="mt-1">
                <Link
                  href="/register/company"
                  className="text-menthol hover:underline"
                >
                  Зарегистрировать компанию
                </Link>
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
