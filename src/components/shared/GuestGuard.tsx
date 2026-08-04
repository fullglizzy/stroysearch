"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface GuestGuardProps {
  children: ReactNode;
  actionLabel?: string;
}

/**
 * Показывает модальное окно гостю при попытке действия, требующего регистрации.
 * Для авторизованных — просто рендерит children без модалки.
 * Соответствует ТЗ: «Модальное окно с пояснением: хотите войти или создать аккаунт?»
 */
export function GuestGuard({ children, actionLabel }: GuestGuardProps) {
  const { data: session } = useSession();
  const router = useRouter();

  if (session?.user) {
    return <>{children}</>;
  }

  return (
    <Dialog>
      <DialogTrigger>
        {children}
      </DialogTrigger>
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
  );
}
