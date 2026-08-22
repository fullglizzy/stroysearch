"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
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
} from "@/components/ui/dialog";
import { EyeButton } from "@/components/shared/EyeButton";
import { GuestGuard } from "@/components/shared/GuestGuard";
import { useAuthGuard } from "@/components/shared/useAuthGuard";
import { StarRating } from "@/components/shared/StarRating";
import { ReportReviewButton } from "@/components/shared/ReportReviewButton";
import { ReviewForm } from "@/components/forms/ReviewForm";
import { Pagination } from "@/components/shared/Pagination";
import { MultiSelect } from "@/components/shared/MultiSelect";
import { AddCompanyDialog } from "@/components/forms/AddCompanyDialog";
import { Plus, Search, MessageSquare, AlertCircle, Loader2, ArrowUpDown, Phone, Mail, Globe, Lock, X } from "lucide-react";
import { roleLabel } from "@/lib/roles";
import { telHref, mailtoHref } from "@/lib/utils";
import { matchClassifier } from "@/lib/classifier";
import { ALL_REGIONS, toggleAllRegions } from "@/lib/regions";
import { PageBanner } from "@/components/shared/PageBanner";

interface CompanyRow {
  id: string;
  kind: "company" | "participant";
  inn: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  regions: string[];
  classifierIds: string[];
  isContactsHidden: boolean;
  billingHidden: boolean;
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

interface TreeItem {
  id: string;
  name: string;
  fullNumberPath: string;
}

interface Props {
  rows: CompanyRow[];
  total: number;
  page: number;
  pageSize: number;
  treeItems: TreeItem[];
  regions: string[];
  pageTitle: string | null;
  moderatorText: string | null;
  bannerUrl: string | null;
  initialQuery: {
    q: string;
    type: "all" | "company" | "participant";
    region: string;
    classifier: string;
    sort: "name" | "rating";
    dir: "asc" | "desc";
  };
}

const COMPANY_CRITERIA_LABELS = [
  "Качество оказанной работы/услуги/материала/поставки",
  "Организация работы на объекте / организация поставки",
  "Взаимодействие со специалистами компании",
  "Наличие средств, необходимых для выполнения работ",
  "Финансовое состояние предприятия",
  "Наличие квалифицированных специалистов и руководителей",
  "Срок выполнения работ/поставки",
  "Стоимость и условия оплаты",
  "Особые условия/гибкость в договорных отношениях",
];

const PARTICIPANT_CRITERIA_LABELS = [
  "Качество работы — соответствие результата стандартам, отсутствие ошибок",
  "Профессионализм — глубокие знания в своей области",
  "Коммуникабельность — умение ясно излагать мысли, вести диалог",
  "Уважительность — корректное и тактичное отношение к другим",
  "Организованность — способность планировать работу, соблюдать сроки",
  "Ответственность — готовность брать на себя обязательства",
  "Гибкость и адаптивность — умение быстро перестраиваться",
  "Работа в команде — способность сотрудничать, поддерживать коллег",
  "Соблюдение договорённостей — выполнение обязательств по срокам и условиям",
];

export function SuppliersPageClient({ rows, total, page, pageSize, treeItems, regions, pageTitle, moderatorText, bannerUrl, initialQuery }: Props) {
  const { data: session } = useSession();
  const router = useRouter();
  const { guard, dialog: authDialog } = useAuthGuard();
  const isAdmin =
    session?.user &&
    ["MODERATOR", "EDITOR", "SUPER", "ROOT"].includes(
      (session.user as { type?: string }).type ?? "",
    );
  const canReview =
    !!session?.user && (session.user as { status?: string }).status === "ACTIVE";

  const [revals, setRevals] = useState<Record<string, Record<string, boolean>>>({});

  // Локальное состояние только для инпута поиска (с дебаунсом в URL)
  const [search, setSearch] = useState(initialQuery.q);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const typeFilter = initialQuery.type;
  const regionFilter = initialQuery.region.split(",").filter(Boolean);
  const classifierFilter = initialQuery.classifier.split(",").filter(Boolean);
  const sortBy = initialQuery.sort;
  const sortDir = initialQuery.dir;

  const hasActiveFilters = !!(
    initialQuery.q ||
    typeFilter ||
    regionFilter.length > 0 ||
    classifierFilter.length > 0
  );

  // Все фильтры/пагинация живут в URL — сервер отдаёт только нужную страницу
  function updateQuery(next: Record<string, string | null>) {
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(next)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    const qs = params.toString();
    router.replace(qs ? `/suppliers?${qs}` : "/suppliers", { scroll: false });
  }

  function handleSearchChange(value: string) {
    setSearch(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      updateQuery({ q: value, page: null });
    }, 300);
  }

