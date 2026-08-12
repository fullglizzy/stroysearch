import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { LibraryModeration } from "@/components/tables/LibraryModeration";

export const dynamic = "force-dynamic";

export default async function AdminLibraryPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const documents = await prisma.libraryDocument.findMany({
    where: { deletedAt: null },
    include: {
      user: { select: { username: true, profile: { select: { nick: true } } } },
      treeItem: { select: { fullNumberPath: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="container-page py-8">
      <h1 className="text-3xl font-bold mb-6">Модерация библиотеки</h1>
      <LibraryModeration documents={documents as any} />
    </div>
  );
}
