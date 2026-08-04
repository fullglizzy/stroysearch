"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Coins,
  Gift,
  Send,
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Loader2,
} from "lucide-react";

interface FinancesPageProps {
  balance: number;
  transactions: {
    id: string;
    type: string;
    amount: number;
    description: string | null;
    createdAt: Date;
  }[];
  gifts: {
    id: string;
    name: string;
    coinPrice: number;
    limit: number;
    imageUrl: string | null;
  }[];
  userId: string;
}

const typeLabels: Record<string, string> = {
  ADD_COMPANY: "Добавление компании",
  REVIEW: "Отзыв",
  POLL_VOTE: "Голосование",
  DOCUMENT_SALE: "Продажа документа",
  DOCUMENT_PURCHASE: "Покупка документа",
  CONFERENCE_ENTRY: "Вход на конференцию",
  CONFERENCE_ORGANIZER: "Доход от конференции",
  GIFT_RECEIVE: "Получение подарка",
  GIFT_SEND: "Дарение монет",
  MODERATOR_ADD: "Зачисление модератором",
  ADMIN_ADJUSTMENT: "Корректировка",
  INVOICE_PAID: "Пополнение счёта",
};

export function FinancesPage({ balance, transactions, gifts, userId }: FinancesPageProps) {
  const router = useRouter();
  const [giftOpen, setGiftOpen] = useState(false);
  const [giftTo, setGiftTo] = useState("");
  const [giftAmount, setGiftAmount] = useState("");
  const [giftError, setGiftError] = useState("");
  const [giftLoading, setGiftLoading] = useState(false);
  const [claimLoading, setClaimLoading] = useState<string | null>(null);

  async function handleGiftCoins(e: React.FormEvent) {
    e.preventDefault();
    setGiftError("");
    setGiftLoading(true);

    try {
      const res = await fetch("/api/coins/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUsername: giftTo,
          amount: parseFloat(giftAmount),
        }),
      });

      if (res.ok) {
        setGiftOpen(false);
        router.refresh();
      } else {
        const data = await res.json();
        setGiftError(data.error || "Ошибка перевода");
      }
    } catch {
      setGiftError("Ошибка соединения");
    }
    setGiftLoading(false);
  }

  async function handleClaimGift(giftId: string) {
    setClaimLoading(giftId);
    try {
      const res = await fetch(`/api/gifts/${giftId}/claim`, { method: "POST" });
      if (res.ok) router.refresh();
      else {
        const data = await res.json();
        alert(data.error || "Недостаточно монет");
      }
    } catch {
      alert("Ошибка соединения");
    }
    setClaimLoading(null);
  }

  return (
    <div className="space-y-6">
      {/* Balance Card */}
      <Card className="bg-gradient-to-r from-menthol/10 to-menthol/5 border-menthol/20">
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Баланс монет</p>
              <div className="flex items-center gap-2 mt-1">
                <Coins className="h-8 w-8 text-orange-accent" />
                <span className="text-4xl font-bold">{balance.toFixed(1)}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => setGiftOpen(true)}
              >
                <Send className="h-4 w-4" /> Подарить
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gift Coins Dialog */}
      <Dialog open={giftOpen} onOpenChange={setGiftOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Подарить монеты</DialogTitle>
            <DialogDescription>
              Укажите ник или ИНН получателя и сумму перевода
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleGiftCoins} className="space-y-4">
            {giftError && (
              <Alert variant="destructive">
                <AlertDescription>{giftError}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="giftTo">Получатель (ник или ИНН)</Label>
              <Input
                id="giftTo"
                value={giftTo}
                onChange={(e) => setGiftTo(e.target.value)}
                placeholder="username или 1234567890"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="giftAmount">Сумма (монет)</Label>
              <Input
                id="giftAmount"
                type="number"
                min="0.1"
                step="0.1"
                value={giftAmount}
                onChange={(e) => setGiftAmount(e.target.value)}
                placeholder="10"
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-menthol hover:bg-menthol-dark"
              disabled={giftLoading}
            >
              {giftLoading ? "Отправка..." : "Подарить"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Gifts / Souvenirs */}
      {gifts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Gift className="h-5 w-5 text-orange-accent" />
              Сувениры
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {gifts.map((gift) => (
                <div
                  key={gift.id}
                  className="border rounded-lg p-3 flex flex-col items-center text-center"
                >
                  <div className="w-12 h-12 bg-secondary rounded-full flex items-center justify-center mb-2">
                    <Gift className="h-6 w-6 text-orange-accent" />
                  </div>
                  <p className="font-medium text-sm">{gift.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {gift.coinPrice} монет • {gift.limit} шт.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2 w-full text-xs"
                    onClick={() => handleClaimGift(gift.id)}
                    disabled={claimLoading === gift.id || balance < gift.coinPrice}
                  >
                    {claimLoading === gift.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      "Получить"
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transactions History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">История операций</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">Нет операций</p>
          ) : (
            <div className="space-y-2">
              {transactions.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {typeLabels[t.type] || t.type}
                    </p>
                    {t.description && (
                      <p className="text-xs text-muted-foreground">{t.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {new Date(t.createdAt).toLocaleDateString("ru-RU", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <Badge
                    variant={t.amount > 0 ? "default" : "destructive"}
                    className={
                      t.amount > 0
                        ? "bg-menthol/10 text-menthol"
                        : ""
                    }
                  >
                    {t.amount > 0 ? (
                      <TrendingUp className="h-3 w-3 mr-1" />
                    ) : (
                      <TrendingDown className="h-3 w-3 mr-1" />
                    )}
                    {t.amount > 0 ? "+" : ""}
                    {t.amount.toFixed(1)}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
