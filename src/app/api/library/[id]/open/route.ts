import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Открытие документа: инкремент просмотров + редирект на файл.
// Используется публичной библиотекой, чтобы счётчик просмотров был честным.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const doc = await prisma.libraryDocument.findUnique({
    where: { id },
    select: { fileUrl: true, isApproved: true, deletedAt: true },
  });

  if (!doc || doc.deletedAt || !doc.isApproved) {
    return NextResponse.redirect(new URL("/library", request.url));
  }

  await prisma.libraryDocument.update({
    where: { id },
    data: { views: { increment: 1 } },
  });

  return NextResponse.redirect(new URL(doc.fileUrl, request.url));
}
