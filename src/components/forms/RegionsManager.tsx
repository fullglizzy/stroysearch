"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { toastSuccess, toastError, toastWarning } from "@/lib/toast";
import { Plus, Pencil, Check, X, Trash2, ArrowUp, ArrowDown, Loader2, MapPin } from "lucide-react";

interface RegionRow {
  id: string;
  name: string;
  sortOrder: number;
}

interface RegionsManagerProps {
  regions: RegionRow[];
}

export function RegionsManager({ regions }: RegionsManagerProps) {
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [moveLoading, setMoveLoading] = useState<string | null>(null);

  async function handleAdd() {
    const name = newName.trim();
    if (!name) {
      toastWarning("Проверьте данные", "Введите название региона");
      return;
    }
    setAddLoading(true);
    try {
      const res = await fetch("/api/admin/regions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        toastSuccess("Регион добавлен", name);
        setNewName("");
        router.refresh();
      } else {
        const d = await res.json().catch(() => ({}));
        toastError("Ошибка", d.error || "Не удалось добавить регион");
      }
    } catch {
      toastError("Ошибка соединения");
    }
    setAddLoading(false);
  }

  function startEdit(region: RegionRow) {
    setEditingId(region.id);
    setEditValue(region.name);
  }

  async function handleSaveEdit(id: string) {
    const name = editValue.trim();
    if (!name) {
      toastWarning("Проверьте данные", "Название региона не может быть пустым");
      return;
    }
    setEditLoading(true);
    try {
      const res = await fetch("/api/admin/regions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name }),
      });
      if (res.ok) {
        toastSuccess("Регион переименован", name);
        setEditingId(null);
        router.refresh();
      } else {
        const d = await res.json().catch(() => ({}));
        toastError("Ошибка", d.error || "Не удалось переименовать регион");
      }
    } catch {
      toastError("Ошибка соединения");
    }
    setEditLoading(false);
  }

  async function handleMove(id: string, direction: "up" | "down") {
    setMoveLoading(id);
    try {
      const res = await fetch("/api/admin/regions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, direction }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const d = await res.json().catch(() => ({}));
        toastError("Ошибка", d.error || "Не удалось изменить порядок");
      }
    } catch {
      toastError("Ошибка соединения");
    }
    setMoveLoading(null);
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleteLoading(true);
    try {
      const res = await fetch("/api/admin/regions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deleteId }),
      });
      if (res.ok) {
        toastSuccess("Регион удалён");
        setDeleteId(null);
        router.refresh();
      } else {
        const d = await res.json().catch(() => ({}));
        toastError("Ошибка", d.error || "Не удалось удалить регион");
        setDeleteId(null);
      }
    } catch {
      toastError("Ошибка соединения");
    }
    setDeleteLoading(false);
  }

  const deleteTarget = regions.find((r) => r.id === deleteId);

  return (
    <div className="space-y-6">
      {/* Добавление */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Название нового региона"
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAdd();
                }
              }}
            />
            <Button
              onClick={handleAdd}
              className="bg-menthol hover:bg-menthol-dark"
              disabled={addLoading}
            >
              {addLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Добавить регион
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Список */}
      <Card>
        <CardContent className="pt-4">
          {regions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Список регионов пуст
            </p>
          ) : (
            <ul className="divide-y">
              {regions.map((region, idx) => (
                <li key={region.id} className="flex items-center gap-2 py-2">
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground w-8 shrink-0">{idx + 1}</span>
                  {editingId === region.id ? (
                    <>
                      <Input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="flex-1 h-8"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleSaveEdit(region.id);
                          }
                          if (e.key === "Escape") setEditingId(null);
                        }}
                      />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleSaveEdit(region.id)}
                        disabled={editLoading}
                        title="Сохранить"
                      >
                        <Check className="h-4 w-4 text-menthol" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setEditingId(null)}
                        title="Отмена"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm">{region.name}</span>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleMove(region.id, "up")}
                        disabled={idx === 0 || moveLoading === region.id}
                        title="Выше"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleMove(region.id, "down")}
                        disabled={idx === regions.length - 1 || moveLoading === region.id}
                        title="Ниже"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => startEdit(region)}
                        title="Переименовать"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setDeleteId(region.id)}
                        title="Удалить"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Подтверждение удаления */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => { if (!o) setDeleteId(null); }}
        title="Удалить регион?"
        message={
          deleteTarget
            ? `Регион «${deleteTarget.name}» будет удалён из единого списка. У компаний и профилей, где он уже указан, значение сохранится.`
            : ""
        }
        confirmLabel="Удалить"
        variant="danger"
        loading={deleteLoading}
        onConfirm={handleDelete}
      />
    </div>
  );
}
