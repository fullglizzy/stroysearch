export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
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

  const [polls, total] = await Promise.all([
    prisma.poll.findMany({
      where: { isActive: true },
      include: {
        treeItem: { select: { fullNumberPath: true, name: true } },
        options: {
          include: { _count: { select: { votes: true } } },
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.poll.count({ where: { isActive: true } }),
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
    <div className="container-page py-8">
      <h1 className="text-3xl font-bold mb-2">Статистика и опросы</h1>
      <p className="text-muted-foreground mb-6">
        Голосуйте в опросах и получайте монеты за каждый ответ
      </p>
      <PollsPageClient
        polls={pollRows}
        total={total}
        page={page}
        totalPages={totalPages}
        moderatorText={null}
        pageTitle={null}
        bannerUrl={null}
      />
    </div>
  );
}
