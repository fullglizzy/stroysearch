import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const userId = (session.user as any).id;
  const { id: confId } = await params;

  const conf = await prisma.conference.findUnique({ where: { id: confId } });
  if (!conf) {
    return NextResponse.json({ error: "Конференция не найдена" }, { status: 404 });
  }

  // Организатор не покупает билет на свою конференцию
  if (conf.organizerId === userId) {
    return NextResponse.json({ success: true, alreadyJoined: true });
  }

  // Check existing
  const existing = await prisma.conferenceParticipant.findUnique({
    where: { conferenceId_userId: { conferenceId: confId, userId } },
  });
  if (existing) {
    return NextResponse.json({ success: true, alreadyJoined: true });
  }

  // If paid, check balance
  if (conf.coinPrice > 0) {
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet || wallet.balance < conf.coinPrice) {
      return NextResponse.json({ error: "Недостаточно монет" }, { status: 400 });
    }

    await prisma.$transaction([
      prisma.wallet.update({ where: { userId }, data: { balance: { decrement: conf.coinPrice } } }),
      prisma.conferenceParticipant.create({ data: { conferenceId: confId, userId } }),
      prisma.transaction.create({
        data: {
          userId,
          type: "CONFERENCE_ENTRY",
          amount: -conf.coinPrice,
          balanceAfter: wallet.balance - conf.coinPrice,
          description: `Вход на конференцию: ${conf.title}`,
          metadata: JSON.stringify({ conferenceId: confId }),
        },
      }),
    ]);

    // Credit organizer
    if (conf.organizerId !== userId) {
      const orgWallet = await prisma.wallet.upsert({
        where: { userId: conf.organizerId },
        update: { balance: { increment: conf.coinPrice } },
        create: { userId: conf.organizerId, balance: conf.coinPrice },
      });
      await prisma.transaction.create({
        data: {
          userId: conf.organizerId,
          type: "CONFERENCE_ORGANIZER",
          amount: conf.coinPrice,
          balanceAfter: orgWallet.balance,
          description: `Доход от конференции: ${conf.title}`,
          metadata: JSON.stringify({ conferenceId: confId }),
        },
      });
    }
  } else {
    await prisma.conferenceParticipant.create({ data: { conferenceId: confId, userId } });
  }

  return NextResponse.json({ success: true });
}
