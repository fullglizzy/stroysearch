"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ReactNode, MouseEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface GuestGuardProps {
  children: ReactNode;
  actionLabel?: string;
}

/**
 * Если пользователь не авторизован, перехватывает клик по children
 * и показывает модалку с предложением войти/зарегистрироваться.
 * Для авторизованных — просто рендерит children как есть.
 *
 * Соответствует ТЗ: «Модальное окно с пояснением: хотите войти или создать аккаунт?»
 */
export function GuestGuard({ children, actionLabel }: GuestGuardProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Авторизован — просто показываем содержимое
  if (session?.user) {
    return <>{children}</>;
  }

  // Гость — оборачиваем: клик открывает диалог, а не выполняет действие
  function handleClick(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
  }

  return (
    <>
      <span onClickCapture={handleClick} className="contents">
        {children}
      </span>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Требуется регистрация</DialogTitle>
            <DialogDescription>
              {actionLabel
                ? `Действие «${actionLabel}» доступно только зарегистрированным пользователям.`
                : "Это действие доступно только зарегистрированным пользователям."}
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
              onClick={() => router.push("/register")}
            >
              Зарегистрироваться
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
