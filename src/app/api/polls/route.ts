import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pollSchema } from "@/lib/validators";
import { isLiveTreeItem } from "@/server/admin/tree";

const ADMIN_TYPES = ["MODERATOR", "EDITOR", "SUPER", "ROOT"];

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  // Создавать опросы (и назначать награду) могут только сотрудники
  const userType = session.user.type;
  if (!ADMIN_TYPES.includes(userType)) {
    return NextResponse.json({ error: "Нет прав" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = pollSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  if (parsed.data.treeItemId && !(await isLiveTreeItem(parsed.data.treeItemId))) {
    return NextResponse.json(
      { error: "Раздел классификатора не найден или удалён" },
      { status: 400 },
    );
  }

  const poll = await prisma.poll.create({
    data: {
      question: parsed.data.question,
      treeItemId: parsed.data.treeItemId || null,
      pollType: parsed.data.pollType,
      coinReward: parsed.data.coinReward,
      options: {
        create: parsed.data.options.map((o) => ({
          text: o.text,
          sortOrder: o.sortOrder,
        })),
      },
    },
  });

  return NextResponse.json({ success: true, id: poll.id });
}
