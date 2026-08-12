import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { addCompanySchema } from "@/lib/validators";
import { auth } from "@/lib/auth";

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

    const company = await prisma.company.create({
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

    // Award coins
    const billingConfig = await prisma.billingConfig.findUnique({
      where: { id: "default" },
    });
    const coinReward = billingConfig?.addCompanyCoins ?? 1;

    await prisma.wallet.update({
      where: { userId },
      data: { balance: { increment: coinReward } },
    });

    await prisma.transaction.create({
      data: {
        userId,
        type: "ADD_COMPANY",
        amount: coinReward,
        balanceAfter: (
          await prisma.wallet.findUnique({ where: { userId } })
        )!.balance,
        description: `Добавление компании ${inn}`,
      },
    });

    return NextResponse.json({ success: true, id: company.id });
  } catch {
    return NextResponse.json(
      { error: "Не удалось добавить компанию. Попробуйте ещё раз" },
      { status: 500 },
    );
  }
}
