import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ID опросов, в которых пользователь уже проголосовал.
// Догружается клиентом, чтобы страница /polls могла кэшироваться.
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ ids: [] });
  }

  const userId = (session.user as any).id;
  const votes = await prisma.pollVote.findMany({
    where: { userId },
    select: { pollId: true },
    distinct: ["pollId"],
  });

  return NextResponse.json({ ids: votes.map((v) => v.pollId) });
}
