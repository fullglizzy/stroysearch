import { prisma } from "@/lib/prisma";
import { HomePageClient } from "@/components/cards/HomePageClient";

export const revalidate = 60; // страница кэшируется на 60 сек

export default async function HomePage() {
  const pageContent = await prisma.pageContent.findUnique({
    where: { pageKey: "home" },
  });

  const upcomingConferences = await prisma.conference.findMany({
    where: {
      status: "APPROVED",
      date: { gte: new Date() },
    },
    orderBy: { date: "asc" },
    take: 3,
    select: {
      id: true,
      title: true,
      date: true,
      time: true,
    },
  });

  return (
    <HomePageClient
      pageContent={pageContent?.content || "<p>Добро пожаловать на платформу ЕНЦПР</p>"}
      bannerUrl={pageContent?.bannerUrl || null}
      upcomingConferences={upcomingConferences}
    />
  );
}
