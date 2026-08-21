import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/types";

const ADMIN_TYPES = ["SUPER", "ROOT"];

// Список актов об оказанных услугах
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  if (!ADMIN_TYPES.includes((session.user as SessionUser).type as string)) {
    return NextResponse.json({ error: "Нет прав" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  // Поиск в нижнем регистре и фильтрация в JS: SQLite LIKE чувствителен
  // к регистру для кириллицы, а лимит списка мал (200).
  const q = (searchParams.get("q") || "").toLowerCase().trim();

  const acts = await prisma.serviceAct.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      number: true,
      date: true,
      total: true,
      invoice: {
        select: {
          id: true,
          number: true,
          periodFrom: true,
          periodTo: true,
          user: { select: { username: true, ownedCompany: { select: { name: true } } } },
        },
      },
    },
  });

  const filtered = q
    ? acts.filter((a) =>
        `${a.number} ${a.invoice.number} ${a.invoice.user.username} ${a.invoice.user.ownedCompany?.name ?? ""}`
          .toLowerCase()
          .includes(q),
      )
    : acts;

  return NextResponse.json({
    acts: filtered.map((a) => ({
      id: a.id,
      number: a.number,
      date: a.date,
      total: a.total.toNumber(),
      invoiceId: a.invoice.id,
      invoiceNumber: a.invoice.number,
      periodFrom: a.invoice.periodFrom,
      periodTo: a.invoice.periodTo,
      username: a.invoice.user.username,
      company: a.invoice.user.ownedCompany?.name ?? null,
    })),
  });
}
