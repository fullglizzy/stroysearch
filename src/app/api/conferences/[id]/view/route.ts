import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Инкремент просмотров конференции (при записи на участие)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  await prisma.conference.updateMany({
    where: { id },
    data: { views: { increment: 1 } },
  });

  return NextResponse.json({ success: true });
}
