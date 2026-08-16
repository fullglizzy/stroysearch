export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/types";
import { AuditLog } from "@/components/tables/AuditLog";

const PAGE_SIZE = 50;

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userType = (session.user as SessionUser).type;
  if (!["SUPER", "ROOT"].includes(userType)) {
    redirect("/admin");
  }

  const sp = await searchParams;
  const get = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const page = Math.max(1, parseInt(get("page") || "1", 10) || 1);
  const action = (get("action") || "").trim();
  const q = (get("q") || "").trim();

  const where = {
    ...(action ? { action } : {}),
    ...(q ? { OR: [{ adminName: { contains: q } }, { entityId: { contains: q } }] } : {}),
  };

  const [logs, total] = await Promise.all([
    prisma.adminActionLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.adminActionLog.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="container-page py-8">
      <h1 className="text-3xl font-bold mb-6">Журнал аудита</h1>
      <AuditLog
        logs={logs.map((l) => ({
          id: l.id,
          adminName: l.adminName,
          action: l.action,
          entityType: l.entityType,
          entityId: l.entityId,
          payload: l.payload,
          createdAt: l.createdAt,
        }))}
        total={total}
        page={page}
        totalPages={totalPages}
        action={action}
        q={q}
      />
    </div>
  );
}
