import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { productSearchText } from "@/lib/company";
import { isLiveTreeItem } from "@/server/admin/tree";

const ADMIN_TYPES = ["MODERATOR", "EDITOR", "SUPER", "ROOT"];

/**
 * Разрешение: владелец товара/компании или админ.
 */
async function canModifyProduct(userId: string, userType: string, productId: string) {
  if (ADMIN_TYPES.includes(userType)) return true;

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      ownerUserId: true,
      company: { select: { ownerUserId: true } },
    },
  });

  if (!product) return null;
  return product.ownerUserId === userId || product.company?.ownerUserId === userId;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const userType = (session.user as { type?: string }).type ?? "";

  const { id } = await params;
  const body = await request.json();

  const allowed = await canModifyProduct(userId, userType, id);
  if (allowed === null) {
    return NextResponse.json({ error: "Товар не найден" }, { status: 404 });
  }
  if (!allowed) {
    return NextResponse.json({ error: "Недостаточно прав для редактирования товара" }, { status: 403 });
  }

  if (body.treeItemId && !(await isLiveTreeItem(body.treeItemId))) {
    return NextResponse.json(
      { error: "Раздел классификатора не найден или удалён" },
      { status: 400 },
    );
  }

  const data: Record<string, unknown> = {
    name: body.name,
    // undefined в data = «не менять» (Prisma), searchText пересчитывается вместе с name
    searchText: body.name !== undefined ? productSearchText(body.name) : undefined,
    treeItemId: body.treeItemId,
    classes: JSON.stringify(body.classes || []),
    regions: (body.regions ?? []).join(","),
    unit: body.unit || null,
    characteristics: JSON.stringify(body.characteristics || []),
    price: body.price || null,
    imageUrl: body.imageUrl || null,
  };

  if (body.status === "DRAFT" || body.status === "PUBLISHED") {
    data.status = body.status;
  }
  if (body.description !== undefined) {
    data.description =
      typeof body.description === "string" && body.description.trim()
        ? body.description.trim().slice(0, 2000)
        : null;
  }

  await prisma.product.update({
    where: { id },
    data,
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

  const userId = (session.user as { id: string }).id;
  const userType = (session.user as { type?: string }).type ?? "";

  const { id } = await params;

  const allowed = await canModifyProduct(userId, userType, id);
  if (allowed === null) {
    return NextResponse.json({ error: "Товар не найден" }, { status: 404 });
  }
  if (!allowed) {
    return NextResponse.json({ error: "Недостаточно прав для удаления товара" }, { status: 403 });
  }

  await prisma.product.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
