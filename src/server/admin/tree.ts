"use server";

import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { comparePath } from "@/lib/utils";

// ── Типы ──

export interface TreeItemFlat {
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
}

/**
 * Операция над деревом. Батч операций применяется атомарно (одна транзакция),
 * после чего всё живое дерево перенумеровывается целиком.
 */
export interface TreeOperation {
  type: "create" | "update" | "move" | "delete" | "restore";
  /** Для create — id, сгенерированный клиентом (нужен для ссылок из других операций батча) */
  id?: string;
  name?: string;
  description?: string | null;
  bannerUrl?: string | null;
  parentId?: string | null;
  /** 1-based позиция среди живых siblings (для create/move) */
  position?: number;
}

// ── JS-модель дерева ──

interface NodeModel {
  id: string;
  name: string;
  parentId: string | null;
  inBranchNumber: number;
  fullNumberPath: string;
  description: string | null;
  bannerUrl: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  isNew: boolean;
}

function collectSubtreeIds(nodes: Map<string, NodeModel>, id: string): Set<string> {
  const ids = new Set<string>([id]);
  // Итерация до фиксированной точки: порядок строк не обязан совпадать
  // с иерархией (родитель может стоять в map позже ребёнка после переносов)
  let changed = true;
  while (changed) {
    changed = false;
    for (const n of nodes.values()) {
      if (n.parentId && ids.has(n.parentId) && !ids.has(n.id)) {
        ids.add(n.id);
        changed = true;
      }
    }
  }
  return ids;
}

/** Проверка на цикл: newParent не должен быть самим узлом или его потомком, и не удалён */
function validateParent(nodes: Map<string, NodeModel>, nodeId: string, newParentId: string | null) {
  if (!newParentId) return;
  if (newParentId === nodeId) {
    throw new Error("Нельзя сделать узел родителем самого себя");
  }
  const descendants = collectSubtreeIds(nodes, nodeId);
  if (descendants.has(newParentId)) {
    throw new Error("Нельзя перенести узел в собственное поддерево");
  }
  const parent = nodes.get(newParentId);
  if (!parent) throw new Error("Родительский узел не найден");
  if (parent.deletedAt) throw new Error("Нельзя перенести узел в удалённый раздел");
}

/** Количество контента, привязанного к поддереву (для защиты удаления) */
async function subtreeContentCounts(ids: string[]): Promise<{
  products: number;
  documents: number;
  conferences: number;
  polls: number;
  classifiers: number;
}> {
  if (ids.length === 0) {
    return { products: 0, documents: 0, conferences: 0, polls: 0, classifiers: 0 };
  }
  const placeholders = ids.map(() => "?").join(", ");
  const classifierConds = ids
    .map(() => `(',' || COALESCE("classifierIds", '') || ',') LIKE ?`)
    .join(" OR ");
  const rows = await prisma.$queryRawUnsafe<
    {
      products: number | bigint;
      documents: number | bigint;
      conferences: number | bigint;
      polls: number | bigint;
      classifiers: number | bigint;
    }[]
  >(
    `SELECT
      (SELECT COUNT(*) FROM products WHERE "treeItemId" IN (${placeholders}) AND "deletedAt" IS NULL) AS products,
      (SELECT COUNT(*) FROM library_documents WHERE "treeItemId" IN (${placeholders}) AND "deletedAt" IS NULL) AS documents,
      (SELECT COUNT(*) FROM conferences WHERE "treeItemId" IN (${placeholders})) AS conferences,
      (SELECT COUNT(*) FROM polls WHERE "treeItemId" IN (${placeholders})) AS polls,
      (SELECT (SELECT COUNT(*) FROM user_profiles WHERE ${classifierConds}) + (SELECT COUNT(*) FROM companies WHERE ${classifierConds})) AS classifiers`,
    ...ids,
    ...ids,
    ...ids,
    ...ids,
    ...ids.map((id) => `%,${id},%`),
    ...ids.map((id) => `%,${id},%`),
  );
  return {
    products: Number(rows[0]?.products ?? 0),
    documents: Number(rows[0]?.documents ?? 0),
    conferences: Number(rows[0]?.conferences ?? 0),
    polls: Number(rows[0]?.polls ?? 0),
    classifiers: Number(rows[0]?.classifiers ?? 0),
  };
}

