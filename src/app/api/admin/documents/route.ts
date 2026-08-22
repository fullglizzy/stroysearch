import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { readFile } from "fs/promises";
import path from "path";
import { extractText } from "unpdf";
import { LEGAL_DOC_KEYS } from "@/lib/legal-docs";
import {
  deleteLegalDocument,
  removeUploadedFile,
  upsertLegalDocument,
} from "@/server/admin/documents";

// Юридические документы — управляют только SUPER/ROOT
async function checkAccess() {
  const session = await auth();
  if (!session?.user) {
    return { error: "Требуется авторизация", status: 401 } as const;
  }
  const userType = session.user.type;
  if (!["SUPER", "ROOT"].includes(userType)) {
    return { error: "Нет прав", status: 403 } as const;
  }
  return null;
}

function isLegalKey(v: unknown): v is (typeof LEGAL_DOC_KEYS)[number] {
  return typeof v === "string" && LEGAL_DOC_KEYS.includes(v as never);
}

const MAX_TEXT_LENGTH = 200_000;

/** Извлекает текст из PDF в public/uploads; пустой результат — ошибка (скан) */
async function extractTextFromUploads(fileUrl: string): Promise<string> {
  const relative = fileUrl.replace(/^\/+/, "");
  const buffer = await readFile(path.join(process.cwd(), "public", relative));
  const { text } = await extractText(new Uint8Array(buffer), { mergePages: true });
  const trimmed = text.trim();
  if (!trimmed) throw new Error("PDF_NO_TEXT");
  return trimmed;
}

export async function POST(request: Request) {
  try {
    const denied = await checkAccess();
    if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status });

    let body: { key?: unknown; fileName?: unknown; fileUrl?: unknown; fileSize?: unknown; text?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Некорректный формат запроса" }, { status: 400 });
    }

    if (!isLegalKey(body.key)) {
      return NextResponse.json({ error: "Неизвестный тип документа" }, { status: 400 });
    }

    const fileName = typeof body.fileName === "string" ? body.fileName.trim() : null;
    const fileUrl = typeof body.fileUrl === "string" ? body.fileUrl : null;
    const fileSize = typeof body.fileSize === "number" ? Math.round(body.fileSize) : null;
    const text = typeof body.text === "string" ? body.text : null;

    const hasFile = fileName !== null || fileUrl !== null || fileSize !== null;
    const hasText = text !== null;
    if (!hasFile && !hasText) {
      return NextResponse.json({ error: "Нет данных для сохранения" }, { status: 400 });
    }

    if (hasFile) {
      if (!fileName) {
        return NextResponse.json({ error: "Имя файла обязательно" }, { status: 400 });
      }
      if (!fileUrl || !fileUrl.startsWith("/uploads/")) {
        return NextResponse.json({ error: "Некорректная ссылка на файл" }, { status: 400 });
      }
      if (fileSize === null || fileSize < 0) {
        return NextResponse.json({ error: "Некорректный размер файла" }, { status: 400 });
      }
    }
    if (hasText && text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json({ error: "Текст документа слишком длинный" }, { status: 400 });
    }

    // Текст извлекаем здесь (обычный Node-runtime маршрута), а не в server action
    let extractedText: string | null = null;
    if (hasFile) {
      try {
        extractedText = await extractTextFromUploads(fileUrl!);
      } catch {
        if (fileUrl) await removeUploadedFile(fileUrl);
        return NextResponse.json(
          {
            error:
              "Не удалось извлечь текст из PDF — возможно, это скан без текстового слоя. Введите текст документа вручную.",
          },
          { status: 400 },
        );
      }
    }

    const doc = await upsertLegalDocument(body.key, {
      fileName: hasFile ? fileName! : undefined,
      fileUrl: hasFile ? fileUrl! : undefined,
      fileSize: hasFile ? fileSize! : undefined,
      text: hasFile ? extractedText! : (text ?? undefined),
    });
    return NextResponse.json({
      success: true,
      doc: {
        fileName: doc.fileName,
        fileUrl: doc.fileUrl,
        fileSize: doc.fileSize,
        text: doc.text,
        updatedAt: doc.updatedAt,
      },
    });
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
