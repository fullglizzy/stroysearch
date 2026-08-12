export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SupportTicketsClient } from "@/components/forms/SupportTicketsClient";

const PAGE_SIZE = 20;

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userType = (session.user as any).type as string;
  if (!["MODERATOR", "EDITOR", "SUPER", "ROOT"].includes(userType)) {
    redirect("/account");
  }

  const sp = await searchParams;
  const get = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const page = Math.max(1, parseInt(get("page") || "1", 10) || 1);

  const [tickets, total] = await Promise.all([
    prisma.supportTicket.findMany({
      // Только счётчик сообщений — сами сообщения грузятся при открытии тикета
      include: { _count: { select: { messages: true } } },
      orderBy: [{ isResolved: "asc" }, { updatedAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.supportTicket.count(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="container-page py-8">
      <h1 className="text-3xl font-bold mb-2">Обращения в поддержку</h1>
      <p className="text-muted-foreground mb-6">
        Переписка с пользователями, ответы и закрытие обращений
      </p>
      <SupportTicketsClient
        initialTickets={tickets.map((t) => ({
          id: t.id,
          subject: t.subject,
          isResolved: t.isResolved,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
          replyCount: t._count.messages,
        }))}
        mode="staff"
        page={page}
        totalPages={totalPages}
      />
    </div>
  );
}
