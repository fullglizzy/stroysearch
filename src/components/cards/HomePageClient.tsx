"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Phone,
  Mail,
  HelpCircle,
  ArrowRight,
  TrendingUp,
  Calendar,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supportTicketSchema } from "@/lib/validators";

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
  const [supportError, setSupportError] = useState("");
  const [supportSuccess, setSupportSuccess] = useState(false);
  const [supportLoading, setSupportLoading] = useState(false);

  async function handleSupportSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSupportError("");
    setSupportLoading(true);

    const formData = new FormData(e.currentTarget);
    const raw = {
      email: formData.get("email") as string,
      subject: formData.get("subject") as string,
      message: formData.get("message") as string,
    };

    const parsed = supportTicketSchema.safeParse(raw);
    if (!parsed.success) {
      setSupportError(parsed.error.issues[0].message);
      setSupportLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      if (res.ok) {
        setSupportSuccess(true);
        setTimeout(() => setSupportOpen(false), 2000);
      } else {
        setSupportError("Ошибка при отправке. Попробуйте позже.");
      }
    } catch {
      setSupportError("Ошибка соединения. Попробуйте позже.");
    }

    setSupportLoading(false);
  }

  return (
    <div>
      {/* Hero Section */}
      <section className="bg-gradient-to-b from-menthol/5 to-white py-16 md:py-24">
        <div className="container-page">
          {/* Баннер №1 (ТЗ §4.1) */}
          {bannerUrl && (
            <div className="mb-8 rounded-lg overflow-hidden max-w-3xl mx-auto">
              <img
                src={bannerUrl}
                alt="Баннер платформы"
                className="w-full h-auto max-h-48 object-cover"
              />
            </div>
          )}
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">
              Единый центр продуктовых решений
              <span className="text-menthol block mt-2">строительной отрасли</span>
            </h1>
            <div
              className="prose prose-gray max-w-none text-muted-foreground text-base md:text-lg leading-relaxed mb-8"
              dangerouslySetInnerHTML={{ __html: pageContent }}
            />
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/register"
                className={cn(buttonVariants({ size: "lg" }), "bg-menthol hover:bg-menthol-dark")}
              >
                Зарегистрироваться <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link
                href="/products"
                className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
              >
                Смотреть продукты
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Conference Ticker */}
      <section className="border-y bg-accent/5 py-3">
        <div className="container-page">
          {upcomingConferences.length > 0 ? (
            <ConferenceTicker conferences={upcomingConferences} />
          ) : (
            <p className="text-center text-sm text-muted-foreground">
              Презентуйте свой продукт, проведите лекцию
            </p>
          )}
        </div>
      </section>

      {/* Metrics */}
      <section className="py-12">
        <div className="container-page">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="text-center">
              <CardContent>
                <Calendar className="h-8 w-8 text-menthol mx-auto mb-3" />
                <div className="text-3xl font-bold text-foreground">
                  {conferenceCount}
                </div>
                <p className="text-sm text-muted-foreground mt-1">Конференций проведено</p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent>
                <Users className="h-8 w-8 text-orange-accent mx-auto mb-3" />
                <div className="text-3xl font-bold text-foreground">
                  {participantCount}
                </div>
                <p className="text-sm text-muted-foreground mt-1">Участников платформы</p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent>
                <TrendingUp className="h-8 w-8 text-menthol mx-auto mb-3" />
                <div className="text-3xl font-bold text-foreground">
                  19
                </div>
                <p className="text-sm text-muted-foreground mt-1">Категорий продуктов</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Account Buttons */}
      <section className="py-12 bg-secondary/50">
        <div className="container-page">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="hover:shadow-md transition-shadow">
              <CardContent>
                <h3 className="text-xl font-semibold mb-2">Личный кабинет участника</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Управляйте профилем, финансами, отзывами, участвуйте в конференциях и опросах
                </p>
                <Link
                  href="/account"
                  className={cn(buttonVariants({ variant: "outline" }), "w-full")}
                >
                  Войти в кабинет
                </Link>
              </CardContent>
            </Card>
            <Card className="hover:shadow-md transition-shadow">
              <CardContent>
                <h3 className="text-xl font-semibold mb-2">Личный кабинет компании</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Управляйте товарами и услугами, добавляйте продукты в матрицу материалов
                </p>
                <Link
                  href="/company"
                  className={cn(buttonVariants({ variant: "outline" }), "w-full")}
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
        <Dialog open={supportOpen} onOpenChange={setSupportOpen}>
          <DialogTrigger>
            <Button
              size="lg"
              className="rounded-full shadow-lg bg-orange-accent hover:bg-orange-accent/90 h-14 w-14 p-0"
            >
              <HelpCircle className="h-6 w-6" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Обращение в поддержку</DialogTitle>
              <DialogDescription>
                Опишите ваш вопрос или проблему, и мы свяжемся с вами
              </DialogDescription>
            </DialogHeader>
            {supportSuccess ? (
              <Alert>
                <AlertDescription>
                  Ваше обращение отправлено! Мы свяжемся с вами в ближайшее время.
                </AlertDescription>
              </Alert>
            ) : (
              <form onSubmit={handleSupportSubmit} className="space-y-4">
                {supportError && (
                  <Alert variant="destructive">
                    <AlertDescription>{supportError}</AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2">
                  <Label htmlFor="support-email">Email</Label>
                  <Input
                    id="support-email"
                    name="email"
                    type="email"
                    placeholder="your@email.ru"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="support-subject">Тема</Label>
                  <Input
                    id="support-subject"
                    name="subject"
                    placeholder="Тема обращения"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="support-message">Сообщение</Label>
                  <Textarea
                    id="support-message"
                    name="message"
                    placeholder="Опишите ваш вопрос..."
                    rows={4}
                    required
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-menthol hover:bg-menthol-dark"
                  disabled={supportLoading}
                >
                  {supportLoading ? "Отправка..." : "Отправить"}
                </Button>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function ConferenceTicker({
  conferences,
}: {
  conferences: { id: string; title: string; date: Date; time: string }[];
}) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (conferences.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % conferences.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [conferences.length]);

  const conf = conferences[currentIndex];
  const dateStr = new Date(conf.date).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
  });

  return (
    <Link
      href={`/conferences`}
      className="flex items-center justify-center gap-2 text-sm hover:text-menthol transition-colors"
    >
      <Calendar className="h-4 w-4 text-orange-accent" />
      <span className="font-medium">{conf.title}</span>
      <span className="text-muted-foreground">
        — {dateStr} в {conf.time} МСК
      </span>
    </Link>
  );
}
