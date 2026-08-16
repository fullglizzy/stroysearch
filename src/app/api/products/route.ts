import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isLiveTreeItem } from "@/server/admin/tree";

const ADMIN_TYPES = ["MODERATOR", "EDITOR", "SUPER", "ROOT"];

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const userType = (session.user as { type?: string }).type ?? "";

  const body = await request.json();
  const { companyId, treeItemId, name, classes, regions, unit, characteristics, price, imageUrl, description, status } = body;

  if (!companyId || !treeItemId || !name) {
    return NextResponse.json({ error: "Поля companyId, treeItemId, name обязательны" }, { status: 400 });
  }

  const productStatus = status === "DRAFT" ? "DRAFT" : "PUBLISHED";
  const productDescription =
    typeof description === "string" && description.trim()
      ? description.trim().slice(0, 2000)
      : null;

  // Товар можно создать только в живом разделе классификатора
  if (!(await isLiveTreeItem(treeItemId))) {
    return NextResponse.json(
      { error: "Раздел классификатора не найден или удалён" },
      { status: 400 },
    );
  }

  // Создавать товары может владелец компании или админ
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { ownerUserId: true },
  });
  if (!company) {
    return NextResponse.json({ error: "Компания не найдена" }, { status: 404 });
  }
  if (!ADMIN_TYPES.includes(userType) && company.ownerUserId !== userId) {
    return NextResponse.json({ error: "Недостаточно прав для добавления товара этой компании" }, { status: 403 });
  }

  const product = await prisma.product.create({
    data: {
      companyId,
      treeItemId,
      name,
      description: productDescription,
      status: productStatus,
      classes: JSON.stringify(classes || []),
      regions: (regions ?? []).join(","),
      unit: unit || null,
      characteristics: JSON.stringify(characteristics || []),
      price: price || null,
      imageUrl: imageUrl || null,
      ownerUserId: userId,
    },
  });

  return NextResponse.json({ success: true, id: product.id, status: product.status });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId");

  const where: { deletedAt: null; companyId?: string } = { deletedAt: null };
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
