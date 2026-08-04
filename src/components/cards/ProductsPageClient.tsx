"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProductTree } from "@/components/tree/ProductTree";
import { GuestGuard } from "@/components/shared/GuestGuard";
import { Plus, FilePlus, AlertCircle } from "lucide-react";

interface FlatItem {
  id: string;
  name: string;
  parentId: string | null;
  inBranchNumber: number;
  fullNumberPath: string;
  description: string | null;
  productCount: number;
  docCount: number;
}

export function ProductsPageClient({ items }: { items: FlatItem[] }) {
  return (
    <div>
      {/* Notification banner per TZ §5 - clicking a row goes to Matrix */}
      <div className="bg-menthol/5 border border-menthol/20 rounded-lg p-3 mb-6 flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-menthol flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-menthol">Как пользоваться классификатором</p>
          <p className="text-muted-foreground">
            Выберите категорию и нажмите <strong>«Товары»</strong> — откроется матрица материалов с фильтром по выбранной категории.
            Нажмите <strong>«Документы»</strong> — перейдёте в библиотеку с документами по этой теме.
          </p>
        </div>
      </div>

      {/* Action buttons per TZ 5.1 */}
      <div className="flex flex-wrap gap-2 mb-6">
        <GuestGuard actionLabel="Добавить свой продукт">
          <Link href="/company/products">
            <Button size="sm" className="bg-menthol hover:bg-menthol-dark gap-1">
              <Plus className="h-4 w-4" /> Добавить свой продукт
            </Button>
          </Link>
        </GuestGuard>
        <GuestGuard actionLabel="Добавить документ">
          <Link href="/account/library">
            <Button size="sm" variant="outline" className="gap-1">
              <FilePlus className="h-4 w-4" /> Добавить документ
            </Button>
          </Link>
        </GuestGuard>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-muted-foreground">Класс товара:</span>
          {["STANDARD", "COMFORT", "BUSINESS", "PREMIUM"].map((cls) => (
            <Link key={cls} href={`/matrix?class=${cls}`}>
              <Badge variant="outline" className="cursor-pointer hover:bg-secondary text-xs">
                {cls === "STANDARD" ? "Стандарт" : cls === "COMFORT" ? "Комфорт" : cls === "BUSINESS" ? "Бизнес" : "Премиум"}
              </Badge>
            </Link>
          ))}
        </div>
      </div>

      <ProductTree items={items} />
    </div>
  );
}
