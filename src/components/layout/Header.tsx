"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";
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
import { cn } from "@/lib/utils";
import { Menu, X, User, Building2, Shield, LogOut } from "lucide-react";

const navLinks = [
  { href: "/products", label: "Продуктовые решения" },
  { href: "/suppliers", label: "Поставщики" },
  { href: "/matrix", label: "Матрица" },
  { href: "/library", label: "Библиотека" },
  { href: "/conferences", label: "Конференции" },
  { href: "/polls", label: "Опросы" },
];

export function Header() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const userType = (session?.user as any)?.type as string;

  const dashboardHref =
    userType === "COMPANY"
      ? "/company"
      : ["MODERATOR", "EDITOR", "SUPER", "ROOT"].includes(userType)
        ? "/admin"
        : "/account";

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container-page flex h-16 items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-bold text-xl flex-shrink-0">
          <span className="text-menthol">Е</span>
          <span className="text-foreground">ЦПР</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1 flex-1 justify-center">
          {navLinks.map((link) => {
            const isActive = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  isActive
                    ? "text-menthol bg-menthol/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
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
                  <Link href={`${dashboardHref}/profile`} className="w-full">
                    Профиль
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Link href={`${dashboardHref}/finances`} className="w-full">
                    Финансы
                  </Link>
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
    </header>
  );
}