// ── Публичные функции ──

/** Получить все узлы дерева (включая удалённые — для админа) */
export async function getAllTreeItems(includeDeleted = false): Promise<TreeItemFlat[]> {
  const where = includeDeleted ? {} : { deletedAt: null };
  const items = await prisma.productTreeItem.findMany({
    where,
    include: {
      _count: { select: { products: true, documents: true, conferences: true, polls: true } },
    },
  });

  items.sort((a, b) => comparePath(a.fullNumberPath, b.fullNumberPath));

  return items.map((item) => ({
    id: item.id,
    name: item.name,
    parentId: item.parentId,
    inBranchNumber: item.inBranchNumber,
    fullNumberPath: item.fullNumberPath,
    description: item.description,
    bannerUrl: item.bannerUrl,
    productCount: item._count.products,
    docCount: item._count.documents,
    conferenceCount: item._count.conferences,
    pollCount: item._count.polls,
    deletedAt: item.deletedAt,
  }));
}

/**
 * Атомарное применение батча операций:
 * 1) операции применяются к JS-модели всего дерева (без промежуточных записей в БД);
 * 2) живое дерево перенумеровывается целиком (inBranchNumber + fullNumberPath);
 * 3) в БД внутри одной транзакции пишутся только изменившиеся узлы.
 */
