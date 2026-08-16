"use client";

import type { ComponentType, ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  User,
  Wallet,
  FileText,
  Calendar,
  Star,
  BarChart3,
  LifeBuoy,
  Building2,
  Package,
  Coins,
  Users,
  Palette,
  MapPin,
  Library,
  Ruler,
  Shield,
} from "lucide-react";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { cn } from "@/lib/utils";

type IconComponent = ComponentType<{ className?: string }>;

interface NavItem {
  href: string;
  label: string;
  icon: IconComponent;
  roles?: string[];
}

interface NavConfig {
  home: NavItem;
  items: NavItem[];
}

const ADMIN_TYPES = ["MODERATOR", "EDITOR", "SUPER", "ROOT"];

/** Активный пункт: сначала точное совпадение, затем самый длинный префикс */
function findCurrent(pathname: string, items: NavItem[]): NavItem | undefined {
  const exact = items.find((i) => i.href === pathname);
  if (exact) return exact;
  return items
    .filter((i) => pathname.startsWith(`${i.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
}

const NAV: Record<string, NavConfig> = {
  account: {
    home: { href: "/account", label: "Кабинет участника", icon: LayoutDashboard },
    items: [
      { href: "/account/profile", label: "Личные данные", icon: User },
      { href: "/account/finances", label: "Финансы", icon: Wallet },
      { href: "/account/library", label: "Библиотека", icon: FileText },
      { href: "/account/conferences", label: "Конференции", icon: Calendar },
      { href: "/account/reviews", label: "Отзывы", icon: Star },
      { href: "/account/polls", label: "Опросы", icon: BarChart3 },
      { href: "/account/support", label: "Поддержка", icon: LifeBuoy },
    ],
  },
  company: {
    home: { href: "/company", label: "Кабинет компании", icon: Building2 },
    items: [
      { href: "/company/profile", label: "Данные компании", icon: Building2 },
      { href: "/company/products", label: "Товары и услуги", icon: Package },
      { href: "/company/finances", label: "Финансы", icon: Wallet },
      { href: "/company/payouts", label: "Выплаты", icon: Coins },
      { href: "/company/library", label: "Библиотека", icon: FileText },
      { href: "/company/conferences", label: "Конференции", icon: Calendar },
      { href: "/company/reviews", label: "Отзывы", icon: Star },
      { href: "/company/support", label: "Поддержка", icon: LifeBuoy },
    ],
  },
  admin: {
    home: { href: "/admin", label: "Панель управления", icon: Shield },
    items: [
      { href: "/admin/users", label: "Пользователи", icon: Users, roles: ["SUPER", "ROOT"] },
      { href: "/admin/products", label: "Товары и дерево", icon: Package, roles: ADMIN_TYPES },
      { href: "/admin/categories", label: "Настройки категорий", icon: Ruler, roles: ["SUPER", "ROOT"] },
      { href: "/admin/regions", label: "Регионы", icon: MapPin, roles: ["SUPER", "ROOT"] },
      { href: "/admin/content", label: "Контент страниц", icon: Palette, roles: ADMIN_TYPES },
      { href: "/admin/documents", label: "Юрдокументы", icon: FileText, roles: ["SUPER", "ROOT"] },
      { href: "/admin/conferences", label: "Модерация конференций", icon: Calendar, roles: ADMIN_TYPES },
      { href: "/admin/library", label: "Модерация библиотеки", icon: Library, roles: ADMIN_TYPES },
      { href: "/admin/reviews", label: "Модерация отзывов", icon: Star, roles: ADMIN_TYPES },
      { href: "/admin/polls", label: "Опросы", icon: BarChart3, roles: ["EDITOR", "SUPER", "ROOT"] },
      { href: "/admin/finances", label: "Финансы и биллинг", icon: Coins, roles: ["SUPER", "ROOT"] },
      { href: "/admin/payouts", label: "Выплаты", icon: Coins, roles: ["ROOT"] },
      { href: "/admin/audit", label: "Журнал аудита", icon: Shield, roles: ["SUPER", "ROOT"] },
      { href: "/admin/support", label: "Поддержка", icon: LifeBuoy, roles: ADMIN_TYPES },
    ],
  },
};

export function DashboardShell({
  userType,
  children,
}: {
  userType: string;
  children: ReactNode;
}) {
  const pathname = usePathname();

  const cabinet = userType === "COMPANY" ? "company" : ADMIN_TYPES.includes(userType) ? "admin" : "account";
  const config = NAV[cabinet];
  const allItems = [config.home, ...config.items.filter((i) => !i.roles || i.roles.includes(userType))];

  const current = findCurrent(pathname, allItems);

  const crumbs =
    current && current.href !== config.home.href
      ? [
          { label: config.home.label, href: config.home.href },
          { label: current.label },
        ]
      : [{ label: config.home.label }];

  return (
    <div className="container-page flex gap-6">
      <aside className="hidden lg:block w-56 shrink-0 py-8">
        <nav className="sticky top-24 space-y-0.5" aria-label="Навигация кабинета">
          {allItems.map((item) => {
            const active = current?.href === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-menthol/70 text-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="flex-1 min-w-0">
        
        {children}
      </div>
    </div>
  );
}
