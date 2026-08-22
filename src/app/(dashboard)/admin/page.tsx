export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AdminDashboard } from "@/components/cards/AdminDashboard";
import { AdminCharts } from "@/components/cards/AdminCharts";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userType = session.user.type;
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

  // Активность за 24 часа и очереди модерации — для бейджей на дашборде.
  // Серверный компонент с force-dynamic: Date.now() здесь — честные текущие данные,
  // правило react-hooks/purity рассчитано на клиентский рендер.
  // eslint-disable-next-line react-hooks/purity
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [pendingDocuments, newReviews, newProducts, newCompanies, pendingGiftClaims] =
    await Promise.all([
      prisma.libraryDocument.count({ where: { isApproved: false, deletedAt: null } }),
      prisma.review.count({ where: { createdAt: { gte: dayAgo } } }),
      prisma.product.count({ where: { createdAt: { gte: dayAgo }, deletedAt: null } }),
      prisma.company.count({ where: { createdAt: { gte: dayAgo } } }),
      prisma.giftClaim.count({ where: { issuedAt: null } }),
    ]);

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

  // Динамика за 30 дней для графика.
  // Prisma хранит DateTime в SQLite как INTEGER (мс), поэтому делим на 1000 и работаем с unixepoch.
  const [usersByDay, txByDay] = await Promise.all([
    prisma.$queryRawUnsafe<{ day: string; cnt: number | bigint }[]>(`
      SELECT date("createdAt" / 1000, 'unixepoch') AS day, COUNT(*) AS cnt FROM users
      WHERE "createdAt" / 1000 >= strftime('%s', 'now') - 30 * 86400
      GROUP BY day ORDER BY day`),
    prisma.$queryRawUnsafe<{ day: string; cnt: number | bigint }[]>(`
      SELECT date("createdAt" / 1000, 'unixepoch') AS day, COUNT(*) AS cnt FROM transactions
      WHERE "createdAt" / 1000 >= strftime('%s', 'now') - 30 * 86400
      GROUP BY day ORDER BY day`),
  ]);

  const txByDayMap = new Map(txByDay.map((r) => [String(r.day), Number(r.cnt)]));
  const chartData = usersByDay.map((r) => ({
    day: String(r.day).slice(5),
    users: Number(r.cnt),
    transactions: txByDayMap.get(String(r.day)) ?? 0,
  }));

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
          pendingDocuments,
          newReviews,
          newProducts,
          newCompanies,
          pendingGiftClaims,
        }}
        userType={userType}
        supportUnread={supportUnread}
      />
      <AdminCharts data={chartData} />
    </div>
  );
}
