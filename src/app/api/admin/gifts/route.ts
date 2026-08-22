import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ADMIN_TYPES = ["SUPER", "ROOT"];

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
    }
    const userType = session.user.type;
    if (!ADMIN_TYPES.includes(userType)) {
      return NextResponse.json({ error: "Нет прав" }, { status: 403 });
    }

    let body: { name?: unknown; coinPrice?: unknown; limit?: unknown; imageUrl?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Некорректный формат запроса" }, { status: 400 });
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const coinPrice = Number(body.coinPrice);
    const limit = Number(body.limit);
    const imageUrl = typeof body.imageUrl === "string" && body.imageUrl.startsWith("/uploads/") ? body.imageUrl : null;

    if (!name || name.length > 255) {
      return NextResponse.json({ error: "Укажите название подарка" }, { status: 400 });
    }
    if (!Number.isInteger(coinPrice) || coinPrice < 1) {
      return NextResponse.json({ error: "Цена должна быть целым числом от 1" }, { status: 400 });
    }
    if (!Number.isInteger(limit) || limit < 0) {
      return NextResponse.json({ error: "Лимит должен быть целым числом от 0" }, { status: 400 });
    }

    const gift = await prisma.gift.create({
      data: { name, coinPrice, limit, imageUrl },
    });
    return NextResponse.json({ success: true, id: gift.id });
  } catch {
    return NextResponse.json({ error: "Не удалось создать подарок" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
    }
    const userType = session.user.type;
    if (!ADMIN_TYPES.includes(userType)) {
      return NextResponse.json({ error: "Нет прав" }, { status: 403 });
    }

    let body: { id?: unknown; name?: unknown; coinPrice?: unknown; limit?: unknown; imageUrl?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Некорректный формат запроса" }, { status: 400 });
    }

    const id = typeof body.id === "string" ? body.id : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const coinPrice = Number(body.coinPrice);
    const limit = Number(body.limit);
    const imageUrl = typeof body.imageUrl === "string" && body.imageUrl.startsWith("/uploads/") ? body.imageUrl : null;

    if (!id) {
      return NextResponse.json({ error: "id обязателен" }, { status: 400 });
    }
    if (!name || name.length > 255) {
      return NextResponse.json({ error: "Укажите название подарка" }, { status: 400 });
    }
    if (!Number.isInteger(coinPrice) || coinPrice < 1) {
      return NextResponse.json({ error: "Цена должна быть целым числом от 1" }, { status: 400 });
    }
    if (!Number.isInteger(limit) || limit < 0) {
      return NextResponse.json({ error: "Лимит должен быть целым числом от 0" }, { status: 400 });
    }

    const updated = await prisma.gift.updateMany({
      where: { id, deletedAt: null },
      data: { name, coinPrice, limit, imageUrl },
    });
    if (updated.count === 0) {
      return NextResponse.json({ error: "Подарок не найден" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Не удалось изменить подарок" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
    }
    const userType = session.user.type;
    if (!ADMIN_TYPES.includes(userType)) {
      return NextResponse.json({ error: "Нет прав" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (id) {
      // Мягкое удаление: история выдач (GiftClaim) сохраняется
      const updated = await prisma.gift.updateMany({
        where: { id, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      if (updated.count === 0) {
        return NextResponse.json({ error: "Подарок не найден" }, { status: 404 });
      }
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Не удалось удалить подарок" }, { status: 500 });
  }
}
