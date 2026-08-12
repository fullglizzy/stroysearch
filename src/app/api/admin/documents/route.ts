import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { LEGAL_DOC_KEYS } from "@/lib/legal-docs";
import {
  deleteLegalDocument,
  upsertLegalDocument,
} from "@/server/admin/documents";

// Юридические документы — управляют только SUPER/ROOT
async function checkAccess() {
  const session = await auth();
  if (!session?.user) {
    return { error: "Требуется авторизация", status: 401 } as const;
  }
  const userType = (session.user as any).type as string;
  if (!["SUPER", "ROOT"].includes(userType)) {
    return { error: "Нет прав", status: 403 } as const;
  }
  return null;
}

function isLegalKey(v: unknown): v is (typeof LEGAL_DOC_KEYS)[number] {
  return typeof v === "string" && LEGAL_DOC_KEYS.includes(v as never);
}

export async function POST(request: Request) {
  try {
    const denied = await checkAccess();
    if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status });

    let body: { key?: unknown; fileName?: unknown; fileUrl?: unknown; fileSize?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Некорректный формат запроса" }, { status: 400 });
    }

    if (!isLegalKey(body.key)) {
      return NextResponse.json({ error: "Неизвестный тип документа" }, { status: 400 });
    }
    if (typeof body.fileName !== "string" || !body.fileName.trim()) {
      return NextResponse.json({ error: "Имя файла обязательно" }, { status: 400 });
    }
    if (typeof body.fileUrl !== "string" || !body.fileUrl.startsWith("/uploads/")) {
      return NextResponse.json({ error: "Некорректная ссылка на файл" }, { status: 400 });
    }
    if (typeof body.fileSize !== "number" || body.fileSize < 0) {
      return NextResponse.json({ error: "Некорректный размер файла" }, { status: 400 });
    }

    const doc = await upsertLegalDocument(
      body.key,
      body.fileName.trim(),
      body.fileUrl,
      Math.round(body.fileSize),
    );
    return NextResponse.json({ success: true, doc });
  } catch {
    return NextResponse.json({ error: "Не удалось сохранить документ" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const denied = await checkAccess();
    if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status });

    let body: { key?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Некорректный формат запроса" }, { status: 400 });
    }

    if (!isLegalKey(body.key)) {
      return NextResponse.json({ error: "Неизвестный тип документа" }, { status: 400 });
    }

    await deleteLegalDocument(body.key);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Не удалось удалить документ" }, { status: 500 });
  }
}
