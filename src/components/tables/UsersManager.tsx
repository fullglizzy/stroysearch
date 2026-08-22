"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/shared/Pagination";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchSelect, type SearchSelectOption } from "@/components/shared/SearchSelect";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Search, Coins, Loader2, Users, Ban, RotateCcw, X, Download } from "lucide-react";
import { roleLabel } from "@/lib/roles";

interface UserRow {
  id: string;
  username: string;
  email: string;
  phone: string | null;
  status: string;
  type: string;
  firstName: string | null;
  lastName: string | null;
  nick: string | null;
  inn: string | null;
  regions: string | null;
  balance: number;
  roles: string[];
  banReason: string | null;
  createdAt: Date;
}

interface UserDetail {
  id: string;
  username: string;
  email: string;
  phone: string | null;
  status: string;
  type: string;
  createdAt: string;
  deletedAt: string | null;
  banReason: string | null;
  banHistory: { action: string; reason: string | null; adminId: string; createdAt: string }[];
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  balance: number;
  profile: {
    firstName: string | null;
    lastName: string | null;
    middleName: string | null;
    nick: string | null;
    regions: string | null;
    inn: string | null;
    companyName: string | null;
    kpp: string | null;
    legalAddress: string | null;
    directorName: string | null;
    isContactsHidden: boolean;
    roles: string[];
  } | null;
  company: {
    id: string;
    inn: string;
    name: string;
    phone: string | null;
    email: string | null;
    website: string | null;
    regions: string | null;
    metrics: {
      phoneViews: number;
      emailViews: number;
      websiteViews: number;
      ratingViews: number;
      reviewsViews: number;
    } | null;
  } | null;
  admin: { adminType: string; permissions: string } | null;
  stats: {
    givenReviews: number;
    receivedReviews: number;
    documents: number;
    conferences: number;
    products: number;
  };
}

interface UsersManagerProps {
  users: UserRow[];
  total: number;
  page: number;
  totalPages: number;
  initialQuery: string;
  initialStatus: string;
  initialType: string;
  initialRole: string;
  initialRegion: string;
  initialSort: string;
  regionOptions: SearchSelectOption[];
}

// CSV-строка регионов → «Регион1, Регион2»
function formatRegions(csv: string | null): string {
  return (csv || "")
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean)
    .join(", ");
}

const statusBadge: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  INACTIVE: "bg-gray-100 text-gray-700",
  BANNED: "bg-red-100 text-red-700",
  DELETED: "bg-red-100 text-red-700",
};

const statusLabel: Record<string, string> = {
  ACTIVE: "Активен",
  INACTIVE: "Неактивен",
  BANNED: "Забанен",
  DELETED: "Удалён",
};

const typeLabel: Record<string, string> = {
  COMMON: "Участник",
  COMPANY: "Компания",
  MODERATOR: "Модератор",
  EDITOR: "Редактор",
  SUPER: "Супер-админ",
  ROOT: "Root",
};

const ROLE_OPTIONS = [
  "PRODUCTOLOGIST",
  "TENDER_SPECIALIST",
  "DESIGNER",
  "COMPANY_OWNER",
  "OTHER",
];

/** Роль → русское название для Select (label показывается в триггере) */
const ROLE_ITEMS: Record<string, string> = Object.fromEntries(
  ROLE_OPTIONS.map((r) => [r, roleLabel(r)]),
);

const SORT_ITEMS: Record<string, string> = {
  created: "Сначала новые",
  name: "По имени",
};

/** Строка информации: «Заголовок: значение» */
function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium text-right break-all">{value ?? "—"}</span>
    </div>
  );
}