  const [reviewTarget, setReviewTarget] = useState<{ id: string; name: string; companyId?: string; label?: string } | null>(null);
  const [reviewPopup, setReviewPopup] = useState<{ id: string; kind: "company" | "participant"; name: string } | null>(null);
  const [reviewsList, setReviewsList] = useState<{ id: string; authorNick: string; comment: string; weightedAverage: number; createdAt: string; criteria: { criteriaIndex: number; score: number }[] }[] | null>(null);
  const [expandedReviewId, setExpandedReviewId] = useState<string | null>(null);

  // Загрузка отзывов для попапа
  useEffect(() => {
    if (!reviewPopup) return;
    let cancelled = false;
    const params = reviewPopup.kind === "company"
      ? `companyId=${reviewPopup.id}`
      : `targetId=${reviewPopup.id}`;
    fetch(`/api/reviews?${params}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setReviewsList(d.reviews || []); })
      .catch(() => { if (!cancelled) setReviewsList([]); });
    return () => { cancelled = true; };
  }, [reviewPopup]);

  function openReviewsPopup(popup: { id: string; kind: "company" | "participant"; name: string }) {
    setExpandedReviewId(null);
    setReviewPopup(popup);
  }

  function closeReviewsPopup() {
    setReviewPopup(null);
    setReviewsList(null);
    setExpandedReviewId(null);
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Варианты классификатора из продуктового дерева
  const classifierOptions = useMemo(
    () => treeItems.map((t) => ({ value: t.id, label: `${t.fullNumberPath} — ${t.name}` })),
    [treeItems],
  );

  // id узла классификатора → путь (для отображения бейджей)
  const classifierPathById = useMemo(
    () => new Map(treeItems.map((t) => [t.id, t.fullNumberPath])),
    [treeItems],
  );

  // Единый список регионов: «Все регионы» + каталог из БД
  const regionOptions = useMemo(
    () => [{ value: ALL_REGIONS, label: ALL_REGIONS }, ...regions.map((r) => ({ value: r, label: r }))],
    [regions],
  );

  // Поля, просмотры которых уже засчитаны (один раз за сессию на поле)
  const countedRef = useRef<Record<string, Record<string, boolean>>>({});

  // Счётчики просмотров для админа: обновляем локально сразу после раскрытия,
  // иначе до ревалидации страницы видны устаревшие значения
  const [metricOverrides, setMetricOverrides] = useState<
    Record<string, Partial<Record<"phoneViews" | "emailViews" | "websiteViews", number>>>
  >({});

  const handleReveal = useCallback(
    async (companyId: string, field: string) => {
      const key = `${companyId}`;
      const isReveal = !revals[key]?.[field];
      setRevals((prev) => ({
        ...prev,
        [key]: { ...prev[key], [field]: !prev[key]?.[field] },
      }));

      // Метрика просмотров считается только для компаний,
      // только при раскрытии и один раз за сессию
      const row = rows.find((c) => c.id === companyId);
      if (!row || row.kind === "participant" || row.billingHidden || !isReveal) return;
      if (countedRef.current[key]?.[field]) return;
      countedRef.current = {
        ...countedRef.current,
        [key]: { ...countedRef.current[key], [field]: true },
      };

      try {
        const res = await fetch(`/api/suppliers/metrics/${companyId}/click`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ field }),
        });
        // После успешного засчитывания сразу показываем новое значение
        if (res.ok && (field === "phone" || field === "email" || field === "website")) {
          const viewField = `${field}Views` as "phoneViews" | "emailViews" | "websiteViews";
          setMetricOverrides((prev) => ({
            ...prev,
            [key]: { ...prev[key], [viewField]: (prev[key]?.[viewField] ?? row.metrics[viewField]) + 1 },
          }));
        }
      } catch {
        // silent
      }
    },
    [rows, revals],
  );

  // ── Переиспользуемые фрагменты строки: и в таблице (десктоп), и в карточке (мобильный)
  const ratingCell = (company: CompanyRow, key: string) => {
    const rev = revals[key] || {};
    if (company.rating === null) return <span className="text-xs text-muted-foreground">—</span>;
    return (
      <div className="flex items-center gap-1">
        {rev.rating ? (
          <button
            type="button"
            onClick={() => openReviewsPopup({ id: company.id, kind: company.kind, name: company.name })}
            className="flex items-center gap-1 cursor-pointer hover:opacity-80"
            title="Показать отзывы"
          >
            <StarRating rating={company.rating} size="sm" />
            <span className="text-xs text-muted-foreground">{company.rating}</span>
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <EyeButton onClick={() => handleReveal(key, "rating")} />
            <span className="text-xs text-muted-foreground">Скрыт</span>
          </div>
        )}
      </div>
    );
  };

  const contactCell = (
    company: CompanyRow,
    key: string,
    field: "phone" | "email" | "website",
    contactsBlocked: boolean,
  ) => {
    const rev = revals[key] || {};
    const value = company[field];
    const Icon = field === "phone" ? Phone : field === "email" ? Mail : Globe;
    const fieldLabel = field === "phone" ? "телефон" : field === "email" ? "email" : "сайт";
    if (contactsBlocked) {
      return (
        <span className="inline-flex items-center gap-1 text-muted-foreground" title="Контакты скрыты администратором">
          <Lock className="h-3 w-3" />
          Скрыто
        </span>
      );
    }
    if (!value) return "—";
    return (
      <div className="flex items-center gap-1">
        {rev[field] ? (
          field === "website" ? (
            <a
              href={value}
              target="_blank"
              rel="noreferrer"
              className="text-sm flex items-center gap-1 hover:text-menthol transition-colors"
            >
              <Icon className="h-3 w-3 text-muted-foreground" />
              {value.replace(/^https?:\/\//, "")}
            </a>
          ) : (
            <a
              href={field === "phone" ? telHref(value) : mailtoHref(value)}
              className="text-sm flex items-center gap-1 hover:text-menthol transition-colors"
            >
              <Icon className="h-3 w-3 text-muted-foreground" />
              {value}
            </a>
          )
        ) : (
          <span className="inline-flex items-center gap-1">
            <Icon className="h-3 w-3 text-muted-foreground" />
            <EyeButton onClick={() => handleReveal(key, field)} fieldLabel={fieldLabel} />
          </span>
        )}
        {isAdmin && (
          <span className="text-[10px] text-muted-foreground">
            ({metricOverrides[company.id]?.[`${field}Views`] ?? company.metrics[`${field}Views`]})
          </span>
        )}
      </div>
    );
  };

  const classifierBadges = (company: CompanyRow) => (
    <div className="flex flex-wrap gap-1">
      {company.classifierIds.slice(0, 2).map((id) => (
        <Badge key={id} variant="secondary" className="text-[10px]">
          {classifierPathById.get(id) || id}
        </Badge>
      ))}
      {company.classifierIds.length > 2 && (
        <Badge variant="outline" className="text-[10px]">
          +{company.classifierIds.length - 2}
        </Badge>
      )}
    </div>
  );

  const roleText = (company: CompanyRow) =>
    company.ownerRoles.length > 0
      ? company.ownerRoles.map(roleLabel).join(", ")
      : company.inn ? "Поставщик" : "—";

  const reviewsCell = (company: CompanyRow, key: string) => {
    const rev = revals[key] || {};
    return (
      <div className="flex items-center gap-1">
        {rev.reviews ? (
          <button
            type="button"
            onClick={() => openReviewsPopup({ id: company.id, kind: company.kind, name: company.name })}
            className="text-xs text-menthol hover:underline cursor-pointer"
          >
            {company.reviewCount} отз.
          </button>
        ) : (
          <EyeButton onClick={() => handleReveal(key, "reviews")} fieldLabel="отзывы" />
        )}
      </div>
    );
  };

  const reviewButtons = (company: CompanyRow) => (
    <div className="flex gap-1">
      {company.kind === "company" && (canReview || !session?.user) && (
        <GuestGuard actionLabel="оставить отзыв о компании">
          <Button size="sm" variant="outline" className="h-7 text-xs"
            onClick={() => setReviewTarget({ id: company.id, name: company.name, companyId: company.id, label: "компанию" })}>
            <MessageSquare className="h-3 w-3 mr-1" />Компании
          </Button>
        </GuestGuard>
      )}
      {company.kind === "participant" && (canReview || !session?.user) && (
        <GuestGuard actionLabel="оставить отзыв об участнике">
          <Button size="sm" variant="outline" className="h-7 text-xs"
            onClick={() => setReviewTarget({ id: company.id, name: company.ownerNick || company.name, label: "участника" })}>
            <MessageSquare className="h-3 w-3 mr-1" />Участнику
          </Button>
        </GuestGuard>
      )}
    </div>
  );

  return (
    <div className="container-page py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">База поставщиков и заказчиков</h1>
          <p className="text-muted-foreground mt-1">
            Контакты открываются по клику на иконку глаза
          </p>
        </div>
        <div className="flex gap-2">
          <AddCompanyDialog
            regions={regions}
            treeItems={treeItems}
            renderTrigger={(open) => (
              <Button
                className="bg-menthol hover:bg-menthol-dark gap-2"
                onClick={guard(open)}
              >
                <Plus className="h-4 w-4" />
                Добавить компанию
              </Button>
            )}
          />
        </div>
      </div>

      {/* Info banner */}
      {(pageTitle || moderatorText) && (
        <div className="bg-menthol/5 border border-menthol/20 rounded-lg p-3 mb-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-menthol flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            {pageTitle && <p className="font-medium text-menthol">{pageTitle}</p>}
            {moderatorText && (
              <div className="text-muted-foreground" dangerouslySetInnerHTML={{ __html: moderatorText }} />
            )}
          </div>
        </div>
      )}

      {/* Баннер */}
      {bannerUrl && <PageBanner url={bannerUrl} alt="Баннер базы поставщиков" />}

      {/* Search + Filters — состояние живёт в URL, данные отдаёт сервер */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск: название, ИНН, ник, контакты, сайт..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={typeFilter}
          items={{ all: "Все", company: "Компании", participant: "Участники" }}
          onValueChange={(v) => updateQuery({ type: v && v !== "all" ? v : null, page: null })}
        >
          <SelectTrigger className="w-[calc(50%-6px)] sm:w-[140px]">
            <SelectValue placeholder="Тип" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" label="Все">Все</SelectItem>
            <SelectItem value="company" label="Компании">Компании</SelectItem>
            <SelectItem value="participant" label="Участники">Участники</SelectItem>
          </SelectContent>
        </Select>
        <MultiSelect
          options={regionOptions}
          value={regionFilter}
          onChange={(v) => updateQuery({ region: toggleAllRegions(regionFilter, v).join(","), page: null })}
          placeholder="Регион"
          searchPlaceholder="Поиск региона..."
          className="w-[calc(50%-6px)] sm:w-[200px]"
        />
        <MultiSelect
          options={classifierOptions}
          value={classifierFilter}
          onChange={(v) => updateQuery({ classifier: v.join(","), page: null })}
          placeholder="Классификатор"
          searchPlaceholder="Поиск категории..."
          className="w-[calc(50%-6px)] sm:w-[220px]"
          filter={matchClassifier}
          hideSelectedLabels
        />
        <Button
          variant="outline"
          size="sm"
          className="h-10 px-3 gap-1"
          onClick={() =>
            updateQuery({ sort: sortBy === "name" ? "rating" : "name", dir: "asc", page: null })
          }
          title={`Сортировка: ${sortBy === "name" ? "по названию" : "по рейтингу"}`}
        >
          <ArrowUpDown className="h-4 w-4" />
          {sortBy === "name" ? "Название" : "Рейтинг"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-10 px-3 gap-1"
          onClick={() => updateQuery({ dir: sortDir === "asc" ? "desc" : "asc", page: null })}
          title={sortDir === "asc" ? "По возрастанию" : "По убыванию"}
        >
          {sortDir === "asc" ? "↑" : "↓"}
        </Button>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" className="h-10 gap-1" onClick={() => router.replace("/suppliers")}>
            <X className="h-3 w-3 mr-1" />
            Сбросить
          </Button>
        )}
      </div>

      {/* Таблица — только десктоп (md+); на мобильных ниже карточки */}
      <div className="hidden md:block border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ник</TableHead>
              <TableHead>ИНН</TableHead>
              <TableHead>Название / Имя</TableHead>
              <TableHead>Рейтинг</TableHead>
              <TableHead>Телефон</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Сайт</TableHead>
              <TableHead>Классификатор</TableHead>
              <TableHead>Роль</TableHead>
              <TableHead>Отзывы</TableHead>
              <TableHead>Оставить отзыв</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                  Записи не найдены
                </TableCell>
              </TableRow>
            ) : (
              rows.map((company) => {
                const key = company.id;
                // Участник скрыл персональные данные — видимы только ник,
                // классификатор, роль, рейтинг и отзывы
                const hiddenContacts = company.kind === "participant" && company.isContactsHidden;
                // Санкция: контакты компании скрыты администратором за неуплату
                const contactsBlocked = hiddenContacts || company.billingHidden;

                return (
                  <TableRow key={company.id}>
                    <TableCell>{company.ownerNick || "—"}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {company.inn || "—"}
                    </TableCell>
                    <TableCell className="font-medium max-w-[180px] truncate">
                      {hiddenContacts ? (
                        "Скрыто"
                      ) : company.kind === "company" ? (
                        <Link
                          href={`/suppliers/${company.id}`}
                          className="hover:text-menthol transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {company.name}
                        </Link>
                      ) : (
                        company.name
                      )}
                    </TableCell>
                    <TableCell>{ratingCell(company, key)}</TableCell>
                    <TableCell>{contactCell(company, key, "phone", contactsBlocked)}</TableCell>
                    <TableCell>{contactCell(company, key, "email", contactsBlocked)}</TableCell>
                    <TableCell>{contactCell(company, key, "website", contactsBlocked)}</TableCell>
                    <TableCell>{classifierBadges(company)}</TableCell>
                    <TableCell>
                      <span className="text-xs">{roleText(company)}</span>
                    </TableCell>
                    <TableCell>{reviewsCell(company, key)}</TableCell>
                    <TableCell>{reviewButtons(company)}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Карточки — только мобильный (<md): та же строка, но в колонку */}
      <div className="md:hidden space-y-3">
        {rows.length === 0 ? (
          <div className="border rounded-lg p-8 text-center text-muted-foreground">
            Записи не найдены
          </div>
        ) : (
          rows.map((company) => {
            const key = company.id;
            const hiddenContacts = company.kind === "participant" && company.isContactsHidden;
            const contactsBlocked = hiddenContacts || company.billingHidden;
            return (
              <div key={company.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground truncate">
                      {company.ownerNick || "—"}
                      {company.inn ? ` · ИНН ${company.inn}` : ""}
                    </p>
                    <p className="font-medium break-words">
                      {hiddenContacts ? (
                        "Скрыто"
                      ) : company.kind === "company" ? (
                        <Link
                          href={`/suppliers/${company.id}`}
                          className="hover:text-menthol transition-colors"
                        >
                          {company.name}
                        </Link>
                      ) : (
                        company.name
                      )}
                    </p>
                  </div>
                  <div className="shrink-0">{ratingCell(company, key)}</div>
                </div>

                <div className="flex flex-col items-start gap-1 text-sm">
                  {contactsBlocked ? (
                    <span className="inline-flex items-center gap-1 text-muted-foreground" title="Контакты скрыты администратором">
                      <Lock className="h-3 w-3" />
                      Контакты скрыты
                    </span>
                  ) : (
                    <>
                      {company.phone && contactCell(company, key, "phone", false)}
                      {company.email && contactCell(company, key, "email", false)}
                      {company.website && contactCell(company, key, "website", false)}
                    </>
                  )}
                </div>

                {classifierBadges(company)}

                <p className="text-xs text-muted-foreground">{roleText(company)}</p>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2">
                  {reviewsCell(company, key)}
                  {reviewButtons(company)}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Пагинация */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center sm:justify-between gap-2 mt-4 text-sm text-muted-foreground">
          <span>Всего: {total} записей</span>
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={(p) => updateQuery({ page: String(p) })} />
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
              criteriaLabels={reviewTarget.companyId ? COMPANY_CRITERIA_LABELS : PARTICIPANT_CRITERIA_LABELS}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Reviews Popup */}
      {reviewPopup && (
        <Dialog open={!!reviewPopup} onOpenChange={closeReviewsPopup}>
          <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader className="min-w-0">
              <DialogTitle className="break-words">Отзывы — {reviewPopup.name}</DialogTitle>
              <DialogDescription>
                {reviewsList === null
                  ? "Загрузка..."
                  : reviewsList.length > 0
                    ? `Всего отзывов: ${reviewsList.length}`
                    : "Отзывов пока нет"}
              </DialogDescription>
            </DialogHeader>
            {reviewsList === null ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : reviewsList.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Будьте первым, кто оставит отзыв
              </p>
            ) : (
              <div className="space-y-3 min-w-0">
                {reviewsList.map((r) => {
                  const isExpanded = expandedReviewId === r.id;
                  const criteriaLabels = reviewPopup.kind === "company"
                    ? COMPANY_CRITERIA_LABELS
                    : PARTICIPANT_CRITERIA_LABELS;
                  return (
                    <div key={r.id} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-sm font-medium break-words min-w-0">{r.authorNick}</span>
                        <StarRating rating={r.weightedAverage} size="sm" />
                      </div>
                      <p className="text-sm mb-1 wrap-anywhere whitespace-pre-wrap">{r.comment}</p>
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-xs text-muted-foreground">
                          {new Date(r.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
                        </p>
                        <ReportReviewButton reviewId={r.id} />
                      </div>
                      {r.criteria.length > 0 && (
                        <div className="mt-2">
                          <button
                            type="button"
                            onClick={() => setExpandedReviewId(isExpanded ? null : r.id)}
                            className="text-xs text-menthol hover:underline cursor-pointer"
                          >
                            {isExpanded ? "Скрыть оценки по критериям" : "Показать оценки по критериям"}
                          </button>
                          {isExpanded && (
                            <div className="mt-2 space-y-1 border-t pt-2">
                              {r.criteria.map((c) => (
                                <div key={c.criteriaIndex} className="flex items-center justify-between gap-2 text-xs">
                                  <span className="text-muted-foreground">
                                    {c.criteriaIndex}. {criteriaLabels[c.criteriaIndex - 1] || "Критерий"}
                                  </span>
                                  <span className="font-medium flex-shrink-0">{c.score}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
      {authDialog}
    </div>
  );
}
