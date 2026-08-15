import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const STAFF_TYPES = ["MODERATOR", "EDITOR", "SUPER", "ROOT"];

// Полный счёт с позициями — для печатного вида.
// Доступ: владелец счёта или сотрудник (для просмотра из тикета поддержки).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const userId = (session.user as any).id;
  const userType = (session.user as any).type as string;
  const isStaff = STAFF_TYPES.includes(userType);

  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      items: { orderBy: { id: "asc" } },
      user: {
        select: {
          username: true,
          ownedCompany: {
            select: { name: true, legalAddress: true },
          },
          profile: {
            select: { nick: true, inn: true, kpp: true, legalAddress: true, regions: true, companyName: true, firstName: true, lastName: true, middleName: true },
          },
        },
      },
    },
  });

  if (!invoice || (invoice.userId !== userId && !isStaff)) {
    return NextResponse.json({ error: "Счёт не найден" }, { status: 404 });
  }

  const profile = invoice.user.profile;
  const ownedCompany = invoice.user.ownedCompany;

  // Юр.лицо/ИП — по ИНН в профиле; физ.лицо — по ФИО
  const buyerKind = profile?.inn ? "company" : "individual";
  const buyerName =
    buyerKind === "company"
      ? profile?.companyName || ownedCompany?.name || profile?.nick || invoice.user.username
      : [profile?.firstName, profile?.lastName, profile?.middleName].filter(Boolean).join(" ").trim() ||
        profile?.nick ||
        invoice.user.username;

  return NextResponse.json({
    invoice: {
      id: invoice.id,
      number: invoice.number,
      date: invoice.date,
      dueDate: invoice.dueDate,
      status: invoice.status,
      kind: invoice.kind,
      subtotal: invoice.subtotal.toNumber(),
      discount: invoice.discount.toNumber(),
      total: invoice.total.toNumber(),
      limit: invoice.limit.toNumber(),
      buyerName,
      buyerKind,
      buyerUserId: invoice.userId,
      buyerInn: profile?.inn || null,
      buyerKpp: profile?.kpp || null,
      buyerAddress:
        profile?.legalAddress ||
        ownedCompany?.legalAddress ||
        profile?.regions?.split(",").map((r) => r.trim()).filter(Boolean)[0] ||
        null,
      items: invoice.items.map((it) => ({
        description: it.description,
        quantity: it.quantity,
        unitPrice: it.unitPrice.toNumber(),
        total: it.total.toNumber(),
      })),
    },
  });
}
