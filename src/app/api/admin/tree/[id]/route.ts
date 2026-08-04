import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  updateTreeItem,
  deleteTreeItem,
  restoreTreeItem,
  moveTreeItem,
} from "@/server/admin/tree";

// PATCH — обновить узел
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userType = (session.user as any).type as string;
  if (!["MODERATOR", "EDITOR", "SUPER", "ROOT"].includes(userType)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await req.json();

    // Обработка перемещения
    if (body.action === "move") {
      const item = await moveTreeItem(id, body.newParentId ?? null, body.newPosition);
      return NextResponse.json(item);
    }

    // Обработка восстановления
    if (body.action === "restore") {
      const item = await restoreTreeItem(id);
      return NextResponse.json(item);
    }

    // Обычное обновление
    const item = await updateTreeItem(id, {
      name: body.name,
      description: body.description,
      bannerUrl: body.bannerUrl,
      parentId: body.parentId,
      position: body.position,
    });
    return NextResponse.json(item);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

// DELETE — мягкое удаление
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userType = (session.user as any).type as string;
  if (!["MODERATOR", "EDITOR", "SUPER", "ROOT"].includes(userType)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await deleteTreeItem(id);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
