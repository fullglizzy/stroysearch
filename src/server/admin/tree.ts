"use server";

import { prisma } from "@/lib/prisma";

// ── Вспомогательные функции для автоперенумерации ──

/** Вычисляет fullNumberPath для узла по parentId и inBranchNumber */
async function computeFullNumberPath(
  parentId: string | null,
  inBranchNumber: number,
): Promise<string> {
  if (!parentId) return String(inBranchNumber);

  const parent = await prisma.productTreeItem.findUnique({
    where: { id: parentId },
    select: { fullNumberPath: true },
  });
  if (!parent) return String(inBranchNumber);

  return `${parent.fullNumberPath}.${inBranchNumber}`;
}

/** Перенумеровывает всех «живых» детей родителя: 1, 2, 3… и пересчитывает fullNumberPath */
async function renumberSiblings(parentId: string | null) {
  const siblings = await prisma.productTreeItem.findMany({
    where: { parentId, deletedAt: null },
    orderBy: { inBranchNumber: "asc" },
  });

  for (let i = 0; i < siblings.length; i++) {
    const newNum = i + 1;
    const newPath = await computeFullNumberPath(parentId, newNum);
    if (
      siblings[i].inBranchNumber !== newNum ||
      siblings[i].fullNumberPath !== newPath
    ) {
      await prisma.productTreeItem.update({
        where: { id: siblings[i].id },
        data: { inBranchNumber: newNum, fullNumberPath: newPath },
      });
      // Рекурсивно обновляем потомков
      await renumberDescendants(siblings[i].id, newPath);
    }
  }
}

/** Рекурсивно обновляет fullNumberPath у всех потомков узла */
async function renumberDescendants(
  nodeId: string,
  parentPath: string,
) {
  const children = await prisma.productTreeItem.findMany({
    where: { parentId: nodeId, deletedAt: null },
    orderBy: { inBranchNumber: "asc" },
  });

  for (let i = 0; i < children.length; i++) {
    const num = i + 1;
    const newPath = `${parentPath}.${num}`;
    if (
      children[i].inBranchNumber !== num ||
      children[i].fullNumberPath !== newPath
    ) {
      await prisma.productTreeItem.update({
        where: { id: children[i].id },
        data: { inBranchNumber: num, fullNumberPath: newPath },
      });
      await renumberDescendants(children[i].id, newPath);
    }
  }
}

// ── Публичные серверные экшены ──

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
  deletedAt: Date | null;
}

/** Получить все узлы дерева (включая удалённые — для админа) */
export async function getAllTreeItems(includeDeleted = false): Promise<TreeItemFlat[]> {
  const where = includeDeleted ? {} : { deletedAt: null };
  const items = await prisma.productTreeItem.findMany({
    where,
    orderBy: { fullNumberPath: "asc" },
    include: {
      _count: { select: { products: true, documents: true } },
    },
  });

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
    deletedAt: item.deletedAt,
  }));
}

/** Создать новый узел */
export async function createTreeItem(data: {
  name: string;
  parentId?: string | null;
  description?: string | null;
  bannerUrl?: string | null;
  position?: number; // позиция среди siblings (0 = в конец)
}) {
  const parentId = data.parentId || null;

  // Определяем номер
  let inBranchNumber: number;
  if (data.position !== undefined && data.position > 0) {
    // Вставляем на конкретную позицию — сдвигаем остальные
    const siblings = await prisma.productTreeItem.findMany({
      where: { parentId, deletedAt: null },
      orderBy: { inBranchNumber: "asc" },
    });

    inBranchNumber = Math.min(data.position, siblings.length + 1);

    // Сдвигаем siblings на +1 начиная с этой позиции
    for (const sib of siblings) {
      if (sib.inBranchNumber >= inBranchNumber) {
        await prisma.productTreeItem.update({
          where: { id: sib.id },
          data: { inBranchNumber: sib.inBranchNumber + 1 },
        });
      }
    }
  } else {
    // В конец
    const maxSibling = await prisma.productTreeItem.findFirst({
      where: { parentId, deletedAt: null },
      orderBy: { inBranchNumber: "desc" },
    });
    inBranchNumber = (maxSibling?.inBranchNumber ?? 0) + 1;
  }

  const fullNumberPath = await computeFullNumberPath(parentId, inBranchNumber);

  const item = await prisma.productTreeItem.create({
    data: {
      name: data.name,
      parentId,
      inBranchNumber,
      fullNumberPath,
      description: data.description || null,
      bannerUrl: data.bannerUrl || null,
    },
  });

  // Перенумеровываем siblings для корректности
  await renumberSiblings(parentId);

  return item;
}

