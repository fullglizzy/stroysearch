"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageBanner } from "@/components/shared/PageBanner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  User,
  Wallet,
  Star,
  FileText,
  Calendar,
  BarChart3,
  Settings,
  ArrowRight,
  Coins,
  LifeBuoy,
} from "lucide-react";

interface AccountDashboardProps {
  user: {
    username: string;
    email: string;
    type: string;
    profile: {
      firstName: string | null;
      lastName: string | null;
      nick: string | null;
      regions: string | null;
      roles: string[];
    } | null;
    walletBalance: number;
    stats: {
      givenReviews: number;
      receivedReviews: number;
      documents: number;
      conferences: number;
    };
  };
  supportUnread: number;
  bannerUrl: string | null;
}

export function AccountDashboard({ user, supportUnread, bannerUrl }: AccountDashboardProps) {
  const displayName =
    user.profile?.firstName && user.profile?.lastName
      ? `${user.profile.lastName} ${user.profile.firstName}`
      : user.username;

  return (
    <div className="container-page py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold">Личный кабинет</h1>
          <p className="text-muted-foreground mt-1">
            Добро пожаловать, {displayName}
          </p>
        </div>
        <Link href="/account/finances">
          <Badge
            variant="secondary"
            className="w-fit text-sm px-3 py-1 hover:border-menthol/50 transition-colors cursor-pointer"
          >
            <Coins className="h-4 w-4 mr-1" />
            Баланс: {user.walletBalance.toFixed(1)} монет
          </Badge>
        </Link>
      </div>

      {/* Баннер */}
      {bannerUrl && <PageBanner url={bannerUrl} alt="Баннер личного кабинета" />}

      {/* Stats Grid — карточки ведут в соответствующие разделы */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Link href="/account/reviews">
          <Card className="h-full hover:shadow-md hover:border-menthol/50 transition-all cursor-pointer">
            <CardContent className="text-center">
              <Star className="h-6 w-6 text-orange-accent mx-auto mb-2" />
              <div className="text-2xl font-bold">{user.stats.receivedReviews}</div>
              <p className="text-xs text-muted-foreground">Получено отзывов</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/account/library">
          <Card className="h-full hover:shadow-md hover:border-menthol/50 transition-all cursor-pointer">
            <CardContent className="text-center">
              <FileText className="h-6 w-6 text-menthol mx-auto mb-2" />
              <div className="text-2xl font-bold">{user.stats.documents}</div>
              <p className="text-xs text-muted-foreground">Документов</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/account/conferences">
          <Card className="h-full hover:shadow-md hover:border-menthol/50 transition-all cursor-pointer">
            <CardContent className="text-center">
              <Calendar className="h-6 w-6 text-menthol mx-auto mb-2" />
              <div className="text-2xl font-bold">{user.stats.conferences}</div>
              <p className="text-xs text-muted-foreground">Конференций</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/account/reviews">
          <Card className="h-full hover:shadow-md hover:border-menthol/50 transition-all cursor-pointer">
            <CardContent className="text-center">
              <Star className="h-6 w-6 text-orange-accent mx-auto mb-2" />
              <div className="text-2xl font-bold">{user.stats.givenReviews}</div>
              <p className="text-xs text-muted-foreground">Оставлено отзывов</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Navigation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          {
            href: "/account/profile",
            icon: User,
            title: "Личные данные",
            desc: "Редактирование профиля, контактов и классификаторов",
            color: "text-menthol",
          },
          {
            href: "/account/finances",
            icon: Wallet,
            title: "Мои финансы",
            desc: "Баланс монет, счета, подарки и дарение монет",
            color: "text-orange-accent",
          },
          {
            href: "/account/reviews",
            icon: Star,
            title: "Мои отзывы",
            desc: "Отзывы о вас и от вас, рейтинг и критерии",
            color: "text-orange-accent",
          },
          {
            href: "/account/library",
            icon: FileText,
            title: "Моя библиотека",
            desc: "Загрузка и покупка документов",
            color: "text-menthol",
          },
          {
            href: "/account/conferences",
            icon: Calendar,
            title: "Мои конференции",
            desc: "Организованные встречи и участие",
            color: "text-menthol",
          },
          {
            href: "/account/polls",
            icon: BarChart3,
            title: "Статистика и опросы",
            desc: "Голосование и просмотр результатов",
            color: "text-menthol",
          },
          {
            href: "/account/support",
            icon: LifeBuoy,
            title: "Поддержка",
            desc: "Обращения и переписка со службой поддержки",
            color: "text-menthol",
            badge: supportUnread,
          },
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
