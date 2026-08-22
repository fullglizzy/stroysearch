import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import { createRegion, renameRegion, deleteRegion, moveRegion } from "@/server/admin/regions";

// Справочник регионов — глобальный, управляют только SUPER/ROOT
async function checkAccess() {
  const session = await auth();
  if (!session?.user) {
    return { error: "Требуется авторизация", status: 401 } as const;
  }
  const userType = session.user.type;
  if (!["SUPER", "ROOT"].includes(userType)) {
    return { error: "Нет прав", status: 403 } as const;
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const denied = await checkAccess();
    if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status });

    let body: { name?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Некорректный формат запроса" }, { status: 400 });
    }

    if (typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json({ error: "Название региона обязательно" }, { status: 400 });
    }

    const region = await createRegion(body.name);
    return NextResponse.json({ success: true, region }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "Регион с таким названием уже существует" }, { status: 409 });
    }
    return NextResponse.json({ error: "Не удалось добавить регион" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const denied = await checkAccess();
    if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status });

    let body: { id?: unknown; name?: unknown; direction?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Некорректный формат запроса" }, { status: 400 });
    }

    if (typeof body.id !== "string") {
      return NextResponse.json({ error: "id региона обязателен" }, { status: 400 });
    }

    if (body.direction === "up" || body.direction === "down") {
      await moveRegion(body.id, body.direction);
      return NextResponse.json({ success: true });
    }

    if (typeof body.name === "string" && body.name.trim()) {
      const region = await renameRegion(body.id, body.name);
      return NextResponse.json({ success: true, region });
    }

    return NextResponse.json({ error: "Укажите новое название или направление перемещения" }, { status: 400 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "Регион с таким названием уже существует" }, { status: 409 });
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return NextResponse.json({ error: "Регион не найден" }, { status: 404 });
    }
    return NextResponse.json({ error: "Не удалось обновить регион" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const denied = await checkAccess();
    if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status });

    let body: { id?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Некорректный формат запроса" }, { status: 400 });
    }

    if (typeof body.id !== "string") {
      return NextResponse.json({ error: "id региона обязателен" }, { status: 400 });
    }

    await deleteRegion(body.id);
    return NextResponse.json({ success: true });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return NextResponse.json({ error: "Регион не найден" }, { status: 404 });
    }
    return NextResponse.json({ error: "Не удалось удалить регион" }, { status: 500 });
  }
}
