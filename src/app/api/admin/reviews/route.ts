import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/types";

const MODERATOR_TYPES = ["MODERATOR", "EDITOR", "SUPER", "ROOT"];

// Список отзывов для модерации (с фильтром по статусу и поиском)
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  if (!MODERATOR_TYPES.includes((session.user as SessionUser).type)) {
    return NextResponse.json({ error: "Нет прав" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") === "HIDDEN" ? "HIDDEN" : "ACTIVE";
  const q = (searchParams.get("q") || "").trim();

  const reviews = await prisma.review.findMany({
    where: {
      status,
      ...(q ? { OR: [{ comment: { contains: q } }] } : {}),
    },
    include: {
      author: { select: { username: true, profile: { select: { nick: true } } } },
      target: { select: { username: true, profile: { select: { nick: true } } } },
      company: { select: { name: true } },
      reports: { select: { id: true, reason: true, createdAt: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json({
    reviews: reviews.map((r) => ({
      id: r.id,
      comment: r.comment,
      weightedAverage: r.weightedAverage,
      createdAt: r.createdAt,
      authorNick: r.author.profile?.nick || r.author.username,
      targetNick: r.target.profile?.nick || r.target.username,
      companyName: r.company?.name || null,
      status: r.status,
      reports: r.reports.map((rep) => ({ id: rep.id, reason: rep.reason, createdAt: rep.createdAt })),
    })),
  });
}
