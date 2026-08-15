import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { getPageContent } from "@/server/admin/content";
import { PollsPageClient } from "@/components/tables/PollsPageClient";

// Страница кэшируется; персональные данные (в каких опросах проголосовал
// пользователь) догружаются клиентом через /api/polls/voted
export const revalidate = 60;

const PAGE_SIZE = 10;

export default async function PollsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
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

  const pageContent = await getPageContent("polls");

  const where: Prisma.PollWhereInput = { isActive: true };
  if (q) where.question = { contains: q };
  if (pollType) where.pollType = pollType;
  if (classifier.length > 0) where.treeItemId = { in: classifier };

  // Фильтр по голосованию — персональный, требует авторизации
  if (votedFilter) {
    const session = await auth();
    const userId = (session?.user as { id?: string } | undefined)?.id;
    const votedIds = userId
      ? (await prisma.pollVote.findMany({ where: { userId }, select: { pollId: true } })).map(
          (v) => v.pollId,
        )
      : [];
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
        options: {
          include: { _count: { select: { votes: true } } },
          orderBy: { sortOrder: "asc" },
        },
        _count: { select: { votes: true } },
        treeItem: { select: { fullNumberPath: true, name: true } },
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

  const rows = polls.map((p) => ({
    id: p.id,
    question: p.question,
    pollType: p.pollType as "DICHOTOMOUS" | "MULTIPLE",
    coinReward: p.coinReward.toNumber(),
    isActive: p.isActive,
    treeItemPath: p.treeItem?.fullNumberPath || null,
    treeItemName: p.treeItem?.name || null,
    totalVotes: p._count.votes,
    options: p.options.map((o) => ({
      id: o.id,
      text: o.text,
      voteCount: o._count.votes,
    })),
  }));

  return (
    <PollsPageClient
      polls={rows}
      total={total}
      page={page}
      totalPages={totalPages}
      treeItems={treeItems}
      moderatorText={pageContent?.content || null}
      pageTitle={pageContent?.title || null}
      bannerUrl={pageContent?.bannerUrl || null}
      initialQuery={{ q, type: pollType, classifier: classifier.join(","), sort, voted: votedFilter }}
    />
  );
}
