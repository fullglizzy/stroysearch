import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/types";
import { logAdminAction } from "@/lib/audit";

const ADMIN_TYPES = ["SUPER", "ROOT"];

// Удаление заметки администратора о компании
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; noteId: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    if (!ADMIN_TYPES.includes((session.user as SessionUser).type as string)) {
      return NextResponse.json({ error: "Нет прав" }, { status: 403 });
    }
    const adminId = (session.user as SessionUser).id as string;
    const adminUsername = (session.user as SessionUser).username as string | undefined;

    const { id, noteId } = await params;
    const note = await prisma.companyNote.findUnique({
      where: { id: noteId },
      select: { id: true, companyId: true },
    });
    if (!note || note.companyId !== id) {
      return NextResponse.json({ error: "Заметка не найдена" }, { status: 404 });
    }

    await prisma.companyNote.delete({ where: { id: noteId } });

    await logAdminAction({
      adminId,
      adminName: adminUsername ?? adminId,
      action: "billing",
      entityType: "company",
      entityId: id,
      payload: { noteId },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Не удалось удалить заметку" }, { status: 500 });
  }
}
