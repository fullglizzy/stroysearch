"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { MultiSelect } from "@/components/shared/MultiSelect";
import { ProductCard } from "@/components/shared/ProductCard";
import { cn } from "@/lib/utils";
import { matchClassifier } from "@/lib/classifier";
import { PageBanner } from "@/components/shared/PageBanner";
import { Search, SlidersHorizontal, Plus, X, Filter, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";

interface ProductRow {
  id: string; companyName: string; companyInn: string; companyId: string;
  name: string; classes: string[]; region: string | null; imageUrl: string | null;
  unit: string | null; characteristics: string[]; price: number | null;
  views: number; treeItemPath: string; treeItemName: string;
  companyRating: number | null; companyPhone: string | null; companyEmail: string | null;
}

interface TreeItem { id: string; name: string; fullNumberPath: string; }

interface Props {
  products: ProductRow[];
  treeItems: TreeItem[];
  regions: string[];
  moderatorText: string | null;
  pageTitle: string | null;
  bannerUrl: string | null;
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

export function MatrixPageClient({ products, treeItems, regions, moderatorText, pageTitle, bannerUrl }: Props) {
  const { data: session } = useSession();
  const searchParams = useSearchParams();

  // Добавлять аналоги могут только компании и админы
  const userType = (session?.user as any)?.type as string;
  const canAddProduct =
    !!session?.user &&
    (userType === "COMPANY" || ["MODERATOR", "EDITOR", "SUPER", "ROOT"].includes(userType));

  const [search, setSearch] = useState("");
  const initialClassifiers = (searchParams.get("classifier") || "").split(",").filter(Boolean);
  const [classifiers, setClassifiers] = useState<string[]>(initialClassifiers);
  const [productClass, setProductClass] = useState(searchParams.get("class") || "");
  const [regionFilter, setRegionFilter] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<"rating" | "price_asc" | "price_desc" | "name">("rating");
  const [revals, setRevals] = useState<Record<string, Record<string, boolean>>>({});
  const [showFilters, setShowFilters] = useState(false);
  const scrollerRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [scrollerState, setScrollerState] = useState<Record<string, { canLeft: boolean; canRight: boolean }>>({});

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

  const currentClassifierName = useMemo(() => {
    if (classifiers.length !== 1) return null;
    const found = treeItems.find(t => t.fullNumberPath === classifiers[0]);
    return found ? `${found.fullNumberPath} — ${found.name}` : classifiers[0];
  }, [classifiers, treeItems]);

  const activeFiltersCount = [classifiers.length > 0, productClass !== "", regionFilter.length > 0].filter(Boolean).length;

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())
        && !p.companyName.toLowerCase().includes(search.toLowerCase())) return false;
      if (classifiers.length > 0 && !classifiers.includes(p.treeItemPath)) return false;
      if (productClass !== "" && !p.classes.includes(productClass)) return false;
      if (regionFilter.length > 0 && (!p.region || !regionFilter.includes(p.region))) return false;
      return true;
    });
  }, [products, search, classifiers, productClass, regionFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, ProductRow[]>();
    for (const p of filtered) {
      const key = p.treeItemPath;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    // Сортировка внутри каждой категории (по умолчанию — по рейтингу)
    for (const list of map.values()) {
      list.sort((a, b) => {
        if (sortBy === "price_asc") return (a.price ?? Infinity) - (b.price ?? Infinity);
        if (sortBy === "price_desc") return (b.price ?? -Infinity) - (a.price ?? -Infinity);
        if (sortBy === "name") return a.name.localeCompare(b.name, "ru");
        return (b.companyRating ?? -Infinity) - (a.companyRating ?? -Infinity);
      });
    }
    return Array.from(map.entries());
  }, [filtered, sortBy]);

  // Пересчёт видимости стрелок при смене категорий/ресайзе
  useEffect(() => {
    const measure = () => {
      for (const [path, el] of Object.entries(scrollerRefs.current)) {
        if (el) updateScrollerState(path, el);
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [grouped]);

  const handleReveal = async (companyId: string, field: string) => {
    setRevals((prev) => ({
      ...prev, [companyId]: { ...prev[companyId], [field]: !prev[companyId]?.[field] },
    }));
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

      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-2 mb-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Поиск по товару или компании..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select
          value={sortBy}
          items={SORT_ITEMS}
          onValueChange={(v) => setSortBy((v ?? "rating") as typeof sortBy)}
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
        <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="h-10 px-3 gap-1">
          <Filter className="h-4 w-4" /> Фильтры {activeFiltersCount > 0 && <Badge variant="secondary" className="ml-1 text-[10px] px-1 h-4">{activeFiltersCount}</Badge>}
        </Button>
        {(classifiers.length > 0 || productClass !== "" || regionFilter.length > 0) && (
          <Button variant="ghost" size="sm" onClick={() => { setClassifiers([]); setProductClass(""); setRegionFilter([]); }} className="h-10 px-3 text-muted-foreground gap-1"><X className="h-3 w-3" /> Сбросить</Button>
        )}
      </div>

      {/* Active chips */}
      {(classifiers.length > 0 || productClass !== "" || regionFilter.length > 0) && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {classifiers.map((c) => {
            const item = treeItems.find((t) => t.fullNumberPath === c);
            return (
              <Badge key={c} variant="secondary" className="gap-1 cursor-pointer" onClick={() => setClassifiers(classifiers.filter((v) => v !== c))}>
                {c}{item ? ` — ${item.name}` : ""} <X className="h-3 w-3" />
              </Badge>
            );
          })}
          {productClass !== "" && <Badge variant="secondary" className="gap-1 cursor-pointer" onClick={() => setProductClass("")}>{classLabels[productClass]} <X className="h-3 w-3" /></Badge>}
          {regionFilter.map((r) => (
            <Badge key={r} variant="secondary" className="gap-1 cursor-pointer" onClick={() => setRegionFilter(regionFilter.filter((v) => v !== r))}>{r} <X className="h-3 w-3" /></Badge>
          ))}
        </div>
      )}

      {/* Expandable filters */}
      {showFilters && (
        <Card className="mb-6 animate-in fade-in slide-in-from-top-2">
          <CardContent className="pb-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Классификатор</Label>
                <MultiSelect
                  options={treeItems.map((t) => ({ value: t.fullNumberPath, label: `${t.fullNumberPath} — ${t.name}` }))}
                  value={classifiers}
                  onChange={setClassifiers}
                  placeholder="Все категории"
                  searchPlaceholder="Поиск категории..."
                  filter={matchClassifier}
                  hideSelectedLabels
                />
              </div>
              
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Регион</Label>
                <MultiSelect
                  options={regions.map((r) => ({ value: r, label: r }))}
                  value={regionFilter}
                  onChange={setRegionFilter}
                  placeholder="Любой регион"
                  searchPlaceholder="Поиск региона..."
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Класс товара</Label>
                <Select
                  value={productClass}
                  items={{ "": "Все классы", ...classLabels }}
                  onValueChange={(v) => setProductClass(v || "")}
                >
                  <SelectTrigger><SelectValue placeholder="Все классы" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="" label="Все классы">Все классы</SelectItem>
                    {Object.entries(classLabels).map(([k, v]) => <SelectItem key={k} value={k} label={v}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="border rounded-lg p-12 text-center text-muted-foreground">
          <SlidersHorizontal className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg">Товары не найдены</p>
          <p className="text-sm mt-2">{activeFiltersCount > 0 ? "Измените или сбросьте фильтры" : "В этой категории пока нет товаров"}</p>
          {classifiers.length > 0 && <Button variant="link" onClick={() => setClassifiers([])} className="mt-2">Показать все товары</Button>}
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
                    ref={(el) => { scrollerRefs.current[path] = el; }}
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
                /* Одна категория — вертикальная сетка по 4 в строке */
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {items.map((product) => renderProductCard(product))}
                  {canAddProduct && renderGiveCard()}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
