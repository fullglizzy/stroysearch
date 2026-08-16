import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { MyLibraryClient } from "@/components/cards/MyLibraryClient";

export const dynamic = "force-dynamic";

export default async function AccountLibraryPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userId = (session.user as any).id as string;

  const [myDocs, treeItems, purchases] = await Promise.all([
    prisma.libraryDocument.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: "desc" },
    }),
    prisma.productTreeItem.findMany({
      where: { deletedAt: null },
      orderBy: { fullNumberPath: "asc" },
      select: { id: true, name: true, fullNumberPath: true },
    }),
    prisma.documentPurchase.findMany({
      where: { userId },
      include: {
        document: { select: { id: true, title: true, fileUrl: true } },
      },
      orderBy: { purchasedAt: "desc" },
    }),
  ]);

  return (
    <div className="container-page py-8">
      <h1 className="text-3xl font-bold mb-2">Моя библиотека</h1>
      <p className="text-muted-foreground mb-6">Документы, которые вы загрузили и приобрели</p>
      <MyLibraryClient
        myDocs={myDocs.map((d) => ({
          id: d.id, title: d.title, coinPrice: d.coinPrice, fileUrl: d.fileUrl,
          fileSize: d.fileSize, views: d.views, purchasesCount: d.purchasesCount,
          isApproved: d.isApproved, moderatorNote: d.moderatorNote, treeItemId: d.treeItemId,
          createdAt: d.createdAt,
        }))}
        treeItems={treeItems}
        purchases={purchases.map((p) => ({
          id: p.document.id, title: p.document.title, fileUrl: p.document.fileUrl,
          purchasedAt: p.purchasedAt,
        }))}
      />
    </div>
  );
}
