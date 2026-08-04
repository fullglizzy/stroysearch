import { prisma } from "@/lib/prisma";
import { PollsPageClient } from "@/components/tables/PollsPageClient";

export const dynamic = "force-dynamic";

export default async function PollsPage() {
  const polls = await prisma.poll.findMany({
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
  });

  const rows = polls.map((p) => ({
    id: p.id,
    question: p.question,
    pollType: p.pollType as "DICHOTOMOUS" | "MULTIPLE",
    coinReward: p.coinReward,
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

  return <PollsPageClient polls={rows} />;
}
