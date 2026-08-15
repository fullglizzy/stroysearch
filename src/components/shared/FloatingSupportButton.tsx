"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SupportDialog } from "@/components/shared/SupportDialog";
import { GuestGuard } from "@/components/shared/GuestGuard";
import { HelpCircle } from "lucide-react";

/**
 * Плавающая кнопка поддержки (кружок в правом нижнем углу) —
 * подключается в корневом layout и видна на всех страницах сайта.
 * Для гостей клик открывает предложение войти/зарегистрироваться (GuestGuard).
 */
export function FloatingSupportButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <GuestGuard actionLabel="Обращение в поддержку">
        <div className="fixed bottom-6 right-6 z-40">
          <Button
            size="lg"
            className="rounded-full shadow-lg bg-orange-accent hover:bg-orange-accent/90 h-14 w-14 p-0"
            title="Поддержка"
            onClick={() => setOpen(true)}
          >
            <HelpCircle className="h-6 w-6" />
          </Button>
        </div>
      </GuestGuard>
      <SupportDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
