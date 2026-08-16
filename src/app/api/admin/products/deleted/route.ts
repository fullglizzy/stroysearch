import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/types";

const ADMIN_TYPES = ["MODERATOR", "EDITOR", "SUPER", "ROOT"];

// Список мягко удалённых товаров (для вкладки «Удалённые»)
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const admin = session.user as SessionUser;
  if (!ADMIN_TYPES.includes(admin.type)) {
    return NextResponse.json({ error: "Нет прав" }, { status: 403 });
  }

  const products = await prisma.product.findMany({
    where: { deletedAt: { not: null } },
    include: {
      company: { select: { name: true } },
      treeItem: { select: { fullNumberPath: true } },
    },
    orderBy: { deletedAt: "desc" },
    take: 100,
  });

  return NextResponse.json({
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      companyName: p.company.name,
      categoryPath: p.treeItem?.fullNumberPath || "—",
      deletedAt: p.deletedAt,
    })),
  });
}
