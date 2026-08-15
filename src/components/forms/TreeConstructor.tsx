"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { SearchSelect } from "@/components/shared/SearchSelect";
import { toastSuccess, toastError } from "@/lib/toast";
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Pencil,
  Trash2,
  Undo2,
  Redo2,
  ArrowUp,
  ArrowDown,
  FolderTree,
  Loader2,
  Check,
  Search,
  GripVertical,
} from "lucide-react";
import { comparePath } from "@/lib/utils";
import type { TreeOperation } from "@/server/admin/tree";

// ── Types ──

interface DraftNode {
  id: string;
  name: string;
  parentId: string | null;
  inBranchNumber: number;
  fullNumberPath: string;
  description: string | null;
  bannerUrl: string | null;
  productCount: number;
  docCount: number;
  conferenceCount: number;
  pollCount: number;
  deletedAt: Date | null;
  isNew?: boolean;
}

interface TreeNode extends DraftNode {
  children: TreeNode[];
  level: number;
}

interface Props {
  items: {
    id: string;
    name: string;
    parentId: string | null;
    inBranchNumber: number;
    fullNumberPath: string;
    description: string | null;
    bannerUrl: string | null;
    productCount: number;
    docCount: number;
    conferenceCount?: number;
    pollCount?: number;
    deletedAt: Date | null;
  }[];
}

// ── Draft-механика (клиентское зеркало серверной логики) ──

function collectSubtreeIds(map: Map<string, DraftNode>, id: string): string[] {
  const ids = new Set<string>([id]);
  // Итерация до фиксированной точки: порядок строк не обязан совпадать
  // с иерархией (родитель может стоять в map позже ребёнка после переносов)
  let changed = true;
  while (changed) {
    changed = false;
    for (const n of map.values()) {
      if (n.parentId && ids.has(n.parentId) && !ids.has(n.id)) {
        ids.add(n.id);
        changed = true;
      }
    }
  }
  return [...ids];
}

const parentKey = (p: string | null) => p ?? "__root__";

/** Применяет операции к черновику и перенумеровывает живое дерево (как на сервере) */
function applyOpsToDraft(nodes: DraftNode[], ops: TreeOperation[]): DraftNode[] {
  const map = new Map(nodes.map((n) => [n.id, { ...n }]));
  const order = new Map<string, string[]>();
  const parents = new Set<string | null>([null, ...nodes.map((n) => n.parentId)]);
  for (const p of parents) {
    order.set(
      parentKey(p),
      nodes
        .filter((n) => n.parentId === p && !n.deletedAt)
        .sort((a, b) => a.inBranchNumber - b.inBranchNumber)
        .map((n) => n.id),
    );
  }

  const removeFromOrder = (id: string) => {
    const n = map.get(id);
    if (!n) return;
    const list = order.get(parentKey(n.parentId));
    if (list) {
      const i = list.indexOf(id);
      if (i >= 0) list.splice(i, 1);
    }
  };
  const insertIntoOrder = (id: string, pid: string | null, position?: number) => {
    const list = order.get(parentKey(pid)) ?? [];
    order.set(parentKey(pid), list);
    const idx = position !== undefined && position > 0
      ? Math.min(position - 1, list.length)
      : list.length;
    list.splice(idx, 0, id);
  };

  for (const op of ops) {
    switch (op.type) {
      case "create": {
        const id = op.id!;
        map.set(id, {
          id,
          name: op.name!,
          parentId: op.parentId || null,
          inBranchNumber: 0,
          fullNumberPath: "",
          description: op.description ?? null,
          bannerUrl: op.bannerUrl ?? null,
          productCount: 0,
          docCount: 0,
          conferenceCount: 0,
          pollCount: 0,
          deletedAt: null,
          isNew: true,
        });
        insertIntoOrder(id, op.parentId || null, op.position);
        break;
      }
      case "update": {
        const n = map.get(op.id!);
        if (!n) break;
        if (op.name !== undefined) n.name = op.name;
        if (op.description !== undefined) n.description = op.description;
        if (op.bannerUrl !== undefined) n.bannerUrl = op.bannerUrl;
        break;
      }
      case "move": {
        const n = map.get(op.id!);
        if (!n || n.deletedAt) break;
        const newParent = op.parentId !== undefined ? (op.parentId || null) : n.parentId;
        removeFromOrder(n.id);
        n.parentId = newParent;
        insertIntoOrder(n.id, newParent, op.position);
        break;
      }
      case "delete": {
        const n = map.get(op.id!);
        if (!n || n.deletedAt) break;
        const now = new Date();
        for (const id of collectSubtreeIds(map, n.id)) {
          const s = map.get(id)!;
          if (!s.deletedAt) {
            s.deletedAt = now;
            removeFromOrder(id);
          }
        }
        break;
      }
      case "restore": {
        const n = map.get(op.id!);
        if (!n) break;
        for (const id of collectSubtreeIds(map, n.id)) {
          const s = map.get(id)!;
          if (s.deletedAt) s.deletedAt = null;
        }
        removeFromOrder(n.id);
        insertIntoOrder(n.id, n.parentId);
        for (const s of map.values()) {
          if (!s.deletedAt && s.parentId !== null) {
            const list = order.get(parentKey(s.parentId)) ?? [];
            order.set(parentKey(s.parentId), list);
            if (!list.includes(s.id)) list.push(s.id);
          }
        }
        break;
      }
    }
  }

  const renumber = (pid: string | null, parentPath: string) => {
    const list = order.get(parentKey(pid)) ?? [];
    list.forEach((id, i) => {
      const n = map.get(id);
      if (!n || n.deletedAt) return;
      n.inBranchNumber = i + 1;
      n.fullNumberPath = parentPath ? `${parentPath}.${i + 1}` : String(i + 1);
      renumber(n.id, n.fullNumberPath);
    });
  };
  renumber(null, "");

  return [...map.values()].sort((a, b) => comparePath(a.fullNumberPath, b.fullNumberPath));
}

