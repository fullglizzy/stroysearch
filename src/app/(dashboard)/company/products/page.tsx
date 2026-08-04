import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CompanyProductsManager } from "@/components/forms/CompanyProductsManager";

export const dynamic = "force-dynamic";

export default async function CompanyProductsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userType = (session.user as any).type as string;
  if (userType !== "COMPANY" && !["MODERATOR", "EDITOR", "SUPER", "ROOT"].includes(userType)) {
    redirect("/account");
  }

  const userId = (session.user as any).id;

  const company = await prisma.company.findFirst({
    where: { ownerUserId: userId },
  });

  const treeItems = await prisma.productTreeItem.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, fullNumberPath: true },
    orderBy: { fullNumberPath: "asc" },
  });

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
    views: p.views,
  }));

  return (
    <div className="container-page py-8">
      <h1 className="text-3xl font-bold mb-6">Мои товары и услуги</h1>
      <CompanyProductsManager
        products={rows}
        treeItems={treeItems}
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
