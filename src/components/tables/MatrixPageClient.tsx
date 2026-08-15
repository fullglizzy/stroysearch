"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { MultiSelect } from "@/components/shared/MultiSelect";
import { ProductCard } from "@/components/shared/ProductCard";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StarRating } from "@/components/shared/StarRating";
import { cn } from "@/lib/utils";
import { matchClassifier } from "@/lib/classifier";
import { ALL_REGIONS, toggleAllRegions } from "@/lib/regions";
import { PageBanner } from "@/components/shared/PageBanner";
import { Search, SlidersHorizontal, Plus, AlertCircle, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

interface ProductRow {
  id: string; companyName: string; companyInn: string; companyId: string;
  name: string; classes: string[]; regions: string[]; imageUrl: string | null;
  unit: string | null; characteristics: string[]; price: number | null;
  views: number; treeItemPath: string; treeItemName: string;
  companyRating: number | null; companyPhone: string | null; companyEmail: string | null;
}

interface TreeItem { id: string; name: string; fullNumberPath: string; }

interface Props {
  products: ProductRow[];
  total: number;
  capped: boolean;
  treeItems: TreeItem[];
  regions: string[];
  moderatorText: string | null;
  pageTitle: string | null;
  bannerUrl: string | null;
  initialQuery: {
    q: string;
    class: string;
    region: string;
    classifier: string;
    sort: string;
  };
}

const classLabels: Record<string, string> = {
  STANDARD: "Стандарт", COMFORT: "Комфорт", BUSINESS: "Бизнес", PREMIUM: "Премиум",
};

const SORT_ITEMS: Record<string, string> = {
  rating: "По рейтингу",
  price_asc: "Сначала дешевле",
  price_desc: "Сначала дороже",
  name: "По названию",
};

// Критерии оценки компании (совпадают с базой поставщиков)
const COMPANY_CRITERIA_LABELS = [
  "Качество оказанной работы/услуги/материала/поставки",
  "Организация работы на объекте / организация поставки",
  "Взаимодействие со специалистами компании",
  "Наличие средств, необходимых для выполнения работ",
  "Финансовое состояние предприятия",
  "Наличие квалифицированных специалистов и руководителей",
  "Срок выполнения работ/поставки",
  "Стоимость и условия оплаты",
  "Особые условия/гибкость в договорных отношениях",
];

export function MatrixPageClient({ products, total, capped, treeItems, regions, moderatorText, pageTitle, bannerUrl, initialQuery }: Props) {
  const { data: session } = useSession();
  const router = useRouter();

  // Добавлять аналоги могут только компании и админы
  const userType = (session?.user as any)?.type as string;
  const canAddProduct =
    !!session?.user &&
    (userType === "COMPANY" || ["MODERATOR", "EDITOR", "SUPER", "ROOT"].includes(userType));

  // Фильтры приходят из URL, сервер уже отфильтровал и отсортировал данные
  const classifiers = initialQuery.classifier.split(",").filter(Boolean);
  const productClass = initialQuery.class;
  const regionFilter = initialQuery.region.split(",").filter(Boolean);
  const sortBy = initialQuery.sort as "rating" | "price_asc" | "price_desc" | "name";

  const [search, setSearch] = useState(initialQuery.q);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [revals, setRevals] = useState<Record<string, Record<string, boolean>>>({});
  const scrollerRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const scrollerObservers = useRef<Map<string, ResizeObserver>>(new Map());
  const [scrollerState, setScrollerState] = useState<Record<string, { canLeft: boolean; canRight: boolean }>>({});

  // Попап отзывов компании (как в базе поставщиков)
  const [reviewPopup, setReviewPopup] = useState<{ id: string; kind: "company" | "participant"; name: string } | null>(null);
  const [reviewsList, setReviewsList] = useState<{ id: string; authorNick: string; comment: string; weightedAverage: number; createdAt: string; criteria: { criteriaIndex: number; score: number }[] }[] | null>(null);
  const [expandedReviewId, setExpandedReviewId] = useState<string | null>(null);

  // Загрузка отзывов для попапа
  useEffect(() => {
    if (!reviewPopup) return;
    let cancelled = false;
    const params = reviewPopup.kind === "company"
      ? `companyId=${reviewPopup.id}`
      : `targetId=${reviewPopup.id}`;
    fetch(`/api/reviews?${params}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setReviewsList(d.reviews || []); })
      .catch(() => { if (!cancelled) setReviewsList([]); });
    return () => { cancelled = true; };
  }, [reviewPopup]);

  function openReviewsPopup(popup: { id: string; kind: "company" | "participant"; name: string }) {
    setExpandedReviewId(null);
    setReviewPopup(popup);
  }

  function closeReviewsPopup() {
    setReviewPopup(null);
    setReviewsList(null);
    setExpandedReviewId(null);
  }

  function updateQuery(next: Record<string, string | null>) {
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(next)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    const qs = params.toString();
    router.replace(qs ? `/matrix?${qs}` : "/matrix", { scroll: false });
  }

  function handleSearchChange(value: string) {
    setSearch(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      updateQuery({ q: value });
    }, 300);
  }

  function updateScrollerState(path: string, el: HTMLDivElement) {
    const canLeft = el.scrollLeft > 1;
    const canRight = el.scrollLeft < el.scrollWidth - el.clientWidth - 1;
    setScrollerState((prev) => {
      const cur = prev[path];
      if (cur && cur.canLeft === canLeft && cur.canRight === canRight) return prev;
      return { ...prev, [path]: { canLeft, canRight } };
    });
  }

  function scrollScroller(path: string, dir: -1 | 1) {
    scrollerRefs.current[path]?.scrollBy({ left: dir * 420, behavior: "smooth" });
  }

  // Привязка скроллера: ResizeObserver пересчитывает стрелки при любом
  // изменении размеров контента (загрузка картинок, ресайз, смена данных)
  function attachScroller(path: string, el: HTMLDivElement | null) {
    scrollerRefs.current[path] = el;
    if (!el) return;
    const prevObserver = scrollerObservers.current.get(path);
    prevObserver?.disconnect();
    const observer = new ResizeObserver(() => updateScrollerState(path, el));
    observer.observe(el);
    scrollerObservers.current.set(path, observer);
    requestAnimationFrame(() => updateScrollerState(path, el));
  }

  useEffect(() => {
    const observers = scrollerObservers.current;
    return () => {
      for (const observer of observers.values()) observer.disconnect();
      observers.clear();
    };
  }, []);

  const currentClassifierName = useMemo(() => {
    if (classifiers.length !== 1) return null;
    const found = treeItems.find((t) => t.id === classifiers[0]);
    return found ? `${found.fullNumberPath} — ${found.name}` : classifiers[0];
  }, [classifiers, treeItems]);

  const activeFiltersCount = [classifiers.length > 0, productClass !== "", regionFilter.length > 0].filter(Boolean).length;

  // Фильтрация и сортировка выполняются на сервере; здесь только группировка
  const grouped = useMemo(() => {
    const map = new Map<string, ProductRow[]>();
    for (const p of products) {
      const key = p.treeItemPath;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    // Сортировка внутри каждой категории (данные уже пришли отсортированными с сервера)
    for (const list of map.values()) {
      list.sort((a, b) => {
        if (sortBy === "price_asc") return (a.price ?? Infinity) - (b.price ?? Infinity);
        if (sortBy === "price_desc") return (b.price ?? -Infinity) - (a.price ?? -Infinity);
        if (sortBy === "name") return a.name.localeCompare(b.name, "ru");
        return (b.companyRating ?? -Infinity) - (a.companyRating ?? -Infinity);
      });
    }
    return Array.from(map.entries());
  }, [products, sortBy]);

  // Поля, просмотры которых уже засчитаны (один раз за сессию на поле)
  const countedRef = useRef<Record<string, Record<string, boolean>>>({});

  const handleReveal = async (companyId: string, field: string) => {
    const isReveal = !revals[companyId]?.[field];
    setRevals((prev) => ({
      ...prev, [companyId]: { ...prev[companyId], [field]: !prev[companyId]?.[field] },
    }));

    // Метрика: только при раскрытии и один раз за сессию
    if (!isReveal || countedRef.current[companyId]?.[field]) return;
    countedRef.current = {
      ...countedRef.current,
      [companyId]: { ...countedRef.current[companyId], [field]: true },
    };

    try { await fetch(`/api/suppliers/metrics/${companyId}/click`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ field }) }); } catch { /* */ }
  };

  const renderProductCard = (product: ProductRow, className?: string) => (
    <ProductCard
      key={product.id}
      className={className}
      data={product}
      classLabels={classLabels}
      companyName={product.companyName}
      companyInn={product.companyInn}
      rating={product.companyRating}
      onRatingClick={() => openReviewsPopup({ id: product.companyId, kind: "company", name: product.companyName })}
      phone={product.companyPhone}
      email={product.companyEmail}
      revealed={revals[product.companyId] || {}}
      onReveal={(field) => handleReveal(product.companyId, field)}
    />
  );

  const renderGiveCard = (className?: string) => (
    <Card key="give-analog" className={cn("flex flex-col border-dashed border-menthol/50 bg-menthol/5", className)}>
      <CardContent className="flex-1 flex flex-col items-center justify-center text-center">
        <Plus className="h-8 w-8 text-menthol mb-2" />
        <p className="text-sm font-medium text-menthol mb-1">Дать аналог</p>
        <p className="text-xs text-muted-foreground mb-3">Добавьте свой продукт</p>
        <Link href="/company/products" className={cn(buttonVariants({ size: "sm" }), "bg-menthol hover:bg-menthol-dark")}>Добавить</Link>
      </CardContent>
    </Card>
  );

  return (
    <div className="container-page py-8">
      {/* Breadcrumb */}
      {currentClassifierName && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <Link href="/products" className="hover:text-menthol transition-colors">← К классификатору</Link>
          <span>/</span>
          <span className="font-medium text-foreground truncate">{currentClassifierName}</span>
        </div>
      )}

      <h1 className="text-3xl font-bold">Даешь аналог! Матрица материалов</h1>
      <p className="text-muted-foreground mt-1 mb-6">
        Конкурентная таблица — сравнение аналогов по цене, характеристикам и классу
      </p>

      {/* Info banner */}
      {(pageTitle || moderatorText) && (
        <div className="bg-menthol/5 border border-menthol/20 rounded-lg p-3 mb-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-menthol flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            {pageTitle && <p className="font-medium text-menthol">{pageTitle}</p>}
            {moderatorText && (
              <div className="text-muted-foreground" dangerouslySetInnerHTML={{ __html: moderatorText }} />
            )}
          </div>
        </div>
      )}

      {/* Баннер (ТЗ §7.1) */}
      {bannerUrl && <PageBanner url={bannerUrl} alt="Баннер матрицы" />}

      {/* Search + Filters — состояние живёт в URL, данные отдаёт сервер */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Поиск по товару или компании..." value={search} onChange={(e) => handleSearchChange(e.target.value)} className="pl-9" />
        </div>
        <MultiSelect
          options={treeItems.map((t) => ({ value: t.id, label: `${t.fullNumberPath} — ${t.name}` }))}
          value={classifiers}
          onChange={(v) => updateQuery({ classifier: v.join(",") })}
          placeholder="Классификатор"
          searchPlaceholder="Поиск категории..."
          className="w-[220px]"
          filter={matchClassifier}
          hideSelectedLabels
        />
        <MultiSelect
          options={[{ value: ALL_REGIONS, label: ALL_REGIONS }, ...regions.map((r) => ({ value: r, label: r }))]}
          value={regionFilter}
          onChange={(v) => updateQuery({ region: toggleAllRegions(regionFilter, v).join(",") })}
          placeholder="Регион"
          searchPlaceholder="Поиск региона..."
          className="w-[200px]"
        />
        <Select
          value={productClass}
          items={{ "": "Все классы", ...classLabels }}
          onValueChange={(v) => updateQuery({ class: v || null })}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Класс" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="" label="Все классы">Все классы</SelectItem>
            {Object.entries(classLabels).map(([k, v]) => <SelectItem key={k} value={k} label={v}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select
          value={sortBy}
          items={SORT_ITEMS}
          onValueChange={(v) => updateQuery({ sort: v ?? "rating" })}
        >
          <SelectTrigger className="w-[190px] justify-between">
            <SelectValue placeholder="Сортировка" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="rating" label="По рейтингу">По рейтингу</SelectItem>
            <SelectItem value="price_asc" label="Сначала дешевле">Сначала дешевле</SelectItem>
            <SelectItem value="price_desc" label="Сначала дороже">Сначала дороже</SelectItem>
            <SelectItem value="name" label="По названию">По названию</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results */}
      {capped && (
        <div className="bg-orange-accent/10 border border-orange-accent/30 rounded-lg p-3 mb-4 text-sm text-orange-accent">
          Показаны первые {products.length} из {total} товаров. Уточните поиск или фильтры, чтобы сузить выдачу.
        </div>
      )}
      {products.length === 0 ? (
        <div className="border rounded-lg p-12 text-center text-muted-foreground">
          <SlidersHorizontal className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg">Товары не найдены</p>
          <p className="text-sm mt-2">{activeFiltersCount > 0 ? "Измените или сбросьте фильтры" : "В этой категории пока нет товаров"}</p>
          {classifiers.length > 0 && <Button variant="link" onClick={() => updateQuery({ classifier: null })} className="mt-2">Показать все товары</Button>}
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(([path, items]) => (
            <div key={path}>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Badge variant="secondary" className="font-mono">{path}</Badge> {items[0]?.treeItemName}
              </h2>
              {grouped.length > 1 ? (
                /* Несколько категорий — горизонтальная прокрутка со стрелками */
                <div className="relative">
                  {scrollerState[path]?.canLeft && (
                    <button
                      type="button"
                      onClick={() => scrollScroller(path, -1)}
                      className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-9 w-9 rounded-full border bg-background/90 shadow-md flex items-center justify-center hover:bg-accent transition-colors"
                      title="Прокрутить влево"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                  )}
                  <div
                    ref={(el) => attachScroller(path, el)}
                    onScroll={(e) => updateScrollerState(path, e.currentTarget)}
                    className="flex gap-3 overflow-x-auto pb-2 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden scroll-smooth"
                  >
                    {items.map((product) => renderProductCard(product, "w-72 shrink-0"))}
                    {canAddProduct && renderGiveCard("w-72 shrink-0")}
                  </div>
                  {scrollerState[path]?.canRight && (
                    <button
                      type="button"
                      onClick={() => scrollScroller(path, 1)}
                      className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-9 w-9 rounded-full border bg-background/90 shadow-md flex items-center justify-center hover:bg-accent transition-colors"
                      title="Прокрутить вправо"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ) : (
                /* Одна категория — вертикальная сетка по 5 в строке */
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  {items.map((product) => renderProductCard(product))}
                  {canAddProduct && renderGiveCard()}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Попап отзывов компании */}
      {reviewPopup && (
        <Dialog open={!!reviewPopup} onOpenChange={closeReviewsPopup}>
          <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader className="min-w-0">
              <DialogTitle className="break-words">Отзывы — {reviewPopup.name}</DialogTitle>
              <DialogDescription>
                {reviewsList === null
                  ? "Загрузка..."
                  : reviewsList.length > 0
                    ? `Всего отзывов: ${reviewsList.length}`
                    : "Отзывов пока нет"}
              </DialogDescription>
            </DialogHeader>
            {reviewsList === null ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : reviewsList.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Будьте первым, кто оставит отзыв
              </p>
            ) : (
              <div className="space-y-3 min-w-0">
                {reviewsList.map((r) => {
                  const isExpanded = expandedReviewId === r.id;
                  return (
                    <div key={r.id} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-sm font-medium break-words min-w-0">{r.authorNick}</span>
                        <StarRating rating={r.weightedAverage} size="sm" />
                      </div>
                      <p className="text-sm mb-1 wrap-anywhere whitespace-pre-wrap">{r.comment}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(r.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
                      </p>
                      {r.criteria.length > 0 && (
                        <div className="mt-2">
                          <button
                            type="button"
                            onClick={() => setExpandedReviewId(isExpanded ? null : r.id)}
                            className="text-xs text-menthol hover:underline cursor-pointer"
                          >
                            {isExpanded ? "Скрыть оценки по критериям" : "Показать оценки по критериям"}
                          </button>
                          {isExpanded && (
                            <div className="mt-2 space-y-1 border-t pt-2">
                              {r.criteria.map((c) => (
                                <div key={c.criteriaIndex} className="flex items-center justify-between gap-2 text-xs">
                                  <span className="text-muted-foreground">
                                    {c.criteriaIndex}. {COMPANY_CRITERIA_LABELS[c.criteriaIndex - 1] || "Критерий"}
                                  </span>
                                  <span className="font-medium flex-shrink-0">{c.score}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
