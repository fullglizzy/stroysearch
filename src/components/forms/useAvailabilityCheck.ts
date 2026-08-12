"use client";

import { useEffect, useRef, useState } from "react";

export type AvailabilityStatus = "idle" | "checking" | "available" | "taken";

interface UseAvailabilityCheckOptions {
  /** Текущее значение поля */
  value: string;
  /** Запускать проверку, только если значение проходит этот предикат */
  whenValid: (value: string) => boolean;
  /** Асинхронная проверка на сервере: true — значение свободно */
  check: (value: string) => Promise<boolean>;
  /** Задержка дебаунса, мс */
  debounceMs?: number;
}

/**
 * Проверяет доступность значения (логин, email, ИНН) на сервере с дебаунсом.
 *
 * Статусы: idle — значение не проверяется (невалидно или пусто),
 * checking — запрос выполняется, available — свободно, taken — занято.
 * Устаревшие ответы при быстром наборе игнорируются.
 */
export function useAvailabilityCheck({
  value,
  whenValid,
  check,
  debounceMs = 450,
}: UseAvailabilityCheckOptions): AvailabilityStatus {
  const [status, setStatus] = useState<AvailabilityStatus>("idle");
  // Порядковый номер запроса — игнорируем ответы, пришедшие после более свежего набора
  const requestSeq = useRef(0);
  // Колбэки храним в ref, чтобы не перезапускать эффект на каждом рендере
  const checkRef = useRef(check);
  const whenValidRef = useRef(whenValid);

  // Обновляем ref после каждого рендера (до основного эффекта ниже)
  useEffect(() => {
    checkRef.current = check;
    whenValidRef.current = whenValid;
  });

  useEffect(() => {
    if (!whenValidRef.current(value)) {
      requestSeq.current += 1;
      setStatus("idle");
      return;
    }

    setStatus("checking");
    const seq = ++requestSeq.current;

    const timer = setTimeout(async () => {
      let available = true;
      try {
        available = await checkRef.current(value);
      } catch {
        // Сеть недоступна — не блокируем, сервер проверит при отправке формы
        available = true;
      }
      if (seq !== requestSeq.current) return; // ответ устарел
      setStatus(available ? "available" : "taken");
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [value, debounceMs]);

  return status;
}
