import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/types";

const ADMIN_TYPES = ["SUPER", "ROOT"];

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
    }
    const userType = (session.user as SessionUser).type;
    if (!ADMIN_TYPES.includes(userType)) {
      return NextResponse.json({ error: "Нет прав" }, { status: 403 });
    }

    const { id } = await params;

    const claim = await prisma.giftClaim.findUnique({ where: { id } });
    if (!claim) {
      return NextResponse.json({ error: "Заявка не найдена" }, { status: 404 });
    }
    if (claim.issuedAt) {
      return NextResponse.json(
        { error: "Подарок уже отмечен как выданный" },
        { status: 400 },
      );
    }

    const updated = await prisma.giftClaim.update({
      where: { id },
      data: { issuedAt: new Date() },
    });

    return NextResponse.json({ success: true, issuedAt: updated.issuedAt });
  } catch {
    return NextResponse.json({ error: "Не удалось обновить заявку" }, { status: 500 });
  }
}
