import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { addCompanySchema } from "@/lib/validators";
import { auth } from "@/lib/auth";
import { roundWalletBalance } from "@/lib/money";

export async function GET() {
  const companies = await prisma.company.findMany({
    include: {
      metrics: true,
      ownerUser: {
        select: { profile: { select: { nick: true } } },
      },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(companies);
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Некорректный формат запроса" }, { status: 400 });
    }

    const parsed = addCompanySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      );
    }

    const { inn, name, email, phone, website, region, classifierIds } = parsed.data;

    const existing = await prisma.company.findUnique({ where: { inn } });
    if (existing) {
      return NextResponse.json(
        { error: "Компания с таким ИНН уже существует" },
        { status: 409 },
      );
    }

    const userId = (session.user as any).id;

    // Нормализуем сайт: добавляем https://, если протокол не указан
    let normalizedWebsite: string | null = website?.trim() || null;
    if (normalizedWebsite && !/^https?:\/\//i.test(normalizedWebsite)) {
      normalizedWebsite = `https://${normalizedWebsite}`;
    }

    const company = await prisma.$transaction(async (tx) => {
      const created = await tx.company.create({
        data: {
          inn,
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          website: normalizedWebsite,
          region,
          classifierIds: classifierIds.join(","),
          addedById: userId,
          metrics: { create: {} },
        },
      });

      // Награда за добавление — в той же транзакции, что и создание
      const billingConfig = await tx.billingConfig.findUnique({
        where: { id: "default" },
      });
      const coinReward = billingConfig?.addCompanyCoins ? billingConfig.addCompanyCoins.toNumber() : 1;

      if (coinReward > 0) {
        const wallet = await tx.wallet.upsert({
          where: { userId },
          update: { balance: { increment: coinReward } },
          create: { userId, balance: coinReward },
        });
        await roundWalletBalance(tx, userId);
        await tx.transaction.create({
          data: {
            userId,
            type: "ADD_COMPANY",
            amount: coinReward,
            balanceAfter: wallet.balance.toDecimalPlaces(2),
            description: `Добавление компании ${inn}`,
            metadata: JSON.stringify({ companyId: created.id }),
          },
        });
      }

      return created;
    });

    return NextResponse.json({ success: true, id: company.id });
  } catch {
    return NextResponse.json(
      { error: "Не удалось добавить компанию. Попробуйте ещё раз" },
      { status: 500 },
    );
  }
}
