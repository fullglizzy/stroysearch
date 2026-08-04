"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
import { Search, Coins } from "lucide-react";

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

export function UsersManager({ users }: UsersManagerProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [addCoinsOpen, setAddCoinsOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [coinAmount, setCoinAmount] = useState("");
  const [coinLoading, setCoinLoading] = useState(false);
  const [coinError, setCoinError] = useState("");

  const filtered = users.filter((u) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      u.username.toLowerCase().includes(s) ||
      u.email.toLowerCase().includes(s) ||
      (u.lastName?.toLowerCase().includes(s)) ||
      (u.nick?.toLowerCase().includes(s)) ||
      (u.inn?.includes(s))
    );
  });

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
        }),
      });

      if (res.ok) {
        setAddCoinsOpen(false);
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
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

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
            {filtered.map((user) => (
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

      <Dialog open={addCoinsOpen} onOpenChange={setAddCoinsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Зачислить монеты</DialogTitle>
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
            <div className="space-y-2">
              <Label htmlFor="coinAmount">Количество монет</Label>
              <Input
                id="coinAmount"
                type="number"
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
              {coinLoading ? "Зачисление..." : "Зачислить"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
