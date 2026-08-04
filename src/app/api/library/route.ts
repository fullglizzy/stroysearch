import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { libraryDocumentSchema } from "@/lib/validators";

export async function GET() {
  const docs = await prisma.libraryDocument.findMany({
    where: { isApproved: true, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(docs);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = libraryDocumentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const doc = await prisma.libraryDocument.create({
    data: {
      ...parsed.data,
      userId: (session.user as any).id,
      treeItemId: parsed.data.treeItemId || null,
    },
  });

  return NextResponse.json({ success: true, id: doc.id });
}
