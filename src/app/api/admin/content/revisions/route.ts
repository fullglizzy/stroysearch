import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/types";

// История версий контента страницы
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const admin = session.user as SessionUser;
  if (!["MODERATOR", "EDITOR", "SUPER", "ROOT"].includes(admin.type)) {
    return NextResponse.json({ error: "Нет прав" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const pageKey = (searchParams.get("pageKey") || "").trim();
  if (!pageKey) return NextResponse.json({ error: "pageKey обязателен" }, { status: 400 });

  const revisions = await prisma.contentRevision.findMany({
    where: { pageKey },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json({
    revisions: revisions.map((r) => ({
      id: r.id,
      content: r.content,
      changedBy: r.changedBy,
      createdAt: r.createdAt,
    })),
  });
}
