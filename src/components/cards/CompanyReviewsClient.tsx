"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StarRating } from "@/components/shared/StarRating";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, User } from "lucide-react";

interface CompanyReviewsClientProps {
  receivedReviews: any[];
  givenReviews: any[];
  avgRating: number | null;
}

export function CompanyReviewsClient({ receivedReviews, givenReviews, avgRating }: CompanyReviewsClientProps) {
  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Рейтинг компании</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <StarRating rating={avgRating ?? 0} size="md" />
              <span className="text-xl font-bold">{avgRating !== null ? `${avgRating}/100` : "—"}</span>
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
        <TabsList>
          <TabsTrigger value="received">Полученные ({receivedReviews.length})</TabsTrigger>
          <TabsTrigger value="given">Оставленные ({givenReviews.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="received" className="space-y-4 mt-4">
          {receivedReviews.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">У компании пока нет отзывов</p>
          ) : (
            receivedReviews.map((r: any) => (
              <Card key={r.id}>
                <CardContent>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">
                      От: {r.author?.profile?.nick || r.author?.username || "?"}
                    </span>
                    <div className="flex items-center gap-1">
                      <StarRating rating={r.weightedAverage} size="sm" />
                      <span className="text-xs text-muted-foreground">{r.weightedAverage}/100</span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{r.comment}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {r.criteria?.map((c: any) => (
                      <Badge key={c.criteriaIndex} variant="secondary" className="text-[10px]">
                        {c.criteriaIndex}: {"★".repeat(c.score)}{"☆".repeat(5 - c.score)}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2">
                    {new Date(r.createdAt).toLocaleDateString("ru-RU")}
                  </p>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="given" className="space-y-4 mt-4">
          {givenReviews.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Вы ещё не оставляли отзывы</p>
          ) : (
            givenReviews.map((r: any) => (
              <Card key={r.id}>
                <CardContent>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        Для: {r.target?.profile?.nick || r.target?.username || "?"}
                      </span>
                      {r.company && (
                        <Badge variant="outline" className="text-[10px]">
                          <Building2 className="h-2 w-2 mr-1" />{r.company.name}
                        </Badge>
                      )}
                    </div>
                    <StarRating rating={r.weightedAverage} size="sm" />
                  </div>
                  <p className="text-sm text-muted-foreground">{r.comment}</p>
                  <p className="text-[10px] text-muted-foreground mt-2">
                    {new Date(r.createdAt).toLocaleDateString("ru-RU")}
                  </p>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
