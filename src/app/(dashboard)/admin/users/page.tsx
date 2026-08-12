export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { UsersManager } from "@/components/tables/UsersManager";

const PAGE_SIZE = 20;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userType = (session.user as any).type as string;
  if (!["SUPER", "ROOT"].includes(userType)) {
    redirect("/admin");
  }

  const sp = await searchParams;
  const get = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const q = (get("q") || "").trim();
  const page = Math.max(1, parseInt(get("page") || "1", 10) || 1);

  const where = q
    ? {
        OR: [
          { username: { contains: q } },
          { email: { contains: q } },
          { profile: { nick: { contains: q } } },
        ],
      }
    : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: {
        profile: {
          include: { roles: true },
        },
        wallet: true,
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.user.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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
    balance: u.wallet ? u.wallet.balance.toNumber() : 0,
    roles: u.profile?.roles.map((r) => r.role) ?? [],
    createdAt: u.createdAt,
  }));

  return (
    <div className="container-page py-8">
      <h1 className="text-3xl font-bold mb-6">Управление пользователями</h1>
      <UsersManager users={rows} total={total} page={page} totalPages={totalPages} initialQuery={q} />
    </div>
  );
}
