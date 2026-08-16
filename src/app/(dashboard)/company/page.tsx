import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { PageBanner } from "@/components/shared/PageBanner";
import { getPageContent } from "@/server/admin/content";
import { computeRating } from "@/lib/rating";
import { Package, FileText, Calendar, Star, Coins, Wallet, ArrowRight, LifeBuoy, Banknote } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CompanyDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userId = (session.user as any).id as string;

  const [supportTickets, wallet, productsCount, payoutSum, receivedReviews, pageContent] =
    await Promise.all([
      prisma.supportTicket.findMany({
        where: { userId },
        include: { messages: { select: { id: true, isStaff: true, createdAt: true } } },
      }),
      prisma.wallet.findUnique({ where: { userId } }),
      prisma.product.count({ where: { ownerUserId: userId, deletedAt: null } }),
      prisma.invoice.aggregate({
        where: {
          userId,
          kind: { in: ["PAYOUT", "ACTIVITY"] },
          status: { notIn: ["PAID", "CANCELLED", "SKIPPED"] },
        },
        _sum: { total: true },
      }),
      prisma.review.findMany({
        where: { targetId: userId },
        select: { weightedAverage: true },
      }),
      getPageContent("company"),
    ]);

  const supportUnread = supportTickets.filter((t) =>
    t.messages.some((m) => m.isStaff && (!t.userLastReadAt || m.createdAt > t.userLastReadAt)),
  ).length;

  const walletBalance = wallet ? wallet.balance.toNumber() : 0;
  const rating = computeRating(receivedReviews);
  const payoutTotal = payoutSum._sum.total ? payoutSum._sum.total.toNumber() : 0;

  const stats = [
    { href: "/company/finances", icon: Wallet, value: `${walletBalance.toFixed(1)} монет`, label: "Баланс" },
    { href: "/company/products", icon: Package, value: String(productsCount), label: "Активных товаров" },
    { href: "/company/reviews", icon: Star, value: rating !== null ? `★ ${rating.toFixed(1)}` : "—", label: "Рейтинг компании" },
    { href: "/company/payouts", icon: Banknote, value: `${payoutTotal.toFixed(2)} ₽`, label: "К выплате" },
  ];

  return (
    <div className="container-page py-8">
      <h1 className="text-3xl font-bold mb-2">Личный кабинет компании</h1>
      <p className="text-muted-foreground mb-8">Управление товарами, конференциями и документами</p>

      {/* Сводка */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map((s) => (
          <Link key={s.href} href={s.href}>
            <Card className="h-full hover:shadow-md hover:border-menthol/50 transition-all cursor-pointer">
              <CardContent className="text-center">
                <s.icon className="h-6 w-6 text-menthol mx-auto mb-2" />
                <div className="text-2xl font-bold">{s.value}</div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Баннер */}
      {pageContent?.bannerUrl && (
        <PageBanner url={pageContent.bannerUrl} alt="Баннер личного кабинета компании" />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { href: "/company/products", icon: Package, title: "Мои товары и услуги", desc: "Добавление и управление продуктами в матрице материалов", color: "text-menthol" },
          { href: "/company/conferences", icon: Calendar, title: "Мои конференции", desc: "Презентация продуктов, проведение лекций", color: "text-menthol" },
          { href: "/company/library", icon: FileText, title: "Моя библиотека", desc: "Загрузка технических заданий и спецификаций", color: "text-menthol" },
          { href: "/company/reviews", icon: Star, title: "Мои отзывы", desc: "Отзывы о компании и поставках", color: "text-orange-accent" },
          { href: "/company/finances", icon: Coins, title: "Мои финансы", desc: "Баланс монет, счета и подарки", color: "text-orange-accent" },
          { href: "/company/payouts", icon: Coins, title: "Мои выплаты", desc: "Счета на выплату за просмотры контактов", color: "text-menthol" },
          { href: "/company/profile", icon: Package, title: "Личные данные", desc: "Профиль компании, ИНН, контакты", color: "text-menthol" },
          { href: "/company/support", icon: LifeBuoy, title: "Поддержка", desc: "Обращения и переписка со службой поддержки", color: "text-menthol", badge: supportUnread },
        ].map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="h-full hover:shadow-md hover:border-menthol/50 transition-all cursor-pointer">
              <CardContent>
                <item.icon className={`h-8 w-8 ${item.color} mb-3`} />
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold mb-1">{item.title}</h3>
                  {item.badge ? (
                    <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-orange-accent text-white text-xs font-medium mb-1">
                      {item.badge}
                    </span>
                  ) : null}
                </div>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
                <ArrowRight className="h-4 w-4 text-muted-foreground mt-3" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
