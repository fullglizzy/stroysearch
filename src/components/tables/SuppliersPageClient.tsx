"use client";

import { useState, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
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
import { EyeButton } from "@/components/shared/EyeButton";
import { StarRating } from "@/components/shared/StarRating";
import { ReviewForm } from "@/components/forms/ReviewForm";
import { Pagination } from "@/components/shared/Pagination";
import { Plus, Search, MessageSquare, AlertCircle, Loader2, Download, ArrowUpDown, Phone, Mail } from "lucide-react";
import { validateInn } from "@/lib/inn";
import { toastSuccess, toastError } from "@/lib/toast";
import { exportToCSV } from "@/lib/export";
import { REGIONS } from "@/lib/regions";

interface CompanyRow {
  id: string;
  inn: string;
  name: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  region: string | null;
  classifierIds: string[];
  rating: number | null;
  reviewCount: number;
  ownerNick: string | null;
  ownerRoles: string[];
  metrics: {
    phoneViews: number;
    emailViews: number;
    websiteViews: number;
  };
}

interface Props {
  companies: CompanyRow[];
}

export function SuppliersPageClient({ companies }: Props) {
  const { data: session } = useSession();
  const router = useRouter();
  const isAdmin =
    session?.user &&
    ["MODERATOR", "EDITOR", "SUPER", "ROOT"].includes(
      (session.user as any).type,
    );

  const [revals, setRevals] = useState<Record<string, Record<string, boolean>>>({});
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all"); // all | company | participant
  const [regionFilter, setRegionFilter] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "rating">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [addOpen, setAddOpen] = useState(false);
  const [addError, setAddError] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<{ id: string; name: string; companyId?: string; label?: string } | null>(null);

  const filtered = useMemo(() => {
    let result = companies;

    // Поиск
    if (search) {
      const s = search.toLowerCase();
      result = result.filter((c) =>
        c.name.toLowerCase().includes(s) ||
        c.inn.includes(s) ||
        (c.ownerNick?.toLowerCase().includes(s)) ||
        (c.region?.toLowerCase().includes(s))
      );
    }

    // Тип (компания/участник)
    if (typeFilter === "company") {
      result = result.filter((c) => c.inn);
    } else if (typeFilter === "participant") {
      result = result.filter((c) => !c.inn || c.ownerNick);
    }

    // Регион
    if (regionFilter && regionFilter !== "Все регионы") {
      result = result.filter((c) => c.region === regionFilter);
    }

    // Сортировка
    result = [...result].sort((a, b) => {
      if (sortBy === "name") {
        const cmp = a.name.localeCompare(b.name, "ru");
        return sortDir === "asc" ? cmp : -cmp;
      } else {
        const ra = a.rating ?? 0;
        const rb = b.rating ?? 0;
        return sortDir === "asc" ? ra - rb : rb - ra;
      }
    });

    return result;
  }, [companies, search, typeFilter, regionFilter, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const handleReveal = useCallback(
    async (companyId: string, field: string) => {
      const key = `${companyId}`;
      setRevals((prev) => ({
        ...prev,
        [key]: { ...prev[key], [field]: !prev[key]?.[field] },
      }));

      try {
        await fetch(`/api/suppliers/metrics/${companyId}/click`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ field }),
        });
      } catch {
        // silent
      }
    },
    [],
  );

  async function handleAddCompany(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAddError("");
    setAddLoading(true);

    const formData = new FormData(e.currentTarget);
    const inn = (formData.get("inn") as string).trim();
    const email = (formData.get("email") as string).trim();

    // Валидация ИНН
    if (!/^\d{10}$|^\d{12}$/.test(inn)) {
      setAddError("ИНН должен состоять из 10 или 12 цифр");
      setAddLoading(false);
      return;
    }
    if (!validateInn(inn)) {
      setAddError("Неверный ИНН — проверьте контрольную сумму");
      setAddLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inn, email }),
      });

      if (!res.ok) {
        const data = await res.json();
        setAddError(data.error || "Ошибка добавления");
      } else {
        setAddOpen(false);
        toastSuccess("Компания добавлена", "+1 монета начислена на ваш счёт");
        router.refresh();
      }
    } catch {
      setAddError("Ошибка соединения");
    }
    setAddLoading(false);
  }

  return (
	    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">База поставщиков и заказчиков</h1>
          <p className="text-muted-foreground mt-1">
            Контакты открываются по клику на иконку глаза
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger>
              <Button className="bg-menthol hover:bg-menthol-dark gap-2">
                <Plus className="h-4 w-4" />
                Добавить компанию
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Добавить компанию по ИНН</DialogTitle>
                <DialogDescription>
                  За добавление компании начисляется +1 монета
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddCompany} className="space-y-4">
                {addError && (
                  <Alert variant="destructive">
                    <AlertDescription>{addError}</AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2">
                  <Label htmlFor="inn">ИНН</Label>
                  <Input id="inn" name="inn" placeholder="10 или 12 цифр" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email компании</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="company@mail.ru"
                    required
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-menthol hover:bg-menthol-dark"
                  disabled={addLoading}
                >
                  {addLoading ? "Добавление..." : "Добавить (+1 монета)"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Info banner */}
      <div className="bg-menthol/5 border border-menthol/20 rounded-lg p-3 mb-4 flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-menthol flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-menthol">Как пользоваться базой поставщиков</p>
          <p className="text-muted-foreground">
            Контакты (телефон, email, рейтинг, отзывы) скрыты иконкой глаза.
            <strong> Нажмите на глаз</strong> чтобы раскрыть информацию — каждый просмотр учитывается в метрике.
            Зарегистрированные пользователи могут <strong>оставить отзыв</strong> о компании или участнике.
          </p>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по названию, ИНН, нику, региону..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v ?? "all"); setPage(1); }}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Тип" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все</SelectItem>
            <SelectItem value="company">Компании</SelectItem>
            <SelectItem value="participant">Участники</SelectItem>
          </SelectContent>
        </Select>
        <Select value={regionFilter} onValueChange={(v) => { setRegionFilter(v ?? ""); setPage(1); }}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Регион" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Все регионы</SelectItem>
            {REGIONS.filter((r) => r !== "Все регионы").map((r) => (
              <SelectItem key={r} value={r}>{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          className="gap-1"
          onClick={() => {
            setSortBy(sortBy === "name" ? "rating" : "name");
            setSortDir("asc");
            setPage(1);
          }}
          title={`Сортировка: ${sortBy === "name" ? "по названию" : "по рейтингу"}`}
        >
          <ArrowUpDown className="h-4 w-4" />
          {sortBy === "name" ? "Название" : "Рейтинг"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1"
          onClick={() => setSortDir((d) => d === "asc" ? "desc" : "asc")}
          title={sortDir === "asc" ? "По возрастанию" : "По убыванию"}
        >
          {sortDir === "asc" ? "↑" : "↓"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1"
          onClick={() => exportToCSV(filtered as unknown as Record<string, unknown>[], [
            { key: "ownerNick", label: "Ник" },
            { key: "inn", label: "ИНН" },
            { key: "name", label: "Название" },
            { key: "rating", label: "Рейтинг" },
            { key: "region", label: "Регион" },
          ], "baza_postavshchikov")}
        >
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">CSV</span>
        </Button>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ник</TableHead>
              <TableHead>ИНН</TableHead>
              <TableHead>Название</TableHead>
              <TableHead>Рейтинг</TableHead>
              <TableHead>Телефон</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Классификатор</TableHead>
              <TableHead>Роль</TableHead>
              <TableHead>Отзывы</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                  Компании не найдены
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((company) => {
                const key = company.id;
                const rev = revals[key] || {};

                return (
                  <TableRow key={company.id}>
                    <TableCell>{company.ownerNick || "—"}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {company.inn || "—"}
                    </TableCell>
                    <TableCell className="font-medium max-w-[180px] truncate">
                      {company.name}
                    </TableCell>
                    <TableCell>
                      {company.rating !== null ? (
                        <div className="flex items-center gap-1">
                          {rev.rating ? (
                            <>
                              <StarRating rating={company.rating} size="sm" />
                              <span className="text-xs text-muted-foreground">
                                {company.rating}/100
                              </span>
                            </>
                          ) : (
                            <div className="flex items-center gap-1">
                              <EyeButton
                                onClick={() => handleReveal(key, "rating")}
                              />
                              <span className="text-xs text-muted-foreground">
                                Скрыт
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {company.phone ? (
                        <div className="flex items-center gap-1">
                          {rev.phone ? (
                            <span className="text-sm flex items-center gap-1">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              {company.phone}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              <EyeButton
                                onClick={() => handleReveal(key, "phone")}
                                fieldLabel="телефон"
                              />
                            </span>
                          )}
                          {isAdmin && (
                            <span className="text-[10px] text-muted-foreground">
                              ({company.metrics.phoneViews})
                            </span>
                          )}
                        </div>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      {company.email ? (
                        <div className="flex items-center gap-1">
                          {rev.email ? (
                            <span className="text-sm flex items-center gap-1">
                              <Mail className="h-3 w-3 text-muted-foreground" />
                              {company.email}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              <Mail className="h-3 w-3 text-muted-foreground" />
                              <EyeButton
                                onClick={() => handleReveal(key, "email")}
                                fieldLabel="email"
                              />
                            </span>
                          )}
                          {isAdmin && (
                            <span className="text-[10px] text-muted-foreground">
                              ({company.metrics.emailViews})
                            </span>
                          )}
                        </div>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {company.classifierIds.slice(0, 2).map((id) => (
                          <Badge key={id} variant="secondary" className="text-[10px]">
                            {id}
                          </Badge>
                        ))}
                        {company.classifierIds.length > 2 && (
                          <Badge variant="outline" className="text-[10px]">
                            +{company.classifierIds.length - 2}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs">
                        {company.ownerRoles.length > 0
                          ? company.ownerRoles.join(", ")
                          : company.inn ? "поставщик" : "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      {company.reviewCount > 0 ? (
                        <div className="flex items-center gap-1">
                          {rev.reviews ? (
                            <span className="text-xs">{company.reviewCount} отз.</span>
                          ) : (
                            <EyeButton onClick={() => handleReveal(key, "reviews")} />
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {session?.user && company.inn && (
                          <Button size="sm" variant="outline" className="h-7 text-[10px]"
                            onClick={() => setReviewTarget({ id: company.id, name: company.name, companyId: company.id, label: "компанию" })}>
                            <MessageSquare className="h-3 w-3 mr-1" />Компании
                          </Button>
                        )}
                        {session?.user && company.ownerNick && (
                          <Button size="sm" variant="outline" className="h-7 text-[10px]"
                            onClick={() => setReviewTarget({ id: company.id, name: company.ownerNick || company.name, label: "участника" })}>
                            <MessageSquare className="h-3 w-3 mr-1" />Участнику
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Пагинация */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
          <span>Всего: {filtered.length} компаний</span>
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}

      {/* Review Dialog */}
      {reviewTarget && (
        <Dialog open={!!reviewTarget} onOpenChange={() => setReviewTarget(null)}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Оставить отзыв {reviewTarget.label ? `о ${reviewTarget.label}` : ""}</DialogTitle>
              <DialogDescription>Оцените по 9 критериям (☆1-5). За отзыв начисляется +1 монета.</DialogDescription>
            </DialogHeader>
            <ReviewForm
              targetId={reviewTarget.id}
              targetName={reviewTarget.name}
              companyId={reviewTarget.companyId}
              criteriaLabels={reviewTarget.companyId ? [
                "Качество оказанной работы/услуги/материала/поставки",
                "Организация работы на объекте / организация поставки",
                "Взаимодействие со специалистами компании",
                "Наличие средств, необходимых для выполнения работ",
                "Финансовое состояние предприятия",
                "Наличие квалифицированных специалистов и руководителей",
                "Срок выполнения работ/поставки",
                "Стоимость и условия оплаты",
                "Особые условия/гибкость в договорных отношениях",
              ] : [
                "Качество работы — соответствие результата стандартам, отсутствие ошибок",
                "Профессионализм — глубокие знания в своей области",
                "Коммуникабельность — умение ясно излагать мысли, вести диалог",
                "Уважительность — корректное и тактичное отношение к другим",
                "Организованность — способность планировать работу, соблюдать сроки",
                "Ответственность — готовность брать на себя обязательства",
                "Гибкость и адаптивность — умение быстро перестраиваться",
                "Работа в команде — способность сотрудничать, поддерживать коллег",
                "Соблюдение договорённостей — выполнение обязательств по срокам и условиям",
              ]}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
