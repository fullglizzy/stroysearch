export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExpandableText } from "@/components/shared/ExpandableText";
import { CreateConferenceButton, CancelConferenceButton, EditConferenceButton } from "@/components/forms/ConferenceCabinetActions";
import { Calendar, Clock, Users, Eye, Coins, ExternalLink } from "lucide-react";

async function getConferencesData(userId: string) {
  const [organized, participated] = await Promise.all([
    prisma.conference.findMany({
      where: { organizerId: userId },
      include: { _count: { select: { participants: true } } },
      orderBy: { date: "desc" },
    }),
    prisma.conference.findMany({
      where: {
        participants: { some: { userId } },
      },
      include: { _count: { select: { participants: true } } },
      orderBy: { date: "desc" },
    }),
  ]);
  return { organized, participated };
}

export default async function AccountConferencesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userId = (session.user as any).id as string;
  const [data, treeItems] = await Promise.all([
    getConferencesData(userId),
    prisma.productTreeItem.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, fullNumberPath: true },
      orderBy: { fullNumberPath: "asc" },
    }),
  ]);
  const { organized, participated } = data;

  const formatDate = (d: Date) =>
    new Date(d).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });

  const ConfCard = ({ conf, showStatus }: { conf: any; showStatus?: boolean }) => (
    <Card key={conf.id} className="hover:shadow-sm transition-shadow">
      <CardContent>
        <h3 className="font-semibold text-lg mb-2">{conf.title}</h3>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mb-3">
          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {formatDate(conf.date)}</span>
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {conf.time} МСК</span>
          <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {conf._count.participants}</span>
          <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {conf.views}</span>
        </div>
        <ExpandableText text={conf.description} />
        {conf.status === "REJECTED" && conf.moderatorNote && (
          <p className="text-xs text-orange-accent mt-2">Причина отклонения: {conf.moderatorNote}</p>
        )}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {conf.coinPrice > 0 ? (
              <Badge className="gap-1"><Coins className="h-3 w-3" /> {conf.coinPrice}</Badge>
            ) : (
              <Badge variant="outline" className="text-menthol">Бесплатно</Badge>
            )}
            {showStatus && (
              <Badge variant={conf.status === "APPROVED" ? "secondary" : conf.status === "PENDING" ? "outline" : "destructive"}>
                {conf.status === "APPROVED" ? "Одобрено" : conf.status === "PENDING" ? "На модерации" : conf.status === "REJECTED" ? "Отклонено" : "Отменено"}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {showStatus && ["PENDING", "REJECTED", "APPROVED"].includes(conf.status) && (
              <>
                <EditConferenceButton
                  treeItems={treeItems}
                  conference={{
                    id: conf.id,
                    title: conf.title,
                    date: conf.date,
                    time: conf.time,
                    description: conf.description,
                    treeItemId: conf.treeItemId,
                    coinPrice: conf.coinPrice,
                    isPublic: conf.isPublic,
                    connectionLink: conf.connectionLink,
                    logoUrl: conf.logoUrl,
                  }}
                />
                {(conf.status === "PENDING" || conf.status === "APPROVED") && (
                  <CancelConferenceButton confId={conf.id} title={conf.title} />
                )}
              </>
            )}
            {conf.connectionLink && (
              <a href={conf.connectionLink} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="gap-1">
                  <ExternalLink className="h-3 w-3" /> Подключиться
                </Button>
              </a>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="container-page py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Мои конференции</h1>
          <p className="text-muted-foreground">Конференции, которые вы организовали и в которых участвуете</p>
        </div>
        <CreateConferenceButton treeItems={treeItems} />
      </div>

      {organized.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Организованные ({organized.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {organized.map((conf) => <ConfCard key={conf.id} conf={conf} showStatus />)}
          </div>
        </section>
      )}

      {participated.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-4">Участие ({participated.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {participated.map((conf) => <ConfCard key={conf.id} conf={conf} />)}
          </div>
        </section>
      )}

      {organized.length === 0 && participated.length === 0 && (
        <div className="border rounded-lg p-12 text-center text-muted-foreground">
          <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg">Нет конференций</p>
          <p className="text-sm mt-2">
            <Link href="/conferences" className="text-menthol hover:underline">
              Создайте конференцию на странице «Конференции»
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
