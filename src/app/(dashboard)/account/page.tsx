export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AccountDashboard } from "@/components/cards/AccountDashboard";
import { getPageContent } from "@/server/admin/content";
import { computeRating } from "@/lib/rating";

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userId = (session.user as any).id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      profile: {
        include: { roles: true },
      },
      wallet: true,
      receivedReviews: { select: { weightedAverage: true } },
      _count: {
        select: {
          givenReviews: true,
          receivedReviews: true,
          documents: true,
          conferences: true,
        },
      },
    },
  });

  if (!user) redirect("/login");

  const walletBalance = user.wallet ? user.wallet.balance.toNumber() : 0;
  const rating = computeRating(user.receivedReviews);

  // Непрочитанные ответы поддержки — одним SQL-запросом вместо загрузки всех сообщений
  const unreadRows = await prisma.$queryRawUnsafe<{ cnt: number | bigint }[]>(`
    SELECT COUNT(*) AS cnt FROM support_tickets t
    WHERE t."userId" = ?
    AND EXISTS (
      SELECT 1 FROM support_messages m
      WHERE m."ticketId" = t.id AND m."isStaff" IS TRUE
      AND (t."userLastReadAt" IS NULL OR m."createdAt" > t."userLastReadAt")
    )`, userId);
  const supportUnread = Number(unreadRows[0]?.cnt ?? 0);

  const pageContent = await getPageContent("account");

  return (
    <AccountDashboard
      bannerUrl={pageContent?.bannerUrl || null}
      user={{
        username: user.username,
        email: user.email,
        type: user.type,
        profile: user.profile
          ? {
              firstName: user.profile.firstName,
              lastName: user.profile.lastName,
              nick: user.profile.nick,
              regions: user.profile.regions,
              roles: user.profile.roles.map((r) => r.role),
            }
          : null,
        walletBalance,
        stats: {
          givenReviews: user._count.givenReviews,
          receivedReviews: user._count.receivedReviews,
          documents: user._count.documents,
          conferences: user._count.conferences,
        },
        rating,
      }}
      supportUnread={supportUnread}
    />
  );
}
