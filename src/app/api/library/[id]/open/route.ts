import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { docHref } from "@/lib/doc-url";

// Открытие документа: инкремент просмотров + редирект на файл.
// Используется публичной библиотекой, чтобы счётчик просмотров был честным.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const doc = await prisma.libraryDocument.findUnique({
    where: { id },
    select: { fileUrl: true, isApproved: true, deletedAt: true },
  });

  if (!doc || doc.deletedAt || !doc.isApproved) {
    return relativeRedirect("/library");
  }

  await prisma.libraryDocument.update({
    where: { id },
    data: { views: { increment: 1 } },
  });

  return relativeRedirect(docHref(doc.fileUrl));
}

// Редирект с относительным Location: за reverse-proxy request.url указывает на
// localhost, и абсолютный Location уводил бы пользователя мимо сайта.
// Браузеры резолвят относительный Location от origin запрошенной страницы.
function relativeRedirect(location: string): NextResponse {
  return new NextResponse(null, {
    status: 307,
    headers: { Location: location },
  });
}
