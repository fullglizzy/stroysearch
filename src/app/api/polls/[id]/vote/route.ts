import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const userId = (session.user as SessionUser).id;
  const { id: pollId } = await params;
  const body = await request.json();
  const { optionIds } = body;

  if (!optionIds || optionIds.length === 0) {
    return NextResponse.json({ error: "Выберите вариант ответа" }, { status: 400 });
  }

  const poll = await prisma.poll.findUnique({ where: { id: pollId } });
  if (!poll || !poll.isActive) {
    return NextResponse.json({ error: "Опрос не найден" }, { status: 404 });
  }

  // Check if already voted
  const existing = await prisma.pollVote.findFirst({
    where: { pollId, userId },
  });
  if (existing) {
    return NextResponse.json({ error: "Вы уже проголосовали" }, { status: 400 });
  }

  // Create votes
  for (const optionId of optionIds) {
    await prisma.pollVote.create({
      data: { pollId, optionId, userId },
    });
  }

  // Award coins
  if (poll.coinReward > 0) {
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (wallet) {
      await prisma.wallet.update({
        where: { userId },
        data: { balance: { increment: poll.coinReward } },
      });
      await prisma.transaction.create({
        data: {
          userId,
          type: "POLL_VOTE",
          amount: poll.coinReward,
          balanceAfter: wallet.balance + poll.coinReward,
          description: `Голосование в опросе: ${poll.question.slice(0, 50)}`,
          metadata: JSON.stringify({ pollId }),
        },
      });
    }
  }

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
}
