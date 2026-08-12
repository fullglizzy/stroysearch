export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AdminDashboard } from "@/components/cards/AdminDashboard";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userType = (session.user as any).type as string;
  if (!["MODERATOR", "EDITOR", "SUPER", "ROOT"].includes(userType)) {
    redirect("/account");
  }

  const totalUsers = await prisma.user.count();
  const totalCompanies = await prisma.company.count();
  const pendingConferences = await prisma.conference.count({
    where: { status: "PENDING" },
  });
  const totalDocuments = await prisma.libraryDocument.count();
  const totalPolls = await prisma.poll.count();

  // Счётчик непрочитанных обращений считаем одним SQL-запросом,
  // а не загрузкой всех тикетов со всеми сообщениями
  const unreadRows = await prisma.$queryRawUnsafe<{ cnt: number | bigint }[]>(`
    SELECT COUNT(*) AS cnt FROM support_tickets t
    WHERE EXISTS (
      SELECT 1 FROM support_messages m
      WHERE m."ticketId" = t.id AND m."isStaff" IS FALSE
      AND (t."adminLastReadAt" IS NULL OR m."createdAt" > t."adminLastReadAt")
    )`);
  const supportUnread = Number(unreadRows[0]?.cnt ?? 0);

  return (
    <div className="container-page py-8">
      <h1 className="text-3xl font-bold mb-2">Панель управления</h1>
      <p className="text-muted-foreground mb-8">
        Управление контентом, пользователями и модерация
      </p>
      <AdminDashboard
        stats={{
          totalUsers,
          totalCompanies,
          pendingConferences,
          totalDocuments,
          totalPolls,
        }}
        userType={userType}
        supportUnread={supportUnread}
      />
    </div>
  );
}
