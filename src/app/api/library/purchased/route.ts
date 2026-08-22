import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ID документов, купленных текущим пользователем — догружается клиентом,
// чтобы страница /library могла кэшироваться
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ ids: [] });
  }

  const userId = session.user.id;
  const purchases = await prisma.documentPurchase.findMany({
    where: { userId },
    select: { documentId: true },
  });

  return NextResponse.json({ ids: purchases.map((p) => p.documentId) });
}
