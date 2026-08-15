"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import {
  Users,
  Building2,
  Calendar,
  FileText,
  BarChart3,
  Settings,
  Palette,
  Shield,
  Package,
  Coins,
  Library,
  CheckCircle,
  Eye,
  MapPin,
  LifeBuoy,
  Ruler,
} from "lucide-react";

interface AdminDashboardProps {
  stats: {
    totalUsers: number;
    totalCompanies: number;
    pendingConferences: number;
    totalDocuments: number;
    totalPolls: number;
  };
  userType: string;
  supportUnread: number;
}

const isSuper = (type: string) => ["SUPER", "ROOT"].includes(type);
const isEditor = (type: string) => ["EDITOR", "SUPER", "ROOT"].includes(type);
const isRoot = (type: string) => type === "ROOT";

export function AdminDashboard({ stats, userType, supportUnread }: AdminDashboardProps) {
  const sections = [
    {
      href: "/admin/content",
      icon: Palette,
      title: "Управление контентом",
      desc: "Тексты страниц, баннеры, логотип, рассылки",
      show: true,
    },
    {
      href: "/admin/users",
      icon: Users,
      title: "Пользователи",
      desc: `${stats.totalUsers} пользователей, ${stats.totalCompanies} компаний`,
      show: isSuper(userType),
    },
    {
      href: "/admin/products",
      icon: Package,
      title: "Продуктовые решения",
      desc: "Редактирование дерева классификатора",
      show: isEditor(userType),
    },
    {
      href: "/admin/conferences",
      icon: Calendar,
      title: "Конференции",
      desc: `${stats.pendingConferences} ожидают модерации`,
      show: true,
      badge: stats.pendingConferences > 0 ? stats.pendingConferences : undefined,
    },
    {
      href: "/admin/library",
      icon: Library,
      title: "Библиотека",
      desc: `${stats.totalDocuments} документов`,
      show: true,
    },
    {
      href: "/admin/polls",
      icon: BarChart3,
      title: "Опросы",
      desc: `${stats.totalPolls} опросов`,
      show: isEditor(userType),
    },
    {
      href: "/admin/finances",
      icon: Coins,
      title: "Финансы и биллинг",
      desc: "Настройка экономики, реквизиты, подарки",
      show: isSuper(userType),
    },
    {
      href: "/admin/regions",
      icon: MapPin,
      title: "Справочник регионов",
      desc: "Единый список регионов для всех форм и фильтров",
      show: isSuper(userType),
    },
    {
      href: "/admin/documents",
      icon: FileText,
      title: "Юридические документы",
      desc: "PDF: согласие на обработку данных, пользовательское соглашение",
      show: isSuper(userType),
    },
    {
      href: "/admin/support",
      icon: LifeBuoy,
      title: "Обращения в поддержку",
      desc: "Переписка с пользователями и закрытие обращений",
      show: true,
      badge: supportUnread > 0 ? supportUnread : undefined,
    },
    {
      href: "/admin/categories",
      icon: Ruler,
      title: "Настройки категорий",
      desc: "Единицы измерения и характеристики категорий классификатора",
      show: isSuper(userType),
    },
    {
      href: "/admin/payouts",
      icon: Coins,
      title: "Учёт метрик и выплаты",
      desc: "Ставки за просмотры и счета на выплату компаниям",
      show: isRoot(userType),
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {sections
        .filter((s) => s.show)
        .map((section) => (
          <Link key={section.href} href={section.href}>
            <Card className="h-full hover:shadow-md hover:border-menthol/50 transition-all cursor-pointer relative">
              <CardContent>
                <section.icon className="h-8 w-8 text-menthol mb-3" />
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{section.title}</h3>
                  {section.badge && (
                    <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-orange-accent text-white text-xs font-medium">
                      {section.badge}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">{section.desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
    </div>
  );
}
