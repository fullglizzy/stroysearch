import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/types";

const ADMIN_TYPES = ["SUPER", "ROOT"];

// KPI вкладки «Финансы»: суммы по статусам, просрочка, компании, просмотры
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  if (!ADMIN_TYPES.includes((session.user as SessionUser).type as string)) {
    return NextResponse.json({ error: "Нет прав" }, { status: 403 });
  }

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const [billingTotals, monthTotals, overdueCount, overdueSum, companyStats, viewsMonth] =
    await Promise.all([
      // Суммы за всё время по статусам
      prisma.invoice.groupBy({
        by: ["status"],
        where: { kind: "BILLING" },
        _sum: { total: true },
        _count: { id: true },
      }),
      // Сумма выставленного за текущий месяц
      prisma.invoice.aggregate({
        where: { kind: "BILLING", createdAt: { gte: monthStart } },
        _sum: { total: true },
        _count: { id: true },
      }),
      prisma.invoice.count({ where: { kind: "BILLING", status: "OVERDUE" } }),
      prisma.invoice.aggregate({
        where: { kind: "BILLING", status: "OVERDUE" },
        _sum: { total: true },
      }),
      prisma.companyBilling.groupBy({
        by: ["status"],
        _count: { companyId: true },
      }),
      prisma.companyViewEvent.count({ where: { createdAt: { gte: monthStart } } }),
    ]);

  const noOwnerCompanies = await prisma.company.count({ where: { ownerUserId: null } });

  const byStatus = Object.fromEntries(billingTotals.map((g) => [g.status, { count: g._count.id, sum: g._sum.total?.toNumber() ?? 0 }]));
  const billingByStatus = Object.fromEntries(companyStats.map((g) => [g.status, g._count.companyId]));
  // Неоплаченное: черновики + выставленные + просроченные
  const debt =
    (byStatus.DRAFT?.sum ?? 0) + (byStatus.SENT?.sum ?? 0) + (byStatus.OVERDUE?.sum ?? 0);

  return NextResponse.json({
    byStatus,
    debt,
    month: {
      createdCount: monthTotals._count.id,
      createdSum: monthTotals._sum.total?.toNumber() ?? 0,
    },
    overdue: { count: overdueCount, sum: overdueSum._sum.total?.toNumber() ?? 0 },
    companies: {
      active: billingByStatus.ACTIVE ?? 0,
      hidden: billingByStatus.HIDDEN ?? 0,
      inactive: billingByStatus.INACTIVE ?? 0,
      noOwner: noOwnerCompanies,
    },
    viewsMonth,
  });
}
