"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
import { toastSuccess } from "@/lib/toast";
import { ImagePreview } from "@/components/shared/ImagePreview";
import { InvoicePrint, type InvoicePrintData, type BillingRequisites } from "@/components/shared/InvoicePrint";
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_BADGE, formatRub } from "@/lib/invoices";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Coins,
  Gift,
  Send,
  TrendingUp,
  TrendingDown,
  Loader2,
  Receipt,
  ShoppingCart,
  FileText,
  AlertTriangle,
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
  coinPriceRub: number;
  /** Поля профиля, без которых нельзя выставить счёт (название/ФИО, адрес) */
  missingInvoiceFields: string[];
  /** Ссылка на страницу профиля, где эти поля заполняются */
  profileHref: string;
  /** Ссылка на раздел поддержки кабинета (для связи счёта с тикетом) */
  supportHref: string;
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

export function FinancesPage({ balance, transactions, gifts, userId, coinPriceRub, missingInvoiceFields, profileHref, supportHref }: FinancesPageProps) {
  const router = useRouter();
  const [giftOpen, setGiftOpen] = useState(false);
  const [giftTo, setGiftTo] = useState("");
  const [giftAmount, setGiftAmount] = useState("");
  const [giftError, setGiftError] = useState("");
  const [giftLoading, setGiftLoading] = useState(false);
  const [confirmGift, setConfirmGift] = useState<{ to: string; amount: number } | null>(null);
  const [confirmClaim, setConfirmClaim] = useState<(typeof gifts)[number] | null>(null);
  const [claimLoading, setClaimLoading] = useState<string | null>(null);
  const [claimError, setClaimError] = useState("");
  const [buyOpen, setBuyOpen] = useState(false);
  const [buyAmount, setBuyAmount] = useState("");
  const [buyError, setBuyError] = useState("");
  const [buyLoading, setBuyLoading] = useState(false);

  // Счета пользователя (догружаются клиентом)
  const [invoices, setInvoices] = useState<
    { id: string; number: string; date: string; dueDate: string; status: string; total: number; ticketId: string | null }[]
  >([]);
  const [invoiceOpen, setInvoiceOpen] = useState<string | null>(null);
  const [invoiceData, setInvoiceData] = useState<InvoicePrintData | null>(null);
  const [requisites, setRequisites] = useState<BillingRequisites | null>(null);

  // История операций: стартовая порция из сервера, дальше догружается
  const [txList, setTxList] = useState(transactions);
  const [txPage, setTxPage] = useState(1);
  const [txHasMore, setTxHasMore] = useState(transactions.length >= 20);
  const [txType, setTxType] = useState("");
  const [txLoading, setTxLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/invoices")
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setInvoices(d.invoices || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  async function openInvoice(invoiceId: string) {
    setInvoiceOpen(invoiceId);
    setInvoiceData(null);
    try {
      const [invRes, reqRes] = await Promise.all([
        fetch(`/api/invoices/${invoiceId}`),
        fetch("/api/billing/info"),
      ]);
      const inv = await invRes.json().catch(() => ({}));
      const req = await reqRes.json().catch(() => ({}));
      if (invRes.ok) setInvoiceData(inv.invoice);
      if (reqRes.ok) setRequisites(req);
    } catch {
      // silent
    }
  }

  const buyTotal = (parseInt(buyAmount, 10) || 0) * coinPriceRub;

  async function handleBuyCoins(e: React.FormEvent) {
    e.preventDefault();
    setBuyError("");
    setBuyLoading(true);
    try {
      const res = await fetch("/api/coins/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parseInt(buyAmount, 10) }),
      });
      if (res.ok) {
        setBuyOpen(false);
        setBuyAmount("");
        toastSuccess("Заявка отправлена", "Счёт появится в разделе «Требуется оплата»");
        // Обновляем список счетов сразу, без перезагрузки страницы —
        // карточка «Требуется оплата» появляется мгновенно
        fetch("/api/invoices")
          .then((r) => r.json())
          .then((d) => { if (Array.isArray(d.invoices)) setInvoices(d.invoices); })
          .catch(() => {});
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setBuyError(data.error || "Ошибка создания заявки");
      }
    } catch {
      setBuyError("Ошибка соединения");
    }
    setBuyLoading(false);
  }

  async function loadTransactions(page: number, type: string, append: boolean) {
    setTxLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (type) params.set("type", type);
      const res = await fetch(`/api/transactions?${params}`);
      const data = await res.json().catch(() => ({}));
      const rows = data.transactions || [];
      setTxList((prev) => (append ? [...prev, ...rows] : rows));
      setTxPage(page);
      setTxHasMore(!!data.hasMore);
    } catch {
      // silent
    }
    setTxLoading(false);
  }

  async function handleGiftCoins(e: React.FormEvent) {
    e.preventDefault();
    setGiftError("");
    setConfirmGift({ to: giftTo, amount: parseFloat(giftAmount) });
  }

  async function doGiftTransfer() {
    if (!confirmGift) return;
    setGiftError("");
    setGiftLoading(true);

    try {
      const res = await fetch("/api/coins/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUsername: confirmGift.to,
          amount: confirmGift.amount,
        }),
      });

      if (res.ok) {
        setGiftOpen(false);
        setGiftTo("");
        setGiftAmount("");
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
      if (res.ok) { setClaimError(""); router.refresh(); }
      else {
        const data = await res.json();
        setClaimError(data.error || "Недостаточно монет");
      }
    } catch {
      setClaimError("Ошибка соединения");
    }
    setClaimLoading(null);
  }

  return (
  <div className="space-y-6">
      {/* Balance Card */}
      <Card className="bg-gradient-to-r from-menthol/10 to-menthol/5 border-menthol/20">
        <CardContent>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Баланс монет</p>
              <div className="flex items-center gap-2 mt-1">
                <Coins className="h-8 w-8 text-orange-accent" />
                <span className="text-4xl font-bold">{balance.toFixed(1)}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => setBuyOpen(true)}
              >
                <ShoppingCart className="h-4 w-4" /> Купить монеты
              </Button>
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

      {/* Счета, ожидающие оплаты */}
      {(() => {
        const pending = invoices.filter((inv) => ["DRAFT", "SENT", "OVERDUE"].includes(inv.status));
        if (pending.length === 0) return null;
        return (
          <Card className="border-orange-accent/50 bg-orange-accent/5">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-accent" />
                Требуется оплата
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {pending.map((inv) => (
                <div key={inv.id} className="flex flex-wrap items-center justify-between gap-2 py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">Счёт № {inv.number}</p>
                    <p className="text-xs text-muted-foreground">
                      от {new Date(inv.date).toLocaleDateString("ru-RU")} · оплатить до{" "}
                      {new Date(inv.dueDate).toLocaleDateString("ru-RU")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className={INVOICE_STATUS_BADGE[inv.status] || ""}>
                      {INVOICE_STATUS_LABELS[inv.status] || inv.status}
                    </Badge>
                    <span className="text-sm font-medium">{formatRub(inv.total)}</span>
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => openInvoice(inv.id)}>
                      <FileText className="h-3 w-3" /> Показать
                    </Button>
                    {inv.ticketId && (
                      <Link
                        href={`${supportHref}?ticket=${inv.ticketId}`}
                        className="text-xs text-menthol hover:underline"
                      >
                        Обсудить с поддержкой
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })()}

      {/* Buy Coins Dialog */}      <Dialog open={buyOpen} onOpenChange={setBuyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Покупка монет</DialogTitle>
            <DialogDescription>
              Заявка будет направлена администратору. Счёт придёт файлом в переписку —
              статус отслеживайте в разделе «Поддержка».
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleBuyCoins} className="space-y-4">
            {buyError && (
              <Alert variant="destructive">
                <AlertDescription>{buyError}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="buyAmount">Количество монет</Label>
              <Input
                id="buyAmount"
                type="number"
                min="1"
                step="1"
                value={buyAmount}
                onChange={(e) => setBuyAmount(e.target.value)}
                placeholder="10"
                required
              />
              <p className="text-xs text-muted-foreground">
                Стоимость: {buyTotal} ₽ (1 монета = {coinPriceRub} ₽)
              </p>
            </div>
            {missingInvoiceFields.length > 0 && (
              <Alert className="border-orange-accent/50 bg-orange-accent/10 text-orange-accent">
                <AlertDescription>
                  Для выставления счёта заполните в профиле: {missingInvoiceFields.join(", ")}.{" "}
                  <Link href={profileHref} className="underline hover:opacity-80">
                    Заполнить профиль
                  </Link>
                </AlertDescription>
              </Alert>
            )}
            <Button
              type="submit"
              className="w-full bg-menthol hover:bg-menthol-dark"
              disabled={buyLoading || missingInvoiceFields.length > 0}
            >
              {buyLoading ? "Отправка..." : "Отправить заявку"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

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

      {claimError && <Alert variant="destructive" className="mb-4"><AlertDescription>{claimError}</AlertDescription></Alert>}

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
                  {gift.imageUrl ? (
                    <ImagePreview
                      src={gift.imageUrl}
                      alt={gift.name}
                      className="w-16 h-16 rounded-lg mb-2"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-secondary rounded-full flex items-center justify-center mb-2">
                      <Gift className="h-6 w-6 text-orange-accent" />
                    </div>
                  )}
                  <p className="font-medium text-sm">{gift.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {gift.coinPrice} монет • {gift.limit} шт.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2 w-full text-xs"
                    onClick={() => setConfirmClaim(gift)}
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

      {/* Счета */}
      {invoices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Счета</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {invoices.map((inv) => (
              <div key={inv.id} className="flex flex-wrap items-center justify-between gap-2 py-2 border-b last:border-0">
                <div>
                  <p className="text-sm font-medium">Счёт № {inv.number}</p>
                  <p className="text-xs text-muted-foreground">
                    от {new Date(inv.date).toLocaleDateString("ru-RU")} · оплатить до {new Date(inv.dueDate).toLocaleDateString("ru-RU")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className={INVOICE_STATUS_BADGE[inv.status] || ""}>
                    {INVOICE_STATUS_LABELS[inv.status] || inv.status}
                  </Badge>
                  <span className="text-sm font-medium">{formatRub(inv.total)}</span>
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => openInvoice(inv.id)}>
                    <FileText className="h-3 w-3" /> Показать
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Transactions History */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-lg">История операций</CardTitle>
            <Select
              value={txType}
              items={Object.fromEntries([
                ["", "Все операции"],
                ...Object.entries(typeLabels),
              ])}
              onValueChange={(v) => {
                const value = v ?? "";
                setTxType(value);
                loadTransactions(1, value, false);
              }}
            >
              <SelectTrigger className="w-56 justify-between">
                <SelectValue placeholder="Все операции" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="" label="Все операции">Все операции</SelectItem>
                {Object.entries(typeLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value} label={label}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {txList.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <Receipt className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>Нет операций</p>
              </div>
          ) : (
            <div className="space-y-2">
              {txList.map((t) => (
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
          {txHasMore && (
            <div className="flex justify-center mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadTransactions(txPage + 1, txType, true)}
                disabled={txLoading}
              >
                {txLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Показать ещё
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Подтверждение перевода монет */}
      <ConfirmDialog
        open={!!confirmGift}
        onOpenChange={(o) => { if (!o) setConfirmGift(null); }}
        title="Подтверждение перевода"
        message={
          confirmGift
            ? `Перевести ${confirmGift.amount} монет пользователю «${confirmGift.to}»? Операция необратима.`
            : ""
        }
        confirmLabel="Перевести"
        variant="info"
        onConfirm={doGiftTransfer}
        loading={giftLoading}
      />

      {/* Подтверждение получения сувенира */}
      <ConfirmDialog
        open={!!confirmClaim}
        onOpenChange={(o) => { if (!o) setConfirmClaim(null); }}
        title="Получение сувенира"
        message={
          confirmClaim
            ? `Получить сувенир «${confirmClaim.name}» за ${confirmClaim.coinPrice} монет? Монеты будут списаны.`
            : ""
        }
        confirmLabel="Получить"
        variant="info"
        onConfirm={async () => {
          if (confirmClaim) {
            await handleClaimGift(confirmClaim.id);
            setConfirmClaim(null);
          }
        }}
        loading={!!claimLoading}
      />

      {/* Печатный вид счёта */}
      <Dialog open={!!invoiceOpen} onOpenChange={(o) => { if (!o) setInvoiceOpen(null); }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Счёт</DialogTitle>
            <DialogDescription>Распечатайте счёт для оплаты по реквизитам</DialogDescription>
          </DialogHeader>
          {invoiceData && requisites ? (
            <InvoicePrint invoice={invoiceData} requisites={requisites} />
          ) : (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
