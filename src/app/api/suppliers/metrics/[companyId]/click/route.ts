import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import type { SessionUser } from "@/types";

const FIELDS = ["phone", "email", "website", "rating", "reviews"] as const;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const { companyId } = await params;

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(companyId)) {
    return NextResponse.json({ error: "Некорректный идентификатор компании" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный формат запроса" }, { status: 400 });
  }

  const field = (body as { field?: unknown } | null)?.field;
  if (typeof field !== "string" || !(FIELDS as readonly string[]).includes(field)) {
    return NextResponse.json({ error: "Некорректное поле метрики" }, { status: 400 });
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, ownerUserId: true },
  });
  if (!company) {
    return NextResponse.json({ error: "Компания не найдена" }, { status: 404 });
  }

  // Просмотры собственных контактов владельцем не считаем
  const session = await auth();
  const userId = (session?.user as SessionUser | undefined)?.id;
  if (userId && company.ownerUserId === userId) {
    return NextResponse.json({ success: true });
  }

  const viewField = `${field}Views`;
  const update: Record<string, { increment: number }> = {};
  update[viewField] = { increment: 1 };

  try {
    await prisma.companyMetrics.upsert({
      where: { companyId },
      update,
      create: { companyId, ...Object.fromEntries([[viewField, 1]]) },
    });
  } catch (error) {
    // Компанию могли удалить между проверкой и upsert
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json({ error: "Компания не найдена" }, { status: 404 });
    }
    throw error;
  }

  return NextResponse.json({ success: true });
}
