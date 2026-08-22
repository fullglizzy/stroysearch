export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CategorySettingsManager } from "@/components/forms/CategorySettingsManager";

function parseJsonArray(val: string): string[] {
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

export default async function AdminCategoriesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userType = session.user.type;
  if (!["SUPER", "ROOT"].includes(userType)) {
    redirect("/account");
  }

  const items = await prisma.productTreeItem.findMany({
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

  return (
    <div className="container-page py-8">
      <h1 className="text-3xl font-bold mb-2">Настройки категорий классификатора</h1>
      <p className="text-muted-foreground mb-6">
        Единицы измерения и шаблон характеристик для каждой категории — отображаются
        в форме добавления товара
      </p>
      <CategorySettingsManager
        items={items.map((i) => ({
          id: i.id,
          name: i.name,
          fullNumberPath: i.fullNumberPath,
          units: parseJsonArray(i.unitOptions),
          characteristics: parseCharacteristics(i.characteristics),
        }))}
      />
    </div>
  );
}
