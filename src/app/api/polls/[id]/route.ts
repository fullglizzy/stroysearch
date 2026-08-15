import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pollSchema } from "@/lib/validators";

const ADMIN_TYPES = ["MODERATOR", "EDITOR", "SUPER", "ROOT"];

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Нет прав" }, { status: 403 });

  const { id } = await params;
  await prisma.poll.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

/**
 * Редактирование опроса: вопрос, тип, награда, категория, варианты ответа.
 * Варианты без id создаются, с id — обновляются, отсутствующие — удаляются
 * (их голоса теряются).
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }
  if (!ADMIN_TYPES.includes((session.user as { type?: string }).type ?? "")) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const { id } = await params;
  const poll = await prisma.poll.findUnique({ where: { id }, select: { id: true } });
  if (!poll) {
    return NextResponse.json({ error: "Опрос не найден" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный формат запроса" }, { status: 400 });
  }

  // Быстрое переключение активности (архивировать/активировать)
  if ((body as { action?: unknown } | null)?.action === "toggle") {
    const current = await prisma.poll.findUnique({ where: { id }, select: { isActive: true } });
    await prisma.poll.update({
      where: { id },
      data: { isActive: !current?.isActive },
    });
    return NextResponse.json({ success: true });
  }

  const parsed = pollSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { question, treeItemId, pollType, coinReward, options } = parsed.data;
  const optionList = options.map((o, i) => ({ ...o, sortOrder: i }));

  const existingOptions = await prisma.pollOption.findMany({
    where: { pollId: id },
    select: { id: true },
  });
  const keptIds = new Set(
    optionList
      .filter((o): o is typeof o & { id: string } => !!o.id)
      .map((o) => o.id),
  );
  const removedCount = existingOptions.filter((o) => !keptIds.has(o.id)).length;

  await prisma.$transaction(async (tx) => {
    await tx.poll.update({
      where: { id },
      data: {
        question,
        treeItemId: treeItemId || null,
        pollType,
        coinReward,
      },
    });

    if (removedCount > 0) {
      await tx.pollOption.deleteMany({
        where: { pollId: id, id: { notIn: [...keptIds] } },
      });
    }

    for (const o of optionList) {
      if (o.id) {
        await tx.pollOption.update({
          where: { id: o.id },
          data: { text: o.text, sortOrder: o.sortOrder },
        });
      } else {
        await tx.pollOption.create({
          data: { pollId: id, text: o.text, sortOrder: o.sortOrder },
        });
      }
    }
  });

  return NextResponse.json({ success: true, removedOptions: removedCount });
}