export function UsersManager({
  users,
  total,
  page,
  totalPages,
  initialQuery,
  initialStatus,
  initialType,
  initialRole,
  initialRegion,
  initialSort,
  regionOptions,
}: UsersManagerProps) {
  const router = useRouter();

  // ── Фильтры (живут в URL, данные отдаёт сервер) ──
  const [search, setSearch] = useState(initialQuery);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function updateQuery(next: Record<string, string | null>) {
    const params = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(next)) {
      if (v === null || v === "") params.delete(k);
      else params.set(k, v);
    }
    params.delete("page");
    router.replace(`/admin/users?${params.toString()}`, { scroll: false });
  }

  function handleSearchChange(value: string) {
    setSearch(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => updateQuery({ q: value || null }), 300);
  }

  const hasFilters =
    !!search || !!initialStatus || !!initialType || !!initialRole || !!initialRegion;

  // ── Попап пользователя ──
  const [userOpen, setUserOpen] = useState(false);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  // ── Бан ──
  const [banMode, setBanMode] = useState(false);
  const [banReason, setBanReason] = useState("");
  const [banLoading, setBanLoading] = useState(false);
  const [banError, setBanError] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBanOpen, setBulkBanOpen] = useState(false);
  const [bulkBanReason, setBulkBanReason] = useState("");
  const [bulkBanLoading, setBulkBanLoading] = useState(false);

  // ── Монеты ──
  const [addCoinsOpen, setAddCoinsOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [coinAmount, setCoinAmount] = useState("");
  const [coinLoading, setCoinLoading] = useState(false);
  const [coinError, setCoinError] = useState("");
  const [coinOperation, setCoinOperation] = useState<"add" | "subtract" | "set">("add");

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exportCsv() {
    const escapeCell = (v: string) =>
      v.includes(";") || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v;
    const header = ["Логин", "ФИО", "Тип", "Статус", "Email", "Монеты", "Причина бана"];
    const rows = users.map((u) =>
      [
        u.username,
        u.lastName && u.firstName ? `${u.lastName} ${u.firstName}` : "",
        typeLabel[u.type] || u.type,
        statusLabel[u.status] || u.status,
        u.email,
        u.balance.toFixed(1),
        u.banReason || "",
      ]
        .map(escapeCell)
        .join(";"),
    );
    const csv = "\uFEFF" + [header.join(";"), ...rows].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "users.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleBulkBan() {
    if (!bulkBanReason.trim()) return;
    setBulkBanLoading(true);
    for (const id of Array.from(selectedIds)) {
      await fetch(`/api/admin/users/${id}/ban`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: bulkBanReason.trim() }),
      }).catch(() => {});
    }
    setBulkBanLoading(false);
    setBulkBanOpen(false);
    setBulkBanReason("");
    setSelectedIds(new Set());
    router.refresh();
  }

  async function openUser(id: string) {
    setUserOpen(true);
    setDetail(null);
    setDetailError("");
    setBanMode(false);
    setBanReason("");
    setBanError("");
    setDetailLoading(true);

    try {
      const res = await fetch(`/api/admin/users/${id}`);
      if (res.ok) {
        setDetail(await res.json());
      } else {
        const data = await res.json().catch(() => ({}));
        setDetailError(data.error || "Не удалось загрузить пользователя");
      }
    } catch {
      setDetailError("Ошибка соединения");
    }
    setDetailLoading(false);
  }

  async function handleBan() {
    if (!detail) return;
    setBanLoading(true);
    setBanError("");

    try {
      const res = await fetch(`/api/admin/users/${detail.id}/ban`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: banReason }),
      });

      if (res.ok) {
        setBanMode(false);
        router.refresh();
        await openUser(detail.id);
      } else {
        const data = await res.json().catch(() => ({}));
        setBanError(data.error || "Не удалось забанить пользователя");
      }
    } catch {
      setBanError("Ошибка соединения");
    }
    setBanLoading(false);
  }

  async function handleUnban() {
    if (!detail) return;
    setBanLoading(true);
    setBanError("");

    try {
      const res = await fetch(`/api/admin/users/${detail.id}/unban`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (res.ok) {
        router.refresh();
        await openUser(detail.id);
      } else {
        const data = await res.json().catch(() => ({}));
        setBanError(data.error || "Не удалось разбанить пользователя");
      }
    } catch {
      setBanError("Ошибка соединения");
    }
    setBanLoading(false);
  }

  async function handleAddCoins() {
    if (!selectedUser || !coinAmount) return;
    setCoinLoading(true);
    setCoinError("");

    try {
      const res = await fetch("/api/admin/coins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser.id,
          amount: parseFloat(coinAmount),
          operation: coinOperation,
        }),
      });

      if (res.ok) {
        setAddCoinsOpen(false);
        setCoinOperation("add");
        router.refresh();
      } else {
        const data = await res.json();
        setCoinError(data.error || "Ошибка");
      }
    } catch {
      setCoinError("Ошибка соединения");
    }
    setCoinLoading(false);
  }

  const fio =
    detail?.profile?.lastName || detail?.profile?.firstName || detail?.profile?.middleName
      ? [detail.profile.lastName, detail.profile.firstName, detail.profile.middleName]
          .filter(Boolean)
          .join(" ")
      : null;

  return (
    <div className="space-y-4">
      {/* Панель фильтров */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по логину, email, ФИО..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={initialStatus || "all"}
          items={{ all: "Все статусы", ...statusLabel }}
          onValueChange={(v) => updateQuery({ status: v === "all" ? null : v })}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Статус" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" label="Все статусы">Все статусы</SelectItem>
            {Object.entries(statusLabel).map(([value, label]) => (
              <SelectItem key={value} value={value} label={label}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={initialType || "all"}
          items={{ all: "Все типы", ...typeLabel }}
          onValueChange={(v) => updateQuery({ type: v === "all" ? null : v })}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Тип" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" label="Все типы">Все типы</SelectItem>
            {Object.entries(typeLabel).map(([value, label]) => (
              <SelectItem key={value} value={value} label={label}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={initialRole || "all"}
          items={{ all: "Все роли", ...ROLE_ITEMS }}
          onValueChange={(v) => updateQuery({ role: v === "all" ? null : v })}
        >
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Роль" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" label="Все роли">Все роли</SelectItem>
            {ROLE_OPTIONS.map((r) => (
              <SelectItem key={r} value={r} label={roleLabel(r)}>{roleLabel(r)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="w-[200px]">
          <SearchSelect
            options={regionOptions}
            value={initialRegion}
            onChange={(v) => updateQuery({ region: v || null })}
            placeholder="Регион"
            searchPlaceholder="Поиск региона..."
          />
        </div>
        <Select
          value={initialSort}
          items={SORT_ITEMS}
          onValueChange={(v) => updateQuery({ sort: v === "created" ? null : v })}
        >
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Сортировка" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created" label="Сначала новые">Сначала новые</SelectItem>
            <SelectItem value="name" label="По имени">По имени</SelectItem>
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              updateQuery({ q: null, status: null, type: null, role: null, region: null });
            }}
          >
            <X className="h-3 w-3 mr-1" />
            Сбросить
          </Button>
        )}
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="h-3 w-3 mr-1" />
            Экспорт CSV
          </Button>
        </div>
      </div>

      {/* Панель массовых операций */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-red-300/50 bg-red-50/50 p-3 mb-4">
          <span className="text-sm font-medium">Выбрано: {selectedIds.size}</span>
          <Button size="sm" variant="destructive" onClick={() => setBulkBanOpen(true)}>
            <Ban className="h-3 w-3 mr-1" />
            Забанить выбранных
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
            Сбросить выбор
          </Button>
        </div>
      )}

      {users.length === 0 ? (
        <div className="border rounded-lg p-12 text-center text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg">Пользователи не найдены</p>
          <p className="text-sm mt-2">Измените параметры фильтра</p>
        </div>
      ) : (
      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={users.length > 0 && users.every((u) => selectedIds.has(u.id))}
                  onCheckedChange={() =>
                    setSelectedIds(
                      users.every((u) => selectedIds.has(u.id))
                        ? new Set()
                        : new Set(users.map((u) => u.id)),
                    )
                  }
                  aria-label="Выбрать всех пользователей"
                />
              </TableHead>
              <TableHead>Логин</TableHead>
              <TableHead>ФИО</TableHead>
              <TableHead>Тип</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Монеты</TableHead>
              <TableHead>Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow
                key={user.id}
                className="cursor-pointer hover:bg-secondary/50"
                onClick={() => openUser(user.id)}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedIds.has(user.id)}
                    onCheckedChange={() => toggleSelect(user.id)}
                    aria-label={`Выбрать пользователя ${user.username}`}
                  />
                </TableCell>
                <TableCell className="font-medium">
                  {user.username}
                  {user.banReason && (
                    <Ban className="h-3 w-3 inline ml-1.5 text-red-600" aria-label="Забанен" />
                  )}
                </TableCell>
                <TableCell>
                  {user.lastName && user.firstName
                    ? `${user.lastName} ${user.firstName}`
                    : "—"}
                </TableCell>
                <TableCell>{typeLabel[user.type] || user.type}</TableCell>
                <TableCell>
                  <Badge
                    variant="secondary"
                    className={statusBadge[user.status] || ""}
                  >
                    {statusLabel[user.status] || user.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">{user.email}</TableCell>
                <TableCell>
                  <span className="font-medium">{user.balance.toFixed(1)}</span>
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedUser(user);
                      setCoinAmount("");
                      setCoinOperation("add");
                      setAddCoinsOpen(true);
                    }}
                  >
                    <Coins className="h-3 w-3" />
                    Монеты
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      )}

      {/* Диалог массового бана */}
      <Dialog open={bulkBanOpen} onOpenChange={setBulkBanOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Забанить {selectedIds.size} пользователей?</DialogTitle>
            <DialogDescription>
              Укажите причину — она будет показана каждому забаненному при входе.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="bulk-ban-reason">Причина</Label>
            <Textarea
              id="bulk-ban-reason"
              rows={3}
              maxLength={500}
              value={bulkBanReason}
              onChange={(e) => setBulkBanReason(e.target.value)}
              placeholder="Например: нарушение правил платформы"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setBulkBanOpen(false)} disabled={bulkBanLoading}>
              Отмена
            </Button>
            <Button variant="destructive" onClick={handleBulkBan} disabled={bulkBanLoading || !bulkBanReason.trim()}>
              {bulkBanLoading && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
              Забанить
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Попап с информацией об аккаунте */}
      <Dialog open={userOpen} onOpenChange={setUserOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {detail ? detail.username : "Пользователь"}
              {detail && (
                <Badge
                  variant="secondary"
                  className={`text-xs ${statusBadge[detail.status] || ""}`}
                >
                  {statusLabel[detail.status] || detail.status}
                </Badge>
              )}
              {detail && (
                <Badge variant="outline" className="text-xs">
                  {typeLabel[detail.type] || detail.type}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>Вся информация об аккаунте</DialogDescription>
          </DialogHeader>

          {detailLoading && (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Загрузка...
            </div>
          )}

          {detailError && (
            <Alert variant="destructive">
              <AlertDescription>{detailError}</AlertDescription>
            </Alert>
          )}

          {detail && (
            <div className="space-y-5">
              {/* Бан */}
              {detail.status === "BANNED" && (
                <Alert variant="destructive">
                  <AlertDescription>
                    Аккаунт заблокирован. Причина: {detail.banReason || "не указана"}
                  </AlertDescription>
                </Alert>
              )}
              {detail.banHistory && detail.banHistory.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">История блокировок</p>
                  <div className="space-y-1">
                    {detail.banHistory.map((b, i) => (
                      <p key={i} className="text-xs text-muted-foreground">
                        {b.action === "BAN" ? "Бан" : "Разбан"} ·{" "}
                        {new Date(b.createdAt).toLocaleString("ru-RU", { day: "numeric", month: "short", year: "numeric" })}
                        {b.reason ? ` · ${b.reason}` : ""}
                      </p>
                    ))}
                  </div>
                </div>
              )}
              {banError && (
                <Alert variant="destructive">
                  <AlertDescription>{banError}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-1.5">
                <InfoRow label="Логин" value={detail.username} />
                <InfoRow label="Email" value={detail.email} />
                <InfoRow label="Телефон" value={detail.phone} />
                <InfoRow
                  label="Регистрация"
                  value={new Date(detail.createdAt).toLocaleString("ru-RU", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                />
                <InfoRow label="Баланс" value={`${detail.balance.toFixed(1)} монет`} />
                <InfoRow
                  label="Email подтверждён"
                  value={detail.isEmailVerified ? "Да" : "Нет"}
                />
                <InfoRow
                  label="Телефон подтверждён"
                  value={detail.isPhoneVerified ? "Да" : "Нет"}
                />
              </div>

              {/* Профиль */}
              {detail.profile && (
                <div className="space-y-1.5 border-t pt-3">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Профиль</p>
                  <InfoRow label="ФИО" value={fio} />
                  <InfoRow label="Ник" value={detail.profile.nick} />
                  <InfoRow label="Регион" value={formatRegions(detail.profile.regions)} />
                  <InfoRow
                    label="Роли"
                    value={detail.profile.roles.map(roleLabel).join(", ") || "нет"}
                  />
                  <InfoRow
                    label="Контакты скрыты"
                    value={detail.profile.isContactsHidden ? "Да" : "Нет"}
                  />
                  {detail.profile.inn && <InfoRow label="ИНН" value={detail.profile.inn} />}
                  {detail.profile.companyName && (
                    <InfoRow label="Название компании" value={detail.profile.companyName} />
                  )}
                  {detail.profile.kpp && <InfoRow label="КПП" value={detail.profile.kpp} />}
                  {detail.profile.legalAddress && (
                    <InfoRow label="Юр. адрес" value={detail.profile.legalAddress} />
                  )}
                  {detail.profile.directorName && (
                    <InfoRow label="Директор" value={detail.profile.directorName} />
                  )}
                </div>
              )}

              {/* Компания */}
              {detail.company && (
                <div className="space-y-1.5 border-t pt-3">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Компания</p>
                  <InfoRow label="Название" value={detail.company.name} />
                  <InfoRow label="ИНН" value={detail.company.inn} />
                  <InfoRow label="Телефон" value={detail.company.phone} />
                  <InfoRow label="Email" value={detail.company.email} />
                  <InfoRow label="Сайт" value={detail.company.website} />
                  <InfoRow label="Регион" value={formatRegions(detail.company.regions)} />
                  {detail.company.metrics && (
                    <div className="text-xs text-muted-foreground pt-1">
                      Просмотры: телефон {detail.company.metrics.phoneViews}, email{" "}
                      {detail.company.metrics.emailViews}, сайт{" "}
                      {detail.company.metrics.websiteViews}, рейтинг{" "}
                      {detail.company.metrics.ratingViews}, отзывы{" "}
                      {detail.company.metrics.reviewsViews}
                    </div>
                  )}
                </div>
              )}

              {/* Админ */}
              {detail.admin && (
                <div className="space-y-1.5 border-t pt-3">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Администратор</p>
                  <InfoRow label="Тип" value={typeLabel[detail.admin.adminType] || detail.admin.adminType} />
                  <InfoRow label="Права" value={detail.admin.permissions} />
                </div>
              )}

              {/* Активность */}
              <div className="space-y-1.5 border-t pt-3">
                <p className="text-sm font-medium text-muted-foreground mb-1">Активность</p>
                <InfoRow label="Отзывов получено" value={detail.stats.receivedReviews} />
                <InfoRow label="Отзывов оставлено" value={detail.stats.givenReviews} />
                <InfoRow label="Документов загружено" value={detail.stats.documents} />
                <InfoRow label="Конференций" value={detail.stats.conferences} />
                <InfoRow label="Товаров" value={detail.stats.products} />
              </div>

              {/* Действия: бан / разбан */}
              <div className="border-t pt-4">
                {detail.status === "BANNED" ? (
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={banLoading}
                    onClick={handleUnban}
                  >
                    {banLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <RotateCcw className="h-4 w-4 mr-2" />
                    )}
                    Разбанить
                  </Button>
                ) : !banMode ? (
                  <Button
                    variant="destructive"
                    className="w-full"
                    disabled={detail.type === "ROOT"}
                    onClick={() => setBanMode(true)}
                  >
                    <Ban className="h-4 w-4 mr-2" />
                    Забанить
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <Label htmlFor="ban-reason">Причина бана</Label>
                      <Textarea
                        id="ban-reason"
                        value={banReason}
                        onChange={(e) => setBanReason(e.target.value)}
                        maxLength={500}
                        placeholder="Например: спам в отзывах"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        className="bg-red-600 hover:bg-red-700 flex-1"
                        disabled={banLoading || !banReason.trim()}
                        onClick={handleBan}
                      >
                        {banLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        Подтвердить бан
                      </Button>
                      <Button
                        variant="outline"
                        disabled={banLoading}
                        onClick={() => {
                          setBanMode(false);
                          setBanReason("");
                        }}
                      >
                        Отмена
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Монеты */}
      <Dialog open={addCoinsOpen} onOpenChange={setAddCoinsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {coinOperation === "add"
                ? "Зачислить монеты"
                : coinOperation === "subtract"
                  ? "Списать монеты"
                  : "Установить баланс"}
            </DialogTitle>
            <DialogDescription>
              Пользователь: {selectedUser?.username} (баланс:{" "}
              {selectedUser?.balance.toFixed(1)})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {coinError && (
              <Alert variant="destructive">
                <AlertDescription>{coinError}</AlertDescription>
              </Alert>
            )}
            <RadioGroup
              value={coinOperation}
              onValueChange={(v) => setCoinOperation(v as "add" | "subtract" | "set")}
              className="flex gap-4"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="add" id="op-add" />
                <Label htmlFor="op-add" className="cursor-pointer">Зачислить</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="subtract" id="op-sub" />
                <Label htmlFor="op-sub" className="cursor-pointer">Списать</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="set" id="op-set" />
                <Label htmlFor="op-set" className="cursor-pointer">Установить</Label>
              </div>
            </RadioGroup>
            <div className="space-y-2">
              <Label htmlFor="coinAmount">
                {coinOperation === "set" ? "Новый баланс (монет)" : "Количество монет"}
              </Label>
              <Input
                id="coinAmount"
                type="number"
                min="0"
                step="0.1"
                value={coinAmount}
                onChange={(e) => setCoinAmount(e.target.value)}
                placeholder="10"
              />
            </div>
            <Button
              onClick={handleAddCoins}
              className="w-full bg-menthol hover:bg-menthol-dark"
              disabled={coinLoading || !coinAmount}
            >
              {coinLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {coinLoading
                ? "Выполняется..."
                : coinOperation === "add"
                  ? "Зачислить"
                  : coinOperation === "subtract"
                    ? "Списать"
                    : "Установить"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center sm:justify-between gap-2 mt-4 text-sm text-muted-foreground">
          <span>Всего: {total} пользователей</span>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={(p) => {
              const params = new URLSearchParams(window.location.search);
              params.set("page", String(p));
              router.replace(`/admin/users?${params.toString()}`, { scroll: false });
            }}
          />
        </div>
      )}
    </div>
  );
}
