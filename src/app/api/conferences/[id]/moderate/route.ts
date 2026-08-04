import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Нет прав" }, { status: 403 });

  const { id } = await params;
  const body = await request.json();
  const { status, moderatorNote } = body;

  await prisma.conference.update({
    where: { id },
    data: { status, moderatorNote },
  });

  return NextResponse.json({ success: true });
}
