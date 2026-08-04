"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
      region: string | null;
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
}

export function AccountDashboard({ user }: AccountDashboardProps) {
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
        <Badge variant="secondary" className="w-fit text-sm px-3 py-1">
          <Coins className="h-4 w-4 mr-1" />
          Баланс: {user.walletBalance.toFixed(1)} монет
        </Badge>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="text-center">
            <Star className="h-6 w-6 text-orange-accent mx-auto mb-2" />
            <div className="text-2xl font-bold">{user.stats.receivedReviews}</div>
            <p className="text-xs text-muted-foreground">Получено отзывов</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center">
            <FileText className="h-6 w-6 text-menthol mx-auto mb-2" />
            <div className="text-2xl font-bold">{user.stats.documents}</div>
            <p className="text-xs text-muted-foreground">Документов</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center">
            <Calendar className="h-6 w-6 text-menthol mx-auto mb-2" />
            <div className="text-2xl font-bold">{user.stats.conferences}</div>
            <p className="text-xs text-muted-foreground">Конференций</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center">
            <Star className="h-6 w-6 text-orange-accent mx-auto mb-2" />
            <div className="text-2xl font-bold">{user.stats.givenReviews}</div>
            <p className="text-xs text-muted-foreground">Оставлено отзывов</p>
          </CardContent>
        </Card>
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
            href: "/account/conferences",
            icon: Calendar,
            title: "Мои конференции",
            desc: "Создание, участие и организация конференций",
            color: "text-menthol",
          },
          {
            href: "/account/library",
            icon: FileText,
            title: "Моя библиотека",
            desc: "Загрузка и покупка документов",
            color: "text-menthol",
          },
          {
            href: "/account/polls",
            icon: BarChart3,
            title: "Статистика и опросы",
            desc: "Голосование и просмотр результатов",
            color: "text-menthol",
          },
        ].map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="h-full hover:shadow-md hover:border-menthol/50 transition-all cursor-pointer">
              <CardContent>
                <item.icon className={`h-8 w-8 ${item.color} mb-3`} />
                <h3 className="font-semibold mb-1">{item.title}</h3>
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
