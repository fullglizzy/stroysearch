"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/shared/Pagination";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Search, Coins, Loader2, Users } from "lucide-react";

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
  region: string | null;
  balance: number;
  roles: string[];
  createdAt: Date;
}

interface UsersManagerProps {
  users: UserRow[];
  total: number;
  page: number;
  totalPages: number;
  initialQuery: string;
}

const statusBadge: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  INACTIVE: "bg-gray-100 text-gray-700",
  BANNED: "bg-red-100 text-red-700",
  DELETED: "bg-red-100 text-red-700",
};

const typeLabel: Record<string, string> = {
  COMMON: "Участник",
  COMPANY: "Компания",
  MODERATOR: "Модератор",
  EDITOR: "Редактор",
  SUPER: "Супер-админ",
  ROOT: "Root",
};

export function UsersManager({ users, total, page, totalPages, initialQuery }: UsersManagerProps) {
  const router = useRouter();
  const [search, setSearch] = useState(initialQuery);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [addCoinsOpen, setAddCoinsOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [coinAmount, setCoinAmount] = useState("");
  const [coinLoading, setCoinLoading] = useState(false);
  const [coinError, setCoinError] = useState("");
  const [coinOperation, setCoinOperation] = useState<"add" | "subtract" | "set">("add");

  // Поиск и пагинация живут в URL, данные отдаёт сервер
  function handleSearchChange(value: string) {
    setSearch(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      if (value) params.set("q", value); else params.delete("q");
      params.delete("page");
      router.replace(`/admin/users?${params.toString()}`, { scroll: false });
    }, 300);
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

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Поиск по логину, email, фамилии..."
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {users.length === 0 ? (
        <div className="border rounded-lg p-12 text-center text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg">Пользователи не найдены</p>
          <p className="text-sm mt-2">Измените поисковый запрос</p>
        </div>
      ) : (
      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
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
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.username}</TableCell>
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
                    {user.status}
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
                    onClick={() => {
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
        <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
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
