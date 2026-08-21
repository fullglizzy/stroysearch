"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SupportDialog } from "@/components/shared/SupportDialog";
import { HelpCircle } from "lucide-react";

/**
 * Плавающая кнопка поддержки (кружок в правом нижнем углу) —
 * подключается в корневом layout и видна на всех страницах сайта.
 * Доступна и гостям: незарегистрированным диалог показывает форму
 * с контактами (email, телефон, ИНН для компаний).
 */
export function FloatingSupportButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
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
      <SupportDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
