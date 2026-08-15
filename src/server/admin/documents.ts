"use server";

import { prisma } from "@/lib/prisma";
import type { LegalDocKey } from "@/lib/legal-docs";
import { unlink } from "fs/promises";
import path from "path";

export async function getLegalDocument(key: LegalDocKey) {
  return prisma.legalDocument.findUnique({ where: { key } });
}

/** Удаляет PDF-файл из public/uploads (если он там лежит) */
export async function removeUploadedFile(fileUrl: string) {
  if (!fileUrl.startsWith("/uploads/")) return;
  const relative = fileUrl.replace(/^\/+/, "");
  try {
    await unlink(path.join(process.cwd(), "public", relative));
  } catch {
    // файла уже нет — не критично
  }
}

/**
 * Сохраняет документ. Если передан fileUrl — текст должен быть уже извлечён
 * из PDF вызывающей стороной (route handler) и передан в text; если только
 * text — обновляется текст, файл и его реквизиты остаются прежними.
 */
export async function upsertLegalDocument(
  key: LegalDocKey,
  input: {
    fileName?: string;
    fileUrl?: string;
    fileSize?: number;
    text?: string;
  },
) {
  const prev = await prisma.legalDocument.findUnique({ where: { key } });

  const data: { fileName?: string; fileUrl?: string; fileSize?: number; text?: string } = {};
  if (input.text !== undefined) data.text = input.text;

  if (input.fileUrl && input.fileName) {
    if (prev && prev.fileUrl && prev.fileUrl !== input.fileUrl) {
      await removeUploadedFile(prev.fileUrl);
    }
    data.fileName = input.fileName;
    data.fileUrl = input.fileUrl;
    data.fileSize = input.fileSize ?? 0;
  }

  return prisma.legalDocument.upsert({
    where: { key },
    update: data,
    create: {
      key,
      fileName: input.fileName ?? "",
      fileUrl: input.fileUrl ?? "",
      fileSize: input.fileSize ?? 0,
      text: input.text ?? "",
    },
  });
}

export async function deleteLegalDocument(key: LegalDocKey) {
  const doc = await prisma.legalDocument.findUnique({ where: { key } });
  if (!doc) return null;
  await removeUploadedFile(doc.fileUrl);
  return prisma.legalDocument.delete({ where: { key } });
}
