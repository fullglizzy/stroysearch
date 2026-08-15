import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { replaceTreeFromData } from "@/server/admin/tree";

const ALLOWED = ["SUPER", "ROOT"];

/**
 * Восстановление дерева из загруженного файла (JSON-экспорт).
 * Полная замена: узлы из файла upsert'ятся, отсутствующие мягко удаляются,
 * живое дерево перенумеровывается.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }
  if (!ALLOWED.includes((session.user as { type?: string }).type ?? "")) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный формат запроса" }, { status: 400 });
  }

  const data = (body as { data?: unknown } | null)?.data;
  if (data === undefined) {
    return NextResponse.json({ error: "Не переданы данные дерева" }, { status: 400 });
  }

  try {
    const items = await replaceTreeFromData(data);
    return NextResponse.json({ success: true, items });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Не удалось восстановить дерево" },
      { status: 400 },
    );
  }
}
