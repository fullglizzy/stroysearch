import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAllTreeItems, createTreeItem } from "@/server/admin/tree";
import { getErrorMessage } from "@/lib/utils";

// GET — получить все узлы дерева (включая удалённые для админа)
export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userType = session.user.type;
  if (!["MODERATOR", "EDITOR", "SUPER", "ROOT"].includes(userType)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const items = await getAllTreeItems(true); // включаем удалённые
    return NextResponse.json(items);
  } catch (e) {
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 500 });
  }
}

// POST — создать новый узел
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userType = session.user.type;
  if (!["MODERATOR", "EDITOR", "SUPER", "ROOT"].includes(userType)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const item = await createTreeItem({
      name: body.name,
      parentId: body.parentId || null,
      description: body.description || null,
      bannerUrl: body.bannerUrl || null,
      position: body.position,
    });
    return NextResponse.json(item, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 400 });
  }
}
