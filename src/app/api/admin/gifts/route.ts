import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Нет прав" }, { status: 403 });

  const body = await request.json();
  const gift = await prisma.gift.create({ data: body });
  return NextResponse.json({ success: true, id: gift.id });
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Нет прав" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (id) await prisma.gift.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
