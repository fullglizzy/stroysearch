import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { getPageContent } from "@/server/admin/content";
import { MatrixPageClient } from "@/components/tables/MatrixPageClient";
import { computeRating } from "@/lib/rating";

export const dynamic = "force-dynamic";

export default async function MatrixPage() {
  const pageContent = await getPageContent("matrix");

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
    const avgRating = computeRating(p.company.reviews);

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

  return (
    <Suspense fallback={<div className="container-page py-8">Загрузка...</div>}>
      <MatrixPageClient
        products={rows}
        treeItems={treeItems}
        moderatorText={pageContent?.content || null}
        bannerUrl={pageContent?.bannerUrl || null}
      />
    </Suspense>
  );
}

function parseJsonArray(val: string): string[] {
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
