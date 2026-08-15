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
          profile: {
            select: { nick: true, inn: true, kpp: true, legalAddress: true, regions: true, companyName: true },
          },
        },
      },
    },
  });

  if (!invoice || (invoice.userId !== userId && !isStaff)) {
    return NextResponse.json({ error: "Счёт не найден" }, { status: 404 });
  }

  return NextResponse.json({
    invoice: {
      id: invoice.id,
      number: invoice.number,
      date: invoice.date,
      dueDate: invoice.dueDate,
      status: invoice.status,
      subtotal: invoice.subtotal.toNumber(),
      discount: invoice.discount.toNumber(),
      total: invoice.total.toNumber(),
      limit: invoice.limit.toNumber(),
      buyerName: invoice.user.profile?.companyName || invoice.user.profile?.nick || invoice.user.username,
      buyerInn: invoice.user.profile?.inn || null,
      buyerKpp: invoice.user.profile?.kpp || null,
      buyerAddress:
        invoice.user.profile?.legalAddress ||
        invoice.user.profile?.regions?.split(",").map((r) => r.trim()).filter(Boolean)[0] ||
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
