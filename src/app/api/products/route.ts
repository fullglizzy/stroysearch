import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const body = await request.json();
  const { companyId, treeItemId, name, classes, region, unit, characteristics, price } = body;

  if (!companyId || !treeItemId || !name) {
    return NextResponse.json({ error: "Поля companyId, treeItemId, name обязательны" }, { status: 400 });
  }

  const product = await prisma.product.create({
    data: {
      companyId,
      treeItemId,
      name,
      classes: JSON.stringify(classes || []),
      region: region || null,
      unit: unit || null,
      characteristics: JSON.stringify(characteristics || []),
      price: price || null,
      ownerUserId: (session.user as any).id,
    },
  });

  return NextResponse.json({ success: true, id: product.id });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId");

  const where: any = { deletedAt: null };
  if (companyId) where.companyId = companyId;

  const products = await prisma.product.findMany({
    where,
    include: {
      company: { select: { name: true, inn: true } },
      treeItem: { select: { fullNumberPath: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(products);
}
