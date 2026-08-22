export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getRegions } from "@/server/admin/regions";
import { RegionsManager } from "@/components/forms/RegionsManager";

export default async function AdminRegionsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userType = session.user.type;
  if (!["SUPER", "ROOT"].includes(userType)) {
    redirect("/account");
  }

  const regions = await getRegions();

  return (
    <div className="container-page py-8">
      <h1 className="text-3xl font-bold mb-2">Справочник регионов</h1>
      <p className="text-muted-foreground mb-6">
        Единый список регионов — используется во всех формах и фильтрах сайта
      </p>
      <RegionsManager regions={regions} />
    </div>
  );
}
