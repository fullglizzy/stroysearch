import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/types";
import { logAdminAction } from "@/lib/audit";

const ADMIN_TYPES = ["SUPER", "ROOT"];

// Строки шаблонов документов (счёт за обслуживание и метрики, акт, счёт на монеты)
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  if (!ADMIN_TYPES.includes((session.user as SessionUser).type as string)) {
    return NextResponse.json({ error: "Нет прав" }, { status: 403 });
  }

  const lines = await prisma.docTemplateLine.findMany({
    orderBy: [{ docKind: "asc" }, { sortOrder: "asc" }],
    select: {
      id: true,
      docKind: true,
      code: true,
      label: true,
      description: true,
      enabled: true,
      sortOrder: true,
    },
  });

  return NextResponse.json({ lines });
}

// Сохранение отредактированных строк шаблонов
export async function PUT(request: Request) {
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

    let body: { lines?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Некорректный формат запроса" }, { status: 400 });
    }

    if (!Array.isArray(body.lines) || body.lines.length === 0) {
      return NextResponse.json({ error: "Нет строк для сохранения" }, { status: 400 });
    }

    const lines: { id: string; description: string; enabled: boolean }[] = [];
    for (const raw of body.lines) {
      if (typeof raw !== "object" || raw === null) {
        return NextResponse.json({ error: "Некорректная строка шаблона" }, { status: 400 });
      }
      const item = raw as Record<string, unknown>;
      const id = typeof item.id === "string" ? item.id : "";
      const description = typeof item.description === "string" ? item.description.trim() : "";
      const enabled = typeof item.enabled === "boolean" ? item.enabled : true;
      if (!id || !description) {
        return NextResponse.json({ error: "У строки шаблона должны быть id и текст" }, { status: 400 });
      }
      if (description.length > 1000) {
        return NextResponse.json({ error: "Текст строки слишком длинный (до 1000 символов)" }, { status: 400 });
      }
      lines.push({ id, description, enabled });
    }

    await prisma.$transaction(
      lines.map((l) =>
        prisma.docTemplateLine.updateMany({
          where: { id: l.id },
          data: { description: l.description, enabled: l.enabled },
        }),
      ),
    );

    await logAdminAction({
      adminId,
      adminName: adminUsername ?? adminId,
      action: "billing",
      entityType: "doc_template_line",
      entityId: undefined,
      payload: { lines: lines.map((l) => ({ id: l.id, enabled: l.enabled })) },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Не удалось сохранить шаблоны" }, { status: 500 });
  }
}
