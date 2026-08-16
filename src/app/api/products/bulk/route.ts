import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ADMIN_TYPES = ["MODERATOR", "EDITOR", "SUPER", "ROOT"];

const ACTIONS = ["publish", "draft", "delete"] as const;

// Массовые операции над товарами: публикация, перевод в черновик, удаление.
// Доступ — владелец товаров или админ.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const userType = (session.user as { type?: string }).type ?? "";
  const isAdmin = ADMIN_TYPES.includes(userType);

  let body: { action?: unknown; ids?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный формат запроса" }, { status: 400 });
  }

  const action = body.action as (typeof ACTIONS)[number] | undefined;
  const ids = Array.isArray(body.ids)
    ? body.ids.filter((id): id is string => typeof id === "string")
    : [];

  if (!action || !ACTIONS.includes(action)) {
    return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
  }
  if (ids.length === 0 || ids.length > 500) {
    return NextResponse.json({ error: "Выберите от 1 до 500 товаров" }, { status: 400 });
  }

  const products = await prisma.product.findMany({
    where: { id: { in: ids }, deletedAt: action === "delete" ? null : undefined },
    select: { id: true, ownerUserId: true, company: { select: { ownerUserId: true } } },
  });

  const allowedIds = products
    .filter((p) => isAdmin || p.ownerUserId === userId || p.company?.ownerUserId === userId)
    .map((p) => p.id);

  if (allowedIds.length === 0) {
    return NextResponse.json({ error: "Нет прав ни на один из выбранных товаров" }, { status: 403 });
  }

  const data =
    action === "publish"
      ? { status: "PUBLISHED" }
      : action === "draft"
        ? { status: "DRAFT" }
        : { deletedAt: new Date() };

  await prisma.product.updateMany({ where: { id: { in: allowedIds } }, data });

  return NextResponse.json({ success: true, updated: allowedIds.length });
}
