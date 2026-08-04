export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { UsersManager } from "@/components/tables/UsersManager";

export default async function AdminUsersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userType = (session.user as any).type as string;
  if (!["SUPER", "ROOT"].includes(userType)) {
    redirect("/admin");
  }

  const users = await prisma.user.findMany({
    include: {
      profile: {
        include: { roles: true },
      },
      wallet: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const rows = users.map((u) => ({
    id: u.id,
    username: u.username,
    email: u.email,
    phone: u.phone,
    status: u.status,
    type: u.type,
    firstName: u.profile?.firstName ?? null,
    lastName: u.profile?.lastName ?? null,
    nick: u.profile?.nick ?? null,
    inn: u.profile?.inn ?? null,
    region: u.profile?.region ?? null,
    balance: u.wallet?.balance ?? 0,
    roles: u.profile?.roles.map((r) => r.role) ?? [],
    createdAt: u.createdAt,
  }));

  return (
    <div className="container-page py-8">
      <h1 className="text-3xl font-bold mb-6">Управление пользователями</h1>
      <UsersManager users={rows} />
    </div>
  );
}
