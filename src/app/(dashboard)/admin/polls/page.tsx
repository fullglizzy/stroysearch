import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PollsManager } from "@/components/forms/PollsManager";
import type { SessionUser } from "@/types";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function AdminPollsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userType = (session.user as SessionUser).type;
  if (!["EDITOR", "SUPER", "ROOT"].includes(userType)) {
    redirect(userType === "COMPANY" ? "/company" : "/account");
  }

  const sp = await searchParams;
  const get = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const page = Math.max(1, parseInt(get("page") || "1", 10) || 1);
  const q = (get("q") || "").trim();
  const pollType =
    get("type") === "DICHOTOMOUS" || get("type") === "MULTIPLE" ? get("type")! : "";
  const active =
    get("active") === "1" || get("active") === "0" ? get("active")! : "";
  const sort = get("sort") === "votes" || get("sort") === "reward" ? get("sort")! : "created";

  const where: Prisma.PollWhereInput = {};
  if (q) where.question = { contains: q };
  if (pollType) where.pollType = pollType;
  if (active) where.isActive = active === "1";

  const orderBy: Prisma.PollOrderByWithRelationInput =
    sort === "votes"
      ? { votes: { _count: "desc" } }
      : sort === "reward"
        ? { coinReward: "desc" }
        : { createdAt: "desc" };

  const [polls, total, treeItems] = await Promise.all([
    prisma.poll.findMany({
      where,
      include: {
        options: {
          include: { _count: { select: { votes: true } } },
          orderBy: { sortOrder: "asc" },
        },
        _count: { select: { votes: true } },
        treeItem: { select: { id: true, fullNumberPath: true, name: true } },
        votes: {
          include: { user: { select: { username: true, profile: { select: { nick: true } } } } },
        },
      },
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.poll.count({ where }),
    prisma.productTreeItem.findMany({
      where: { deletedAt: null },
      select: { id: true, fullNumberPath: true, name: true },
      orderBy: { fullNumberPath: "asc" },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Decimal нельзя передавать в клиентские компоненты — маппим в plain-объекты
  const pollRows = polls.map((p) => ({
    id: p.id,
    question: p.question,
    pollType: p.pollType,
    coinReward: p.coinReward.toNumber(),
    isActive: p.isActive,
    treeItem: p.treeItem,
    _count: { votes: p._count.votes },
    options: p.options.map((o) => ({
      id: o.id,
      text: o.text,
      _count: { votes: o._count.votes },
    })),
    votes: p.votes.map((v) => ({
      user: { username: v.user.username, profile: { nick: v.user.profile?.nick ?? null } },
    })),
  }));

  return (
    <div className="container-page py-8">
      <h1 className="text-3xl font-bold mb-6">Управление опросами</h1>
      <PollsManager
        polls={pollRows}
        treeItems={treeItems}
        total={total}
        page={page}
        totalPages={totalPages}
        initialQuery={{ q, type: pollType, active, sort }}
      />
    </div>
  );
}
