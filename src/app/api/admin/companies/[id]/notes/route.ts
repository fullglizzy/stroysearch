import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/types";
import { logAdminAction } from "@/lib/audit";

const ADMIN_TYPES = ["SUPER", "ROOT"];

// Заметки администратора о компании — список
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  if (!ADMIN_TYPES.includes((session.user as SessionUser).type as string)) {
    return NextResponse.json({ error: "Нет прав" }, { status: 403 });
  }

  const { id } = await params;
  const notes = await prisma.companyNote.findMany({
    where: { companyId: id },
    orderBy: { createdAt: "desc" },
    select: { id: true, text: true, createdAt: true },
  });

  return NextResponse.json({ notes });
}

// Добавление заметки
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    if (!ADMIN_TYPES.includes((session.user as SessionUser).type as string)) {
      return NextResponse.json({ error: "Нет прав" }, { status: 403 });
    }
    const adminId = (session.user as SessionUser).id as string;
    const adminUsername = (session.user as SessionUser).username as string | undefined;

    const { id } = await params;
    const company = await prisma.company.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
    if (!company) {
      return NextResponse.json({ error: "Компания не найдена" }, { status: 404 });
    }

    let body: { text?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Некорректный формат запроса" }, { status: 400 });
    }

    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) {
      return NextResponse.json({ error: "Текст заметки не может быть пустым" }, { status: 400 });
    }
    if (text.length > 1000) {
      return NextResponse.json({ error: "Заметка слишком длинная (до 1000 символов)" }, { status: 400 });
    }

    const note = await prisma.companyNote.create({
      data: { companyId: id, text },
      select: { id: true, text: true, createdAt: true },
    });

    await logAdminAction({
      adminId,
      adminName: adminUsername ?? adminId,
      action: "billing",
      entityType: "company",
      entityId: id,
      payload: { company: company.name, note: text.slice(0, 200) },
    });

    return NextResponse.json({ success: true, note });
  } catch {
    return NextResponse.json({ error: "Не удалось добавить заметку" }, { status: 500 });
  }
}
