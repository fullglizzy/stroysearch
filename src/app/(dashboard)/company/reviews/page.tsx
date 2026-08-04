import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CompanyReviewsClient } from "@/components/cards/CompanyReviewsClient";

export const dynamic = "force-dynamic";

export default async function CompanyReviewsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userId = (session.user as any).id as string;

  const company = await prisma.company.findFirst({
    where: { ownerUserId: userId },
  });

  const [receivedReviews, givenReviews] = await Promise.all([
    company
      ? prisma.review.findMany({
          where: { companyId: company.id },
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
  ]);

  const avgRating =
    receivedReviews.length > 0
      ? Math.round(receivedReviews.reduce((s, r) => s + r.weightedAverage, 0) / receivedReviews.length)
      : null;

  return (
    <div className="container-page py-8">
      <h1 className="text-3xl font-bold mb-2">Мои отзывы</h1>
      <p className="text-muted-foreground mb-6">Отзывы о компании и оставленные вами</p>
      <CompanyReviewsClient
        receivedReviews={receivedReviews}
        givenReviews={givenReviews}
        avgRating={avgRating}
      />
    </div>
  );
}
