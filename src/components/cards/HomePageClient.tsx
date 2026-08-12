"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SupportDialog } from "@/components/shared/SupportDialog";
import {
  HelpCircle,
  ArrowRight,
  Calendar,
  MapPin,
  Clock,
  User,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface HomePageProps {
  pageContent: string;
  bannerUrl: string | null;
  conferenceCount: number;
  participantCount: number;
  upcomingConferences: {
    id: string;
    title: string;
    date: Date;
    time: string;
  }[];
}

export function HomePageClient({
  pageContent,
  bannerUrl,
  conferenceCount,
  participantCount,
  upcomingConferences,
}: HomePageProps) {
  const [supportOpen, setSupportOpen] = useState(false);

  return (
    <div>
      {/* Hero Section — 3 columns: text | photo | conferences */}
      <section className="bg-gradient-to-b from-menthol/5 to-background py-16 md:py-24">
        <div className="container-page">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12 items-center">
            {/* Column 1: Text */}
            <div>
              <div
                className="prose prose-gray max-w-none text-muted-foreground text-base md:text-lg leading-relaxed mb-8"
                dangerouslySetInnerHTML={{ __html: pageContent }}
              />
            </div>

            {/* Column 2: Photo */}
            <div className="flex justify-center">
              {bannerUrl ? (
                <div className="rounded-xl overflow-hidden shadow-lg w-full max-w-sm">
                  <img
                    src={bannerUrl}
                    alt="Баннер платформы"
                    className="w-full h-auto object-cover"
                  />
                </div>
              ) : (
                <div className="rounded-xl bg-menthol/10 w-full max-w-sm aspect-[4/3] flex items-center justify-center">
                  <MapPin className="h-16 w-16 text-menthol/30" />
                </div>
              )}
            </div>

            {/* Column 3: Conference List */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-orange-accent" />
                Ближайшие конференции
              </h3>
              {upcomingConferences.length > 0 ? (
                <ul className="space-y-3">
                  {upcomingConferences.map((conf) => {
                    const dateStr = new Date(conf.date).toLocaleDateString("ru-RU", {
                      day: "numeric",
                      month: "long",
                    });
                    return (
                      <li key={conf.id}>
                        <Link
                          href={`/conferences`}
                          className="block rounded-lg border bg-card p-3 hover:border-menthol/50 hover:shadow-sm transition-all"
                        >
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>
                              {dateStr}
                            </span>
                            <Clock className="h-3.5 w-3.5 ml-2" />
                            <span>{conf.time} МСК</span>
                          </div>
                          <p className="text-sm font-medium line-clamp-2">{conf.title}</p>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Презентуйте свой продукт, проведите лекцию
                </p>
              )}
              <Link
                href="/conferences"
                className={cn(
                  buttonVariants({ variant: "link" }),
                  "mt-3 px-0 text-menthol",
                )}
              >
                Все конференции <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Account Buttons */}
      <section className="py-12 bg-secondary/50">
        <div className="container-page">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-1 border-menthol shadow-md hover:shadow-lg transition-shadow">
              <CardContent>
                <h3 className="text-xl font-semibold mb-2 flex items-center gap-2">
                  <User className="h-5 w-5 text-menthol" />
                  Личный кабинет участника
                </h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Управляйте профилем, финансами, отзывами, участвуйте в конференциях и опросах
                </p>
                <Link
                  href="/account"
                  className={cn(buttonVariants({}), "w-full bg-menthol hover:bg-menthol-dark")}
                >
                  Войти в кабинет
                </Link>
              </CardContent>
            </Card>
            <Card className="border-1 border-menthol shadow-md hover:shadow-lg transition-shadow">
              <CardContent>
                <h3 className="text-xl font-semibold mb-2 flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-menthol" />
                  Личный кабинет компании
                </h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Управляйте товарами и услугами, добавляйте продукты в матрицу материалов
                </p>
                <Link
                  href="/company"
                  className={cn(buttonVariants({}), "w-full bg-menthol hover:bg-menthol-dark")}
                >
                  Войти в кабинет
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Quick Links */}
      <section className="py-12">
        <div className="container-page">
          <h2 className="text-2xl font-bold text-center mb-8">Возможности платформы</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: "Продуктовые решения",
                desc: "Иерархический классификатор строительных материалов и услуг",
                href: "/products",
              },
              {
                title: "База поставщиков",
                desc: "Актуальные контакты компаний и специалистов отрасли",
                href: "/suppliers",
              },
              {
                title: "Матрица материалов",
                desc: "Сравнение аналогов от разных производителей",
                href: "/matrix",
              },
              {
                title: "Библиотека ТЗ",
                desc: "Технические задания и спецификации для скачивания",
                href: "/library",
              },
              {
                title: "Конференции",
                desc: "Вебинары, лекции и презентации продуктов",
                href: "/conferences",
              },
              {
                title: "Опросы и статистика",
                desc: "Голосуйте и получайте монеты за участие",
                href: "/polls",
              },
            ].map((item) => (
              <Link key={item.href} href={item.href}>
                <Card className="h-full hover:shadow-md hover:border-menthol/50 transition-all cursor-pointer">
                  <CardContent>
                    <h3 className="font-semibold mb-2">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Support Button */}
      <div className="fixed bottom-6 right-6 z-40">
        <Button
          size="lg"
          className="rounded-full shadow-lg bg-orange-accent hover:bg-orange-accent/90 h-14 w-14 p-0"
          title="Поддержка"
          onClick={() => setSupportOpen(true)}
        >
          <HelpCircle className="h-6 w-6" />
        </Button>
        <SupportDialog open={supportOpen} onOpenChange={setSupportOpen} />
      </div>
    </div>
  );
}
