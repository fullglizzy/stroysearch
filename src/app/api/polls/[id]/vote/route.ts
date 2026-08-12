import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/types";
import { roundWalletBalance } from "@/lib/money";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
    }

    const userId = (session.user as SessionUser).id;
    const { id: pollId } = await params;
    const body = await request.json();
    const { optionIds } = body;

    if (!Array.isArray(optionIds) || optionIds.length === 0) {
      return NextResponse.json({ error: "Выберите вариант ответа" }, { status: 400 });
    }

    const poll = await prisma.poll.findUnique({ where: { id: pollId } });
    if (!poll || !poll.isActive) {
      return NextResponse.json({ error: "Опрос не найден" }, { status: 404 });
    }

    // Варианты должны принадлежать этому опросу
    const validOptions = await prisma.pollOption.findMany({
      where: { id: { in: optionIds }, pollId },
      select: { id: true },
    });
    if (validOptions.length !== optionIds.length) {
      return NextResponse.json(
        { error: "Указаны варианты из другого опроса" },
        { status: 400 },
      );
    }

    // Голоса и награда — в одной транзакции
    await prisma.$transaction(async (tx) => {
      const existing = await tx.pollVote.findFirst({
        where: { pollId, userId },
      });
      if (existing) {
        throw new Error("Вы уже проголосовали");
      }

      for (const optionId of validOptions.map((o) => o.id)) {
        await tx.pollVote.create({
          data: { pollId, optionId, userId },
        });
      }

      const reward = poll.coinReward.toNumber();
      if (reward > 0) {
        const wallet = await tx.wallet.upsert({
          where: { userId },
          update: { balance: { increment: reward } },
          create: { userId, balance: reward },
        });
        await roundWalletBalance(tx, userId);
        await tx.transaction.create({
          data: {
            userId,
            type: "POLL_VOTE",
            amount: reward,
            balanceAfter: wallet.balance.toDecimalPlaces(2),
            description: `Голосование в опросе: ${poll.question.slice(0, 50)}`,
            metadata: JSON.stringify({ pollId }),
          },
        });
      }
    });

    // Актуальные результаты для немедленного обновления UI
    const options = await prisma.pollOption.findMany({
      where: { pollId },
      include: { _count: { select: { votes: true } } },
      orderBy: { sortOrder: "asc" },
    });
    const totalVotes = await prisma.pollVote.count({ where: { pollId } });

    return NextResponse.json({
      success: true,
      totalVotes,
      options: options.map((o) => ({ id: o.id, voteCount: o._count.votes })),
    });
  } catch (e) {
    if (e instanceof Error && e.message === "Вы уже проголосовали") {
      return NextResponse.json({ error: "Вы уже проголосовали" }, { status: 400 });
    }
    return NextResponse.json({ error: "Не удалось проголосовать" }, { status: 500 });
  }
}
