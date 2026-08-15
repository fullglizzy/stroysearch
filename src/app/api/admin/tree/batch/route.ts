import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { applyTreeOperations, type TreeOperation } from "@/server/admin/tree";

const VALID_TYPES = ["create", "update", "move", "delete", "restore"] as const;

/**
 * Атомарное применение батча операций над деревом решений.
 * Все операции выполняются в одной транзакции, после чего дерево
 * перенумеровывается целиком.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userType = (session.user as { type?: string }).type as string;
  if (!["MODERATOR", "EDITOR", "SUPER", "ROOT"].includes(userType)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный формат запроса" }, { status: 400 });
  }

  const operations = (body as { operations?: unknown } | null)?.operations;
  if (!Array.isArray(operations) || operations.length === 0) {
    return NextResponse.json({ error: "Пустой список операций" }, { status: 400 });
  }

  for (const op of operations as Partial<TreeOperation>[]) {
    if (!op || typeof op.type !== "string" || !(VALID_TYPES as readonly string[]).includes(op.type)) {
      return NextResponse.json({ error: "Некорректная операция" }, { status: 400 });
    }
    if (op.type !== "create" && typeof op.id !== "string") {
      return NextResponse.json({ error: "Не указан id узла" }, { status: 400 });
    }
    if (op.type === "create" && typeof op.name !== "string") {
      return NextResponse.json({ error: "Не указано название узла" }, { status: 400 });
    }
  }

  try {
    const items = await applyTreeOperations(operations as TreeOperation[]);
    return NextResponse.json({ success: true, items });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Не удалось применить изменения" },
      { status: 400 },
    );
  }
}