export async function applyTreeOperations(operations: TreeOperation[]): Promise<TreeItemFlat[]> {
  const dbNodes = await prisma.productTreeItem.findMany();

  const nodes = new Map<string, NodeModel>();
  for (const n of dbNodes) {
    nodes.set(n.id, {
      id: n.id,
      name: n.name,
      parentId: n.parentId,
      inBranchNumber: n.inBranchNumber,
      fullNumberPath: n.fullNumberPath,
      description: n.description,
      bannerUrl: n.bannerUrl,
      deletedAt: n.deletedAt,
      createdAt: n.createdAt,
      isNew: false,
    });
  }

  /** Порядок живых детей каждого родителя (ключ — parentId или "__root__") */
  const order = new Map<string, string[]>();
  const orderKey = (parentId: string | null) => parentId ?? "__root__";

  // Начальный порядок: живые узлы по inBranchNumber
  const parents = new Set<string | null>([null, ...dbNodes.map((n) => n.parentId)]);
  for (const p of parents) {
    const children = dbNodes
      .filter((n) => n.parentId === p && n.deletedAt === null)
      .sort((a, b) => a.inBranchNumber - b.inBranchNumber)
      .map((n) => n.id);
    order.set(orderKey(p), children);
  }

  function removeFromOrder(id: string) {
    const node = nodes.get(id);
    if (!node) return;
    const list = order.get(orderKey(node.parentId));
    if (list) {
      const idx = list.indexOf(id);
      if (idx >= 0) list.splice(idx, 1);
    }
  }

  function insertIntoOrder(id: string, parentId: string | null, position?: number) {
    const key = orderKey(parentId);
    const list = order.get(key) ?? [];
    order.set(key, list);
    const idx = position !== undefined && position > 0
      ? Math.min(position - 1, list.length)
      : list.length;
    list.splice(idx, 0, id);
  }

  /** Узлы, затронутые операциями (пишутся в БД всегда) */
  const dirtyIds = new Set<string>();

  // ── Применяем операции к модели ──
  for (const op of operations) {
    switch (op.type) {
      case "create": {
        const id = op.id || crypto.randomUUID();
        if (!op.name || !op.name.trim()) throw new Error("Название узла обязательно");
        if (nodes.has(id)) throw new Error("Узел с таким id уже существует");
        if (op.parentId) {
          const parent = nodes.get(op.parentId);
          if (!parent) throw new Error("Родительский узел не найден");
          if (parent.deletedAt) throw new Error("Нельзя создать узел в удалённом разделе");
        }
        nodes.set(id, {
          id,
          name: op.name.trim(),
          parentId: op.parentId || null,
          inBranchNumber: 0,
          fullNumberPath: "",
          description: op.description ?? null,
          bannerUrl: op.bannerUrl ?? null,
          deletedAt: null,
          createdAt: new Date(),
          isNew: true,
        });
        dirtyIds.add(id);
        insertIntoOrder(id, op.parentId || null, op.position);
        break;
      }
      case "update":
      case "move": {
        const id = op.id;
        if (!id) throw new Error("Не указан id узла");
        const node = nodes.get(id);
        if (!node) throw new Error("Узел не найден");
        if (node.deletedAt) throw new Error("Нельзя редактировать удалённый узел");
        if (op.name !== undefined) {
          if (!op.name.trim()) throw new Error("Название узла обязательно");
          node.name = op.name.trim();
        }
        if (op.description !== undefined) node.description = op.description;
        if (op.bannerUrl !== undefined) node.bannerUrl = op.bannerUrl;
        dirtyIds.add(id);

        if (op.parentId !== undefined || op.position !== undefined) {
          const newParent = op.parentId !== undefined ? (op.parentId || null) : node.parentId;
          validateParent(nodes, id, newParent);
          removeFromOrder(id);
          node.parentId = newParent;
          insertIntoOrder(id, newParent, op.position);
        }
        break;
      }
      case "delete": {
        const id = op.id;
        if (!id) throw new Error("Не указан id узла");
        const node = nodes.get(id);
        if (!node) throw new Error("Узел не найден");
        if (node.deletedAt) break;

        // Защита: узел с контентом удалять нельзя
        const subtreeIds = [...collectSubtreeIds(nodes, id)];
        const counts = await subtreeContentCounts(subtreeIds);
        if (
          counts.products + counts.documents + counts.conferences + counts.polls + counts.classifiers > 0
        ) {
          const parts: string[] = [];
          if (counts.products) parts.push(`${counts.products} товар(ов)`);
          if (counts.documents) parts.push(`${counts.documents} документ(ов)`);
          if (counts.conferences) parts.push(`${counts.conferences} конференц(ий)`);
          if (counts.polls) parts.push(`${counts.polls} опрос(ов)`);
          if (counts.classifiers) parts.push(`${counts.classifiers} ссылок в профилях`);
          throw new Error(
            `Нельзя удалить «${node.name}»: к разделу привязано ${parts.join(", ")}. Сначала перенесите содержимое.`,
          );
        }

        const now = new Date();
        for (const subId of subtreeIds) {
          const sub = nodes.get(subId)!;
          if (!sub.deletedAt) {
            sub.deletedAt = now;
            dirtyIds.add(subId);
            removeFromOrder(subId);
          }
        }
        break;
      }
      case "restore": {
        const id = op.id;
        if (!id) throw new Error("Не указан id узла");
        const node = nodes.get(id);
        if (!node) throw new Error("Узел не найден");
        if (!node.deletedAt) break;

        // Восстанавливаем узел и всех удалённых потомков
        const subtreeIds = [...collectSubtreeIds(nodes, id)].filter((_subId) => {
          // только те, что в поддереве и удалены
          return true;
        });
        for (const subId of subtreeIds) {
          const sub = nodes.get(subId)!;
          if (sub.deletedAt) {
            sub.deletedAt = null;
            dirtyIds.add(subId);
          }
        }
        // Восстановленный узел встаёт в конец своего родителя
        removeFromOrder(id);
        insertIntoOrder(id, node.parentId);
        // Потомков (уже живых) возвращаем в порядок их родителя в конце
        for (const n of nodes.values()) {
          if (!n.deletedAt && n.parentId) {
            const list = order.get(orderKey(n.parentId));
            if (list && !list.includes(n.id)) list.push(n.id);
          }
        }
        break;
      }
    }
  }

  // ── Полная перенумерация живого дерева ──
  function renumber(parentId: string | null, parentPath: string) {
    const list = order.get(orderKey(parentId)) || [];
    for (let i = 0; i < list.length; i++) {
      const node = nodes.get(list[i]);
      if (!node || node.deletedAt) continue;
      const num = i + 1;
      const path = parentPath ? `${parentPath}.${num}` : String(num);
      if (node.inBranchNumber !== num || node.fullNumberPath !== path) {
        node.inBranchNumber = num;
        node.fullNumberPath = path;
        dirtyIds.add(node.id);
      }
      renumber(node.id, path);
    }
  }
  renumber(null, "");

  // ── Запись в БД (одна транзакция) ──
  await prisma.$transaction(async (tx) => {
    for (const id of dirtyIds) {
      const node = nodes.get(id);
      if (!node) continue;
      if (node.isNew) {
        await tx.productTreeItem.create({
          data: {
            id: node.id,
            name: node.name,
            parentId: node.parentId,
            inBranchNumber: node.inBranchNumber,
            fullNumberPath: node.fullNumberPath,
            description: node.description,
            bannerUrl: node.bannerUrl,
            // Узел мог быть создан и удалён в одном батче — сохраняем deletedAt
            deletedAt: node.deletedAt,
          },
        });
      } else {
        await tx.productTreeItem.update({
          where: { id: node.id },
          data: {
            name: node.name,
            parentId: node.parentId,
            inBranchNumber: node.inBranchNumber,
            fullNumberPath: node.fullNumberPath,
            description: node.description,
            bannerUrl: node.bannerUrl,
            deletedAt: node.deletedAt,
          },
        });
      }
    }
  });

  return getAllTreeItems(true);
}

