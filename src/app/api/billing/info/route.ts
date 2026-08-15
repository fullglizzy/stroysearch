import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Реквизиты организации для печатного вида счёта.
// Доступны любому авторизованному — пользователь должен видеть,
// куда переводить оплату по своему счёту.
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const [config, termsDoc] = await Promise.all([
    prisma.billingConfig.findUnique({ where: { id: "default" } }),
    // Дата публикации оферты для поля «Основание» в печатном виде счёта
    prisma.legalDocument.findUnique({
      where: { key: "terms" },
      select: { updatedAt: true },
    }),
  ]);

  return NextResponse.json({
    organizationName: config?.organizationName || null,
    organizationInn: config?.organizationInn || null,
    organizationKpp: config?.organizationKpp || null,
    organizationAddress: config?.organizationAddress || null,
    bankName: config?.bankName || null,
    bankBik: config?.bankBik || null,
    bankAccount: config?.bankAccount || null,
    bankCorrAccount: config?.bankCorrAccount || null,
    directorName: config?.directorName || null,
    signatureImage: config?.signatureImage || null,
    stampImage: config?.stampImage || null,
    vatRate: config?.vatRate ? config.vatRate.toNumber() : 0,
    invoiceBasis: config?.invoiceBasis || null,
    offerDate: termsDoc?.updatedAt?.toISOString() || null,
  });
}
