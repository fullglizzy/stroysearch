export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SupportTicketsClient } from "@/components/forms/SupportTicketsClient";

export default async function AccountSupportPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userId = (session.user as any).id as string;

  const tickets = await prisma.supportTicket.findMany({
    where: { userId },
    include: { messages: { select: { id: true, isStaff: true, createdAt: true } } },
    orderBy: [{ isResolved: "asc" }, { updatedAt: "desc" }],
  });

  return (
    <div className="container-page py-8">
      <h1 className="text-3xl font-bold mb-2">Поддержка</h1>
      <p className="text-muted-foreground mb-6">
        Ваши обращения и переписка со службой поддержки
      </p>
      <SupportTicketsClient
        initialTickets={tickets.map((t) => ({
          id: t.id,
          subject: t.subject,
          isResolved: t.isResolved,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
          replyCount: t.messages.length,
          hasUnread: t.messages.some(
            (m) => m.isStaff && (!t.userLastReadAt || m.createdAt > t.userLastReadAt),
          ),
        }))}
        mode="user"
      />
    </div>
  );
}
