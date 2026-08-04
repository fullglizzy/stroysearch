export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAllTreeItems } from "@/server/admin/tree";
import { TreeConstructor } from "@/components/forms/TreeConstructor";

export default async function AdminProductsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userType = (session.user as any).type as string;
  if (!["MODERATOR", "EDITOR", "SUPER", "ROOT"].includes(userType)) {
    redirect("/account");
  }

  const items = await getAllTreeItems(true);

  return (
    <div className="container-page py-8">
      <h1 className="text-3xl font-bold mb-2">Конструктор дерева решений</h1>
      <p className="text-muted-foreground mb-6">
        Создание, редактирование и управление иерархией классификатора.
        Нумерация пересчитывается автоматически при любых изменениях (ТЗ §5.4).
      </p>
      <TreeConstructor items={items} />
    </div>
  );
}
