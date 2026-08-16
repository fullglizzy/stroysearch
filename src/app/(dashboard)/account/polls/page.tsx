export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PollsPageClient } from "@/components/tables/PollsPageClient";

const PAGE_SIZE = 10;

export default async function AccountPollsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const sp = await searchParams;
  const get = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const page = Math.max(1, parseInt(get("page") || "1", 10) || 1);
  const q = (get("q") || "").trim();
  const pollType =
    get("type") === "DICHOTOMOUS" || get("type") === "MULTIPLE" ? get("type")! : "";
  const classifier = (get("classifier") || "").split(",").filter(Boolean);
  const sort = get("sort") === "votes" || get("sort") === "reward" ? get("sort")! : "created";
  const votedFilter =
    get("voted") === "yes" || get("voted") === "no" ? get("voted")! : "";

  const where: Prisma.PollWhereInput = { isActive: true };
  if (q) where.question = { contains: q };
  if (pollType) where.pollType = pollType;
  if (classifier.length > 0) where.treeItemId = { in: classifier };

  // Фильтр по голосованию текущего пользователя
  if (votedFilter) {
    const userId = (session.user as { id: string }).id;
    const votedIds = (
      await prisma.pollVote.findMany({ where: { userId }, select: { pollId: true } })
    ).map((v) => v.pollId);
    if (votedFilter === "yes") {
      where.id = { in: votedIds.length > 0 ? votedIds : ["__none__"] };
    } else if (votedIds.length > 0) {
      where.id = { notIn: votedIds };
    }
  }

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
        treeItem: { select: { fullNumberPath: true, name: true } },
        options: {
          include: { _count: { select: { votes: true } } },
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.poll.count({ where }),
    prisma.productTreeItem.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, fullNumberPath: true },
      orderBy: { fullNumberPath: "asc" },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const pollRows = polls.map((p) => ({
    id: p.id,
    question: p.question,
    pollType: p.pollType as "DICHOTOMOUS" | "MULTIPLE",
    coinReward: p.coinReward.toNumber(),
    isActive: p.isActive,
    treeItemPath: p.treeItem?.fullNumberPath ?? null,
    treeItemName: p.treeItem?.name ?? null,
    totalVotes: p.options.reduce((s, o) => s + o._count.votes, 0),
    options: p.options.map((o) => ({
      id: o.id,
      text: o.text,
      voteCount: o._count.votes,
    })),
  }));

  return (
    <div className="container-page py-2">
      <PollsPageClient
        polls={pollRows}
        total={total}
        page={page}
        totalPages={totalPages}
        treeItems={treeItems}
        moderatorText={null}
        pageTitle={null}
        bannerUrl={null}
        initialQuery={{ q, type: pollType, classifier: classifier.join(","), sort, voted: votedFilter }}
      />
    </div>
  );
}
