import { prisma } from "@/lib/prisma";
import { comparePath } from "@/lib/utils";
import { ProductTree } from "@/components/tree/ProductTree";
import { getPageContent } from "@/server/admin/content";
import { ProductsPageClient } from "@/components/cards/ProductsPageClient";

export const dynamic = "force-dynamic";

interface FlatItem {
  id: string;
  name: string;
  parentId: string | null;
  inBranchNumber: number;
  fullNumberPath: string;
  description: string | null;
  productCount: number;
  docCount: number;
}

async function getTreeItems(): Promise<FlatItem[]> {
  const items = await prisma.productTreeItem.findMany({
    where: { deletedAt: null },
    include: {
      _count: { select: { products: true, documents: true } },
    },
  });

  // Естественная (numeric) сортировка
  items.sort((a, b) => comparePath(a.fullNumberPath, b.fullNumberPath));

  return items.map((item) => ({
    id: item.id,
    name: item.name,
    parentId: item.parentId,
    inBranchNumber: item.inBranchNumber,
    fullNumberPath: item.fullNumberPath,
    description: item.description,
    productCount: item._count.products,
    docCount: item._count.documents,
  }));
}

export default async function ProductsPage() {
  const pageContent = await getPageContent("products");
  const items = await getTreeItems();

  return (
    <div className="container-page py-8">
      <h1 className="text-3xl font-bold mb-2">Продуктовые решения</h1>

      {/* Баннер №2 (ТЗ §5.1) */}
      {pageContent?.bannerUrl && (
        <div className="mb-6 rounded-lg overflow-hidden">
          <img
            src={pageContent.bannerUrl}
            alt="Баннер продуктовых решений"
            className="w-full h-auto max-h-48 object-cover"
          />
        </div>
      )}

      {pageContent?.content && (
        <div
          className="prose prose-gray max-w-none text-muted-foreground mb-6"
          dangerouslySetInnerHTML={{ __html: pageContent.content }}
        />
      )}
      <ProductsPageClient items={items} />
    </div>
  );
}
