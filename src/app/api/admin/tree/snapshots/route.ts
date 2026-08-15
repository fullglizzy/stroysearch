import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createTreeSnapshot, getTreeSnapshots } from "@/server/admin/tree";

const ALLOWED = ["SUPER", "ROOT"];

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }
  if (!ALLOWED.includes((session.user as { type?: string }).type ?? "")) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const snapshots = await getTreeSnapshots();
  return NextResponse.json({ snapshots });
}

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

  const label = (body as { label?: unknown } | null)?.label;
  const userId = (session.user as { id: string }).id;

  try {
    const snapshot = await createTreeSnapshot(
      typeof label === "string" && label.trim() ? label.trim() : null,
      userId,
    );
    return NextResponse.json({ success: true, id: snapshot.id });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Не удалось создать снимок" },
      { status: 500 },
    );
  }
}
