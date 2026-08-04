export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AccountDashboard } from "@/components/cards/AccountDashboard";

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

  const walletBalance = user.wallet?.balance ?? 0;

  return (
    <AccountDashboard
      user={{
        username: user.username,
        email: user.email,
        type: user.type,
        profile: user.profile
          ? {
              firstName: user.profile.firstName,
              lastName: user.profile.lastName,
              nick: user.profile.nick,
              region: user.profile.region,
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
      }}
    />
  );
}
