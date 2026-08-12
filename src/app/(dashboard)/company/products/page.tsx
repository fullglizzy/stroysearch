import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ProductsManager } from "@/components/forms/ProductsManager";
import { getRegions } from "@/server/admin/regions";
import type { SessionUser } from "@/types";

export const dynamic = "force-dynamic";

export default async function CompanyProductsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userType = (session.user as SessionUser).type;
  if (userType !== "COMPANY" && !["MODERATOR", "EDITOR", "SUPER", "ROOT"].includes(userType)) {
    redirect("/account");
  }

  const userId = (session.user as SessionUser).id;

  const company = await prisma.company.findFirst({
    where: { ownerUserId: userId },
  });

  const regions = await getRegions();

  const treeItemsRaw = await prisma.productTreeItem.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      name: true,
      fullNumberPath: true,
      unitOptions: true,
      characteristics: true,
    },
    orderBy: { fullNumberPath: "asc" },
  });
  const treeItems = treeItemsRaw.map((t) => ({
    id: t.id,
    name: t.name,
    fullNumberPath: t.fullNumberPath,
    units: parseJson(t.unitOptions),
    characteristics: parseCharacteristics(t.characteristics),
  }));

  const products = company
    ? await prisma.product.findMany({
        where: { companyId: company.id, deletedAt: null },
        include: {
          treeItem: { select: { fullNumberPath: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const rows = products.map((p) => ({
    id: p.id,
    name: p.name,
    treeItemPath: p.treeItem.fullNumberPath,
    treeItemName: p.treeItem.name,
    classes: parseJson(p.classes),
    region: p.region,
    unit: p.unit,
    characteristics: parseJson(p.characteristics),
    price: p.price,
    imageUrl: p.imageUrl,
    views: p.views,
  }));

  return (
    <div className="container-page py-8">
      <h1 className="text-3xl font-bold mb-6">Мои товары и услуги</h1>
      <ProductsManager
        products={rows}
        treeItems={treeItems}
        regions={regions.map((r) => r.name)}
        companyId={company?.id || ""}
      />
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
