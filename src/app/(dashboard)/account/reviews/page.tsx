export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ReviewForm } from "@/components/forms/ReviewForm";
import { StarRating } from "@/components/shared/StarRating";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Star, MessageSquare, Plus, Search, Building2, User } from "lucide-react";

async function getReviewData(userId: string) {
  const [receivedReviews, givenReviews, companies] = await Promise.all([
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
    prisma.company.findMany({
      select: { id: true, name: true, inn: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const avgRating =
    receivedReviews.length > 0
      ? Math.round(receivedReviews.reduce((s, r) => s + r.weightedAverage, 0) / receivedReviews.length * 10) / 10
      : null;

  return { receivedReviews, givenReviews, companies, avgRating };
}

export default async function AccountReviewsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userId = (session.user as any).id as string;
  const isActive = (session.user as any).status === "ACTIVE";
  const { receivedReviews, givenReviews, companies, avgRating } = await getReviewData(userId);

  return (
    <div className="container-page py-8">
      <h1 className="text-3xl font-bold mb-2">Мои отзывы</h1>
      <p className="text-muted-foreground mb-6">
        Отзывы о вас и от вас. За каждый опубликованный отзыв начисляется +1 монета.
      </p>

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
            receivedReviews.map((review) => (
              <ReviewCard key={review.id} review={review} isReceived />
            ))
          )}
        </TabsContent>

        <TabsContent value="given" className="space-y-4 mt-4">
          {givenReviews.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Вы ещё не оставляли отзывы</p>
          ) : (
            givenReviews.map((review) => (
              <ReviewCard key={review.id} review={review} isReceived={false} />
            ))
          )}
        </TabsContent>

        <TabsContent value="add" className="mt-4">
          {isActive ? (
            <AddReviewSection companies={companies} />
          ) : (
            <Alert variant="destructive">
              <AlertDescription>
                Ваш аккаунт не активен — оставлять отзывы нельзя.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ReviewCard({
  review,
  isReceived,
}: {
  review: any;
  isReceived: boolean;
}) {
  const person = isReceived ? review.author : review.target;
  const displayName =
    person?.profile?.nick || person?.profile?.firstName || person?.username || "?";
  const signature =
    review.signatureType === "name" && person?.profile?.firstName
      ? `${person.profile.lastName || ""} ${person.profile.firstName}`.trim()
      : displayName;

  return (
    <Card>
      <CardContent>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {isReceived ? "От:" : "Для:"} {signature}
            </span>
            {review.company && (
              <Badge variant="outline" className="text-[10px]">
                <Building2 className="h-2 w-2 mr-1" />
                {review.company.name}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <StarRating rating={review.weightedAverage} size="sm" />
            <span className="text-xs text-muted-foreground">{review.weightedAverage.toFixed(1)}</span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{review.comment}</p>
        <div className="flex flex-wrap gap-1 mt-2">
          {review.criteria.map((c: any) => (
            <Badge key={c.criteriaIndex} variant="secondary" className="text-[10px]">
              {c.criteriaIndex}: {"★".repeat(c.score)}{"☆".repeat(5 - c.score)}
            </Badge>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">
          {new Date(review.createdAt).toLocaleDateString("ru-RU")}
        </p>
      </CardContent>
    </Card>
  );
}

function AddReviewSection({ companies }: { companies: { id: string; name: string; inn: string }[] }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Выберите компанию для отзыва (из базы поставщиков) или найдите по ИНН
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {companies.slice(0, 20).map((c) => (
          <Dialog key={c.id}>
            <DialogTrigger>
              <Card className="h-full hover:border-menthol/50 transition-colors cursor-pointer text-left w-full">
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-menthol" />
                    <span className="font-medium text-sm">{c.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">ИНН: {c.inn}</p>
                </CardContent>
              </Card>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Оставить отзыв</DialogTitle>
                <DialogDescription>
                  Оцените компанию по 9 критериям. За отзыв +1 монета.
                </DialogDescription>
              </DialogHeader>
              <ReviewForm
                targetId={c.id}
                targetName={c.name}
                companyId={c.id}
                criteriaLabels={[
                  "Качество оказанной работы/услуги/материала/поставки",
                  "Организация работы на объекте / организация поставки",
                  "Взаимодействие со специалистами компании",
                  "Наличие средств, необходимых для выполнения работ",
                  "Финансовое состояние предприятия",
                  "Наличие квалифицированных специалистов и руководителей",
                  "Срок выполнения работ/поставки",
                  "Стоимость и условия оплаты",
                  "Особые условия/гибкость в договорных отношениях",
                ]}
              />
            </DialogContent>
          </Dialog>
        ))}
      </div>
    </div>
  );
}
