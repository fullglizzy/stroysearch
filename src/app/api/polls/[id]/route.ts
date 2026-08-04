import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
