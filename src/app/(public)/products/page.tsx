import { prisma } from "@/lib/prisma";
import { comparePath } from "@/lib/utils";
import { ProductTree } from "@/components/tree/ProductTree";
import { getPageContent } from "@/server/admin/content";
import { ProductsPageClient } from "@/components/cards/ProductsPageClient";
import { PageBanner } from "@/components/shared/PageBanner";
import { AlertCircle } from "lucide-react";

export const revalidate = 60; // страница кэшируется на 60 сек

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
      <h1 className="text-3xl font-bold">Продуктовые решения</h1>
      <p className="text-muted-foreground mt-1 mb-6">
        Иерархический классификатор строительных материалов и услуг
      </p>

      {/* Info banner */}
      {(pageContent?.title || pageContent?.content) && (
        <div className="bg-menthol/5 border border-menthol/20 rounded-lg p-3 mb-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-menthol flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            {pageContent?.title && <p className="font-medium text-menthol">{pageContent.title}</p>}
            {pageContent?.content && (
              <div className="text-muted-foreground" dangerouslySetInnerHTML={{ __html: pageContent.content }} />
            )}
          </div>
        </div>
      )}

      {/* Баннер */}
      {pageContent?.bannerUrl && (
        <PageBanner url={pageContent.bannerUrl} alt="Баннер продуктовых решений" />
      )}
      <ProductsPageClient items={items} />
    </div>
  );
}
