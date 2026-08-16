"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pagination } from "@/components/shared/Pagination";
import { ShieldCheck, Search } from "lucide-react";

interface LogRow {
  id: string;
  adminName: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  payload: string | null;
  createdAt: Date;
}

const ACTION_LABELS: Record<string, string> = {
  ban: "Бан",
  unban: "Разбан",
  coins: "Монеты",
  content: "Контент",
  billing: "Биллинг",
  gift: "Подарки",
  payout: "Выплаты",
  review: "Отзывы",
  tree: "Дерево",
};

interface Props {
  logs: LogRow[];
  total: number;
  page: number;
  totalPages: number;
  action: string;
  q: string;
}

export function AuditLog({ logs, total, page, totalPages, action, q }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState(q);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function updateQuery(next: Record<string, string | null>) {
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(next)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    const qs = params.toString();
    router.replace(qs ? `/admin/audit?${qs}` : "/admin/audit", { scroll: false });
  }

  function handleSearchChange(value: string) {
    setSearch(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      updateQuery({ q: value, page: null });
    }, 300);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по админу или сущности..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={action}
          items={Object.fromEntries([["", "Все действия"], ...Object.entries(ACTION_LABELS)])}
          onValueChange={(v) => updateQuery({ action: v ?? "", page: null })}
        >
          <SelectTrigger className="w-56 justify-between">
            <SelectValue placeholder="Все действия" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="" label="Все действия">Все действия</SelectItem>
            {Object.entries(ACTION_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value} label={label}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {logs.length === 0 ? (
        <div className="border rounded-lg p-12 text-center text-muted-foreground">
          <ShieldCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg">Записей нет</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((l) => (
            <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 border rounded-lg px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{l.adminName}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {ACTION_LABELS[l.action] || l.action}
                  </Badge>
                  {l.entityType && (
                    <span className="text-xs text-muted-foreground">{l.entityType}</span>
                  )}
                  {l.entityId && (
                    <span className="text-xs font-mono text-muted-foreground truncate max-w-[200px]">
                      {l.entityId}
                    </span>
                  )}
                </div>
                {l.payload && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-xl">{l.payload}</p>
                )}
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                {new Date(l.createdAt).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Всего: {total} записей</span>
        {totalPages > 1 && (
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={(p) => updateQuery({ page: String(p) })} />
        )}
      </div>
    </div>
  );
}
