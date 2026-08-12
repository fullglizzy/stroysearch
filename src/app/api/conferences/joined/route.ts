import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ID конференций, в которых участвует пользователь (как участник или организатор).
// Догружается клиентом, чтобы страница /conferences могла кэшироваться.
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ ids: [] });
  }

  const userId = (session.user as any).id;

  const [parts, own] = await Promise.all([
    prisma.conferenceParticipant.findMany({
      where: { userId },
      select: { conferenceId: true },
    }),
    prisma.conference.findMany({
      where: { organizerId: userId },
      select: { id: true },
    }),
  ]);

  return NextResponse.json({
    ids: [...parts.map((p) => p.conferenceId), ...own.map((c) => c.id)],
  });
}