// ── Тонкие обёртки над ядром (совместимость с одиночными роутами) ──

/** Существует ли живой (не удалённый) узел с таким id */
export async function isLiveTreeItem(id: string | null | undefined): Promise<boolean> {
  if (!id) return true;
  const item = await prisma.productTreeItem.findUnique({
    where: { id },
    select: { deletedAt: true },
  });
  return !!item && item.deletedAt === null;
}

// ── Снимки дерева (резервные копии «как гитхаб») ──

interface SnapshotNode {
  id: string;
  name: string;
  parentId: string | null;
  inBranchNumber: number;
  fullNumberPath: string;
  description: string | null;
  bannerUrl: string | null;
  deletedAt: Date | null;
}

/** Валидирует данные снимка (из файла или БД) и проверяет целостность связей */
export async function parseTreeSnapshotData(raw: unknown): Promise<SnapshotNode[]> {
  if (!Array.isArray(raw)) {
    throw new Error("Данные должны быть массивом узлов дерева");
  }
  const ids = new Set<string>();
  const nodes: SnapshotNode[] = raw.map((r) => {
    const n = (r ?? {}) as Record<string, unknown>;
    const id = typeof n.id === "string" ? n.id : "";
    const name = typeof n.name === "string" ? n.name : "";
    if (!id) throw new Error("У узла отсутствует id");
    if (!name) throw new Error(`У узла ${id} отсутствует название`);
    if (ids.has(id)) throw new Error(`Дублирующийся id узла: ${id}`);
    ids.add(id);
    const deletedAt = n.deletedAt ? new Date(String(n.deletedAt)) : null;
    if (deletedAt && Number.isNaN(deletedAt.getTime())) {
      throw new Error(`Некорректная дата удаления у узла ${id}`);
    }
    const num = Number(n.inBranchNumber);
    return {
      id,
      name,
      parentId:
        n.parentId === null || n.parentId === undefined
          ? null
          : typeof n.parentId === "string"
            ? n.parentId
            : null,
      inBranchNumber: Number.isFinite(num) ? Math.max(1, Math.floor(num)) : 1,
      fullNumberPath: typeof n.fullNumberPath === "string" ? n.fullNumberPath : "",
      description: typeof n.description === "string" ? n.description : null,
      bannerUrl: typeof n.bannerUrl === "string" ? n.bannerUrl : null,
      deletedAt,
    };
  });

  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const n of nodes) {
    if (n.parentId && !byId.has(n.parentId)) {
      throw new Error(`У узла «${n.name}» родитель не найден в данных`);
    }
  }
  // Циклы
  for (const n of nodes) {
    const seen = new Set<string>();
    let cur: string | null = n.id;
    while (cur) {
      if (seen.has(cur)) throw new Error("В данных обнаружен цикл родительских связей");
      seen.add(cur);
      cur = byId.get(cur)?.parentId ?? null;
    }
  }

  return nodes;
}

