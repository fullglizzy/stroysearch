"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Pencil,
  Trash2,
  Undo2,
  GripVertical,
  FolderTree,
  Loader2,
} from "lucide-react";

// ── Types ──

interface TreeItemFlat {
  id: string;
  name: string;
  parentId: string | null;
  inBranchNumber: number;
  fullNumberPath: string;
  description: string | null;
  bannerUrl: string | null;
  productCount: number;
  docCount: number;
  deletedAt: Date | null;
}

interface TreeNode extends TreeItemFlat {
  children: TreeNode[];
  level: number;
}

function buildTree(flat: TreeItemFlat[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  for (const item of flat) {
    map.set(item.id, { ...item, children: [], level: 0 });
  }

  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  function assignLevel(nodes: TreeNode[], lvl: number) {
    for (const n of nodes) {
      n.level = lvl;
      assignLevel(n.children, lvl + 1);
    }
  }
  assignLevel(roots, 0);

  return roots;
}

// ── Component ──

interface Props {
  items: TreeItemFlat[];
}

export function TreeConstructor({ items }: Props) {
  const router = useRouter();
  const tree = useMemo(() => buildTree(items), [items]);
  const allItems = useMemo(() => items.filter((i) => !i.deletedAt), [items]);

  return (
    <div className="space-y-3">
      {/* Add root node button */}
      <AddNodeDialog
        parentId={null}
        parentPath=""
        allItems={allItems}
        onSaved={() => router.refresh()}
        trigger={
          <Button className="bg-menthol hover:bg-menthol-dark gap-2" size="sm">
            <Plus className="h-4 w-4" /> Добавить корневой раздел
          </Button>
        }
      />

      {/* Tree */}
      <div className="border rounded-lg divide-y">
        {tree.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <FolderTree className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg">Дерево пусто</p>
            <p className="text-sm mt-2">Добавьте корневой раздел классификатора</p>
          </div>
        ) : (
          tree.map((node) => (
            <TreeNodeRow
              key={node.id}
              node={node}
              allItems={allItems}
              onRefresh={() => router.refresh()}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ── TreeNodeRow ──

function TreeNodeRow({
  node,
  allItems,
  onRefresh,
}: {
  node: TreeNode;
  allItems: TreeItemFlat[];
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(node.level < 3);
  const hasChildren = node.children.length > 0;
  const isDeleted = !!node.deletedAt;
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);

  async function handleDelete() {
    if (!confirm(`Удалить «${node.name}» и все вложенные подразделы?`)) return;
    setDeleteLoading(true);
    try {
      await fetch(`/api/admin/tree/${node.id}`, { method: "DELETE" });
      onRefresh();
    } catch {
      alert("Ошибка удаления");
    }
    setDeleteLoading(false);
  }

  async function handleRestore() {
    setRestoreLoading(true);
    try {
      await fetch(`/api/admin/tree/${node.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore" }),
      });
      onRefresh();
    } catch {
      alert("Ошибка восстановления");
    }
    setRestoreLoading(false);
  }

  return (
    <div>
      <div
        className={`flex items-center gap-2 px-4 py-2.5 hover:bg-secondary/30 transition-colors ${
          isDeleted ? "opacity-50 bg-red-50" : ""
        }`}
        style={{ paddingLeft: `${16 + node.level * 24}px` }}
      >
        {/* Expand/Collapse */}
        {hasChildren ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex-shrink-0 p-0.5 rounded hover:bg-secondary"
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        ) : (
          <span className="w-5 flex-shrink-0" />
        )}

        {/* Number + Name */}
        <span className="font-mono text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded flex-shrink-0">
          {node.fullNumberPath}
        </span>
        <span className={`font-medium text-sm truncate ${isDeleted ? "line-through" : ""}`}>
          {node.name}
        </span>

        {/* Badges */}
        {node.productCount > 0 && (
          <Badge variant="secondary" className="text-[10px]">{node.productCount} товаров</Badge>
        )}
        {node.docCount > 0 && (
          <Badge variant="outline" className="text-[10px]">{node.docCount} док.</Badge>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 ml-auto flex-shrink-0">
          {isDeleted ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-green-600"
              onClick={handleRestore}
              disabled={restoreLoading}
            >
              <Undo2 className="h-3 w-3 mr-1" />
              Восстановить
            </Button>
          ) : (
            <>
              <AddNodeDialog
                parentId={node.id}
                parentPath={node.fullNumberPath}
                allItems={allItems}
                onSaved={onRefresh}
                trigger={
                  <Button variant="ghost" size="sm" className="h-7 text-xs">
                    <Plus className="h-3 w-3 mr-1" /> Дочерний
                  </Button>
                }
              />
              <EditNodeDialog
                node={node}
                allItems={allItems}
                onSaved={onRefresh}
                trigger={
                  <Button variant="ghost" size="sm" className="h-7 text-xs">
                    <Pencil className="h-3 w-3" />
                  </Button>
                }
              />
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-red-500"
                onClick={handleDelete}
                disabled={deleteLoading}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Children */}
      {hasChildren && expanded && (
        <div>
          {node.children.map((child) => (
            <TreeNodeRow
              key={child.id}
              node={child}
              allItems={allItems}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Add Node Dialog ──

function AddNodeDialog({
  parentId,
  parentPath,
  allItems,
  onSaved,
  trigger,
}: {
  parentId: string | null;
  parentPath: string;
  allItems: TreeItemFlat[];
  onSaved: () => void;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const fd = new FormData(e.currentTarget);
    const body = {
      name: fd.get("name"),
      parentId: parentId || null,
      description: fd.get("description") || null,
      bannerUrl: fd.get("bannerUrl") || null,
    };

    try {
      const res = await fetch("/api/admin/tree", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setOpen(false);
        onSaved();
      } else {
        const d = await res.json();
        setError(d.error || "Ошибка");
      }
    } catch {
      setError("Ошибка соединения");
    }
    setLoading(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Добавить раздел</DialogTitle>
          <DialogDescription>
            {parentId
              ? `Дочерний раздел для «${parentPath}»`
              : "Корневой раздел классификатора"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="add-name">Название</Label>
            <Input id="add-name" name="name" placeholder="Например: Фасадные работы" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-desc">Описание (опционально)</Label>
            <Textarea id="add-desc" name="description" rows={2} placeholder="Краткое описание раздела" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-banner">Ссылка на баннер (опционально)</Label>
            <Input id="add-banner" name="bannerUrl" placeholder="https://..." />
          </div>
          <Button type="submit" className="w-full bg-menthol hover:bg-menthol-dark" disabled={loading}>
            {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Создание...</> : "Создать раздел"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Edit Node Dialog ──

function EditNodeDialog({
  node,
  allItems,
  onSaved,
  trigger,
}: {
  node: TreeNode;
  allItems: TreeItemFlat[];
  onSaved: () => void;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Список возможных родителей (исключая самого себя и потомков)
  const parentOptions = useMemo(() => {
    // Собираем ID всех потомков
    function collectDescendantIds(n: TreeNode): Set<string> {
      const ids = new Set<string>();
      for (const child of n.children) {
        ids.add(child.id);
        for (const id of collectDescendantIds(child)) {
          ids.add(id);
        }
      }
      return ids;
    }
    const descendantIds = collectDescendantIds(node);
    descendantIds.add(node.id); // исключаем себя

    return allItems.filter((item) => !descendantIds.has(item.id));
  }, [node, allItems]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const fd = new FormData(e.currentTarget);
    const newParentId = fd.get("parentId") as string;
    const body: Record<string, unknown> = {
      name: fd.get("name"),
      description: fd.get("description") || null,
      bannerUrl: fd.get("bannerUrl") || null,
    };

    if (newParentId !== (node.parentId || "__root__")) {
      body.parentId = newParentId === "__root__" ? null : newParentId;
    }

    try {
      const res = await fetch(`/api/admin/tree/${node.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setOpen(false);
        onSaved();
      } else {
        const d = await res.json();
        setError(d.error || "Ошибка");
      }
    } catch {
      setError("Ошибка соединения");
    }
    setLoading(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Редактировать раздел</DialogTitle>
          <DialogDescription>
            {node.fullNumberPath} — {node.name}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="edit-name">Название</Label>
            <Input id="edit-name" name="name" defaultValue={node.name} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-desc">Описание</Label>
            <Textarea id="edit-desc" name="description" rows={2} defaultValue={node.description || ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-banner">Ссылка на баннер</Label>
            <Input id="edit-banner" name="bannerUrl" defaultValue={node.bannerUrl || ""} placeholder="https://..." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-parent">Родительский раздел</Label>
            <Select name="parentId" defaultValue={node.parentId || "__root__"}>
              <SelectTrigger>
                <SelectValue placeholder="Корень (без родителя)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__root__">🏠 Корень (без родителя)</SelectItem>
                {parentOptions.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.fullNumberPath} — {item.name.slice(0, 50)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full bg-menthol hover:bg-menthol-dark" disabled={loading}>
            {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Сохранение...</> : "Сохранить изменения"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
