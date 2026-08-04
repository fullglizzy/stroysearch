export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ProfileForm } from "@/components/forms/ProfileForm";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userId = (session.user as any).id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      profile: {
        include: { roles: true },
      },
    },
  });

  if (!user) redirect("/login");

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
          region: user.profile?.region || "",
          isContactsHidden: user.profile?.isContactsHidden ?? true,
          classifierIds: user.profile?.classifierIds
            ? user.profile.classifierIds.split(",").filter(Boolean)
            : [],
          roles: user.profile?.roles.map((r) => r.role) || [],
        }}
        username={user.username}
      />
    </div>
  );
}
