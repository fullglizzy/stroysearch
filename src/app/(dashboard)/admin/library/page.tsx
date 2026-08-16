import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { LibraryModeration } from "@/components/tables/LibraryModeration";
import type { SessionUser } from "@/types";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function AdminLibraryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userType = (session.user as SessionUser).type;
  if (!["MODERATOR", "EDITOR", "SUPER", "ROOT"].includes(userType)) {
    redirect(userType === "COMPANY" ? "/company" : "/account");
  }

  const sp = await searchParams;
  const get = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const page = Math.max(1, parseInt(get("page") || "1", 10) || 1);
  const q = (get("q") || "").trim();
  const status = get("status");
  const where = {
    deletedAt: null,
    ...(q ? { title: { contains: q } } : {}),
    ...(status === "approved" ? { isApproved: true } : status === "pending" ? { isApproved: false } : {}),
  };

  const [documents, total] = await Promise.all([
    prisma.libraryDocument.findMany({
      where,
      include: {
        user: { select: { username: true, profile: { select: { nick: true } } } },
        treeItem: { select: { fullNumberPath: true, name: true } },
      },
      orderBy: [{ isApproved: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.libraryDocument.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="container-page py-8">
      <h1 className="text-3xl font-bold mb-6">Модерация библиотеки</h1>
      <LibraryModeration
        documents={documents as any}
        total={total}
        page={page}
        totalPages={totalPages}
        q={q}
        statusFilter={status || ""}
      />
    </div>
  );
}
