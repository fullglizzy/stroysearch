import { prisma } from "@/lib/prisma";
import { MatrixPageClient } from "@/components/tables/MatrixPageClient";

export const dynamic = "force-dynamic";

export default async function MatrixPage() {
  const treeItems = await prisma.productTreeItem.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, fullNumberPath: true },
    orderBy: { fullNumberPath: "asc" },
  });

  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    include: {
      company: {
        include: {
          metrics: true,
          reviews: { select: { weightedAverage: true } },
        },
      },
      treeItem: { select: { fullNumberPath: true, name: true } },
    },
    orderBy: [{ treeItem: { fullNumberPath: "asc" } }, { price: "asc" }],
  });

  const rows = products.map((p) => {
    const ratings = p.company.reviews.map((r) => r.weightedAverage);
    const avgRating = ratings.length > 0
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 20)
      : null;

    return {
      id: p.id,
      companyName: p.company.name,
      companyInn: p.company.inn,
      companyId: p.company.id,
      name: p.name,
      classes: parseJsonArray(p.classes),
      region: p.region,
      imageUrl: p.imageUrl,
      unit: p.unit,
      characteristics: parseJsonArray(p.characteristics),
      price: p.price,
      views: p.views,
      treeItemPath: p.treeItem.fullNumberPath,
      treeItemName: p.treeItem.name,
      companyRating: avgRating,
      companyPhone: p.company.phone,
      companyEmail: p.company.email,
    };
  });

  return <MatrixPageClient products={rows} treeItems={treeItems} />;
}

function parseJsonArray(val: string): string[] {
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
