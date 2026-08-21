import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import type { SessionUser } from "@/types";

const FIELDS = ["phone", "email", "website", "rating", "reviews"] as const;

// Простейшая защита от накрутки: не более WINDOW_MAX запросов с одного IP за окно.
const WINDOW_MS = 10_000;
const WINDOW_MAX = 10;
const rateBuckets = new Map<string, number[]>();

function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

function ipHash(ip: string): string {
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

function rateLimited(key: string): boolean {
  const now = Date.now();
  const bucket = (rateBuckets.get(key) || []).filter((t) => now - t < WINDOW_MS);
  if (bucket.length >= WINDOW_MAX) {
    rateBuckets.set(key, bucket);
    return true;
  }
  bucket.push(now);
  rateBuckets.set(key, bucket);
  return false;
}

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

  const viewerIpHash = ipHash(clientIp(request));
  if (rateLimited(viewerIpHash)) {
    return NextResponse.json({ error: "Слишком много запросов, попробуйте позже" }, { status: 429 });
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, ownerUserId: true, billing: { select: { status: true } } },
  });
  if (!company) {
    return NextResponse.json({ error: "Компания не найдена" }, { status: 404 });
  }

  // Санкция: контакты скрыты администратором — не открываем и не считаем
  if (company.billing?.status === "HIDDEN") {
    return NextResponse.json(
      { error: "Контакты скрыты", code: "CONTACTS_HIDDEN" },
      { status: 403 },
    );
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
    await prisma.$transaction([
      prisma.companyMetrics.upsert({
        where: { companyId },
        update,
        create: { companyId, ...Object.fromEntries([[viewField, 1]]) },
      }),
      prisma.companyViewEvent.create({
        data: {
          companyId,
          metric: field,
          viewerId: userId ?? null,
          ipHash: viewerIpHash,
        },
      }),
    ]);
  } catch (error) {
    // Компанию могли удалить между проверкой и записью
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json({ error: "Компания не найдена" }, { status: 404 });
    }
    throw error;
  }

  return NextResponse.json({ success: true });
}
