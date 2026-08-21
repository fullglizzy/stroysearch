"use client";

import { useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * Хук для защиты действий, требующих авторизации.
 * Вместо редиректа на /login показывает модалку.
 *
 * Использование:
 *   const { guard } = useAuthGuard();
 *   <Button onClick={guard(() => doSomething())}>Купить</Button>
 */
export function useAuthGuard() {
  const { data: session } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const guard = useCallback(
    <T extends unknown[]>(fn: (...args: T) => void): (...args: T) => void => {
      return (...args: T) => {
        if (session?.user) {
          fn(...args);
        } else {
          setOpen(true);
        }
      };
    },
    [session?.user],
  );

  const dialog = (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Требуется авторизация</DialogTitle>
          <DialogDescription>
            Это действие доступно только зарегистрированным пользователям.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-3 justify-center mt-4">
          <Button
            className="bg-menthol hover:bg-menthol-dark"
            onClick={() => router.push("/login")}
          >
            Войти
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push("/login")}
          >
            Зарегистрироваться
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  return { guard, dialog };
}
