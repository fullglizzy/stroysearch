export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { StarRating } from "@/components/shared/StarRating";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReviewCard } from "@/components/shared/ReviewCard";
import { AddReviewSection } from "@/components/forms/AddReviewSection";
import { AddCompanyDialog } from "@/components/forms/AddCompanyDialog";
import { getRegions } from "@/server/admin/regions";

async function getReviewData(userId: string) {
  const [receivedReviews, givenReviews, companies, participants] = await Promise.all([
    prisma.review.findMany({
      where: { targetId: userId },
      include: {
        author: { select: { username: true, profile: { select: { nick: true, firstName: true, lastName: true } } } },
        company: { select: { id: true, name: true, inn: true } },
        criteria: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.review.findMany({
      where: { authorId: userId },
      include: {
        target: { select: { username: true, profile: { select: { nick: true, firstName: true, lastName: true } } } },
        company: { select: { id: true, name: true, inn: true } },
        criteria: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    // Кандидаты для вкладки «Оставить отзыв»
    prisma.company.findMany({
      select: { id: true, name: true, inn: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { status: "ACTIVE", type: "COMMON" },
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

  return { receivedReviews, givenReviews, companies, participantRows, avgRating };
}

export default async function AccountReviewsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userId = (session.user as any).id as string;
  const isActive = (session.user as any).status === "ACTIVE";
  const { receivedReviews, givenReviews, companies, participantRows, avgRating } = await getReviewData(userId);

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
          <p className="text-muted-foreground">
            Отзывы о вас и от вас. За каждый опубликованный отзыв начисляется +1 монета.
          </p>
        </div>
        <AddCompanyDialog regions={regions.map((r) => r.name)} treeItems={treeItems} />
      </div>

      {/* Rating */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Ваш рейтинг</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <StarRating rating={avgRating ?? 0} size="md" />
              <span className="text-xl font-bold">{avgRating !== null ? `${avgRating}` : "—"}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{receivedReviews.length} отзывов получено</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Оставлено отзывов</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{givenReviews.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Получено отзывов</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{receivedReviews.length}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="received">
        <TabsList>
          <TabsTrigger value="received">Полученные ({receivedReviews.length})</TabsTrigger>
          <TabsTrigger value="given">Оставленные ({givenReviews.length})</TabsTrigger>
          <TabsTrigger value="add">Оставить отзыв</TabsTrigger>
        </TabsList>

        <TabsContent value="received" className="space-y-4 mt-4">
          {receivedReviews.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">У вас пока нет отзывов</p>
          ) : (
            receivedReviews.map((review: any) => (
              <ReviewCard
                key={review.id}
                id={review.id}
                authorNick={review.author?.profile?.nick || review.author?.profile?.firstName || review.author?.username || "?"}
                comment={review.comment}
                weightedAverage={review.weightedAverage}
                createdAt={review.createdAt}
                criteria={review.criteria || []}
                companyName={review.company?.name || null}
                companyId={review.companyId}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="given" className="space-y-4 mt-4">
          {givenReviews.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Вы ещё не оставляли отзывы</p>
          ) : (
            givenReviews.map((review: any) => (
              <ReviewCard
                key={review.id}
                id={review.id}
                targetName={review.target?.profile?.nick || review.target?.profile?.firstName || review.target?.username || "?"}
                comment={review.comment}
                weightedAverage={review.weightedAverage}
                createdAt={review.createdAt}
                criteria={review.criteria || []}
                companyName={review.company?.name || null}
                companyId={review.companyId}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="add" className="mt-4">
          <AddReviewSection
            companies={companies}
            participants={participantRows}
            canReview={isActive}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
