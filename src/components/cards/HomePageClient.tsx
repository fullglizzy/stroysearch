"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowRight,
  Calendar,
  MapPin,
  Clock,
  User,
  Building2,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";

interface HomePageProps {
  pageContent: string;
  bannerUrl: string | null;
  upcomingConferences: {
    id: string;
    title: string;
    date: Date;
    time: string;
  }[];
  upcomingCount: number;
}

export function HomePageClient({
  pageContent,
  bannerUrl,
  upcomingConferences,
  upcomingCount,
}: HomePageProps) {
  // Высота одной копии ленты конференций: подгоняем контейнер под неё,
  // чтобы дубль списка всегда был за пределами видимой области и не «появлялся» на глазах
  const marqueeCopyRef = useRef<HTMLUListElement>(null);
  const [marqueeHeight, setMarqueeHeight] = useState<number | null>(null);

  useEffect(() => {
    const measure = () => {
      if (marqueeCopyRef.current) {
        setMarqueeHeight(marqueeCopyRef.current.offsetHeight);
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [upcomingConferences]);

  // ── Автопрокрутка + ручное листание ленты ──
  // Прокрутка управляется из JS (requestAnimationFrame): автодвижение вверх
  // с постоянной скоростью, ручные кнопки делают плавный твин на шаг карточки.
  const MARQUEE_SPEED = 30; // px/сек
  const [marqueeOffset, setMarqueeOffset] = useState(0);
  const offsetRef = useRef(0);
  const tweenRef = useRef<{ from: number; to: number; start: number; duration: number } | null>(null);
  const pausedRef = useRef(false);
  const reduceMotionRef = useRef(false);
  const cardStepRef = useRef(96);

  useEffect(() => {
    reduceMotionRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotionRef.current) pausedRef.current = true;

    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const tween = tweenRef.current;
      if (tween) {
        const p = Math.min(1, (now - tween.start) / tween.duration);
        const eased = 1 - Math.pow(1 - p, 3);
        offsetRef.current = tween.from + (tween.to - tween.from) * eased;
        setMarqueeOffset(offsetRef.current);
        if (p >= 1) tweenRef.current = null;
      } else if (!pausedRef.current) {
        offsetRef.current += MARQUEE_SPEED * dt;
        setMarqueeOffset(offsetRef.current);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Шаг ручной прокрутки = высота одной карточки + отступ
  useEffect(() => {
    const ul = marqueeCopyRef.current;
    if (ul?.firstElementChild) {
      cardStepRef.current = (ul.firstElementChild as HTMLElement).offsetHeight + 12;
    }
  }, [upcomingConferences, marqueeHeight]);

  function scrollMarquee(dir: 1 | -1) {
    tweenRef.current = {
      from: offsetRef.current,
      to: offsetRef.current + dir * cardStepRef.current,
      start: performance.now(),
      duration: 350,
    };
  }

  // Смещение ленты (зациклено по высоте одной копии)
  const marqueeY = marqueeHeight ? -(marqueeOffset % marqueeHeight) : 0;

  return (
    <div>
      {/* Логотип с полным названием платформы + Hero — общий градиентный фон */}
      <section className="bg-gradient-to-b from-menthol/10 via-menthol/5 to-background">
        <div className="pt-4 md:pt-2">
          <div className="container-page">
            <div className="mx-auto max-w-4xl rounded-2xl border-2 border-menthol/70 px-6 py-4 md:py-2 flex flex-col items-center text-center">
              <p className="max-w-4xl font-semibold uppercase tracking-[0.18em] leading-relaxed text-foreground">
                <span className="block text-xl md:text-2xl">
                  Единый независимый центр{" "}
                  <span className="text-menthol">продуктовых решений</span>
                </span>
                <span className="mt-1 block text-sm md:text-base">
                  закупок и технических заданий{" "}
                  <span className="text-menthol">строительной отрасли</span>
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Hero Section — 3 columns: text | photo | conferences */}
        <div className="container-page py-4 md:py-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12 items-start">
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
                  <Image
                    src={bannerUrl}
                    alt="Баннер платформы"
                    width={800}
                    height={600}
                    className="w-full h-auto object-cover"
                    sizes="(max-width: 640px) 100vw, 448px"
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
                {upcomingCount > 0 && (
                  <span className="text-xs text-muted-foreground font-normal">
                    · всего {upcomingCount}
                  </span>
                )}
              </h3>
              {upcomingConferences.length > 0 ? (
                <div
                  className="relative"
                  onMouseEnter={() => { pausedRef.current = true; }}
                  onMouseLeave={() => { pausedRef.current = false; }}
                >
                  {/* Лента с мягкими границами (маска сверху и снизу) */}
                  <div
                    className="overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_40px,black_calc(100%-40px),transparent)]"
                    style={marqueeHeight ? { height: `${marqueeHeight}px` } : undefined}
                  >
                    <div
                      className="flex w-full flex-col"
                      style={{ transform: `translateY(${marqueeY}px)` }}
                    >
                      {/* Дублируем список заранее — дубль всегда за пределами видимой области */}
                      {[0, 1].map((copy) => (
                        <ul
                          key={copy}
                          ref={copy === 0 ? marqueeCopyRef : undefined}
                          aria-hidden={copy === 1 ? true : undefined}
                          className="flex flex-col gap-3 pb-3"
                        >
                          {upcomingConferences.map((conf) => {
                            const dateStr = new Date(conf.date).toLocaleDateString("ru-RU", {
                              day: "numeric",
                              month: "long",
                            });
                            return (
                              <li key={conf.id} className="w-full shrink-0">
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
                      ))}
                    </div>
                  </div>

                  {/* Ручное листание (автопрокрутка приостанавливается при наведении) */}
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 z-10 flex flex-col gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 rounded-full bg-background/70 backdrop-blur shadow-sm"
                      onClick={() => scrollMarquee(-1)}
                      title="Прокрутить вверх"
                      aria-label="Прокрутить вверх"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 rounded-full bg-background/70 backdrop-blur shadow-sm"
                      onClick={() => scrollMarquee(1)}
                      title="Прокрутить вниз"
                      aria-label="Прокрутить вниз"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
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
      <section className="py-4 bg-secondary/50">
        <div className="container-page">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-1 border-orange-accent shadow-md hover:shadow-lg transition-shadow">
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
                  className={cn(buttonVariants({}), "w-full bg-orange-accent hover:bg-menthol-dark")}
                >
                  Войти в кабинет
                </Link>
              </CardContent>
            </Card>
            <Card className="border-1 border-orange-accent shadow-md hover:shadow-lg transition-shadow">
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
                  className={cn(buttonVariants({}), "w-full bg-orange-accent hover:bg-menthol-dark")}
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
    </div>
  );
}
