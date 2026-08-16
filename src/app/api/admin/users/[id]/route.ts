import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/types";

/**
 * Полная информация об аккаунте для попапа админ-панели.
 * Доступно только SUPER и ROOT.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const userType = (session.user as SessionUser).type;
  if (!["SUPER", "ROOT"].includes(userType)) {
    return NextResponse.json({ error: "Нет прав" }, { status: 403 });
  }

  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "Некорректный идентификатор пользователя" }, { status: 400 });
  }

  const [user, banLogs] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      include: {
        profile: { include: { roles: true } },
        serviceFields: true,
        wallet: true,
        admin: true,
        ownedCompany: { include: { metrics: true } },
        _count: {
          select: {
            givenReviews: true,
            receivedReviews: true,
            documents: true,
            conferences: true,
            products: true,
          },
        },
      },
    }),
    prisma.banLog.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  if (!user) {
    return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
  }

  return NextResponse.json({
    id: user.id,
    username: user.username,
    email: user.email,
    phone: user.phone,
    status: user.status,
    type: user.type,
    createdAt: user.createdAt,
    deletedAt: user.deletedAt,
    banReason: user.serviceFields?.banReason ?? null,
    banHistory: banLogs.map((b) => ({
      action: b.action,
      reason: b.reason,
      adminId: b.adminId,
      createdAt: b.createdAt,
    })),
    isEmailVerified: user.serviceFields?.isEmailVerified ?? false,
    isPhoneVerified: user.serviceFields?.isPhoneVerified ?? false,
    balance: user.wallet ? user.wallet.balance.toNumber() : 0,
    profile: user.profile
      ? {
          firstName: user.profile.firstName,
          lastName: user.profile.lastName,
          middleName: user.profile.middleName,
          nick: user.profile.nick,
          regions: user.profile.regions,
          inn: user.profile.inn,
          companyName: user.profile.companyName,
          kpp: user.profile.kpp,
          legalAddress: user.profile.legalAddress,
          directorName: user.profile.directorName,
          isContactsHidden: user.profile.isContactsHidden,
          roles: user.profile.roles.map((r) => r.role),
        }
      : null,
    company: user.ownedCompany
      ? {
          id: user.ownedCompany.id,
          inn: user.ownedCompany.inn,
          name: user.ownedCompany.name,
          phone: user.ownedCompany.phone,
          email: user.ownedCompany.email,
          website: user.ownedCompany.website,
          regions: user.ownedCompany.regions,
          metrics: user.ownedCompany.metrics
            ? {
                phoneViews: user.ownedCompany.metrics.phoneViews,
                emailViews: user.ownedCompany.metrics.emailViews,
                websiteViews: user.ownedCompany.metrics.websiteViews,
                ratingViews: user.ownedCompany.metrics.ratingViews,
                reviewsViews: user.ownedCompany.metrics.reviewsViews,
              }
            : null,
        }
      : null,
    admin: user.admin
      ? { adminType: user.admin.adminType, permissions: user.admin.permissions }
      : null,
    stats: {
      givenReviews: user._count.givenReviews,
      receivedReviews: user._count.receivedReviews,
      documents: user._count.documents,
      conferences: user._count.conferences,
      products: user._count.products,
    },
  });
}
