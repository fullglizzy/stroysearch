import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getTreeSnapshotData, replaceTreeFromData } from "@/server/admin/tree";

const ALLOWED = ["SUPER", "ROOT"];

/**
 * Восстановление дерева из снимка (резервной копии).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }
  if (!ALLOWED.includes((session.user as { type?: string }).type ?? "")) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const { id } = await params;
  const snapshot = await getTreeSnapshotData(id);
  if (!snapshot) {
    return NextResponse.json({ error: "Снимок не найден" }, { status: 404 });
  }

  try {
    const items = await replaceTreeFromData(JSON.parse(snapshot.data));
    return NextResponse.json({ success: true, items });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Не удалось восстановить дерево" },
      { status: 400 },
    );
  }
}
