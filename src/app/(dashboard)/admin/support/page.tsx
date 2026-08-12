export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SupportTicketsClient } from "@/components/forms/SupportTicketsClient";

export default async function AdminSupportPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userType = (session.user as any).type as string;
  if (!["MODERATOR", "EDITOR", "SUPER", "ROOT"].includes(userType)) {
    redirect("/account");
  }

  const tickets = await prisma.supportTicket.findMany({
    include: { messages: { select: { id: true } } },
    orderBy: [{ isResolved: "asc" }, { updatedAt: "desc" }],
  });

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
          replyCount: t.messages.length,
        }))}
        mode="staff"
      />
    </div>
  );
}
