import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/types";
import { logAdminAction } from "@/lib/audit";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const admin = session.user as SessionUser;
  if (!["MODERATOR", "EDITOR", "SUPER", "ROOT"].includes(admin.type)) {
    return NextResponse.json({ error: "Нет прав" }, { status: 403 });
  }

  const body = await request.json();
  const { pageKey, title, content, bannerUrl } = body;

  if (!pageKey) {
    return NextResponse.json({ error: "pageKey обязателен" }, { status: 400 });
  }

  const [page, revision] = await Promise.all([
    prisma.pageContent.upsert({
      where: { pageKey },
      update: { title, content, bannerUrl },
      create: { pageKey, title, content, bannerUrl },
    }),
    // Снимок перед сохранением — история версий для отката
    prisma.contentRevision.create({
      data: {
        pageKey,
        content: JSON.stringify({ title, content, bannerUrl }),
        changedBy: admin.username,
      },
    }),
  ]);

  await logAdminAction({
    adminId: admin.id,
    adminName: admin.username,
    action: "content",
    entityType: "page",
    entityId: pageKey,
    payload: { revisionId: revision.id },
  });

  return NextResponse.json({ success: true, page });
}
