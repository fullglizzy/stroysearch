import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const OPERATIONS = ["add", "subtract", "set"] as const;
type Operation = (typeof OPERATIONS)[number];

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const userType = (session.user as any).type as string;
    if (!["SUPER", "ROOT"].includes(userType)) {
      return NextResponse.json({ error: "Нет прав" }, { status: 403 });
    }

    let body: { userId?: unknown; amount?: unknown; operation?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Некорректный формат запроса" }, { status: 400 });
    }

    const userId = body.userId as string;
    const amount = Number(body.amount);
    const operation = (body.operation ?? "add") as Operation;

    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "userId обязателен" }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount < 0) {
      return NextResponse.json({ error: "Сумма должна быть неотрицательным числом" }, { status: 400 });
    }
    if (!OPERATIONS.includes(operation)) {
      return NextResponse.json({ error: "Неизвестная операция" }, { status: 400 });
    }

    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    const current = wallet?.balance ?? 0;

    let newBalance: number;
    let delta: number;

    if (operation === "add") {
      delta = amount;
      newBalance = current + amount;
    } else if (operation === "subtract") {
      if (amount > current) {
        return NextResponse.json(
          { error: `Нельзя списать больше текущего баланса (${current})` },
          { status: 400 },
        );
      }
      delta = -amount;
      newBalance = current - amount;
    } else {
      // set — устанавливаем точное значение
      delta = amount - current;
      newBalance = amount;
    }

    const updated = await prisma.wallet.upsert({
      where: { userId },
      update: { balance: newBalance },
      create: { userId, balance: newBalance },
    });

    const description =
      operation === "add"
        ? "Ручное зачисление модератором"
        : operation === "subtract"
          ? "Ручное списание модератором"
          : "Установка баланса модератором";

    await prisma.transaction.create({
      data: {
        userId,
        type: operation === "add" ? "MODERATOR_ADD" : "ADMIN_ADJUSTMENT",
        amount: delta,
        balanceAfter: newBalance,
        description,
      },
    });

    return NextResponse.json({ success: true, balance: newBalance });
  } catch {
    return NextResponse.json({ error: "Не удалось изменить баланс" }, { status: 500 });
  }
}
