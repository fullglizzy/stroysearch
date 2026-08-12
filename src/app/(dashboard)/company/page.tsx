import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Package, FileText, Calendar, Star, Coins, ArrowRight, LifeBuoy } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CompanyDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userId = (session.user as any).id as string;

  const supportTickets = await prisma.supportTicket.findMany({
    where: { userId },
    include: { messages: { select: { id: true, isStaff: true, createdAt: true } } },
  });
  const supportUnread = supportTickets.filter((t) =>
    t.messages.some((m) => m.isStaff && (!t.userLastReadAt || m.createdAt > t.userLastReadAt)),
  ).length;

  return (
    <div className="container-page py-8">
      <h1 className="text-3xl font-bold mb-2">Личный кабинет компании</h1>
      <p className="text-muted-foreground mb-8">Управление товарами, конференциями и документами</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { href: "/company/products", icon: Package, title: "Мои товары и услуги", desc: "Добавление и управление продуктами в матрице материалов", color: "text-menthol" },
          { href: "/company/conferences", icon: Calendar, title: "Мои конференции", desc: "Презентация продуктов, проведение лекций", color: "text-menthol" },
          { href: "/company/library", icon: FileText, title: "Моя библиотека", desc: "Загрузка технических заданий и спецификаций", color: "text-menthol" },
          { href: "/company/reviews", icon: Star, title: "Мои отзывы", desc: "Отзывы о компании и поставках", color: "text-orange-accent" },
          { href: "/company/finances", icon: Coins, title: "Мои финансы", desc: "Баланс монет, счета и подарки", color: "text-orange-accent" },
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
