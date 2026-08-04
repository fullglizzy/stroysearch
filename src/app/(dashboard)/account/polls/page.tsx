export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PollsPageClient } from "@/components/tables/PollsPageClient";

export default async function AccountPollsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userId = (session.user as any).id as string;

  const polls = await prisma.poll.findMany({
    where: { isActive: true },
    include: {
      treeItem: { select: { fullNumberPath: true, name: true } },
      options: {
        include: { _count: { select: { votes: true } } },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const pollRows = polls.map((p) => ({
    id: p.id,
    question: p.question,
    pollType: p.pollType as "DICHOTOMOUS" | "MULTIPLE",
    coinReward: p.coinReward,
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
    <div className="container-page py-8">
      <h1 className="text-3xl font-bold mb-2">Статистика и опросы</h1>
      <p className="text-muted-foreground mb-6">
        Голосуйте в опросах и получайте монеты за каждый ответ
      </p>
      <PollsPageClient polls={pollRows} moderatorText={null} bannerUrl={null} />
    </div>
  );
}
