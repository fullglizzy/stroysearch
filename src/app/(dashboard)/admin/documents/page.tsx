export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DocumentsManager } from "@/components/forms/DocumentsManager";

export default async function AdminDocumentsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userType = (session.user as any).type as string;
  if (!["SUPER", "ROOT"].includes(userType)) {
    redirect("/account");
  }

  const documents = await prisma.legalDocument.findMany();

  return (
    <div className="container-page py-8">
      <h1 className="text-3xl font-bold mb-2">Юридические документы</h1>
      <p className="text-muted-foreground mb-6">
        PDF-файлы отображаются на страницах /privacy и /terms
      </p>
      <DocumentsManager
        documents={documents.map((d) => ({
          key: d.key,
          fileName: d.fileName,
          fileUrl: d.fileUrl,
          fileSize: d.fileSize,
          updatedAt: d.updatedAt,
        }))}
      />
    </div>
  );
}