/** Обновить узел */
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
  const node = await prisma.productTreeItem.findUnique({ where: { id } });
  if (!node) throw new Error("Узел не найден");

  const newParentId =
    data.parentId !== undefined ? (data.parentId || null) : node.parentId;
  const parentChanged = newParentId !== node.parentId;

  // Базовое обновление полей
  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.bannerUrl !== undefined) updateData.bannerUrl = data.bannerUrl;

  if (parentChanged || data.position !== undefined) {
    // Удаляем из старого родителя (временно ставим parentId = null)
    if (parentChanged) {
      updateData.parentId = newParentId;
    }

    // Определяем позицию
    let newNum: number;
    if (data.position !== undefined && data.position > 0) {
      newNum = data.position;
    } else {
      const siblings = await prisma.productTreeItem.findMany({
        where: { parentId: newParentId, deletedAt: null, id: { not: id } },
        orderBy: { inBranchNumber: "asc" },
      });
      newNum = siblings.length + 1;
    }

    updateData.inBranchNumber = newNum;
    updateData.fullNumberPath = await computeFullNumberPath(
      newParentId,
      newNum,
    );
  }

  await prisma.productTreeItem.update({
    where: { id },
    data: updateData,
  });

  // Перенумеровываем старых и новых siblings
  if (parentChanged) {
    await renumberSiblings(node.parentId); // старый родитель
  }
  await renumberSiblings(newParentId); // новый родитель

  // Рекурсивно обновляем потомков если поменялся путь
  if (parentChanged || data.position !== undefined) {
    const updated = await prisma.productTreeItem.findUnique({ where: { id } });
    if (updated) {
      await renumberDescendants(updated.id, updated.fullNumberPath);
    }
  }

  return prisma.productTreeItem.findUnique({ where: { id } });
}

/** Мягкое удаление узла */
export async function deleteTreeItem(id: string) {
  const node = await prisma.productTreeItem.findUnique({ where: { id } });
  if (!node) throw new Error("Узел не найден");

  // Мягко удаляем узел и всех потомков
  async function softDeleteRecursive(nodeId: string) {
    await prisma.productTreeItem.update({
      where: { id: nodeId },
      data: { deletedAt: new Date() },
    });
    const children = await prisma.productTreeItem.findMany({
      where: { parentId: nodeId, deletedAt: null },
    });
    for (const child of children) {
      await softDeleteRecursive(child.id);
    }
  }

  await softDeleteRecursive(id);

  // Перенумеровываем siblings родителя
  if (node.parentId) {
    await renumberSiblings(node.parentId);
  }

  return { success: true };
}

/** Восстановить удалённый узел */
export async function restoreTreeItem(id: string) {
  const node = await prisma.productTreeItem.findUnique({ where: { id } });
  if (!node) throw new Error("Узел не найден");

  await prisma.productTreeItem.update({
    where: { id },
    data: { deletedAt: null },
  });

  // Восстанавливаем потомков
  async function restoreRecursive(nodeId: string) {
    const children = await prisma.productTreeItem.findMany({
      where: { parentId: nodeId, deletedAt: { not: null } },
    });
    for (const child of children) {
      await prisma.productTreeItem.update({
        where: { id: child.id },
        data: { deletedAt: null },
      });
      await restoreRecursive(child.id);
    }
  }

  await restoreRecursive(id);

  // Перенумеровываем
  if (node.parentId) {
    await renumberSiblings(node.parentId);
  } else {
    await renumberSiblings(null);
  }

  return prisma.productTreeItem.findUnique({ where: { id } });
}

/** Переместить узел (изменить порядок или родителя) */
export async function moveTreeItem(
  id: string,
  newParentId: string | null,
  newPosition: number,
) {
  return updateTreeItem(id, { parentId: newParentId, position: newPosition });
}
