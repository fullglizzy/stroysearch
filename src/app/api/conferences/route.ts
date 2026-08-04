import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { conferenceSchema } from "@/lib/validators";

export async function GET() {
  const conferences = await prisma.conference.findMany({
    where: { status: "APPROVED" },
    orderBy: { date: "asc" },
  });
  return NextResponse.json(conferences);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = conferenceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const conf = await prisma.conference.create({
    data: {
      ...parsed.data,
      date: new Date(parsed.data.date),
      treeItemId: parsed.data.treeItemId || null,
      organizerId: (session.user as any).id,
    },
  });

  return NextResponse.json({ success: true, id: conf.id });
}
