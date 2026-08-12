"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Pagination } from "@/components/shared/Pagination";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SupportDialog } from "@/components/shared/SupportDialog";
import { InvoicePrint, type InvoicePrintData, type BillingRequisites } from "@/components/shared/InvoicePrint";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SUPPORT_TOPICS, SUPPORT_TOPIC_ITEMS } from "@/lib/support";
import { toastError, toastSuccess } from "@/lib/toast";
import { Plus, Send, Loader2, CheckCircle2, RotateCcw, MessageSquare, LifeBuoy, Paperclip, X, FileText } from "lucide-react";

interface TicketRow {
  id: string;
  subject: string;
  isResolved: boolean;
  createdAt: Date;
  updatedAt: Date;
  replyCount: number;
}

interface DetailMessage {
  id: string;
  message: string;
  isStaff: boolean;
  createdAt: Date;
  authorName: string | null;
  attachments: { url: string; name: string }[];
}

interface TicketDetail {
  id: string;
  subject: string;
  isResolved: boolean;
  createdAt: Date;
  message: string;
  userName: string | null;
}

interface InvoiceInfo {
  id: string;
  number: string;
  status: string;
  total: number;
  coins: number;
  sentAt: Date | null;
  paidAt: Date | null;
}

const INVOICE_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Ожидает оплаты",
  SENT: "Выставлен",
  PAID: "Оплачен",
  SKIPPED: "Пропущен",
  OVERDUE: "Просрочен",
  CANCELLED: "Отменён",
};

