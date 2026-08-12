"use client";

import { useState } from "react";
import { Check, CircleAlert, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Инлайновая ошибка поля: красный текст с иконкой.
 * role="alert" озвучивается скринридерами при появлении.
 */
export function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="flex items-start gap-1.5 text-xs text-destructive">
      <CircleAlert className="mt-px h-3.5 w-3.5 shrink-0" />
      <span>{message}</span>
    </p>
  );
}

/**
 * Поле пароля с кнопкой показа/скрытия («глазик»).
 * Все пропсы пробрасываются во внутренний Input (в том числе ref из react-hook-form).
 */
export function PasswordInput({
  className,
  disabled,
  ...props
}: React.ComponentProps<"input">) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? "text" : "password"}
        disabled={disabled}
        className={cn("pr-10", className)}
      />
      <Button
        type="button"
        variant="ghost"
        className="absolute top-1/2 right-1.5 h-7 w-7 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        onClick={() => setVisible((v) => !v)}
        disabled={disabled}
        aria-label={visible ? "Скрыть пароль" : "Показать пароль"}
        aria-pressed={visible}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </Button>
    </div>
  );
}

/**
 * Форматирует телефон в российский формат: +7 (999) 123-45-67.
 * Оставляет только цифры (максимум 11), 8 и 9 в начале нормализует к +7.
 */
export function formatRussianPhone(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (digits[0] === "8") digits = "7" + digits.slice(1);
  else if (digits[0] !== "7") digits = "7" + digits;
  digits = digits.slice(0, 11);

  let formatted = "+7";
  if (digits.length > 1) formatted += ` (${digits.slice(1, 4)}`;
  if (digits.length >= 5) formatted += `) ${digits.slice(4, 7)}`;
  if (digits.length >= 8) formatted += `-${digits.slice(7, 9)}`;
  if (digits.length >= 10) formatted += `-${digits.slice(9, 11)}`;
  return formatted;
}

/**
 * Применяет маску телефона прямо к DOM-инпуту, сохраняя позицию каретки
 * (чтобы можно было редактировать середину номера без прыжка в конец).
 */
export function applyPhoneMask(input: HTMLInputElement) {
  const caret = input.selectionStart ?? input.value.length;
  const digitsBefore = input.value.slice(0, caret).replace(/\D/g, "").length;
  // Если номер начинался не с 7, «+7» добавлен нами — не считаем его за цифру пользователя
  const rawDigits = input.value.replace(/\D/g, "");
  const skipSynthetic = rawDigits.length > 0 && rawDigits[0] !== "7";
  input.value = formatRussianPhone(input.value);

  let pos = input.value.length;
  if (digitsBefore > 0) {
    let seen = 0;
    pos = 0;
    while (pos < input.value.length && seen < digitsBefore) {
      const ch = input.value[pos];
      if (/\d/.test(ch) && !(skipSynthetic && seen === 0 && ch === "7")) seen += 1;
      pos += 1;
    }
  }
  input.setSelectionRange(pos, pos);
}

/**
 * Оценка надёжности пароля: 0 (пусто) — 4 (надёжный).
 */
export function getPasswordScore(password: string): number {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  // Короткий пароль не может быть «хорошим», даже если в нём есть все символы
  if (password.length < 8) score = Math.min(score, 1);
  return Math.min(score, 4);
}

const STRENGTH_LABELS = ["", "Слабый", "Средний", "Хороший", "Надёжный"] as const;
const STRENGTH_BAR_COLORS = ["", "bg-red-500", "bg-amber-500", "bg-lime-500", "bg-emerald-500"] as const;
const STRENGTH_TEXT_COLORS = ["", "text-red-500", "text-amber-500", "text-lime-600", "text-emerald-600"] as const;

const PASSWORD_CHECKS = [
  { test: (p: string) => p.length >= 8, label: "8+ символов" },
  { test: (p: string) => /[a-z]/.test(p) && /[A-Z]/.test(p), label: "Заглавные и строчные" },
  { test: (p: string) => /\d/.test(p), label: "Цифра" },
  { test: (p: string) => /[^A-Za-z0-9]/.test(p), label: "Спецсимвол" },
];

/**
 * Живой индикатор надёжности пароля: шкала из 4 сегментов + чек-лист требований.
 * Чек-лист скрывается, когда все требования выполнены.
 */
export function PasswordStrength({ password, id }: { password: string; id?: string }) {
  if (!password) return null;

  const score = getPasswordScore(password);
  const allPassed = PASSWORD_CHECKS.every((check) => check.test(password));

  return (
    <div id={id} aria-live="polite" className="space-y-1.5">
      <div className="flex h-1 gap-1" aria-hidden="true">
        {[1, 2, 3, 4].map((segment) => (
          <div
            key={segment}
            className={cn(
              "flex-1 rounded-full transition-colors",
              segment <= score ? STRENGTH_BAR_COLORS[score] : "bg-muted",
            )}
          />
        ))}
      </div>
      <p className={cn("text-xs font-medium", STRENGTH_TEXT_COLORS[score])}>
        Надёжность пароля: {STRENGTH_LABELS[score]}
      </p>
      {!allPassed && (
        <ul className="grid grid-cols-2 gap-x-2 gap-y-1">
          {PASSWORD_CHECKS.map((check) => {
            const passed = check.test(password);
            return (
              <li
                key={check.label}
                className={cn(
                  "flex items-center gap-1 text-xs",
                  passed ? "text-emerald-600" : "text-muted-foreground",
                )}
              >
                <Check className={cn("h-3 w-3 shrink-0", passed ? "opacity-100" : "opacity-40")} />
                {check.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
