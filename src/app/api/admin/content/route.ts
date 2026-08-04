import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const userType = (session.user as any).type as string;
  if (!["MODERATOR", "EDITOR", "SUPER", "ROOT"].includes(userType)) {
    return NextResponse.json({ error: "Нет прав" }, { status: 403 });
  }

  const body = await request.json();
  const { pageKey, content, bannerUrl } = body;

  if (!pageKey) {
    return NextResponse.json({ error: "pageKey обязателен" }, { status: 400 });
  }

  const page = await prisma.pageContent.upsert({
    where: { pageKey },
    update: { content, bannerUrl },
    create: { pageKey, content, bannerUrl },
  });

  return NextResponse.json({ success: true, page });
}