interface SupportTicketsClientProps {
  initialTickets: TicketRow[];
  /** user — личный кабинет (мои обращения), staff — админка (все обращения) */
  mode: "user" | "staff";
  /** Для админки: пагинация списка (опционально) */
  page?: number;
  totalPages?: number;
}

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SupportTicketsClient({ initialTickets, mode, page, totalPages }: SupportTicketsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const autoOpenRef = useRef(false);
  const [tickets, setTickets] = useState<TicketRow[]>(initialTickets);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [messages, setMessages] = useState<DetailMessage[]>([]);
  const [invoice, setInvoice] = useState<InvoiceInfo | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [topicFilter, setTopicFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const visibleTickets = useMemo(
    () =>
      tickets.filter(
        (t) =>
          (topicFilter === "all" || t.subject === topicFilter) &&
          (statusFilter === "all" ||
            (statusFilter === "open" ? !t.isResolved : t.isResolved)),
      ),
    [tickets, topicFilter, statusFilter],
  );

  async function refreshList() {
    setListLoading(true);
    try {
      const res = await fetch(`/api/support${mode === "staff" ? "?all=1" : ""}`);
      if (res.ok) {
        const d = await res.json();
        setTickets(d.tickets);
      }
    } catch {
      // silent
    }
    setListLoading(false);
  }

  async function openTicket(id: string) {
    setSelectedId(id);
    setDetailLoading(true);
    setDetail(null);
    setMessages([]);
    setInvoice(null);
    try {
      const res = await fetch(`/api/support/${id}`);
      if (res.ok) {
        const d = await res.json();
        setDetail(d.ticket);
        setMessages(d.messages);
        setInvoice(d.invoice || null);
      } else {
        const d = await res.json().catch(() => ({}));
        toastError("Ошибка", d.error || "Не удалось загрузить обращение");
      }
    } catch {
      toastError("Ошибка соединения");
    }
    setDetailLoading(false);
  }

  // Автооткрытие тикета из ?ticket=... (например, после «Хочу создать опрос»)
  useEffect(() => {
    const ticketParam = searchParams.get("ticket");
    if (ticketParam && !autoOpenRef.current) {
      autoOpenRef.current = true;
      openTicket(ticketParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const [printInvoice, setPrintInvoice] = useState<InvoicePrintData | null>(null);
  const [printRequisites, setPrintRequisites] = useState<BillingRequisites | null>(null);

  async function openPrintInvoice() {
    if (!invoice) return;
    setPrintInvoice(null);
    try {
      const [invRes, reqRes] = await Promise.all([
        fetch(`/api/invoices/${invoice.id}`),
        fetch("/api/billing/info"),
      ]);
      const inv = await invRes.json().catch(() => ({}));
      const req = await reqRes.json().catch(() => ({}));
      if (invRes.ok) setPrintInvoice(inv.invoice);
      if (reqRes.ok) setPrintRequisites(req);
    } catch {
      // silent
    }
  }

  async function handleMarkPaid() {
    if (!selectedId) return;
    setInvoiceLoading(true);
    try {
      const res = await fetch(`/api/support/${selectedId}/invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pay" }),
      });
      if (res.ok) {
        const d = await res.json();
        setInvoice(d.invoice);
        setMessages((prev) => [...prev, d.message]);
        setDetail((prev) => (prev ? { ...prev, isResolved: true } : prev));
        setTickets((prev) =>
          prev.map((t) => (t.id === selectedId ? { ...t, isResolved: true } : t)),
        );
        toastSuccess("Счёт оплачен, монеты зачислены");
      } else {
        const d = await res.json().catch(() => ({}));
        toastError("Ошибка", d.error || "Не удалось отметить оплату");
      }
    } catch {
      toastError("Ошибка соединения");
    }
    setInvoiceLoading(false);
  }

  async function sendReply() {
    if (!selectedId || (!reply.trim() && pendingFiles.length === 0)) return;
    setSending(true);
    try {
      // Загружаем прикреплённые файлы
      const files: { url: string; name: string }[] = [];
      for (const file of pendingFiles) {
        const formData = new FormData();
        formData.append("file", file);
        const upRes = await fetch("/api/upload", { method: "POST", body: formData });
        const upData = await upRes.json().catch(() => ({}));
        if (!upRes.ok) {
          toastError("Ошибка загрузки файла", upData.error || file.name);
          setSending(false);
          return;
        }
        files.push({ url: upData.fileUrl, name: file.name });
      }

      const res = await fetch(`/api/support/${selectedId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: reply, files }),
      });
      if (res.ok) {
        const d = await res.json();
        setMessages((prev) => [...prev, d.message]);
        setReply("");
        setPendingFiles([]);
        setTickets((prev) =>
          prev.map((t) =>
            t.id === selectedId
              ? { ...t, replyCount: t.replyCount + 1, updatedAt: new Date() }
              : t,
          ),
        );
      } else {
        const d = await res.json().catch(() => ({}));
        toastError("Ошибка", d.error || "Не удалось отправить сообщение");
      }
    } catch {
      toastError("Ошибка соединения");
    }
    setSending(false);
  }

  async function toggleResolve(id: string, isResolved: boolean) {
    try {
      const res = await fetch(`/api/support/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isResolved }),
      });
      if (res.ok) {
        setTickets((prev) =>
          prev.map((t) => (t.id === id ? { ...t, isResolved } : t)),
        );
        setDetail((prev) => (prev && prev.id === id ? { ...prev, isResolved } : prev));
        toastSuccess(isResolved ? "Обращение закрыто" : "Обращение открыто");
      } else {
        const d = await res.json().catch(() => ({}));
        toastError("Ошибка", d.error || "Не удалось обновить обращение");
      }
    } catch {
      toastError("Ошибка соединения");
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6 items-start">
      {/* Список обращений */}
      <div className="space-y-3">
        {mode === "user" && (
          <Button
            className="w-full bg-menthol hover:bg-menthol-dark"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Новое обращение
          </Button>
        )}
        {mode === "staff" && (
          <div className="space-y-2">
            <Select
              value={topicFilter}
              items={{ all: "Все темы", ...SUPPORT_TOPIC_ITEMS }}
              onValueChange={(v) => setTopicFilter(v ?? "all")}
            >
              <SelectTrigger className="w-full justify-between">
                <SelectValue placeholder="Все темы" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" label="Все темы">Все темы</SelectItem>
                {SUPPORT_TOPICS.map((t) => (
                  <SelectItem key={t} value={t} label={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={statusFilter}
              items={{ all: "Все статусы", open: "Открытые", closed: "Закрытые" }}
              onValueChange={(v) => setStatusFilter(v ?? "all")}
            >
              <SelectTrigger className="w-full justify-between">
                <SelectValue placeholder="Все статусы" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" label="Все статусы">Все статусы</SelectItem>
                <SelectItem value="open" label="Открытые">Открытые</SelectItem>
                <SelectItem value="closed" label="Закрытые">Закрытые</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        {listLoading && (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {visibleTickets.length === 0 && !listLoading ? (
          <div className="text-center text-muted-foreground py-8">
            <LifeBuoy className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>{mode === "staff" ? "Обращений не найдено" : "У вас пока нет обращений"}</p>
          </div>
        ) : (
          visibleTickets.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => openTicket(t.id)}
              className={`w-full text-left rounded-lg border p-3 transition-colors hover:border-menthol/50 cursor-pointer ${
                selectedId === t.id ? "border-menthol bg-menthol/5" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-medium break-words">{t.subject}</span>
                {t.isResolved ? (
                  <Badge variant="secondary" className="shrink-0 text-[10px]">Закрыто</Badge>
                ) : (
                  <Badge className="shrink-0 text-[10px] bg-menthol">Открыто</Badge>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span>{formatDate(t.updatedAt)}</span>
                {t.replyCount > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    {t.replyCount}
                  </span>
                )}
              </div>
            </button>
          ))
        )}
      </div>

      {/* Переписка */}
      <div>
        {!selectedId ? (
          <div className="text-center text-muted-foreground py-16 border rounded-lg">
            <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>Выберите обращение, чтобы увидеть переписку</p>
          </div>
        ) : detailLoading ? (
          <div className="flex justify-center py-16 border rounded-lg">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : detail ? (
          <Card>
            <CardContent className="space-y-4">
              {/* Шапка */}
              <div className="flex flex-wrap items-start justify-between gap-2 pb-3 border-b">
                <div className="min-w-0">
                  <h2 className="font-semibold break-words">{detail.subject}</h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    {mode === "staff" && detail.userName
                      ? `От: ${detail.userName} · `
                      : ""}
                    {formatDate(detail.createdAt)}
                  </p>
                </div>
                {mode === "staff" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleResolve(detail.id, !detail.isResolved)}
                  >
                    {detail.isResolved ? (
                      <RotateCcw className="h-3.5 w-3.5 mr-1" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                    )}
                    {detail.isResolved ? "Открыть" : "Закрыть"}
                  </Button>
                )}
              </div>

              {/* Первое сообщение */}
              <div className={`flex ${mode === "staff" ? "justify-start" : "justify-end"}`}>
                <div className="max-w-[85%] rounded-lg bg-secondary px-3 py-2 text-sm whitespace-pre-wrap break-words">
                  {detail.message}
                </div>
              </div>

              {/* Счёт (для админа) */}
              {mode === "staff" && invoice && (
                <div className="rounded-lg border p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm">
                      <span className="font-medium">Счёт {invoice.number}</span>
                      <span className="text-muted-foreground">
                        {" · "}{invoice.total} ₽ · {invoice.coins} монет
                      </span>
                    </div>
                    <Badge variant="secondary" className="text-[10px]">
                      {INVOICE_STATUS_LABELS[invoice.status] || invoice.status}
                    </Badge>
                  </div>
                  {invoice.status !== "PAID" && (
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-muted-foreground">
                        Счёт можно распечатать и передать пользователю
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={openPrintInvoice}
                      >
                        <FileText className="h-3.5 w-3.5 mr-1" />
                        Показать счёт
                      </Button>
                      <Button
                        size="sm"
                        className="bg-menthol hover:bg-menthol-dark"
                        onClick={handleMarkPaid}
                        disabled={invoiceLoading}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                        Оплачено
                      </Button>
                      {invoiceLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                    </div>
                  )}
                </div>
              )}

              {/* Ответы */}
              {messages.map((m) => {
                const isOwn = mode === "staff" ? m.isStaff : !m.isStaff;
                return (
                  <div key={m.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words ${
                        isOwn ? "bg-secondary" : "bg-menthol/10 border border-menthol/20"
                      }`}
                    >
                      {m.isStaff && mode !== "staff" && (
                        <p className="text-[10px] font-medium text-menthol mb-1">
                          Поддержка{m.authorName ? ` · ${m.authorName}` : ""}
                        </p>
                      )}
                      {m.message}
                      {m.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {m.attachments.map((a, i) => (
                            <a
                              key={i}
                              href={a.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-accent max-w-full"
                            >
                              <Paperclip className="h-3 w-3 shrink-0" />
                              <span className="break-all">{a.name}</span>
                            </a>
                          ))}
                        </div>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-1 text-right">
                        {formatDate(m.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })}

              {/* Ответ */}
              <div className="space-y-2 pt-2 border-t">
                <Textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  rows={3}
                  placeholder={mode === "staff" ? "Ответить пользователю..." : "Ваше сообщение..."}
                />
                {pendingFiles.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {pendingFiles.map((f, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs max-w-full"
                      >
                        <Paperclip className="h-3 w-3 shrink-0" />
                        <span className="break-all">{f.name}</span>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => setPendingFiles(pendingFiles.filter((_, j) => j !== i))}
                          title="Убрать файл"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length > 0) setPendingFiles((prev) => [...prev, ...files]);
                    e.target.value = "";
                  }}
                />
                <div className="flex items-center gap-2">
                  <Button
                    className="bg-menthol hover:bg-menthol-dark"
                    onClick={sendReply}
                    disabled={sending || (!reply.trim() && pendingFiles.length === 0)}
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                    {sending ? "Отправка..." : "Отправить"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={sending}
                    title="Прикрепить файл"
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>

      {/* Диалог создания обращения (user mode) */}
      {/* Печатный вид счёта */}
      <Dialog open={!!printInvoice} onOpenChange={(o) => { if (!o) setPrintInvoice(null); }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Счёт</DialogTitle>
            <DialogDescription>Распечатайте счёт для отправки пользователю</DialogDescription>
          </DialogHeader>
          {printInvoice && printRequisites && (
            <InvoicePrint invoice={printInvoice} requisites={printRequisites} />
          )}
        </DialogContent>
      </Dialog>

      <SupportDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={refreshList}
      />

      {mode === "staff" && totalPages && totalPages > 1 && (
        <div className="flex items-center justify-end mt-4">
          <Pagination
            currentPage={page || 1}
            totalPages={totalPages}
            onPageChange={(p) => {
              const params = new URLSearchParams(window.location.search);
              params.set("page", String(p));
              router.replace(`/admin/support?${params.toString()}`, { scroll: false });
            }}
          />
        </div>
      )}
    </div>
  );
}
