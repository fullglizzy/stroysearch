import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { roundWalletBalance } from "@/lib/money";
import { notifyUser, cabinetHome } from "@/lib/notifications";

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
    const adminId = (session.user as any).id as string;
    const adminUsername = (session.user as any).username as string | undefined;

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

    const { newBalance, delta } = await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { userId } });
      const current = wallet ? wallet.balance.toNumber() : 0;

      if (operation === "add") {
        await tx.wallet.upsert({
          where: { userId },
          update: { balance: { increment: amount } },
          create: { userId, balance: amount },
        });
        await roundWalletBalance(tx, userId);
        return { newBalance: Math.round((current + amount) * 100) / 100, delta: amount };
      }

      if (operation === "subtract") {
        if (amount > current) {
          throw new Error(`Нельзя списать больше текущего баланса (${current})`);
        }
        const res = await tx.wallet.updateMany({
          where: { userId, balance: { gte: amount } },
          data: { balance: { decrement: amount } },
        });
        if (res.count === 0) {
          throw new Error(`Нельзя списать больше текущего баланса (${current})`);
        }
        await roundWalletBalance(tx, userId);
        return { newBalance: Math.round((current - amount) * 100) / 100, delta: -amount };
      }

      // set — устанавливаем точное значение через дельту
      const delta = amount - current;
      if (delta > 0) {
        await tx.wallet.upsert({
          where: { userId },
          update: { balance: { increment: delta } },
          create: { userId, balance: amount },
        });
      } else if (delta < 0) {
        const res = await tx.wallet.updateMany({
          where: { userId, balance: { gte: -delta } },
          data: { balance: { decrement: -delta } },
        });
        if (res.count === 0) {
          throw new Error(`Нельзя установить баланс ниже текущего (${current})`);
        }
      }

      await roundWalletBalance(tx, userId);
      return { newBalance: Math.round(amount * 100) / 100, delta };
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
        metadata: JSON.stringify({ adminId, adminUsername: adminUsername ?? null }),
      },
    });

    // Уведомляем пользователя об изменении баланса
    const target = await prisma.user.findUnique({ where: { id: userId }, select: { type: true } });
    await notifyUser({
      userId,
      type: "COINS",
      title: operation === "add" ? "Начислены монеты" : "Изменение баланса",
      message:
        operation === "add"
          ? `Модератор зачислил ${amount} монет. Текущий баланс: ${newBalance}.`
          : `Модератор изменил баланс: теперь ${newBalance} монет.`,
      link: `${cabinetHome(target?.type)}/finances`,
    });

    return NextResponse.json({ success: true, balance: newBalance });
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("Нельзя")) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Не удалось изменить баланс" }, { status: 500 });
  }
}
