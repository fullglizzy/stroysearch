"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StarRating } from "@/components/shared/StarRating";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare } from "lucide-react";
import { ReviewCard } from "@/components/shared/ReviewCard";
import { AddReviewSection, type ReviewCandidateCompany, type ReviewCandidateParticipant } from "@/components/forms/AddReviewSection";
import type { ReviewRow } from "@/types";

interface CompanyReviewsClientProps {
  receivedReviews: ReviewRow[];
  givenReviews: ReviewRow[];
  avgRating: number | null;
  companies: ReviewCandidateCompany[];
  participants: ReviewCandidateParticipant[];
  canReview: boolean;
}

export function CompanyReviewsClient({
  receivedReviews,
  givenReviews,
  avgRating,
  companies,
  participants,
  canReview,
}: CompanyReviewsClientProps) {
  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Рейтинг компании</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <StarRating rating={avgRating ?? 0} size="md" />
              <span className="text-xl font-bold">{avgRating !== null ? `${avgRating}` : "—"}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{receivedReviews.length} отзывов</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Оставлено отзывов</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{givenReviews.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Получено отзывов</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{receivedReviews.length}</div></CardContent>
        </Card>
      </div>

      <Tabs defaultValue="received">
        <TabsList className="flex-wrap h-auto justify-start">
          <TabsTrigger value="received">Полученные ({receivedReviews.length})</TabsTrigger>
          <TabsTrigger value="given">Оставленные ({givenReviews.length})</TabsTrigger>
          <TabsTrigger value="add">Оставить отзыв</TabsTrigger>
        </TabsList>

        <TabsContent value="received" className="space-y-4 mt-4">
          {receivedReviews.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>У компании пока нет отзывов</p>
            </div>
          ) : (
            receivedReviews.map((r) => (
              <ReviewCard
                key={r.id}
                id={r.id}
                authorNick={r.author?.profile?.nick || r.author?.username || "?"}
                comment={r.comment}
                weightedAverage={r.weightedAverage}
                createdAt={r.createdAt}
                criteria={r.criteria || []}
                companyId={r.companyId}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="given" className="space-y-4 mt-4">
          {givenReviews.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>Вы ещё не оставляли отзывы</p>
            </div>
          ) : (
            givenReviews.map((r) => (
              <ReviewCard
                key={r.id}
                id={r.id}
                targetName={r.companyId ? null : r.target?.profile?.nick || r.target?.username || "?"}
                comment={r.comment}
                weightedAverage={r.weightedAverage}
                createdAt={r.createdAt}
                criteria={r.criteria || []}
                companyName={r.company?.name || null}
                companyId={r.companyId}
                hidden={r.status === "HIDDEN"}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="add" className="mt-4">
          <AddReviewSection companies={companies} participants={participants} canReview={canReview} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
