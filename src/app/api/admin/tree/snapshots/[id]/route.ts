import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { deleteTreeSnapshot, getTreeSnapshotData } from "@/server/admin/tree";

const ALLOWED = ["SUPER", "ROOT"];

function checkAuth(session: { user?: unknown } | null): boolean {
  if (!session?.user) return false;
  return ALLOWED.includes((session.user as { type?: string }).type ?? "");
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }
  if (!checkAuth(session)) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const { id } = await params;
  const snapshot = await getTreeSnapshotData(id);
  if (!snapshot) {
    return NextResponse.json({ error: "Снимок не найден" }, { status: 404 });
  }

  return NextResponse.json({
    snapshot: {
      id: snapshot.id,
      label: snapshot.label,
      nodeCount: snapshot.nodeCount,
      createdAt: snapshot.createdAt,
      data: snapshot.data,
    },
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }
  if (!checkAuth(session)) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const { id } = await params;
  try {
    await deleteTreeSnapshot(id);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Не удалось удалить снимок" },
      { status: 400 },
    );
  }
}
