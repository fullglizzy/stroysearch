import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

// В production Next.js раздаёт только файлы public/, существовавшие на момент
// сборки. Загруженные в рантайме файлы из public/uploads отдаём сами.
const MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".txt": "text/plain",
  ".zip": "application/zip",
};

// Имена генерирует /api/upload: 32 hex-символа + расширение
const SAFE_NAME = /^[a-f0-9]{32}\.(pdf|png|jpe?g|webp|gif|docx?|xlsx?|txt|zip)$/;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;

  if (!SAFE_NAME.test(name)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const dir = path.join(process.cwd(), "public", "uploads");
  const filePath = path.resolve(dir, name);

  // Защита от выхода за пределы папки uploads
  if (!filePath.startsWith(dir + path.sep)) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const data = await readFile(filePath);
    const ext = path.extname(name).toLowerCase();
    return new NextResponse(data, {
      headers: {
        "Content-Type": MIME[ext] || "application/octet-stream",
        // Имена уникальны (случайный hex) — можно кэшировать навсегда
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
