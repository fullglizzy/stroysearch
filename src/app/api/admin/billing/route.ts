import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ADMIN_TYPES = ["SUPER", "ROOT"];

// Разрешённые к изменению поля конфигурации экономики
const NUMERIC_FIELDS = [
  "coinPriceRub",
  "addCompanyCoins",
  "reviewCoins",
  "maxMonthlyLimit",
  "vatRate",
] as const;

const STRING_FIELDS = [
  "bankName",
  "bankInn",
  "bankBik",
  "bankAccount",
  "bankCorrAccount",
  "organizationName",
  "organizationAddress",
  "organizationInn",
  "organizationKpp",
  "organizationAccount",
  "directorName",
  "directorPhone",
  "directorEmail",
  "signatureImage",
  "stampImage",
  "invoiceBasis",
] as const;

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const userType = (session.user as any).type as string;
    if (!ADMIN_TYPES.includes(userType)) {
      return NextResponse.json({ error: "Нет прав" }, { status: 403 });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Некорректный формат запроса" }, { status: 400 });
    }

    // Только известные поля, иначе в БД попадёт мусор
    const data: Record<string, unknown> = {};

    for (const field of NUMERIC_FIELDS) {
      if (field in body) {
        const value = Number(body[field]);
        if (!Number.isFinite(value) || value < 0) {
          return NextResponse.json(
            { error: `Некорректное значение поля ${field}` },
            { status: 400 },
          );
        }
        data[field] = value;
      }
    }

    for (const field of STRING_FIELDS) {
      if (field in body) {
        if (typeof body[field] !== "string") {
          return NextResponse.json(
            { error: `Некорректное значение поля ${field}` },
            { status: 400 },
          );
        }
        const value = (body[field] as string).trim();
        if (value.length > 500) {
          return NextResponse.json(
            { error: `Поле ${field} слишком длинное` },
            { status: 400 },
          );
        }
        data[field] = value || null;
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Нет полей для сохранения" }, { status: 400 });
    }

    await prisma.billingConfig.upsert({
      where: { id: "default" },
      update: data,
      create: { id: "default", ...data },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Не удалось сохранить настройки" }, { status: 500 });
  }
}
