import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/types";

const MODERATOR_TYPES = ["MODERATOR", "EDITOR", "SUPER", "ROOT"];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const userType = (session.user as SessionUser).type;
  if (!MODERATOR_TYPES.includes(userType)) {
    return NextResponse.json({ error: "Нет прав" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { status, moderatorNote } = body;

  await prisma.conference.update({
    where: { id },
    data: { status, moderatorNote },
  });

  return NextResponse.json({ success: true });
}