function buildTree(flat: DraftNode[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];
  for (const item of flat) map.set(item.id, { ...item, children: [], level: 0 });
  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) map.get(node.parentId)!.children.push(node);
    else roots.push(node);
  }
  const assignLevel = (nodes: TreeNode[], lvl: number) => {
    for (const n of nodes) {
      n.level = lvl;
      n.children.sort((a, b) => comparePath(a.fullNumberPath, b.fullNumberPath));
      assignLevel(n.children, lvl + 1);
    }
  };
  assignLevel(roots, 0);
  return roots;
}

// ── History ──

interface HistoryEntry {
  ops: TreeOperation[];
  inverse: TreeOperation[];
  labels: string[];
}

// ── Component ──

export function TreeConstructor({ items }: Props) {
  const router = useRouter();

  // Черновик = серверное состояние (base) + применённые операции из истории.
  // История хранит forward/inverse операции — undo/redo просто двигают указатель.
  const [base, setBase] = useState<DraftNode[]>(() =>
    items.map((i) => ({ ...i, conferenceCount: i.conferenceCount ?? 0, pollCount: i.pollCount ?? 0 })),
  );
  const [history, setHistory] = useState<{ past: HistoryEntry[]; future: HistoryEntry[] }>({
    past: [],
    future: [],
  });

  const flat = useMemo(
    () => applyOpsToDraft(base, history.past.flatMap((h) => h.ops)),
    [base, history.past],
  );

  // Синхронизация с сервером: только когда пропсы реально изменились
  // (после применения батча или внешнего refresh)
  const itemsSignature = useMemo(
    () => items.map((i) => `${i.id}:${i.name}:${i.fullNumberPath}:${i.parentId}:${i.deletedAt ?? ""}`).join("|"),
    [items],
  );
  const lastSignature = useRef(itemsSignature);
  useEffect(() => {
    if (lastSignature.current !== itemsSignature) {
      lastSignature.current = itemsSignature;
      setBase(
        items.map((i) => ({
          ...i,
          conferenceCount: i.conferenceCount ?? 0,
          pollCount: i.pollCount ?? 0,
        })),
      );
      setHistory({ past: [], future: [] });
    }
  }, [items, itemsSignature]);

  function commit(ops: TreeOperation[], inverse: TreeOperation[], labels: string[]) {
    setHistory((h) => ({
      past: [...h.past, { ops, inverse, labels }],
      future: [],
    }));
  }

  const undo = useCallback(() => {
    setHistory((h) => {
      const last = h.past[h.past.length - 1];
      if (!last) return h;
      return { past: h.past.slice(0, -1), future: [last, ...h.future] };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory((h) => {
      const next = h.future[0];
      if (!next) return h;
      return { past: [...h.past, next], future: h.future.slice(1) };
    });
  }, []);

  // Горячие клавиши Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo]);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);

  // Диалоги
  const [addParentId, setAddParentId] = useState<string | null | undefined>(undefined);
  const [editNodeId, setEditNodeId] = useState<string | null>(null);
  const [deleteNodeId, setDeleteNodeId] = useState<string | null>(null);
  const [applyOpen, setApplyOpen] = useState(false);
  const [applying, setApplying] = useState(false);

  // DnD
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const nodeById = useMemo(() => new Map(flat.map((n) => [n.id, n])), [flat]);

  // ── Операции над черновиком ──

  const siblingPosition = (nodeId: string, dir: -1 | 1): number | undefined => {
    const node = nodeById.get(nodeId);
    if (!node) return undefined;
    const siblings = flat
      .filter((n) => n.parentId === node.parentId && !n.deletedAt)
      .sort((a, b) => a.inBranchNumber - b.inBranchNumber);
    const idx = siblings.findIndex((s) => s.id === nodeId);
    const target = idx + dir;
    if (target < 0 || target >= siblings.length) return undefined;
    return target + 1;
  };

  function renameNode(node: DraftNode, newName: string) {
    const name = newName.trim();
    if (!name || name === node.name) return;
    commit(
      [{ type: "update", id: node.id, name }],
      [{ type: "update", id: node.id, name: node.name }],
      [`Переименовать «${node.name}» → «${name}»`],
    );
  }

  function moveNode(node: DraftNode, parentId: string | null, position?: number, label?: string) {
    if (node.parentId === parentId && position === undefined) return;
    commit(
      [{ type: "move", id: node.id, parentId, position }],
      [{ type: "move", id: node.id, parentId: node.parentId, position: node.inBranchNumber }],
      [label || "Переместить раздел"],
    );
  }

  function deleteNode(node: DraftNode) {
    commit(
      [{ type: "delete", id: node.id }],
      [{ type: "restore", id: node.id }],
      [`Удалить «${node.name}»`],
    );
    setDeleteNodeId(null);
  }

  function restoreNode(node: DraftNode) {
    commit(
      [{ type: "restore", id: node.id }],
      [{ type: "delete", id: node.id }],
      [`Восстановить «${node.name}»`],
    );
  }

  function createNode(parentId: string | null, data: { name: string; description?: string; bannerUrl?: string }) {
    const id = crypto.randomUUID();
    commit(
      [{ type: "create", id, parentId, name: data.name, description: data.description ?? null, bannerUrl: data.bannerUrl ?? null }],
      [{ type: "delete", id }],
      [`Добавить «${data.name}»`],
    );
    if (parentId) {
      setExpanded((prev) => new Set(prev).add(parentId));
    }
  }

  function updateNode(node: DraftNode, patch: { name?: string; description?: string | null; bannerUrl?: string | null; parentId?: string | null }) {
    const inverse: TreeOperation[] = [];
    const labels: string[] = [];
    if (patch.name !== undefined && patch.name !== node.name) {
      labels.push(`Переименовать «${node.name}» → «${patch.name}»`);
      inverse.push({ type: "update", id: node.id, name: node.name });
    }
    if (patch.parentId !== undefined && patch.parentId !== node.parentId) {
      labels.push(`Переместить «${node.name}»`);
      inverse.push({ type: "move", id: node.id, parentId: node.parentId, position: node.inBranchNumber });
    }
    if (labels.length === 0) {
      // только описание/баннер
      labels.push(`Изменить «${node.name}»`);
      inverse.push({
        type: "update",
        id: node.id,
        description: node.description,
        bannerUrl: node.bannerUrl,
      });
    }
    commit(
      [{ type: "update", id: node.id, ...patch }],
      inverse,
      labels,
    );
  }

  async function applyChanges() {
    if (history.past.length === 0) return;
    setApplying(true);
    try {
      const operations = history.past.flatMap((h) => h.ops);
      const res = await fetch("/api/admin/tree/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operations }),
      });
      if (res.ok) {
        const d = await res.json().catch(() => ({}));
        toastSuccess("Изменения сохранены", "Дерево перенумеровано, всё содержимое обновлено");
        setApplyOpen(false);
        setHistory({ past: [], future: [] });
        if (Array.isArray(d.items)) {
          setBase(
            (d.items as DraftNode[]).map((i) => ({
              ...i,
              conferenceCount: i.conferenceCount ?? 0,
              pollCount: i.pollCount ?? 0,
            })),
          );
        }
        router.refresh();
      } else {
        const d = await res.json().catch(() => ({}));
        toastError("Ошибка", d.error || "Не удалось применить изменения");
      }
    } catch {
      toastError("Ошибка соединения", "Проверьте подключение к интернету");
    }
    setApplying(false);
  }

  // ── DnD ──

  function isDropTarget(draggedId: string, targetId: string): boolean {
    if (draggedId === targetId) return false;
    const target = nodeById.get(targetId);
    if (!target || target.deletedAt) return false;
    const descendants = new Set(collectSubtreeIds(nodeById, draggedId));
    return !descendants.has(targetId);
  }

  function handleDrop(targetId: string) {
    if (!dragId || !isDropTarget(dragId, targetId)) {
      setDragId(null);
      setDropTargetId(null);
      return;
    }
    const node = nodeById.get(dragId)!;
    const target = nodeById.get(targetId)!;
    moveNode(node, target.id, undefined, `Переместить «${node.name}» под «${target.name}»`);
    setDragId(null);
    setDropTargetId(null);
  }

  function handleDropRoot() {
    if (!dragId) return;
    const node = nodeById.get(dragId)!;
    moveNode(node, null, undefined, `Переместить «${node.name}» в корень`);
    setDragId(null);
    setDropTargetId(null);
  }

  // ── Поиск ──

  const liveNodes = useMemo(() => flat.filter((n) => !n.deletedAt), [flat]);
  const matchIds = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return null;
    const matched = new Set<string>();
    for (const n of liveNodes) {
      if (n.name.toLowerCase().includes(q) || n.fullNumberPath.includes(q)) matched.add(n.id);
    }
    // добавляем всех предков совпадений, чтобы дерево оставалось видимым
    for (const n of liveNodes) {
      let cur = n.parentId;
      while (cur) {
        if (matched.has(n.id)) matched.add(cur);
        cur = nodeById.get(cur)?.parentId ?? null;
      }
    }
    return matched;
  }, [liveNodes, search, nodeById]);

  const displayFlat = useMemo(() => {
    // Удалённые узлы скрыты по умолчанию — показываются только по переключателю
    const list = showDeleted ? flat : flat.filter((n) => !n.deletedAt);
    if (!matchIds) return list;
    const visible = new Set<string>();
    for (const id of matchIds) {
      let cur: string | null = id;
      while (cur) {
        visible.add(cur);
        cur = nodeById.get(cur)?.parentId ?? null;
      }
    }
    return list.filter((n) => visible.has(n.id));
  }, [flat, matchIds, nodeById, showDeleted]);

  const tree = useMemo(() => buildTree(displayFlat), [displayFlat]);

  // Диалоги добавления/редактирования берут данные из черновика
  const editNode = editNodeId ? nodeById.get(editNodeId) ?? null : null;

  const pendingLabels = history.past.flatMap((h) => h.labels);

  return (
    <div className="space-y-3">
      {/* Панель инструментов */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по названию или номеру..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setExpanded(new Set(liveNodes.map((n) => n.id)))}
        >
          Развернуть всё
        </Button>
        <Button variant="outline" size="sm" onClick={() => setExpanded(new Set())}>
          Свернуть всё
        </Button>
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <Checkbox
            checked={showDeleted}
            onCheckedChange={(v) => setShowDeleted(v === true)}
          />
          Показывать удалённые
        </label>
        <Button size="sm" className="bg-menthol hover:bg-menthol-dark gap-2" onClick={() => setAddParentId(null)}>
          <Plus className="h-4 w-4" /> Корневой раздел
        </Button>

        {/* Панель изменений */}
        <div className="ml-auto flex items-center gap-1.5">
          <Badge variant={history.past.length > 0 ? "default" : "secondary"} className={history.past.length > 0 ? "bg-orange-accent" : ""}>
            Изменений: {history.past.length}
          </Badge>
          <Button variant="outline" size="sm" disabled={history.past.length === 0} onClick={undo} title="Отменить (Ctrl+Z)">
            <Undo2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="sm" disabled={history.future.length === 0} onClick={redo} title="Повторить (Ctrl+Y)">
            <Redo2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            className="bg-menthol hover:bg-menthol-dark gap-1.5"
            disabled={history.past.length === 0}
            onClick={() => setApplyOpen(true)}
          >
            <Check className="h-3.5 w-3.5" />
            Применить изменения
          </Button>
        </div>
      </div>

      {/* Дерево */}
      <div className="border rounded-lg divide-y">
        {tree.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <FolderTree className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg">{search ? "Ничего не найдено" : "Дерево пусто"}</p>
            <p className="text-sm mt-2">
              {search ? "Попробуйте другой запрос" : "Добавьте корневой раздел классификатора"}
            </p>
          </div>
        ) : (
          tree.map((node) => (
            <TreeNodeRow
              key={node.id}
              node={node}
              expanded={expanded}
              onToggle={(id) =>
                setExpanded((prev) => {
                  const next = new Set(prev);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  return next;
                })
              }
              editingId={editingId}
              editValue={editValue}
              onStartEdit={(id, name) => {
                setEditingId(id);
                setEditValue(name);
              }}
              onEditValue={setEditValue}
              onCommitEdit={(id, name) => {
                const node = nodeById.get(id);
                if (node) renameNode(node, name);
                setEditingId(null);
              }}
              onCancelEdit={() => setEditingId(null)}
              onAddChild={(id) => setAddParentId(id)}
              onEdit={(id) => setEditNodeId(id)}
              onDelete={(id) => setDeleteNodeId(id)}
              onRestore={(id) => {
                const node = nodeById.get(id);
                if (node) restoreNode(node);
              }}
              onMove={(id, dir) => {
                const node = nodeById.get(id);
                if (!node) return;
                const pos = siblingPosition(id, dir);
                if (pos !== undefined) {
                  moveNode(node, node.parentId, pos, `Переместить «${node.name}»`);
                }
              }}
              onDragStart={setDragId}
              onDragEnd={() => {
                setDragId(null);
                setDropTargetId(null);
              }}
              dragId={dragId}
              dropTargetId={dropTargetId}
              onDragOver={(targetId) => {
                if (dragId && isDropTarget(dragId, targetId)) setDropTargetId(targetId);
              }}
              onDrop={handleDrop}
              searchQuery={search.trim().toLowerCase()}
              matchIds={matchIds}
              flat={nodeById}
            />
          ))
        )}
      </div>

      {/* Зона «переместить в корень» при перетаскивании */}
      {dragId && (
        <div
          className="border-2 border-dashed rounded-lg p-3 text-center text-sm text-muted-foreground hover:border-menthol hover:text-menthol transition-colors"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleDropRoot();
          }}
        >
          Переместить в корень
        </div>
      )}

      {/* Подтверждение применения изменений */}
      <ConfirmDialog
        open={applyOpen}
        onOpenChange={setApplyOpen}
        title="Применить изменения к дереву?"
        message={`Будет применено ${history.past.length} изменений. Нумерация дерева пересчитается, все товары, документы и профили получат новые номера автоматически.`}
        variant="success"
        confirmLabel="Применить"
        onConfirm={applyChanges}
        loading={applying}
      >
        {pendingLabels.length > 0 && (
          <div className="mt-2 max-h-40 overflow-y-auto rounded-md border bg-secondary/50 p-2 text-xs">
            <ul className="space-y-1">
              {pendingLabels.slice(0, 20).map((label, i) => (
                <li key={i}>• {label}</li>
              ))}
              {pendingLabels.length > 20 && (
                <li className="text-muted-foreground">… и ещё {pendingLabels.length - 20}</li>
              )}
            </ul>
          </div>
        )}
      </ConfirmDialog>

      {/* Диалог добавления */}
      <AddNodeDialog
        open={addParentId !== undefined}
        parentId={addParentId ?? null}
        parentName={addParentId ? (nodeById.get(addParentId)?.name ?? "") : null}
        onClose={() => setAddParentId(undefined)}
        onSave={(data) => {
          createNode(addParentId ?? null, data);
          setAddParentId(undefined);
        }}
      />

      {/* Диалог редактирования */}
      <EditNodeDialog
        node={editNode}
        allLive={liveNodes}
        nodeById={nodeById}
        onClose={() => setEditNodeId(null)}
        onSave={(patch) => {
          if (editNode) updateNode(editNode, patch);
          setEditNodeId(null);
        }}
      />

      {/* Подтверждение удаления */}
      <ConfirmDialog
        open={!!deleteNodeId}
        onOpenChange={(v) => { if (!v) setDeleteNodeId(null); }}
        title="Удалить раздел?"
        message={
          deleteNodeId
            ? `Раздел «${nodeById.get(deleteNodeId)?.name ?? ""}» и все вложенные подразделы будут удалены. Удалить можно только пустой раздел.`
            : ""
        }
        confirmLabel="Удалить"
        onConfirm={() => {
          const node = deleteNodeId ? nodeById.get(deleteNodeId) : null;
          if (node) deleteNode(node);
        }}
      />
    </div>
  );
}

