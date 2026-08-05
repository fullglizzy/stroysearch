"use client";

import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PartyPopper, ArrowRight, BookOpen, Users, FileText } from "lucide-react";

interface WelcomeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  username: string;
  dashboardHref: string;
}

export function WelcomeDialog({ open, onOpenChange, username, dashboardHref }: WelcomeDialogProps) {
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md text-center">
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-menthol/10">
            <PartyPopper className="h-8 w-8 text-menthol" />
          </div>
          <DialogTitle className="text-xl">
            Добро пожаловать на платформу, {username}!
          </DialogTitle>
          <DialogDescription className="text-base pt-2">
            Ваш аккаунт успешно создан. Вот что доступно на платформе:
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 text-left my-4">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50">
            <BookOpen className="h-5 w-5 text-menthol flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm">Продуктовые решения</p>
              <p className="text-xs text-muted-foreground">Иерархический классификатор строительных материалов</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50">
            <Users className="h-5 w-5 text-orange-accent flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm">База поставщиков</p>
              <p className="text-xs text-muted-foreground">Поиск компаний и участников строительной отрасли</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50">
            <FileText className="h-5 w-5 text-menthol flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm">Библиотека и матрица</p>
              <p className="text-xs text-muted-foreground">Сравнение аналогов и техническая документация</p>
            </div>
          </div>
        </div>

        <Button
          className="w-full bg-menthol hover:bg-menthol-dark gap-2"
          onClick={() => {
            onOpenChange(false);
            router.push(dashboardHref);
          }}
        >
          Перейти в личный кабинет
          <ArrowRight className="h-4 w-4" />
        </Button>
      </DialogContent>
    </Dialog>
  );
}
