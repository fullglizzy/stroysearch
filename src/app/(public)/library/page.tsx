import { prisma } from "@/lib/prisma";
import { LibraryPageClient } from "@/components/tables/LibraryPageClient";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
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

  return <LibraryPageClient documents={rows} treeItems={treeItems} />;
}
