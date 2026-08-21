import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/types";
import { logAdminAction } from "@/lib/audit";

const ADMIN_TYPES = ["SUPER", "ROOT"];
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 дней

// Одноразовая ссылка-приглашение для передачи карточки компании владельцу.
// Без автоотправки: админ копирует ссылку и передаёт её сам.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
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

    const { id } = await params;
    const company = await prisma.company.findUnique({
      where: { id },
      select: { id: true, name: true, inn: true, ownerUserId: true },
    });
    if (!company) {
      return NextResponse.json({ error: "Компания не найдена" }, { status: 404 });
    }
    if (company.ownerUserId) {
      return NextResponse.json({ error: "У компании уже есть владелец" }, { status: 400 });
    }

    const token = randomBytes(24).toString("hex");
    await prisma.companyInvite.create({
      data: {
        companyId: id,
        token,
        createdById: adminId,
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      },
    });

    await logAdminAction({
      adminId,
      adminName: adminUsername ?? adminId,
      action: "billing",
      entityType: "company",
      entityId: id,
      payload: { company: company.name, action: "create_invite" },
    });

    // За reverse-proxy request.url указывает на localhost — публичный адрес берём из env
    const origin = (process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin).replace(/\/+$/, "");
    return NextResponse.json({
      success: true,
      inviteUrl: `${origin}/register/company?invite=${token}`,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      notice: "Ссылка одноразовая, срок действия 7 дней. Передайте её владельцу компании вручную.",
    });
  } catch {
    return NextResponse.json({ error: "Не удалось создать приглашение" }, { status: 500 });
  }
}

// Активные приглашения компании
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  if (!ADMIN_TYPES.includes((session.user as SessionUser).type as string)) {
    return NextResponse.json({ error: "Нет прав" }, { status: 403 });
  }

  const { id } = await params;
  const invites = await prisma.companyInvite.findMany({
    where: { companyId: id },
    orderBy: { createdAt: "desc" },
    select: {
      token: true,
      expiresAt: true,
      usedAt: true,
      createdAt: true,
      createdBy: { select: { username: true } },
    },
  });

  return NextResponse.json({
    invites: invites.map((i) => ({
      token: i.token,
      expiresAt: i.expiresAt,
      usedAt: i.usedAt,
      createdAt: i.createdAt,
      createdBy: i.createdBy?.username ?? null,
    })),
  });
}
