import { prisma } from "@/lib/prisma";
import { ProductTree } from "@/components/tree/ProductTree";
import { getPageContent } from "@/server/admin/content";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const pageContent = await getPageContent("products");

  const treeItems = await prisma.productTreeItem.findMany({
    where: { parentId: null, deletedAt: null },
    orderBy: { inBranchNumber: "asc" },
    include: {
      children: {
        where: { deletedAt: null },
        orderBy: { inBranchNumber: "asc" },
        include: {
          _count: { select: { products: true } },
        },
      },
      _count: { select: { products: true } },
    },
  });

  return (
    <div className="container-page py-8">
      <h1 className="text-3xl font-bold mb-2">Продуктовые решения</h1>
      {pageContent?.content && (
        <div
          className="prose prose-gray max-w-none text-muted-foreground mb-8"
          dangerouslySetInnerHTML={{ __html: pageContent.content }}
        />
      )}

      <ProductTree items={treeItems} />
    </div>
  );
}