// ── Строка дерева ──

function HighlightedName({ name, query }: { name: string; query: string }) {
  if (!query) return <>{name}</>;
  const idx = name.toLowerCase().indexOf(query);
  if (idx === -1) return <>{name}</>;
  return (
    <>
      {name.slice(0, idx)}
      <mark className="bg-orange-light/60 rounded-sm px-0.5">{name.slice(idx, idx + query.length)}</mark>
      {name.slice(idx + query.length)}
    </>
  );
}

function TreeNodeRow({
  node,
  expanded,
  onToggle,
  editingId,
  editValue,
  onStartEdit,
  onEditValue,
  onCommitEdit,
  onCancelEdit,
  onAddChild,
  onEdit,
  onDelete,
  onRestore,
  onMove,
  onDragStart,
  onDragEnd,
  dragId,
  dropTargetId,
  onDragOver,
  onDrop,
  searchQuery,
  matchIds,
  flat,
}: {
  node: TreeNode;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  editingId: string | null;
  editValue: string;
  onStartEdit: (id: string, name: string) => void;
  onEditValue: (v: string) => void;
  onCommitEdit: (id: string, name: string) => void;
  onCancelEdit: () => void;
  onAddChild: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onRestore: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  dragId: string | null;
  dropTargetId: string | null;
  onDragOver: (targetId: string) => void;
  onDrop: (targetId: string) => void;
  searchQuery: string;
  matchIds: Set<string> | null;
  flat: Map<string, DraftNode>;
}) {
  const isExpanded = expanded.has(node.id);
  const hasChildren = node.children.length > 0;
  const isDeleted = !!node.deletedAt;
  const isEditing = editingId === node.id;
  const isDropTarget = dropTargetId === node.id && dragId !== node.id;

  // Позиция среди живых siblings — для стрелок
  const canUp = !isDeleted && (() => {
    const siblings = [...flat.values()]
      .filter((n) => n.parentId === node.parentId && !n.deletedAt)
      .sort((a, b) => a.inBranchNumber - b.inBranchNumber);
    return siblings.findIndex((s) => s.id === node.id) > 0;
  })();
  const canDown = !isDeleted && (() => {
    const siblings = [...flat.values()]
      .filter((n) => n.parentId === node.parentId && !n.deletedAt)
      .sort((a, b) => a.inBranchNumber - b.inBranchNumber);
    const idx = siblings.findIndex((s) => s.id === node.id);
    return idx >= 0 && idx < siblings.length - 1;
  })();

  const isMatch = matchIds?.has(node.id);

  return (
    <div>
      <div
        draggable={!isDeleted}
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          onDragStart(node.id);
        }}
        onDragOver={(e) => {
          if (dragId) {
            e.preventDefault();
            onDragOver(node.id);
          }
        }}
        onDragLeave={() => {
          if (dropTargetId === node.id) {
            // подсветку снимает следующий dragover
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          onDrop(node.id);
        }}
        onDragEnd={onDragEnd}
        className={`flex items-center gap-2 px-4 py-2 hover:bg-secondary/30 transition-colors cursor-grab active:cursor-grabbing ${
          isDeleted ? "opacity-50 bg-red-50" : ""
        } ${isDropTarget ? "ring-2 ring-menthol ring-inset bg-menthol/10" : ""}`}
        style={{ paddingLeft: `${16 + node.level * 24}px` }}
      >
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 flex-shrink-0" />

        {hasChildren ? (
          <button
            onClick={() => onToggle(node.id)}
            className="flex-shrink-0 p-0.5 rounded hover:bg-secondary"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        ) : (
          <span className="w-5 flex-shrink-0" />
        )}

        <span className="font-mono text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded flex-shrink-0">
          {node.fullNumberPath || "—"}
        </span>

        {isEditing ? (
          <input
            autoFocus
            value={editValue}
            onChange={(e) => onEditValue(e.target.value)}
            onBlur={() => onCommitEdit(node.id, editValue)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onCommitEdit(node.id, editValue);
              if (e.key === "Escape") onCancelEdit();
            }}
            className="flex-1 h-7 px-1 text-sm border rounded"
          />
        ) : (
          <button
            className={`font-medium text-sm truncate text-left hover:text-menthol transition-colors ${isDeleted ? "line-through" : ""}`}
            title="Нажмите, чтобы переименовать"
            onClick={() => onStartEdit(node.id, node.name)}
          >
            <HighlightedName name={node.name} query={isMatch ? searchQuery : ""} />
          </button>
        )}

        {node.productCount > 0 && (
          <Badge variant="secondary" className="text-[10px]">{node.productCount} тов.</Badge>
        )}
        {node.docCount > 0 && (
          <Badge variant="outline" className="text-[10px]">{node.docCount} док.</Badge>
        )}
        {node.conferenceCount > 0 && (
          <Badge variant="outline" className="text-[10px]">{node.conferenceCount} конф.</Badge>
        )}
        {node.pollCount > 0 && (
          <Badge variant="outline" className="text-[10px]">{node.pollCount} опр.</Badge>
        )}

        <div className="flex items-center gap-0.5 ml-auto flex-shrink-0">
          {isDeleted ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-green-600"
              onClick={() => onRestore(node.id)}
            >
              <Undo2 className="h-3 w-3 mr-1" />
              Восстановить
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="icon" className="h-7 w-7" title="Выше"
                disabled={!canUp} onClick={() => onMove(node.id, -1)}>
                <ArrowUp className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" title="Ниже"
                disabled={!canDown} onClick={() => onMove(node.id, 1)}>
                <ArrowDown className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onAddChild(node.id)}>
                <Plus className="h-3 w-3 mr-1" /> Дочерний
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" title="Редактировать"
                onClick={() => onEdit(node.id)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" title="Удалить"
                onClick={() => onDelete(node.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>

      {hasChildren && isExpanded && (
        <div>
          {node.children.map((child) => (
            <TreeNodeRow
              key={child.id}
              node={child}
              expanded={expanded}
              onToggle={onToggle}
              editingId={editingId}
              editValue={editValue}
              onStartEdit={onStartEdit}
              onEditValue={onEditValue}
              onCommitEdit={onCommitEdit}
              onCancelEdit={onCancelEdit}
              onAddChild={onAddChild}
              onEdit={onEdit}
              onDelete={onDelete}
              onRestore={onRestore}
              onMove={onMove}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              dragId={dragId}
              dropTargetId={dropTargetId}
              onDragOver={onDragOver}
              onDrop={onDrop}
              searchQuery={searchQuery}
              matchIds={matchIds}
              flat={flat}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Диалог добавления ──

function AddNodeDialog({
  open,
  parentId,
  parentName,
  onClose,
  onSave,
}: {
  open: boolean;
  parentId: string | null;
  parentName: string | null;
  onClose: () => void;
  onSave: (data: { name: string; description?: string; bannerUrl?: string }) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");

  useEffect(() => {
    if (open) {
      setName("");
      setDescription("");
      setBannerUrl("");
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Добавить раздел</DialogTitle>
          <DialogDescription>
            {parentId ? `Дочерний раздел для «${parentName ?? ""}»` : "Корневой раздел классификатора"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="add-name">Название</Label>
            <Input id="add-name" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Например: Фасадные работы" autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-desc">Описание (опционально)</Label>
            <Textarea id="add-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Краткое описание раздела" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-banner">Ссылка на баннер (опционально)</Label>
            <Input id="add-banner" value={bannerUrl} onChange={(e) => setBannerUrl(e.target.value)}
              placeholder="https://..." />
          </div>
          <Button
            className="w-full bg-menthol hover:bg-menthol-dark"
            disabled={!name.trim()}
            onClick={() => onSave({ name: name.trim(), description: description || undefined, bannerUrl: bannerUrl || undefined })}
          >
            <Plus className="h-4 w-4 mr-2" />
            Создать раздел
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Диалог редактирования ──

function EditNodeDialog({
  node,
  allLive,
  nodeById,
  onClose,
  onSave,
}: {
  node: DraftNode | null;
  allLive: DraftNode[];
  nodeById: Map<string, DraftNode>;
  onClose: () => void;
  onSave: (patch: { name?: string; description?: string | null; bannerUrl?: string | null; parentId?: string | null }) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [parentId, setParentId] = useState("__root__");

  useEffect(() => {
    if (node) {
      setName(node.name);
      setDescription(node.description || "");
      setBannerUrl(node.bannerUrl || "");
      setParentId(node.parentId || "__root__");
    }
  }, [node]);

  const parentOptions = useMemo(() => {
    if (!node) return [];
    const excluded = new Set(collectSubtreeIds(nodeById, node.id));
    return allLive.filter((n) => !excluded.has(n.id));
  }, [node, allLive, nodeById]);

  if (!node) return null;

  return (
    <Dialog open={!!node} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Редактировать раздел</DialogTitle>
          <DialogDescription>
            {node.fullNumberPath} — {node.name}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Название</Label>
            <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-desc">Описание</Label>
            <Textarea id="edit-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-banner">Ссылка на баннер</Label>
            <Input id="edit-banner" value={bannerUrl} onChange={(e) => setBannerUrl(e.target.value)} placeholder="https://..." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-parent">Родительский раздел</Label>
            <SearchSelect
              name="parentId"
              options={[
                { value: "__root__", label: "🏠 Корень (без родителя)" },
                ...parentOptions.map((item) => ({ value: item.id, label: `${item.fullNumberPath} — ${item.name}` })),
              ]}
              value={parentId}
              onChange={setParentId}
              placeholder="Корень (без родителя)"
              searchPlaceholder="Поиск раздела..."
            />
          </div>
          <Button
            className="w-full bg-menthol hover:bg-menthol-dark"
            disabled={!name.trim()}
            onClick={() =>
              onSave({
                name: name.trim(),
                description: description || null,
                bannerUrl: bannerUrl || null,
                parentId: parentId === "__root__" ? null : parentId,
              })
            }
          >
            <Check className="h-4 w-4 mr-2" />
            Сохранить изменения
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
