import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ["application/pdf"];

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Файл не предоставлен" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Принимаются только PDF файлы" }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "Размер файла не должен превышать 10 МБ" }, { status: 400 });
    }

    // Generate unique filename
    const ext = ".pdf";
    const uniqueName = crypto.randomBytes(16).toString("hex") + ext;
    const uploadsDir = path.join(process.cwd(), "public", "uploads");

    // Ensure directory exists
    await mkdir(uploadsDir, { recursive: true });

    const filePath = path.join(uploadsDir, uniqueName);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    const fileUrl = `/uploads/${uniqueName}`;

    return NextResponse.json({
      success: true,
      fileUrl,
      fileSize: file.size,
      fileName: file.name,
    });
  } catch (e: any) {
    return NextResponse.json({ error: "Ошибка загрузки файла" }, { status: 500 });
  }
}
