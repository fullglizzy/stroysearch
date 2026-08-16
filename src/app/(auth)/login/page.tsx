"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { signIn, getSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { PasswordInput } from "@/components/forms/fields";
import { Loader2, Crown, Shield, Pencil, Building2, User } from "lucide-react";

const quickLogins = [
  { label: "Владелец", username: "root", icon: Crown, role: "ROOT", color: "bg-purple-100 text-purple-700 hover:bg-purple-200" },
  { label: "КерамФасад", username: "keram_facade", icon: Building2, role: "КОМПАНИЯ", color: "bg-orange-100 text-orange-700 hover:bg-orange-200" },
  { label: "Проектировщик", username: "petrov_nik", icon: User, role: "УЧАСТНИК", color: "bg-green-100 text-green-700 hover:bg-green-200" },
];

// Демо-вход с общим паролем — только для разработки: NEXT_PUBLIC_DEMO_LOGIN=1
const showQuickLogins = process.env.NEXT_PUBLIC_DEMO_LOGIN === "1";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeRole, setActiveRole] = useState<string | null>(null);
  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);

    try {
      const result = await signIn("credentials", {
        username: formData.get("username") as string,
        password: formData.get("password") as string,
        redirect: false,
      });

      if (result?.error) {
        // Забаненный аккаунт — показываем причину блокировки
        if (result.code === "banned") {
          try {
            const res = await fetch("/api/auth/ban-info", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ username: formData.get("username") as string }),
            });
            const data = await res.json().catch(() => ({}));
            if (data?.banned) {
              setError(`Аккаунт заблокирован. Причина: ${data.reason}`);
              return;
            }
          } catch {
            // fallthrough — общая ошибка ниже
          }
        }
        setError("Неверный логин или пароль");
        return;
      }

      // Возвращаем пользователя туда, откуда его отправил proxy (защищённая страница)
      const params = new URLSearchParams(window.location.search);
      const callbackUrl = params.get("callbackUrl") || "";
      if (callbackUrl.startsWith("/") && !callbackUrl.startsWith("//") && callbackUrl !== "/login") {
        router.push(callbackUrl);
        router.refresh();
        return;
      }

      // Без callbackUrl — в кабинет по роли
      const session = await getSession();
      const userType = (session?.user as any)?.type as string;

      let dashboard = "/account";
      if (userType === "COMPANY") {
        dashboard = "/company";
      } else if (["MODERATOR", "EDITOR", "SUPER", "ROOT"].includes(userType)) {
        dashboard = "/admin";
      }

      router.push(dashboard);
      router.refresh();
    } catch (err) {
      // Сетевая ошибка или устаревший JS-бандл — показываем ошибку вместо «тихого» зависания
      console.error("Ошибка входа", err);
      setError("Не удалось выполнить вход. Обновите страницу (Ctrl+F5) и попробуйте ещё раз");
    } finally {
      setLoading(false);
    }
  }

  function quickLogin(username: string) {
    setActiveRole(username);
    setError("");
    // Fill fields
    if (usernameRef.current) usernameRef.current.value = username;
    if (passwordRef.current) passwordRef.current.value = "12345678";
    // Trigger form submit
    setTimeout(() => {
      formRef.current?.requestSubmit();
    }, 50);
  }

  return (
    <div className="container-page py-12 flex justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Вход в ЕНЦПР</CardTitle>
          <CardDescription>
            Войдите в свой аккаунт для доступа ко всем возможностям платформы
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="username">Логин</Label>
              <Input
                ref={usernameRef}
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
              <PasswordInput
                ref={passwordRef}
                id="password"
                name="password"
                placeholder="Введите пароль"
                required
                disabled={loading}
                defaultValue=""
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

            {/* Quick login buttons — только при NEXT_PUBLIC_DEMO_LOGIN=1 */}
            {showQuickLogins && (
              <div className="pt-2">
                <Separator className="mb-3" />
                <div className="grid grid-cols-2 gap-1.5">
                  {quickLogins.map((q) => {
                    const Icon = q.icon;
                    return (
                      <button
                        key={q.username}
                        type="button"
                        onClick={() => quickLogin(q.username)}
                        disabled={loading}
                        className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all active:scale-95 disabled:opacity-50 ${q.color}`}
                      >
                        <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="truncate">{q.label}</span>
                        <Badge variant="secondary" className="ml-auto text-[10px] px-1 py-0 h-4 flex-shrink-0">
                          {q.role}
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="text-center text-sm text-muted-foreground">
              <p>
                Нет аккаунта?{" "}
                <Link href="/register" className="text-menthol hover:underline">
                  Зарегистрироваться как участник
                </Link>
              </p>
              <p className="mt-1">
                <Link
                  href="/register/company"
                  className="text-menthol hover:underline"
                >
                  Зарегистрироваться как компания
                </Link>
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
