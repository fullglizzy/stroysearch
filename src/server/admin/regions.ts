"use server";

import { prisma } from "@/lib/prisma";

/** Единый список регионов (упорядоченный), используется на всём сайте */
export async function getRegions() {
  return prisma.region.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function createRegion(name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Название региона не может быть пустым");

  const last = await prisma.region.findFirst({
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  return prisma.region.create({
    data: { name: trimmed, sortOrder: (last?.sortOrder ?? -1) + 1 },
  });
}

export async function renameRegion(id: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Название региона не может быть пустым");

  return prisma.region.update({
    where: { id },
    data: { name: trimmed },
  });
}

export async function deleteRegion(id: string) {
  return prisma.region.delete({ where: { id } });
}

/** Переместить регион вверх/вниз в списке (меняем sortOrder с соседом) */
export async function moveRegion(id: string, direction: "up" | "down") {
  const regions = await prisma.region.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, sortOrder: true },
  });

  const idx = regions.findIndex((r) => r.id === id);
  if (idx === -1) return null;

  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= regions.length) return null;

  const a = regions[idx];
  const b = regions[swapIdx];

  await prisma.$transaction([
    prisma.region.update({ where: { id: a.id }, data: { sortOrder: b.sortOrder } }),
    prisma.region.update({ where: { id: b.id }, data: { sortOrder: a.sortOrder } }),
  ]);

  return true;
}
