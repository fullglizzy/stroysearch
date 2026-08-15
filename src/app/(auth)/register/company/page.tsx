"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, TriangleAlert, CircleCheck } from "lucide-react";
import {
  registerCompany,
  checkUsernameAvailability,
  checkEmailAvailability,
  checkInnAvailability,
} from "@/server/auth/actions";
import { registerCompanySchema, isValidInn, type RegisterCompanyInput } from "@/lib/validators";
import { WelcomeDialog } from "@/components/shared/WelcomeDialog";
import { FieldError, PasswordInput, PasswordStrength } from "@/components/forms/fields";
import { useAvailabilityCheck } from "@/components/forms/useAvailabilityCheck";

// Предикаты запуска live-проверок (совпадают с правилами схемы)
const USERNAME_CHECK_RE = /^[a-zA-Z0-9_]{3,63}$/;
const EMAIL_CHECK_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function RegisterCompanyPage() {
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [registeredDisplayName, setRegisteredDisplayName] = useState("");

  const {
    register,
    handleSubmit,
    control,
    setError,
    setFocus,
    formState: { errors },
  } = useForm<RegisterCompanyInput>({
    resolver: zodResolver(registerCompanySchema),
    // Валидируем после первого «касания» поля, а не сразу при наборе
    mode: "onTouched",
    defaultValues: {
      username: "",
      email: "",
      password: "",
      inn: "",
      companyName: "",
      agreeTerms: false,
    },
  });

  const password = useWatch({ control, name: "password" }) ?? "";
  const username = useWatch({ control, name: "username" }) ?? "";
  const email = useWatch({ control, name: "email" }) ?? "";
  const inn = useWatch({ control, name: "inn" }) ?? "";

  // Моментальная проверка занятости логина, email и ИНН (с дебаунсом)
  const usernameStatus = useAvailabilityCheck({
    value: username,
    whenValid: (v) => USERNAME_CHECK_RE.test(v),
    check: async (v) => (await checkUsernameAvailability(v)).available,
  });
  const emailStatus = useAvailabilityCheck({
    value: email,
    whenValid: (v) => EMAIL_CHECK_RE.test(v),
    check: async (v) => (await checkEmailAvailability(v)).available,
  });
  const innStatus = useAvailabilityCheck({
    value: inn,
    whenValid: (v) => isValidInn(v),
    check: async (v) => (await checkInnAvailability(v)).available,
  });

  async function onSubmit(values: RegisterCompanyInput) {
    // Не отправляем, если live-проверка уже нашла занятое значение
    if (usernameStatus === "taken") {
      setError("username", { type: "taken", message: "Пользователь с таким логином уже существует" });
      setFocus("username");
      return;
    }
    if (emailStatus === "taken") {
      setError("email", { type: "taken", message: "Пользователь с таким email уже существует" });
      setFocus("email");
      return;
    }
    if (innStatus === "taken") {
      setError("inn", { type: "taken", message: "Компания с таким ИНН уже зарегистрирована на платформе" });
      setFocus("inn");
      return;
    }

    setServerError("");
    setLoading(true);

    const formData = new FormData();
    formData.append("username", values.username);
    formData.append("email", values.email);
    formData.append("password", values.password);
    formData.append("inn", values.inn);
    formData.append("companyName", values.companyName);
    formData.append("agreeTerms", values.agreeTerms ? "on" : "off");

    const result = await registerCompany(formData);

    if (result?.error) {
      setLoading(false);
      // Ошибки сервера привязываем к конкретному полю, если это возможно
      if (result.error.includes("логином")) {
        setError("username", { message: result.error });
        setFocus("username");
      } else if (result.error.includes("email")) {
        setError("email", { message: result.error });
        setFocus("email");
      } else if (result.error.includes("ИНН")) {
        setError("inn", { message: result.error });
        setFocus("inn");
      } else if (result.error.includes("название")) {
        setError("companyName", { message: result.error });
        setFocus("companyName");
      } else {
        setServerError(result.error);
      }
      return;
    }

    // Автовход после регистрации
    await signIn("credentials", {
      username: values.username,
      password: values.password,
      redirect: false,
    });

    setRegisteredDisplayName(result.displayName ?? values.companyName);
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
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {serverError && (
              <Alert variant="destructive">
                <TriangleAlert className="h-4 w-4" />
                <AlertDescription>{serverError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="username">Придумайте логин компании. Сменить его далее не получится</Label>
              <Input
                id="username"
                type="text"
                placeholder="латинские буквы, цифры и _"
                autoComplete="username"
                maxLength={63}
                spellCheck={false}
                disabled={loading}
                aria-invalid={!!errors.username}
                aria-describedby={
                  errors.username
                    ? "username-error"
                    : usernameStatus === "checking"
                      ? "username-checking"
                      : usernameStatus === "available"
                        ? "username-available"
                        : usernameStatus === "taken"
                          ? "username-taken"
                          : "username-hint"
                }
                {...register("username", {
                  // Маска: пропускаем только латиницу, цифры и подчёркивание
                  setValueAs: (value: string) => value.replace(/[^a-zA-Z0-9_]/g, ""),
                  onChange: (e) => {
                    e.target.value = e.target.value.replace(/[^a-zA-Z0-9_]/g, "");
                  },
                })}
              />
              {errors.username ? (
                <FieldError id="username-error" message={errors.username.message} />
              ) : usernameStatus === "checking" ? (
                <p id="username-checking" role="status" className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Проверка доступности...
                </p>
              ) : usernameStatus === "available" ? (
                <p id="username-available" role="status" className="flex items-center gap-1.5 text-xs text-emerald-600">
                  <CircleCheck className="h-3 w-3" />
                  Логин свободен
                </p>
              ) : usernameStatus === "taken" ? (
                <FieldError id="username-taken" message="Пользователь с таким логином уже существует" />
              ) : (
                <p id="username-hint" className="text-xs text-muted-foreground">
                  Только латинские буквы, цифры и символ подчёркивания
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="company@mail.ru"
                autoComplete="email"
                disabled={loading}
                aria-invalid={!!errors.email}
                aria-describedby={
                  errors.email
                    ? "email-error"
                    : emailStatus === "checking"
                      ? "email-checking"
                      : emailStatus === "available"
                        ? "email-available"
                        : emailStatus === "taken"
                          ? "email-taken"
                          : undefined
                }
                {...register("email", {
                  // Маска: без пробелов, в нижнем регистре
                  setValueAs: (value: string) => value.replace(/\s/g, "").toLowerCase(),
                  onChange: (e) => {
                    e.target.value = e.target.value.replace(/\s/g, "").toLowerCase();
                  },
                })}
              />
              {errors.email ? (
                <FieldError id="email-error" message={errors.email.message} />
              ) : emailStatus === "checking" ? (
                <p id="email-checking" role="status" className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Проверка доступности...
                </p>
              ) : emailStatus === "available" ? (
                <p id="email-available" role="status" className="flex items-center gap-1.5 text-xs text-emerald-600">
                  <CircleCheck className="h-3 w-3" />
                  Email свободен
                </p>
              ) : emailStatus === "taken" ? (
                <FieldError id="email-taken" message="Пользователь с таким email уже существует" />
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <PasswordInput
                id="password"
                placeholder="Минимум 8 символов"
                autoComplete="new-password"
                disabled={loading}
                aria-invalid={!!errors.password}
                aria-describedby={
                  errors.password ? "password-error" : password ? "password-strength" : undefined
                }
                {...register("password")}
              />
              {errors.password ? (
                <FieldError id="password-error" message={errors.password.message} />
              ) : (
                <PasswordStrength id="password-strength" password={password} />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="inn">ИНН</Label>
              <Input
                id="inn"
                type="text"
                inputMode="numeric"
                placeholder="10 или 12 цифр"
                autoComplete="off"
                maxLength={12}
                disabled={loading}
                aria-invalid={!!errors.inn}
                aria-describedby={
                  errors.inn
                    ? "inn-error"
                    : innStatus === "checking"
                      ? "inn-checking"
                      : innStatus === "available"
                        ? "inn-available"
                        : innStatus === "taken"
                          ? "inn-taken"
                          : "inn-hint"
                }
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
              ) : innStatus === "checking" ? (
                <p id="inn-checking" role="status" className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Проверка доступности...
                </p>
              ) : innStatus === "available" ? (
                <p id="inn-available" role="status" className="flex items-center gap-1.5 text-xs text-emerald-600">
                  <CircleCheck className="h-3 w-3" />
                  ИНН свободен
                </p>
              ) : innStatus === "taken" ? (
                <FieldError id="inn-taken" message="Компания с таким ИНН уже зарегистрирована на платформе" />
              ) : (
                <p id="inn-hint" className="text-xs text-muted-foreground">
                  10 цифр для организации, 12 — для ИП
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="companyName">Название компании</Label>
              <Input
                id="companyName"
                type="text"
                placeholder="ООО «Название»"
                autoComplete="organization"
                maxLength={255}
                disabled={loading}
                aria-invalid={!!errors.companyName}
                aria-describedby={errors.companyName ? "companyName-error" : undefined}
                {...register("companyName", {
                  // Маска: схлопываем повторяющиеся пробелы, обрезаем по краям на blur
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

            <div className="space-y-3 pt-2">
              <div>
                <div className="flex items-start gap-2">
                  <Controller
                    name="agreeTerms"
                    control={control}
                    render={({ field }) => (
                      <Checkbox
                        id="agreeTerms"
                        checked={field.value}
                        onCheckedChange={(checked) => field.onChange(checked === true)}
                        disabled={loading}
                        aria-invalid={!!errors.agreeTerms}
                        aria-describedby={errors.agreeTerms ? "agreeTerms-error" : undefined}
                      />
                    )}
                  />
                  <Label htmlFor="agreeTerms" className="cursor-pointer text-sm leading-tight">
                    Я принимаю{" "}
                    <Link href="/terms" className="text-menthol hover:underline" target="_blank">
                      условия пользовательского соглашения
                    </Link>
                  </Label>
                </div>
                {errors.agreeTerms && (
                  <div className="pl-6 pt-1">
                    <FieldError id="agreeTerms-error" message={errors.agreeTerms.message} />
                  </div>
                )}
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-menthol hover:bg-menthol-dark"
              disabled={loading}
            >
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
        displayName={registeredDisplayName}
        role="company"
        dashboardHref="/company"
      />
    </div>
  );
}
