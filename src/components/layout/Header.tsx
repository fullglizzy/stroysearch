"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuGroup,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { SupportDialog } from "@/components/shared/SupportDialog";
import { cn } from "@/lib/utils";
import { Menu, X, User, Building2, Shield, LogOut, HelpCircle } from "lucide-react";

const navLinks = [
  { href: "/products", label: "Продуктовые решения" },
  { href: "/suppliers", label: "База поставщиков и заказчиков" },
  { href: "/matrix", label: "Даешь аналог! Матрица материалов" },
  { href: "/library", label: "Продуктовая библиотека" },
  { href: "/conferences", label: "Встречи и конференции" },
  { href: "/polls", label: "Статистика и опросы" },
];

export function Header() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [supportUnread, setSupportUnread] = useState(0);

  // Счётчик непрочитанных обращений
  useEffect(() => {
    if (!session?.user) {
      setSupportUnread(0);
      return;
    }
    let cancelled = false;
    const load = () =>
      fetch("/api/support/unread")
        .then((r) => r.json())
        .then((d) => { if (!cancelled) setSupportUnread(d.count || 0); })
        .catch(() => {});
    load();
    const timer = setInterval(load, 60000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [session?.user]);

  const userType = (session?.user as any)?.type as string;

  const dashboardHref =
    userType === "COMPANY"
      ? "/company"
      : ["MODERATOR", "EDITOR", "SUPER", "ROOT"].includes(userType)
        ? "/admin"
        : "/account";

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      {/* Хедер шире контента страниц, чтобы ссылки занимали меньше строк */}
      <div className="mx-auto w-full max-w-[1900px] px-4 sm:px-6 lg:px-8 flex min-h-16 items-center justify-between">
        {/* Logo */}
        <Link href="/" aria-label="ЕНЦПР — на главную" className="flex items-center gap-0 flex-shrink-0">
          <img
            src="/logo/logo.svg"
            alt="ЕНЦПР"
            // Справа в холсте SVG ~33% пустоты (425px из 1280): при h-16 это ~27px —
            // убираем их отрицательным отступом, чтобы текст был вплотную к рисунку
            className="h-24 w-auto translate-y-[9.7%] -mr-[40px]"
          />
          <span className="font-bold text-lg">
                <span className="text-menthol">Е</span>
                <span className="text-foreground">НЦПР</span>
              </span>
        </Link>

        {/* Desktop Nav — при нехватке места переносится на следующую строку */}
        <nav className="hidden md:flex items-center gap-1 flex-1 flex-wrap justify-center">
          {navLinks.map((link) => {
            const isActive = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-2.5 xl:px-3 py-2 text-sm font-medium whitespace-normal text-center rounded-md bg-menthol/30 transition-colors ${
                  isActive
                    ? "text-primary-foreground bg-orange-accent/80"
                    : "text-foreground hover:text-foreground hover:bg-menthol/80"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Right side: ThemeToggle, Auth */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <ThemeToggle />

          {session?.user ? (
            <DropdownMenu>
              <DropdownMenuTrigger>
                <Button variant="outline" size="sm" className="gap-2">
                  {userType === "COMPANY" ? (
                    <Building2 className="h-4 w-4" />
                  ) : ["MODERATOR", "EDITOR", "SUPER", "ROOT"].includes(userType) ? (
                    <Shield className="h-4 w-4" />
                  ) : (
                    <User className="h-4 w-4" />
                  )}
                  <span className="max-w-[100px] truncate">
                    {(session.user as any)?.username || session.user?.email}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Мой кабинет</DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Link href={dashboardHref} className="w-full">
                    Личный кабинет
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Link href={`${dashboardHref}/finances`} className="w-full">
                    Финансы
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Link href={`${dashboardHref}/support`} className="w-full flex items-center justify-between">
                    <span>Мои обращения</span>
                    {supportUnread > 0 && (
                      <span className="ml-2 inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-orange-accent text-white text-[10px] font-medium">
                        {supportUnread}
                      </span>
                    )}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSupportOpen(true)}>
                  <HelpCircle className="mr-2 h-4 w-4" />
                  Поддержка
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => signOut({ callbackUrl: window.location.origin + "/" })}
                  className="text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Выйти
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link
              href="/login"
              className={cn(buttonVariants({ size: "sm" }), "bg-menthol hover:bg-menthol-dark")}
            >
              Войти
            </Link>
          )}

          {/* Mobile Menu Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Nav */}
      {mobileOpen && (
        <nav className="md:hidden border-t bg-background p-4">
          <div className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-3 py-2.5 text-sm font-medium rounded-md hover:bg-secondary transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            {!session?.user && (
              <div className="mt-2 pt-2 border-t">
                <Link
                  href="/login"
                  className={cn(
                    buttonVariants({ size: "default" }),
                    "w-full bg-menthol hover:bg-menthol-dark",
                  )}
                >
                  Войти
                </Link>
              </div>
            )}
          </div>
        </nav>
      )}

      {/* Диалог поддержки (дублирует кнопку с главной страницы) */}
      <SupportDialog
        open={supportOpen}
        onOpenChange={setSupportOpen}
      />
    </header>
  );
}
