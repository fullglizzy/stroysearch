import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Инкремент просмотров товара (вызывается с публичной страницы матрицы)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const updated = await prisma.product.updateMany({
    where: { id, deletedAt: null },
    data: { views: { increment: 1 } },
  });

  if (updated.count === 0) {
    return NextResponse.json({ error: "Товар не найден" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
