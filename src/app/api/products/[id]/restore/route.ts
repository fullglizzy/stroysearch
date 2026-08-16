import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/types";

const ADMIN_TYPES = ["MODERATOR", "EDITOR", "SUPER", "ROOT"];

// Восстановление мягко удалённого товара (только админ)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const admin = session.user as SessionUser;
  if (!ADMIN_TYPES.includes(admin.type)) {
    return NextResponse.json({ error: "Нет прав" }, { status: 403 });
  }

  const { id } = await params;

  const updated = await prisma.product.updateMany({
    where: { id, deletedAt: { not: null } },
    data: { deletedAt: null },
  });

  if (updated.count === 0) {
    return NextResponse.json({ error: "Удалённый товар не найден" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
