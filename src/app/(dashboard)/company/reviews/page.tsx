import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CompanyReviewsClient } from "@/components/cards/CompanyReviewsClient";
import { AddCompanyDialog } from "@/components/forms/AddCompanyDialog";
import { getRegions } from "@/server/admin/regions";

export const dynamic = "force-dynamic";

export default async function CompanyReviewsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userId = session.user.id;
  const canReview = session.user.status === "ACTIVE";

  const company = await prisma.company.findFirst({
    where: { ownerUserId: userId },
  });

  const [receivedReviews, givenReviews, companies, participants] = await Promise.all([
    company
      ? prisma.review.findMany({
          where: { companyId: company.id, status: "ACTIVE" },
          include: {
            author: { select: { username: true, profile: { select: { nick: true, firstName: true, lastName: true } } } },
            criteria: true,
          },
          orderBy: { createdAt: "desc" },
        })
      : [],
    prisma.review.findMany({
      where: { authorId: userId },
      include: {
        target: { select: { username: true, profile: { select: { nick: true } } } },
        company: { select: { name: true } },
        criteria: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    // Кандидаты для вкладки «Оставить отзыв»:
    // исключаем компании, которыми пользователь ВЛАДЕЕТ, но оставляем компании
    // без владельца (в т.ч. добавленные самим пользователем) и чужие.
    prisma.company.findMany({
      where: {
        OR: [{ ownerUserId: { not: userId } }, { ownerUserId: null }],
      },
      select: { id: true, name: true, inn: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { status: "ACTIVE", type: "COMMON", id: { not: userId } },
      select: {
        id: true,
        username: true,
        profile: { select: { nick: true, firstName: true, lastName: true } },
      },
    }),
  ]);

  const participantRows = participants.map((u) => {
    const names = [u.profile?.firstName, u.profile?.lastName].filter(Boolean);
    return {
      id: u.id,
      nick: u.profile?.nick || null,
      name: names.length > 0 ? names.join(" ") : u.username,
    };
  });

  const avgRating =
    receivedReviews.length > 0
      ? Math.round(receivedReviews.reduce((s, r) => s + r.weightedAverage, 0) / receivedReviews.length * 10) / 10
      : null;

  const [regions, treeItems] = await Promise.all([
    getRegions(),
    prisma.productTreeItem.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, fullNumberPath: true },
      orderBy: { fullNumberPath: "asc" },
    }),
  ]);

  return (
    <div className="container-page py-8">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Мои отзывы</h1>
          <p className="text-muted-foreground">Отзывы о компании и оставленные вами</p>
        </div>
        <AddCompanyDialog regions={regions.map((r) => r.name)} treeItems={treeItems} />
      </div>
      <CompanyReviewsClient
        receivedReviews={receivedReviews}
        givenReviews={givenReviews}
        avgRating={avgRating}
        companies={companies}
        participants={participantRows}
        canReview={canReview}
      />
    </div>
  );
}
