"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EyeButton } from "@/components/shared/EyeButton";
import { StarRating } from "@/components/shared/StarRating";
import { cn } from "@/lib/utils";
import { Search, SlidersHorizontal, Plus } from "lucide-react";

interface ProductRow {
  id: string;
  companyName: string;
  companyInn: string;
  companyId: string;
  name: string;
  classes: string[];
  region: string | null;
  imageUrl: string | null;
  unit: string | null;
  characteristics: string[];
  price: number | null;
  views: number;
  treeItemPath: string;
  treeItemName: string;
  companyRating: number | null;
  companyPhone: string | null;
  companyEmail: string | null;
}

interface TreeItem {
  id: string;
  name: string;
  fullNumberPath: string;
}

interface Props {
  products: ProductRow[];
  treeItems: TreeItem[];
}

const classLabels: Record<string, string> = {
  STANDARD: "Стандарт",
  COMFORT: "Комфорт",
  BUSINESS: "Бизнес",
  PREMIUM: "Премиум",
};

export function MatrixPageClient({ products, treeItems }: Props) {
  const { data: session } = useSession();
  const [search, setSearch] = useState("");
  const [classifier, setClassifier] = useState("all");
  const [productClass, setProductClass] = useState("all");
  const [region, setRegion] = useState("");
  const [revals, setRevals] = useState<Record<string, Record<string, boolean>>>({});

  const regions = useMemo(() => {
    const set = new Set(products.map((p) => p.region).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [products]);

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
      ...prev,
      [companyId]: { ...prev[companyId], [field]: !prev[companyId]?.[field] },
    }));
    try {
      await fetch(`/api/suppliers/metrics/${companyId}/click`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field }),
      });
    } catch { /* silent */ }
  };

  return (
    <div className="container-page py-8">
      <h1 className="text-3xl font-bold mb-2">Даешь аналог! Матрица материалов</h1>
      <p className="text-muted-foreground mb-6">
        Конкурентная таблица — сравнение аналогов по цене, характеристикам и классу
      </p>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Поиск по названию..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={classifier} onValueChange={(v) => setClassifier(v || "all")}>
              <SelectTrigger>
                <SelectValue placeholder="Классификатор" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все категории</SelectItem>
                {treeItems.map((t) => (
                  <SelectItem key={t.id} value={t.fullNumberPath}>
                    {t.fullNumberPath} — {t.name.slice(0, 40)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={productClass} onValueChange={(v) => setProductClass(v || "all")}>
              <SelectTrigger>
                <SelectValue placeholder="Класс товара" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все классы</SelectItem>
                {Object.entries(classLabels).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Input
                placeholder="Регион"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {grouped.length === 0 ? (
        <div className="border rounded-lg p-12 text-center text-muted-foreground">
          <SlidersHorizontal className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg">Товары не найдены</p>
          <p className="text-sm mt-2">Измените параметры фильтрации или добавьте свой продукт</p>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(([path, items]) => (
            <div key={path}>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Badge variant="secondary" className="font-mono">{path}</Badge>
                {items[0]?.treeItemName}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {items.map((product) => {
                  const rev = revals[product.companyId] || {};
                  return (
                    <Card key={product.id} className="flex flex-col">
                      <CardContent className="pt-4 flex-1 flex flex-col">
                        {/* Company info */}
                        <div className="text-xs text-muted-foreground mb-2">
                          <span className="font-medium text-foreground">{product.companyName}</span>
                          <span className="ml-1">ИНН {product.companyInn}</span>
                        </div>

                        {/* Rating */}
                        {product.companyRating !== null && (
                          <div className="flex items-center gap-1 mb-2">
                            <StarRating rating={product.companyRating} size="sm" />
                            <span className="text-xs text-muted-foreground">{product.companyRating}/100</span>
                          </div>
                        )}

                        {/* Product name */}
                        <h3 className="font-semibold text-sm mb-2">{product.name}</h3>

                        {/* Image placeholder */}
                        <div className="bg-secondary rounded-md h-32 mb-3 flex items-center justify-center text-muted-foreground text-xs">
                          {product.imageUrl ? (
                            <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover rounded-md" />
                          ) : (
                            "Нет изображения"
                          )}
                        </div>

                        {/* Price */}
                        <div className="flex items-baseline gap-1 mb-3">
                          <span className="text-xl font-bold text-menthol">
                            {product.price !== null ? `${product.price.toLocaleString("ru-RU")} ₽` : "Цена по запросу"}
                          </span>
                          {product.unit && (
                            <span className="text-xs text-muted-foreground">/ {product.unit}</span>
                          )}
                        </div>

                        {/* Classes */}
                        <div className="flex flex-wrap gap-1 mb-2">
                          {product.classes.map((c) => (
                            <Badge key={c} variant="outline" className="text-[10px]">
                              {classLabels[c] || c}
                            </Badge>
                          ))}
                        </div>

                        {/* Region */}
                        {product.region && (
                          <p className="text-xs text-muted-foreground mb-2">{product.region}</p>
                        )}

                        {/* Characteristics */}
                        {product.characteristics.length > 0 && (
                          <div className="text-xs text-muted-foreground mb-3 space-y-0.5">
                            {product.characteristics.map((ch, i) => (
                              <div key={i}>{ch}</div>
                            ))}
                          </div>
                        )}

                        {/* Contacts (eye button) */}
                        <div className="flex items-center gap-2 mt-auto pt-2 border-t">
                          {product.companyPhone && (
                            <div className="flex items-center gap-1">
                              {rev.phone ? (
                                <span className="text-xs">{product.companyPhone}</span>
                              ) : (
                                <EyeButton onClick={() => handleReveal(product.companyId, "phone")} />
                              )}
                            </div>
                          )}
                          {product.companyEmail && (
                            <div className="flex items-center gap-1">
                              {rev.email ? (
                                <span className="text-xs">{product.companyEmail}</span>
                              ) : (
                                <EyeButton onClick={() => handleReveal(product.companyId, "email")} />
                              )}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                {/* "Give analog" card */}
                <Card className="flex flex-col border-dashed border-menthol/50 bg-menthol/5">
                  <CardContent className="pt-6 flex-1 flex flex-col items-center justify-center text-center">
                    <Plus className="h-8 w-8 text-menthol mb-2" />
                    <p className="text-sm font-medium text-menthol mb-1">Дать аналог</p>
                    <p className="text-xs text-muted-foreground mb-3">
                      Добавьте свой продукт в эту категорию
                    </p>
                    {session?.user ? (
                      <Link
                        href="/company/products"
                        className={cn(buttonVariants({ size: "sm" }), "bg-menthol hover:bg-menthol-dark")}
                      >
                        Добавить продукт
                      </Link>
                    ) : (
                      <Link
                        href="/login"
                        className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
                      >
                        Войти
                      </Link>
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
