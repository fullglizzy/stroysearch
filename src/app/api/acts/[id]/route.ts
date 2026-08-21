import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/types";

const STAFF_TYPES = ["MODERATOR", "EDITOR", "SUPER", "ROOT"];

// Акт об оказанных услугах — владелец счёта или сотрудник (для печати в админке)
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const userId = (session.user as SessionUser).id as string;
  const userType = (session.user as SessionUser).type as string;
  const isStaff = STAFF_TYPES.includes(userType);

  const { id } = await params;

  const act = await prisma.serviceAct.findUnique({
    where: { id },
    include: {
      invoice: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              ownedCompany: {
                select: { name: true, inn: true, kpp: true, legalAddress: true },
              },
            },
          },
        },
      },
    },
  });

  if (!act || (act.invoice.userId !== userId && !isStaff)) {
    return NextResponse.json({ error: "Акт не найден" }, { status: 404 });
  }

  const items = JSON.parse(act.itemsJson) as {
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];

  return NextResponse.json({
    act: {
      id: act.id,
      number: act.number,
      date: act.date,
      total: act.total.toNumber(),
      invoiceNumber: act.invoice.number,
      periodFrom: act.invoice.periodFrom,
      periodTo: act.invoice.periodTo,
      items,
      company: act.invoice.user.ownedCompany
        ? {
            name: act.invoice.user.ownedCompany.name,
            inn: act.invoice.user.ownedCompany.inn,
            kpp: act.invoice.user.ownedCompany.kpp,
            legalAddress: act.invoice.user.ownedCompany.legalAddress,
          }
        : null,
      buyerName: act.invoice.user.username,
      buyerEmail: act.invoice.user.email,
    },
  });
}
