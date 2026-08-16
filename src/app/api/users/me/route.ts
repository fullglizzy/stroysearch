import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { profileSchema } from "@/lib/validators";
import type { SessionUser } from "@/types";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const userId = (session.user as SessionUser).id;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      profile: { include: { roles: true } },
    },
  });

  return NextResponse.json(user);
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const userId = (session.user as SessionUser).id;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный формат запроса" }, { status: 400 });
  }

  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректные данные" },
      { status: 400 },
    );
  }

  const {
    firstName,
    lastName,
    middleName,
    phone,
    website,
    regions,
    isContactsHidden,
    roles,
    classifierIds,
    companyName,
    kpp,
    legalAddress,
    directorName,
  } = parsed.data;

  const classifierIdsCsv = (classifierIds ?? []).join(",");
  const regionsCsv = (regions ?? []).join(",");

  // Нормализуем сайт: добавляем https://, если протокол не указан
  let normalizedWebsite: string | null = null;
  if (website && website.trim()) {
    normalizedWebsite = /^https?:\/\//i.test(website.trim())
      ? website.trim()
      : `https://${website.trim()}`;
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { phone: phone || null },
    });

    await prisma.userProfile.upsert({
      where: { userId },
      update: {
        firstName,
        lastName,
        middleName,
        regions: regionsCsv,
        isContactsHidden,
        classifierIds: classifierIdsCsv,
        companyName,
        kpp,
        legalAddress,
        directorName,
      },
      create: {
        userId,
        firstName,
        lastName,
        middleName,
        regions: regionsCsv,
        isContactsHidden,
        classifierIds: classifierIdsCsv,
        companyName,
        kpp,
        legalAddress,
        directorName,
      },
    });

    // Синхронизируем данные компании: Company — единственный источник данных
    // для публичного каталога поставщиков, поэтому пишем туда всё, что меняет
    // компания в профиле (раньше это оставалось только в UserProfile и терялось)
    if (
      website !== undefined ||
      regions !== undefined ||
      companyName !== undefined ||
      kpp !== undefined ||
      legalAddress !== undefined ||
      phone !== undefined ||
      classifierIds !== undefined
    ) {
      await prisma.company.updateMany({
        where: { ownerUserId: userId },
        data: {
          ...(website !== undefined ? { website: normalizedWebsite } : {}),
          ...(regions !== undefined ? { regions: regionsCsv } : {}),
          ...(companyName && companyName.trim() ? { name: companyName.trim() } : {}),
          ...(kpp !== undefined ? { kpp: kpp || null } : {}),
          ...(legalAddress !== undefined ? { legalAddress: legalAddress || null } : {}),
          ...(phone !== undefined ? { phone: phone || null } : {}),
          ...(classifierIds !== undefined ? { classifierIds: classifierIdsCsv } : {}),
        },
      });
    }

    // Обновляем роли (только если они переданы)
    if (roles !== undefined) {
      await prisma.userProfileRole.deleteMany({
        where: { profileId: userId },
      });

      if (roles.length > 0) {
        await prisma.userProfileRole.createMany({
          data: roles.map((role) => ({
            profileId: userId,
            role,
          })),
        });
      }
    }
  } catch (error) {
    // Уникальный конфликт — телефон уже занят другим пользователем
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "Этот телефон уже используется другим пользователем" },
        { status: 400 },
      );
    }
    throw error;
  }

  return NextResponse.json({ success: true });
}
