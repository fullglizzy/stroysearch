import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  const product = await prisma.product.update({
    where: { id },
    data: {
      name: body.name,
      treeItemId: body.treeItemId,
      classes: JSON.stringify(body.classes || []),
      region: body.region || null,
      unit: body.unit || null,
      characteristics: JSON.stringify(body.characteristics || []),
      price: body.price || null,
    },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { id } = await params;

  await prisma.product.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
