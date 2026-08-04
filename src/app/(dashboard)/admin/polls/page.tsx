import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PollsManager } from "@/components/forms/PollsManager";

export const dynamic = "force-dynamic";

export default async function AdminPollsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const polls = await prisma.poll.findMany({
    include: {
      options: { include: { _count: { select: { votes: true } } } },
      _count: { select: { votes: true } },
      treeItem: { select: { fullNumberPath: true } },
      votes: {
        include: { user: { select: { username: true, profile: { select: { nick: true } } } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const treeItems = await prisma.productTreeItem.findMany({
    where: { deletedAt: null },
    select: { id: true, fullNumberPath: true, name: true },
  });

  return (
    <div className="container-page py-8">
      <h1 className="text-3xl font-bold mb-6">Управление опросами</h1>
      <PollsManager polls={polls as any} treeItems={treeItems} />
    </div>
  );
}