/**
 * Полная замена дерева данными снимка:
 * - узлы из снимка upsert'ятся (по id) в одной транзакции;
 * - узлы, отсутствующие в снимке, мягко удаляются;
 * - затем живое дерево перенумеровывается (пустой батч = только нормализация).
 */
export async function replaceTreeFromData(raw: unknown): Promise<TreeItemFlat[]> {
  const nodes = await parseTreeSnapshotData(raw);

  await prisma.$transaction(async (tx) => {
    const incomingIds = new Set(nodes.map((n) => n.id));
    for (const n of nodes) {
      await tx.productTreeItem.upsert({
        where: { id: n.id },
        update: {
          name: n.name,
          parentId: n.parentId,
          inBranchNumber: n.inBranchNumber,
          fullNumberPath: n.fullNumberPath,
          description: n.description,
          bannerUrl: n.bannerUrl,
          deletedAt: n.deletedAt,
        },
        create: {
          id: n.id,
          name: n.name,
          parentId: n.parentId,
          inBranchNumber: n.inBranchNumber,
          fullNumberPath: n.fullNumberPath,
          description: n.description,
          bannerUrl: n.bannerUrl,
          deletedAt: n.deletedAt,
        },
      });
    }
    const existing = await tx.productTreeItem.findMany({ select: { id: true, deletedAt: true } });
    for (const e of existing) {
      if (!incomingIds.has(e.id) && !e.deletedAt) {
        await tx.productTreeItem.update({
          where: { id: e.id },
          data: { deletedAt: new Date() },
        });
      }
    }
  });

  return applyTreeOperations([]);
}

/** Создать снимок текущего дерева (все узлы, включая удалённые) */
export async function createTreeSnapshot(label: string | null, userId: string) {
  const items = await getAllTreeItems(true);
  const data = JSON.stringify(
    items.map(({ ...rest }) => rest),
  );
  return prisma.treeSnapshot.create({
    data: { label: label || null, data, nodeCount: items.length, createdById: userId },
  });
}

export async function getTreeSnapshots() {
  const snaps = await prisma.treeSnapshot.findMany({
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { username: true } } },
  });
  return snaps.map((s) => ({
    id: s.id,
    label: s.label,
    nodeCount: s.nodeCount,
    createdAt: s.createdAt,
    createdBy: s.createdBy?.username ?? null,
  }));
}

export async function getTreeSnapshotData(id: string) {
  return prisma.treeSnapshot.findUnique({ where: { id } });
}

export async function deleteTreeSnapshot(id: string) {
  const existing = await prisma.treeSnapshot.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new Error("Снимок не найден");
  await prisma.treeSnapshot.delete({ where: { id } });
  return { success: true };
}

export async function createTreeItem(data: {
  name: string;
  parentId?: string | null;
  description?: string | null;
  bannerUrl?: string | null;
  position?: number;
}) {
  const id = crypto.randomUUID();
  await applyTreeOperations([{ type: "create", id, ...data }]);
  return prisma.productTreeItem.findUnique({ where: { id } });
}

export async function updateTreeItem(
  id: string,
  data: {
    name?: string;
    description?: string | null;
    bannerUrl?: string | null;
    parentId?: string | null;
    position?: number;
  },
) {
  await applyTreeOperations([{ type: "update", id, ...data }]);
  return prisma.productTreeItem.findUnique({ where: { id } });
}

export async function moveTreeItem(id: string, newParentId: string | null, newPosition: number) {
  return updateTreeItem(id, { parentId: newParentId, position: newPosition });
}

export async function deleteTreeItem(id: string) {
  await applyTreeOperations([{ type: "delete", id }]);
  return { success: true };
}

export async function restoreTreeItem(id: string) {
  await applyTreeOperations([{ type: "restore", id }]);
  return prisma.productTreeItem.findUnique({ where: { id } });
}
