import { prisma } from "@/lib/prisma";
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

  const pageContent = await getPageContent("polls");

  const [polls, total] = await Promise.all([
    prisma.poll.findMany({
      where: { isActive: true },
      include: {
        options: {
          include: { _count: { select: { votes: true } } },
          orderBy: { sortOrder: "asc" },
        },
        _count: { select: { votes: true } },
        treeItem: { select: { fullNumberPath: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.poll.count({ where: { isActive: true } }),
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
      moderatorText={pageContent?.content || null}
      pageTitle={pageContent?.title || null}
      bannerUrl={pageContent?.bannerUrl || null}
    />
  );
}
