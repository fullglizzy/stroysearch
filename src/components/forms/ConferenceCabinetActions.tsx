"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { toastSuccess, toastError } from "@/lib/toast";
import { ConferenceCreateDialog, type ConferenceEditData } from "@/components/forms/ConferenceCreateDialog";
import { Pencil, Plus } from "lucide-react";

interface TreeItem {
  id: string;
  name: string;
  fullNumberPath: string;
}

/** Кнопка «Создать конференцию» с диалогом — для личных кабинетов */
export function CreateConferenceButton({ treeItems }: { treeItems: TreeItem[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        className="bg-menthol hover:bg-menthol-dark gap-2"
        onClick={() => setOpen(true)}
      >
        <Plus className="h-4 w-4" /> Создать конференцию
      </Button>
      <ConferenceCreateDialog treeItems={treeItems} open={open} onOpenChange={setOpen} />
    </>
  );
}

/** Кнопка редактирования своей конференции с диалогом */
export function EditConferenceButton({
  treeItems,
  conference,
}: {
  treeItems: TreeItem[];
  conference: ConferenceEditData;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="h-3 w-3 mr-1" />
        Изменить
      </Button>
      <ConferenceCreateDialog
        treeItems={treeItems}
        open={open}
        onOpenChange={setOpen}
        initial={conference}
      />
    </>
  );
}

/** Кнопка отмены своей конференции с подтверждением */
export function CancelConferenceButton({ confId, title }: { confId: string; title: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleCancel() {
    setLoading(true);
    try {
      const res = await fetch(`/api/conferences/${confId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      if (res.ok) {
        toastSuccess("Конференция отменена", "Участники больше не смогут записаться");
        router.refresh();
      } else {
        const d = await res.json().catch(() => ({}));
        toastError("Ошибка", d.error || "Не удалось отменить конференцию");
      }
    } catch {
      toastError("Ошибка соединения");
    }
    setLoading(false);
  }

  return (
    <>
      <Button variant="outline" size="sm" className="text-destructive" onClick={() => setOpen(true)}>
        Отменить
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Отменить конференцию?"
        message={`Конференция «${title}» будет отменена, участники не смогут записаться.`}
        confirmLabel="Отменить"
        variant="danger"
        onConfirm={handleCancel}
        loading={loading}
      />
    </>
  );
}
