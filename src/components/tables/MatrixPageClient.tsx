"use client";

import { useState, useMemo } from "react";
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
import { EyeButton } from "@/components/shared/EyeButton";
import { StarRating } from "@/components/shared/StarRating";
import { cn } from "@/lib/utils";
import { Search, SlidersHorizontal, Plus, X, Filter } from "lucide-react";

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
  moderatorText: string | null;
  bannerUrl: string | null;
}

const classLabels: Record<string, string> = {
  STANDARD: "Стандарт", COMFORT: "Комфорт", BUSINESS: "Бизнес", PREMIUM: "Премиум",
};

export function MatrixPageClient({ products, treeItems, moderatorText, bannerUrl }: Props) {
  const { data: session } = useSession();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState("");
  const [classifier, setClassifier] = useState(searchParams.get("classifier") || "all");
  const [productClass, setProductClass] = useState(searchParams.get("class") || "all");
  const [region, setRegion] = useState("");
  const [revals, setRevals] = useState<Record<string, Record<string, boolean>>>({});
  const [showFilters, setShowFilters] = useState(false);

  const currentClassifierName = useMemo(() => {
    if (classifier === "all") return null;
    const found = treeItems.find(t => t.fullNumberPath === classifier);
    return found ? `${found.fullNumberPath} — ${found.name}` : classifier;
  }, [classifier, treeItems]);

  const activeFiltersCount = [classifier !== "all", productClass !== "all", !!region].filter(Boolean).length;

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())
        && !p.companyName.toLowerCase().includes(search.toLowerCase())) return false;
      if (classifier !== "all" && p.treeItemPath !== classifier) return false;
      if (productClass !== "all" && !p.classes.includes(productClass)) return false;
      if (region && p.region !== region) return false;
      return true;
    });
  }, [products, search, classifier, productClass, region]);

  const grouped = useMemo(() => {
    const map = new Map<string, ProductRow[]>();
    for (const p of filtered) {
      const key = p.treeItemPath;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const handleReveal = async (companyId: string, field: string) => {
    setRevals((prev) => ({
      ...prev, [companyId]: { ...prev[companyId], [field]: !prev[companyId]?.[field] },
    }));
    try { await fetch(`/api/suppliers/metrics/${companyId}/click`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ field }) }); } catch { /* */ }
  };

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

      <h1 className="text-3xl font-bold mb-2">Даешь аналог! Матрица материалов</h1>
      <p className="text-muted-foreground mb-2">
        Конкурентная таблица — сравнение аналогов по цене, характеристикам и классу
      </p>

      {/* Баннер (ТЗ §7.1) */}
      {bannerUrl && (
        <div className="mb-4 rounded-lg overflow-hidden">
          <img src={bannerUrl} alt="Баннер матрицы" className="w-full h-auto max-h-48 object-cover" />
        </div>
      )}

      {/* Текст модератора (ТЗ §7.1) */}
      {moderatorText && (
        <div
          className="prose prose-gray max-w-none text-muted-foreground mb-6 text-sm"
          dangerouslySetInnerHTML={{ __html: moderatorText }}
        />
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-2 mb-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Поиск по товару или компании..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="gap-1">
          <Filter className="h-4 w-4" /> Фильтры {activeFiltersCount > 0 && <Badge variant="secondary" className="ml-1 text-[10px] px-1 h-4">{activeFiltersCount}</Badge>}
        </Button>
        {(classifier !== "all" || productClass !== "all" || region) && (
          <Button variant="ghost" size="sm" onClick={() => { setClassifier("all"); setProductClass("all"); setRegion(""); }} className="text-muted-foreground gap-1"><X className="h-3 w-3" /> Сбросить</Button>
        )}
      </div>

      {/* Active chips */}
      {(classifier !== "all" || productClass !== "all" || region) && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {classifier !== "all" && currentClassifierName && <Badge variant="secondary" className="gap-1 cursor-pointer" onClick={() => setClassifier("all")}>{classifier} <X className="h-3 w-3" /></Badge>}
          {productClass !== "all" && <Badge variant="secondary" className="gap-1 cursor-pointer" onClick={() => setProductClass("all")}>{classLabels[productClass]} <X className="h-3 w-3" /></Badge>}
          {region && <Badge variant="secondary" className="gap-1 cursor-pointer" onClick={() => setRegion("")}>{region} <X className="h-3 w-3" /></Badge>}
        </div>
      )}

      {/* Expandable filters */}
      {showFilters && (
        <Card className="mb-6 animate-in fade-in slide-in-from-top-2">
          <CardContent className="pb-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Классификатор</Label>
                <Select value={classifier} onValueChange={(v) => setClassifier(v || "all")}>
                  <SelectTrigger><SelectValue placeholder="Все категории" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все категории</SelectItem>
                    {treeItems.map((t) => <SelectItem key={t.id} value={t.fullNumberPath}>{t.fullNumberPath} — {t.name.slice(0, 50)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Класс товара</Label>
                <Select value={productClass} onValueChange={(v) => setProductClass(v || "all")}>
                  <SelectTrigger><SelectValue placeholder="Все классы" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все классы</SelectItem>
                    {Object.entries(classLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Регион</Label>
                <Input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="Любой регион" />
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
          {classifier !== "all" && <Button variant="link" onClick={() => setClassifier("all")} className="mt-2">Показать все товары</Button>}
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(([path, items]) => (
            <div key={path}>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Badge variant="secondary" className="font-mono">{path}</Badge> {items[0]?.treeItemName}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {items.map((product) => {
                  const rev = revals[product.companyId] || {};
                  return (
                    <Card key={product.id} className="flex flex-col">
                      <CardContent className="pt-3 flex-1 flex flex-col">
                        <div className="text-xs text-muted-foreground mb-2">
                          <span className="font-medium text-foreground">{product.companyName}</span>
                          <span className="ml-1">ИНН {product.companyInn}</span>
                        </div>
                        {product.companyRating !== null && (
                          <div className="flex items-center gap-1 mb-2"><StarRating rating={product.companyRating} size="sm" /><span className="text-xs text-muted-foreground">{product.companyRating}/100</span></div>
                        )}
                        <h3 className="font-semibold text-sm mb-2">{product.name}</h3>
                        <div className="bg-secondary rounded-md h-28 mb-2 flex items-center justify-center text-muted-foreground text-xs">
                          {product.imageUrl ? <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover rounded-md" /> : "Нет фото"}
                        </div>
                        <div className="flex items-baseline gap-1 mb-2">
                          <span className="text-lg font-bold text-menthol">{product.price !== null ? `${product.price.toLocaleString("ru-RU")} ₽` : "Цена по запросу"}</span>
                          {product.unit && <span className="text-xs text-muted-foreground">/ {product.unit}</span>}
                        </div>
                        <div className="flex flex-wrap gap-1 mb-2">
                          {product.classes.map((c) => <Badge key={c} variant="outline" className="text-[10px]">{classLabels[c] || c}</Badge>)}
                        </div>
                        {product.region && <p className="text-xs text-muted-foreground mb-2">{product.region}</p>}
                        {product.characteristics.length > 0 && (
                          <div className="text-xs text-muted-foreground mb-3 space-y-0.5">
                            {product.characteristics.map((ch, i) => <div key={i}>{ch}</div>)}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-auto pt-2 border-t">
                          {product.companyPhone && (rev.phone ? <span className="text-xs">{product.companyPhone}</span> : <EyeButton onClick={() => handleReveal(product.companyId, "phone")} />)}
                          {product.companyEmail && (rev.email ? <span className="text-xs">{product.companyEmail}</span> : <EyeButton onClick={() => handleReveal(product.companyId, "email")} />)}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                {/* Give analog card */}
                <Card className="flex flex-col border-dashed border-menthol/50 bg-menthol/5">
                  <CardContent className="flex-1 flex flex-col items-center justify-center text-center">
                    <Plus className="h-8 w-8 text-menthol mb-2" />
                    <p className="text-sm font-medium text-menthol mb-1">Дать аналог</p>
                    <p className="text-xs text-muted-foreground mb-3">Добавьте свой продукт</p>
                    {session?.user ? (
                      <Link href="/company/products" className={cn(buttonVariants({ size: "sm" }), "bg-menthol hover:bg-menthol-dark")}>Добавить</Link>
                    ) : (
                      <Link href="/login" className={cn(buttonVariants({ size: "sm", variant: "outline" }))}>Войти</Link>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
