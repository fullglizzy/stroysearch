"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toastSuccess, toastError } from "@/lib/toast";
import { Package, RotateCcw, Loader2 } from "lucide-react";

interface DeletedRow {
  id: string;
  name: string;
  companyName: string;
  categoryPath: string;
  deletedAt: string;
}

/** Список мягко удалённых товаров с восстановлением (вкладка админки) */
export function DeletedProductsList() {
  const router = useRouter();
  const [rows, setRows] = useState<DeletedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/products/deleted")
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setRows(d.products || []); })
      .catch(() => { if (!cancelled) setRows([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  async function handleRestore(id: string) {
    setRestoring(id);
    try {
      const res = await fetch(`/api/products/${id}/restore`, { method: "POST" });
      if (res.ok) {
        setRows((prev) => prev.filter((r) => r.id !== id));
        toastSuccess("Товар восстановлен", "Он снова появился в каталоге");
        router.refresh();
      } else {
        const d = await res.json().catch(() => ({}));
        toastError("Ошибка", d.error || "Не удалось восстановить товар");
      }
    } catch {
      toastError("Ошибка соединения");
    }
    setRestoring(null);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="border rounded-lg p-12 text-center text-muted-foreground">
        <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg">Удалённых товаров нет</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 border rounded-lg px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{r.name}</p>
            <div className="flex items-center gap-2 flex-wrap mt-0.5">
              <Badge variant="outline" className="text-[10px]">{r.categoryPath}</Badge>
              <span className="text-xs text-muted-foreground">{r.companyName}</span>
              <span className="text-xs text-muted-foreground">
                удалён {new Date(r.deletedAt).toLocaleDateString("ru-RU")}
              </span>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => handleRestore(r.id)} disabled={restoring === r.id}>
            {restoring === r.id ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : (
              <RotateCcw className="h-3 w-3 mr-1" />
            )}
            Восстановить
          </Button>
        </div>
      ))}
    </div>
  );
}
