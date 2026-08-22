export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { UsersManager } from "@/components/tables/UsersManager";
import { getRegions } from "@/server/admin/regions";
import { ALL_REGIONS } from "@/lib/regions";

const PAGE_SIZE = 20;

const STATUSES = ["ACTIVE", "INACTIVE", "BANNED", "DELETED"] as const;
const TYPES = ["COMMON", "COMPANY", "MODERATOR", "EDITOR", "SUPER", "ROOT"] as const;
const ROLES = ["PRODUCTOLOGIST", "TENDER_SPECIALIST", "DESIGNER", "COMPANY_OWNER", "OTHER"] as const;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userType = session.user.type;
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
  const status = (STATUSES as readonly string[]).includes(get("status") || "")
    ? get("status")!
    : "";
  const type = (TYPES as readonly string[]).includes(get("type") || "") ? get("type")! : "";
  const role = (ROLES as readonly string[]).includes(get("role") || "") ? get("role")! : "";
  const region = get("region") || "";
  const sort = get("sort") === "name" ? "name" : "created";

  const where: Prisma.UserWhereInput = {};
  if (q) {
    where.OR = [
      { username: { contains: q } },
      { email: { contains: q } },
      { phone: { contains: q } },
      { profile: { nick: { contains: q } } },
      { profile: { firstName: { contains: q } } },
      { profile: { lastName: { contains: q } } },
    ];
  }
  if (status) where.status = status;
  if (type) where.type = type;

  const profileFilter: Prisma.UserProfileWhereInput = {};
  // «Все регионы» в фильтре = без ограничения по региону
  if (region && region !== ALL_REGIONS) {
    // Подходит выбранный регион, либо «Все регионы» (покрывает любой регион)
    profileFilter.OR = [
      { regions: { contains: region } },
      { regions: { contains: ALL_REGIONS } },
    ];
  }
  if (role) profileFilter.roles = { some: { role } };
  if (Object.keys(profileFilter).length > 0) where.profile = profileFilter;

  const orderBy: Prisma.UserOrderByWithRelationInput[] =
    sort === "name"
      ? [{ profile: { lastName: "asc" } }, { profile: { firstName: "asc" } }]
      : [{ createdAt: "desc" }];

  const [users, total, regions] = await Promise.all([
    prisma.user.findMany({
      where,
      include: {
        profile: {
          include: { roles: true },
        },
        wallet: true,
        serviceFields: { select: { banReason: true } },
      },
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.user.count({ where }),
    getRegions(),
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
    regions: u.profile?.regions ?? null,
    balance: u.wallet ? u.wallet.balance.toNumber() : 0,
    roles: u.profile?.roles.map((r) => r.role) ?? [],
    banReason: u.serviceFields?.banReason ?? null,
    createdAt: u.createdAt,
  }));

  return (
    <div className="container-page py-8">
      <h1 className="text-3xl font-bold mb-6">Управление пользователями</h1>
      <UsersManager
        users={rows}
        total={total}
        page={page}
        totalPages={totalPages}
        initialQuery={q}
        initialStatus={status}
        initialType={type}
        initialRole={role}
        initialRegion={region}
        initialSort={sort}
        regionOptions={[{ value: ALL_REGIONS, label: ALL_REGIONS }, ...regions.map((r) => ({ value: r.name, label: r.name }))]}
      />
    </div>
  );
}
