export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExpandableText } from "@/components/shared/ExpandableText";
import { Calendar, Clock, Users, Eye, Coins, ExternalLink } from "lucide-react";

export default async function CompanyConferencesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userId = (session.user as any).id as string;

  const [organized, participated] = await Promise.all([
    prisma.conference.findMany({
      where: { organizerId: userId },
      include: { _count: { select: { participants: true } } },
      orderBy: { date: "desc" },
    }),
    prisma.conference.findMany({
      where: { participants: { some: { userId } } },
      include: { _count: { select: { participants: true } } },
      orderBy: { date: "desc" },
    }),
  ]);

  const formatDate = (d: Date) =>
    new Date(d).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="container-page py-8">
      <h1 className="text-3xl font-bold mb-2">Мои конференции</h1>
      <p className="text-muted-foreground mb-6">Презентация продуктов, проведение лекций</p>

      {organized.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Организованные ({organized.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {organized.map((conf) => (
              <Card key={conf.id}>
                <CardContent>
                  <h3 className="font-semibold text-lg mb-2">{conf.title}</h3>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mb-3">
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {formatDate(conf.date)}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {conf.time} МСК</span>
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {conf._count.participants}</span>
                    <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {conf.views}</span>
                  </div>
                  <ExpandableText text={conf.description} />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {conf.coinPrice > 0 ? <Badge className="gap-1"><Coins className="h-3 w-3" />{conf.coinPrice}</Badge> : <Badge variant="outline" className="text-menthol">Бесплатно</Badge>}
                      <Badge variant={conf.status === "APPROVED" ? "secondary" : "outline"}>
                        {conf.status === "APPROVED" ? "Одобрено" : conf.status === "PENDING" ? "На модерации" : conf.status === "REJECTED" ? "Отклонено" : "Отменено"}
                      </Badge>
                    </div>
                    {conf.connectionLink && (
                      <a href={conf.connectionLink} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm"><ExternalLink className="h-3 w-3 mr-1" />Подключиться</Button>
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {participated.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-4">Участие ({participated.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {participated.map((conf) => (
              <Card key={conf.id}>
                <CardContent>
                  <h3 className="font-semibold text-lg mb-2">{conf.title}</h3>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mb-3">
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {formatDate(conf.date)}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {conf.time} МСК</span>
                  </div>
                  <ExpandableText text={conf.description} />
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {organized.length === 0 && participated.length === 0 && (
        <div className="border rounded-lg p-12 text-center text-muted-foreground">
          <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg">Нет конференций</p>
          <p className="text-sm mt-2">Презентуйте свой продукт — создайте конференцию</p>
        </div>
      )}
    </div>
  );
}
