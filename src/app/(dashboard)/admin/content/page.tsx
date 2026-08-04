export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ContentManager } from "@/components/forms/ContentManager";

export default async function AdminContentPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userType = (session.user as any).type as string;
  if (!["MODERATOR", "EDITOR", "SUPER", "ROOT"].includes(userType)) {
    redirect("/account");
  }

  const pages = await prisma.pageContent.findMany();

  return (
    <div className="container-page py-8">
      <h1 className="text-3xl font-bold mb-6">Управление контентом</h1>
      <ContentManager pages={pages} />
    </div>
  );
}
