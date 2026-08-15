export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAllTreeItems } from "@/server/admin/tree";
import { getRegions } from "@/server/admin/regions";
import { TreeConstructor } from "@/components/forms/TreeConstructor";
import { TreeBackups } from "@/components/forms/TreeBackups";
import { ProductsManager } from "@/components/forms/ProductsManager";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { SessionUser } from "@/types";

export default async function AdminProductsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userType = (session.user as SessionUser).type;
  if (!["MODERATOR", "EDITOR", "SUPER", "ROOT"].includes(userType)) {
    redirect("/account");
  }

  // Резервные копии дерева — только для SUPER/ROOT (восстановление разрушительно)
  const isBackupsAllowed = ["SUPER", "ROOT"].includes(userType);

  const [treeItemsRaw, regions, products, companies, treeConstructorItems] = await Promise.all([
    prisma.productTreeItem.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        fullNumberPath: true,
        unitOptions: true,
        characteristics: true,
      },
      orderBy: { fullNumberPath: "asc" },
    }),
    getRegions(),
    prisma.product.findMany({
      where: { deletedAt: null },
      include: {
        treeItem: { select: { id: true, fullNumberPath: true, name: true } },
        company: { select: { name: true, inn: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.company.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    getAllTreeItems(true),
  ]);

  const treeItems = treeItemsRaw.map((t) => ({
    id: t.id,
    name: t.name,
    fullNumberPath: t.fullNumberPath,
    units: parseJson(t.unitOptions),
    characteristics: parseCharacteristics(t.characteristics),
  }));

  const rows = products.map((p) => ({
    id: p.id,
    name: p.name,
    treeItemId: p.treeItem.id,
    treeItemPath: p.treeItem.fullNumberPath,
    treeItemName: p.treeItem.name,
    classes: parseJson(p.classes),
    regions: p.regions ? p.regions.split(",").map((r) => r.trim()).filter(Boolean) : [],
    unit: p.unit,
    characteristics: parseJson(p.characteristics),
    price: p.price,
    imageUrl: p.imageUrl,
    views: p.views,
    companyName: p.company.name,
    companyInn: p.company.inn,
  }));

  return (
    <div className="container-page py-8">
      <h1 className="text-3xl font-bold mb-2">Управление товарами</h1>
      <p className="text-muted-foreground mb-6">
        Каталог товаров платформы и конструктор дерева решений.
        Нумерация классификатора пересчитывается автоматически при любых изменениях.
      </p>

      <Tabs defaultValue="products">
        <TabsList>
          <TabsTrigger value="products">Товары</TabsTrigger>
          <TabsTrigger value="tree">Дерево решений</TabsTrigger>
          {isBackupsAllowed && <TabsTrigger value="backups">Резервные копии</TabsTrigger>}
        </TabsList>
        <TabsContent value="products" className="pt-4">
          <ProductsManager
            products={rows}
            treeItems={treeItems}
            regions={regions.map((r) => r.name)}
            companies={companies}
          />
        </TabsContent>
        <TabsContent value="tree" className="pt-4">
          <TreeConstructor items={treeConstructorItems} />
        </TabsContent>
        {isBackupsAllowed && (
          <TabsContent value="backups" className="pt-4">
            <TreeBackups items={treeConstructorItems} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function parseJson(val: string): string[] {
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseCharacteristics(val: string): { name: string; value: string; unit: string }[] {
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed)
      ? parsed.filter(
          (c) => c && typeof c.name === "string" && typeof c.value === "string" && typeof c.unit === "string",
        )
      : [];
  } catch {
    return [];
  }
}
