"use server";

import { prisma } from "@/lib/prisma";
import type { LegalDocKey } from "@/lib/legal-docs";
import { unlink } from "fs/promises";
import path from "path";

export async function getLegalDocument(key: LegalDocKey) {
  return prisma.legalDocument.findUnique({ where: { key } });
}

/** Удаляет PDF-файл из public/uploads (если он там лежит) */
async function removeUploadedFile(fileUrl: string) {
  if (!fileUrl.startsWith("/uploads/")) return;
  const relative = fileUrl.replace(/^\/+/, "");
  try {
    await unlink(path.join(process.cwd(), "public", relative));
  } catch {
    // файла уже нет — не критично
  }
}

export async function upsertLegalDocument(
  key: LegalDocKey,
  fileName: string,
  fileUrl: string,
  fileSize: number,
) {
  const prev = await prisma.legalDocument.findUnique({ where: { key } });
  if (prev && prev.fileUrl !== fileUrl) {
    await removeUploadedFile(prev.fileUrl);
  }
  return prisma.legalDocument.upsert({
    where: { key },
    update: { fileName, fileUrl, fileSize },
    create: { key, fileName, fileUrl, fileSize },
  });
}

export async function deleteLegalDocument(key: LegalDocKey) {
  const doc = await prisma.legalDocument.findUnique({ where: { key } });
  if (!doc) return null;
  await removeUploadedFile(doc.fileUrl);
  return prisma.legalDocument.delete({ where: { key } });
}
