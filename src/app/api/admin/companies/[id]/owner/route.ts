import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/types";
import * as argon2 from "@node-rs/argon2";
import { logAdminAction } from "@/lib/audit";
import { notifyUser } from "@/lib/notifications";
import { companySearchText } from "@/lib/company";

const ADMIN_TYPES = ["SUPER", "ROOT"];

const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,30}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Создание владельца компании: новый аккаунт с логином и паролем
// (пароль отдаётся один раз). Режим привязки существующего пользователя
// убран — владелец получает доступ через создание аккаунта или ссылку.
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
      select: { id: true, inn: true, name: true, email: true, ownerUserId: true },
    });
    if (!company) {
      return NextResponse.json({ error: "Компания не найдена" }, { status: 404 });
    }
    if (company.ownerUserId) {
      return NextResponse.json({ error: "У компании уже есть владелец" }, { status: 400 });
    }

    let body: { mode?: unknown; username?: unknown; email?: unknown; password?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Некорректный формат запроса" }, { status: 400 });
    }

    if (body.mode !== "create") {
      return NextResponse.json({ error: "Укажите режим: create" }, { status: 400 });
    }

    const username = String(body.username ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = typeof body.password === "string" && body.password.length >= 8
      ? body.password
      : randomBytes(9).toString("base64url");

    if (!USERNAME_RE.test(username)) {
      return NextResponse.json({ error: "Некорректный логин (3–30 символов: буквы, цифры, точка, минус, подчёркивание)" }, { status: 400 });
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Некорректный email" }, { status: 400 });
    }

    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ username }, { email }] },
      select: { username: true, email: true },
    });
    if (existingUser) {
      return NextResponse.json({
        error:
          existingUser.username === username
            ? "Пользователь с таким логином уже существует"
            : "Пользователь с таким email уже существует",
      }, { status: 400 });
    }

    const pwdHash = await argon2.hash(password);

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          username,
          email,
          pwdHash,
          status: "ACTIVE",
          type: "COMPANY",
          profile: {
            create: { nick: username, inn: company.inn, companyName: company.name },
          },
          serviceFields: { create: {} },
          wallet: { create: { balance: 0 } },
        },
      });
      await tx.company.update({
        where: { id },
        data: { ownerUserId: created.id, searchText: companySearchText(company.name, company.inn) },
      });
      await tx.companyBilling.upsert({
        where: { companyId: id },
        update: { status: "ACTIVE" },
        create: { companyId: id, status: "ACTIVE", billingStartedAt: new Date() },
      });
      return created;
    });

    await logAdminAction({
      adminId,
      adminName: adminUsername ?? adminId,
      action: "billing",
      entityType: "company",
      entityId: id,
      payload: { company: company.name, mode, username },
    });

    await notifyUser({
      userId: user.id,
      type: "INVOICE",
      title: "Компания привязана к вашему аккаунту",
      message: `Ваш аккаунт привязан к компании «${company.name}». С этого момента действует тариф платформы: абонентская плата и плата за просмотры контактов.`,
      link: "/company/finances",
    });

    return NextResponse.json({
      success: true,
      mode,
      credentials: { username, password },
      notice: "Пароль показывается только один раз — передайте его владельцу компании",
    });
  } catch {
    return NextResponse.json({ error: "Не удалось выдать доступ" }, { status: 500 });
  }
}
