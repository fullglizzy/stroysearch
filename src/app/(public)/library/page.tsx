import { prisma } from "@/lib/prisma";
import { getPageContent } from "@/server/admin/content";
import { auth } from "@/lib/auth";
import { LibraryPageClient } from "@/components/tables/LibraryPageClient";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const pageContent = await getPageContent("library");
  const session = await auth();

  const treeItems = await prisma.productTreeItem.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, fullNumberPath: true },
  });

  const documents = await prisma.libraryDocument.findMany({
    where: { isApproved: true, deletedAt: null },
    include: {
      user: {
        select: {
          username: true,
          profile: { select: { nick: true } },
        },
      },
      treeItem: { select: { fullNumberPath: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Fetch user's purchased document IDs
  let purchasedDocIds: string[] = [];
  if (session?.user) {
    const userId = (session.user as any).id as string;
    const purchases = await prisma.documentPurchase.findMany({
      where: { userId },
      select: { documentId: true },
    });
    purchasedDocIds = purchases.map((p) => p.documentId);
  }

  const rows = documents.map((d) => ({
    id: d.id,
    title: d.title,
    treeItemPath: d.treeItem?.fullNumberPath || null,
    coinPrice: d.coinPrice,
    uploaderName: d.user.profile?.nick || d.user.username,
    fileSize: d.fileSize,
    fileUrl: d.fileUrl,
    views: d.views,
    purchasesCount: d.purchasesCount,
  }));

  return (
    <LibraryPageClient
      documents={rows}
      treeItems={treeItems}
      moderatorText={pageContent?.content || null}
      bannerUrl={pageContent?.bannerUrl || null}
      purchasedDocIds={purchasedDocIds}
    />
  );
}
