"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductTree } from "@/components/tree/ProductTree";
import { GuestGuard } from "@/components/shared/GuestGuard";
import { Plus, FilePlus, Search, X } from "lucide-react";

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
  const { data: session } = useSession();
  const [search, setSearch] = useState("");

  // Добавлять продукты могут только пользователи с ролью компании
  const isCompany = (session?.user as { type?: string })?.type === "COMPANY";

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;

    const lower = search.toLowerCase();
    const matchingIds = new Set<string>();

    // Find items matching search
    for (const item of items) {
      if (
        item.name.toLowerCase().includes(lower) ||
        item.fullNumberPath === search.trim()
      ) {
        matchingIds.add(item.id);
      }
    }

    if (matchingIds.size === 0) return [];

    // Build a parent map for ancestor lookup
    const parentMap = new Map<string, string | null>();
    for (const item of items) {
      parentMap.set(item.id, item.parentId);
    }

    // Include ancestors of matching items
    for (const id of [...matchingIds]) {
      let parentId = parentMap.get(id);
      while (parentId) {
        if (matchingIds.has(parentId)) break; // already included
        matchingIds.add(parentId);
        parentId = parentMap.get(parentId) ?? null;
      }
    }

    return items.filter((item) => matchingIds.has(item.id));
  }, [items, search]);

  const isSearching = search.trim().length > 0;

  return (
    <div>
      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Поиск по названию или номеру классификатора..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 pr-9"
        />
        {search && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
            onClick={() => setSearch("")}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      

      {/* Action buttons per TZ 5.1 */}
      <div className="flex flex-wrap gap-2 mb-6">
        {/* Вариант Б из ТЗ: кнопка видна всем, гостей встречает модалка */}
        <GuestGuard actionLabel="Добавить свой продукт">
          <Link href={isCompany ? "/company/products" : "/register/company"}>
            <Button size="sm" className="bg-menthol hover:bg-menthol-dark gap-1">
              <Plus className="h-4 w-4" /> Добавить свой продукт
            </Button>
          </Link>
        </GuestGuard>
        <GuestGuard actionLabel="Добавить документ">
          <Link href={isCompany ? "/company/library" : "/account/library"}>
            <Button size="sm" variant="outline" className="gap-1">
              <FilePlus className="h-4 w-4" /> Добавить документ
            </Button>
          </Link>
        </GuestGuard>
        
      </div>

      {filteredItems.length === 0 && isSearching ? (
        <div className="border rounded-lg p-12 text-center text-muted-foreground">
          <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg">Ничего не найдено</p>
          <p className="text-sm mt-2">Попробуйте изменить поисковый запрос</p>
        </div>
      ) : (
        <ProductTree items={filteredItems} expandAll={isSearching} />
      )}
    </div>
  );
}
