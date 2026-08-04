import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Нет прав" }, { status: 403 });

  const body = await request.json();
  await prisma.billingConfig.upsert({
    where: { id: "default" },
    update: body,
    create: { id: "default", ...body },
  });

  return NextResponse.json({ success: true });
}
