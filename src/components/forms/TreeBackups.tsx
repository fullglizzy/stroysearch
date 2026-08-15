"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { toastSuccess, toastError } from "@/lib/toast";
import {
  Download,
  Upload,
  Camera,
  RotateCcw,
  Trash2,
  Loader2,
  Database,
} from "lucide-react";
import type { TreeItemFlat } from "@/server/admin/tree";

interface SnapshotMeta {
  id: string;
  label: string | null;
  nodeCount: number;
  createdAt: string;
  createdBy: string | null;
}

type RestoreTarget =
  | { kind: "file"; data: unknown; summary: string }
  | { kind: "snapshot"; id: string; summary: string };

/**
 * Резервные копии дерева решений («как гитхаб»):
 * экспорт/импорт JSON-файла + история снимков с восстановлением.
 */
export function TreeBackups({ items }: { items: TreeItemFlat[] }) {
  const router = useRouter();
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([]);
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<RestoreTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadSnapshots() {
    try {
      const res = await fetch("/api/admin/tree/snapshots");
      const d = await res.json().catch(() => ({}));
      if (res.ok) setSnapshots(d.snapshots || []);
    } catch {
      // silent
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/tree/snapshots")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setSnapshots(d.snapshots || []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  function handleDownload() {
    // Экспортируем только структурные поля (без счётчиков контента)
    const data = items.map((n) => ({
      id: n.id,
      name: n.name,
      parentId: n.parentId,
      inBranchNumber: n.inBranchNumber,
      fullNumberPath: n.fullNumberPath,
      description: n.description,
      bannerUrl: n.bannerUrl,
      deletedAt: n.deletedAt,
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
    a.href = url;
    a.download = `tree-snapshot-${stamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleFile(file: File) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!Array.isArray(data)) throw new Error("Файл должен содержать массив узлов");
      setRestoreTarget({
        kind: "file",
        data,
        summary: `Файл «${file.name}»: ${data.length} узлов`,
      });
    } catch (e) {
      toastError("Ошибка файла", e instanceof Error ? e.message : "Не удалось прочитать файл");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleCreateSnapshot() {
    setCreating(true);
    try {
      const res = await fetch("/api/admin/tree/snapshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      if (res.ok) {
        toastSuccess("Снимок создан");
        setLabel("");
        await loadSnapshots();
      } else {
        const d = await res.json().catch(() => ({}));
        toastError("Ошибка", d.error || "Не удалось создать снимок");
      }
    } catch {
      toastError("Ошибка соединения", "Проверьте подключение к интернету");
    }
    setCreating(false);
  }

  async function handleRestore() {
    if (!restoreTarget) return;
    setRestoring(true);
    try {
      const url =
        restoreTarget.kind === "file"
          ? "/api/admin/tree/restore"
          : `/api/admin/tree/snapshots/${restoreTarget.id}/restore`;
      const body = restoreTarget.kind === "file" ? { data: restoreTarget.data } : {};
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        toastSuccess("Дерево восстановлено", "Нумерация нормализована");
        setRestoreTarget(null);
        router.refresh();
      } else {
        const d = await res.json().catch(() => ({}));
        toastError("Ошибка", d.error || "Не удалось восстановить дерево");
      }
    } catch {
      toastError("Ошибка соединения", "Проверьте подключение к интернету");
    }
    setRestoring(false);
  }

  async function handleDeleteSnapshot() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/tree/snapshots/${deleteTarget}`, { method: "DELETE" });
      if (res.ok) {
        toastSuccess("Снимок удалён");
        setDeleteTarget(null);
        await loadSnapshots();
      } else {
        const d = await res.json().catch(() => ({}));
        toastError("Ошибка", d.error || "Не удалось удалить снимок");
      }
    } catch {
      toastError("Ошибка соединения", "Проверьте подключение к интернету");
    }
    setDeleting(false);
  }

  return (
    <div className="space-y-6">
      {/* Файл */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Файл</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Скачайте текущее дерево в JSON-файл (резервная копия) или загрузите файл,
            чтобы восстановить дерево из него.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleDownload} className="gap-2">
              <Download className="h-4 w-4" /> Скачать дерево (JSON)
            </Button>
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-2">
              <Upload className="h-4 w-4" /> Загрузить файл и восстановить
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Снимки */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Снимки (история)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="Подпись снимка (опционально)"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="max-w-sm"
            />
            <Button
              className="bg-menthol hover:bg-menthol-dark gap-2"
              onClick={handleCreateSnapshot}
              disabled={creating}
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              Создать снимок
            </Button>
          </div>

          {snapshots.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <Database className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Снимков пока нет</p>
            </div>
          ) : (
            <div className="space-y-2">
              {snapshots.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-3 py-2 border-b last:border-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{s.label || "Без подписи"}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(s.createdAt).toLocaleString("ru-RU")} · {s.nodeCount} узлов
                      {s.createdBy ? ` · ${s.createdBy}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1"
                      onClick={() =>
                        setRestoreTarget({
                          kind: "snapshot",
                          id: s.id,
                          summary: `Снимок от ${new Date(s.createdAt).toLocaleString("ru-RU")} (${s.nodeCount} узлов)`,
                        })
                      }
                    >
                      <RotateCcw className="h-3 w-3" /> Восстановить
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-red-500"
                      onClick={() => setDeleteTarget(s.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Подтверждение восстановления */}
      <ConfirmDialog
        open={!!restoreTarget}
        onOpenChange={(v) => {
          if (!v) setRestoreTarget(null);
        }}
        title="Восстановить дерево?"
        message={
          restoreTarget
            ? `${restoreTarget.summary}. Текущее дерево будет заменено: узлы, которых нет в копии, будут удалены (привязанный к ним контент может скрыться).`
            : ""
        }
        variant="danger"
        confirmLabel="Восстановить"
        onConfirm={handleRestore}
        loading={restoring}
      />

      {/* Подтверждение удаления снимка */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => {
          if (!v) setDeleteTarget(null);
        }}
        title="Удалить снимок?"
        message="Снимок будет удалён безвозвратно."
        confirmLabel="Удалить"
        onConfirm={handleDeleteSnapshot}
        loading={deleting}
      />
    </div>
  );
}
