export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ProfileForm } from "@/components/forms/ProfileForm";
import { getRegions } from "@/server/admin/regions";
import { ALL_REGIONS } from "@/lib/regions";
import type { SessionUser } from "@/types";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userId = (session.user as SessionUser).id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      profile: {
        include: { roles: true },
      },
    },
  });

  if (!user) redirect("/login");

  const [regions, treeItems] = await Promise.all([
    getRegions(),
    prisma.productTreeItem.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, fullNumberPath: true },
      orderBy: { fullNumberPath: "asc" },
    }),
  ]);

  const treeItemIds = new Set(treeItems.map((t) => t.id));

  return (
    <div className="container-page py-8 max-w-2xl">
      <h1 className="text-3xl font-bold mb-6">Личные данные</h1>
      <ProfileForm
        initialData={{
          firstName: user.profile?.firstName || "",
          lastName: user.profile?.lastName || "",
          middleName: user.profile?.middleName || "",
          phone: user.phone || "",
          email: user.email,
          regions: user.profile?.regions
            ? user.profile.regions
                .split(",")
                .map((r) => r.trim())
                .filter(Boolean)
            : [],
          isContactsHidden: user.profile?.isContactsHidden ?? true,
          classifierIds: user.profile?.classifierIds
            ? user.profile.classifierIds
                .split(",")
                .map((id) => id.trim())
                .filter((id) => treeItemIds.has(id))
            : [],
          roles: user.profile?.roles.map((r) => r.role) || [],
        }}
        username={user.username}
        nick={user.profile?.nick || null}
          regionOptions={[{ value: ALL_REGIONS, label: ALL_REGIONS }, ...regions.map((r) => ({ value: r.name, label: r.name }))]}
        classifierOptions={treeItems.map((t) => ({
          value: t.id,
          label: `${t.fullNumberPath} — ${t.name}`,
        }))}
      />
    </div>
  );
}
