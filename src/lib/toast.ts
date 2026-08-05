"use client";

import { toast } from "@/components/ui/toast";

/**
 * Показать toast-уведомление об успехе
 */
export function toastSuccess(title: string, description?: string) {
  toast.add({
    type: "success",
    title,
    description: description ?? "",
  });
}

/**
 * Показать toast-уведомление об ошибке
 */
export function toastError(title: string, description?: string) {
  toast.add({
    type: "error",
    title,
    description: description ?? "",
  });
}

/**
 * Показать информационное toast-уведомление
 */
export function toastInfo(title: string, description?: string) {
  toast.add({
    type: "info",
    title,
    description: description ?? "",
  });
}

/**
 * Показать toast-предупреждение
 */
export function toastWarning(title: string, description?: string) {
  toast.add({
    type: "warning",
    title,
    description: description ?? "",
  });
}
