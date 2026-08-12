import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Characteristic {
  name: string;
  value: string;
  unit: string;
}

function parseCharacteristics(raw: unknown): Characteristic[] | null {
  if (!Array.isArray(raw) || raw.length > 30) return null;
  const result: Characteristic[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) return null;
    const name = typeof (item as any).name === "string" ? (item as any).name.trim() : "";
    const value = typeof (item as any).value === "string" ? (item as any).value.trim() : "";
    const unit = typeof (item as any).unit === "string" ? (item as any).unit.trim() : "";
    if (!name || name.length > 100 || value.length > 100 || unit.length > 50) return null;
    result.push({ name, value, unit });
  }
  return result;
}

function parseUnits(raw: unknown): string[] | null {
  if (!Array.isArray(raw) || raw.length > 20) return null;
  const result: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") return null;
    const v = item.trim();
    if (!v || v.length > 50) return null;
    result.push(v);
  }
  return result;
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
    }
    const userType = (session.user as any).type as string;
    if (!["SUPER", "ROOT"].includes(userType)) {
      return NextResponse.json({ error: "Нет прав" }, { status: 403 });
    }

    let body: { treeItemId?: unknown; units?: unknown; characteristics?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Некорректный формат запроса" }, { status: 400 });
    }

    if (typeof body.treeItemId !== "string" || !body.treeItemId) {
      return NextResponse.json({ error: "Категория не выбрана" }, { status: 400 });
    }

    const units = parseUnits(body.units);
    const characteristics = parseCharacteristics(body.characteristics);
    if (units === null) {
      return NextResponse.json({ error: "Некорректный список единиц измерения" }, { status: 400 });
    }
    if (characteristics === null) {
      return NextResponse.json({ error: "Некорректный список характеристик" }, { status: 400 });
    }

    const item = await prisma.productTreeItem.findUnique({ where: { id: body.treeItemId } });
    if (!item) {
      return NextResponse.json({ error: "Категория не найдена" }, { status: 404 });
    }

    await prisma.productTreeItem.update({
      where: { id: body.treeItemId },
      data: {
        unitOptions: JSON.stringify(units),
        characteristics: JSON.stringify(characteristics),
      },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Не удалось сохранить настройки" }, { status: 500 });
  }
}
