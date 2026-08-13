"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
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
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EyeButton } from "@/components/shared/EyeButton";
import { GuestGuard } from "@/components/shared/GuestGuard";
import { useAuthGuard } from "@/components/shared/useAuthGuard";
import { StarRating } from "@/components/shared/StarRating";
import { ReviewForm } from "@/components/forms/ReviewForm";
import { Pagination } from "@/components/shared/Pagination";
import { MultiSelect } from "@/components/shared/MultiSelect";
import { SearchSelect } from "@/components/shared/SearchSelect";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Search, MessageSquare, AlertCircle, Loader2, ArrowUpDown, Phone, Mail, Globe } from "lucide-react";
import { roleLabel } from "@/lib/roles";
import { toastSuccess } from "@/lib/toast";
import { telHref, mailtoHref } from "@/lib/utils";
import { matchClassifier } from "@/lib/classifier";
import { PageBanner } from "@/components/shared/PageBanner";
import { FieldError, applyPhoneMask, formatRussianPhone } from "@/components/forms/fields";
import { isValidInn } from "@/lib/validators";

interface CompanyRow {
  id: string;
  kind: "company" | "participant";
  inn: string | null;
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

// Сообщения совпадают с серверной схемой addCompanySchema
const addCompanyFormSchema = z.object({
  inn: z
    .string()
    .regex(/^\d{10}$|^\d{12}$/, "ИНН должен содержать ровно 10 или 12 цифр")
    .refine(isValidInn, "Такого ИНН не существует — проверьте номер"),
  name: z
    .string()
    .trim()
    .min(1, "Название компании обязательно")
    .max(255, "Название должно быть не более 255 символов"),
  email: z.string().trim().toLowerCase().email("Некорректный email"),
  phone: z
    .string()
    .regex(
      /^(\+7|8)?[\s-]?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}$/,
      "Неверный формат телефона. Пример: +7 (999) 123-45-67",
    ),
  website: z
    .string()
    .trim()
    .max(255, "Сайт должен быть не более 255 символов")
    .refine((v) => !/\s/.test(v), "Ссылка не должна содержать пробелов")
    .optional()
    .or(z.literal("")),
  region: z.string().min(1, "Выберите регион").max(255),
  classifierIds: z
    .array(z.string().uuid("Некорректный классификатор"))
    .min(1, "Выберите хотя бы одну категорию классификатора"),
});

type AddCompanyFormValues = z.infer<typeof addCompanyFormSchema>;

const ADD_COMPANY_FORM_DEFAULTS: AddCompanyFormValues = {
  inn: "",
  name: "",
  email: "",
  phone: "",
  website: "",
  region: "",
  classifierIds: [],
};

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

  const [addOpen, setAddOpen] = useState(false);
  const [addError, setAddError] = useState("");
  const [addLoading, setAddLoading] = useState(false);

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

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    setError: setFieldError,
    setFocus,
    formState: { errors },
  } = useForm<AddCompanyFormValues>({
    resolver: zodResolver(addCompanyFormSchema),
    // Валидируем после первого «касания» поля, а не сразу при наборе
    mode: "onTouched",
    defaultValues: ADD_COMPANY_FORM_DEFAULTS,
  });
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

  // Единый список регионов (из БД)
  const regionOptions = useMemo(
    () => regions.map((r) => ({ value: r, label: r })),
    [regions],
  );

  // Поля, просмотры которых уже засчитаны (один раз за сессию на поле)
  const countedRef = useRef<Record<string, Record<string, boolean>>>({});

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
      if (row?.kind === "participant" || !isReveal) return;
      if (countedRef.current[key]?.[field]) return;
      countedRef.current = {
        ...countedRef.current,
        [key]: { ...countedRef.current[key], [field]: true },
      };

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
    [rows, revals],
  );

  async function handleAddCompany(values: AddCompanyFormValues) {
    setAddError("");
    setAddLoading(true);

    try {
      const res = await fetch("/api/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inn: values.inn,
          name: values.name,
          email: values.email,
          phone: values.phone,
          website: values.website,
          region: values.region,
          classifierIds: values.classifierIds,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const message = data.error || "Ошибка добавления";
        // Конфликт ИНН привязываем к полю
        if (message.includes("ИНН")) {
          setFieldError("inn", { message });
          setFocus("inn");
        } else {
          setAddError(message);
        }
      } else {
        setAddOpen(false);
        reset(ADD_COMPANY_FORM_DEFAULTS);
        toastSuccess("Компания добавлена", "+1 монета начислена на ваш счёт");
        router.refresh();
      }
    } catch {
      setAddError("Ошибка соединения");
    }
    setAddLoading(false);
  }

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
          <Dialog open={addOpen} onOpenChange={(o) => {
            setAddOpen(o);
            if (!o) {
              setAddError("");
              reset(ADD_COMPANY_FORM_DEFAULTS);
            }
          }}>
            <Button
              className="bg-menthol hover:bg-menthol-dark gap-2"
              onClick={guard(() => setAddOpen(true))}
            >
              <Plus className="h-4 w-4" />
              Добавить компанию
            </Button>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Добавить компанию</DialogTitle>
                <DialogDescription>
                  Заполните данные компании. За добавление начисляется +1 монета
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit(handleAddCompany)} className="space-y-4" noValidate>
                {addError && (
                  <Alert variant="destructive">
                    <AlertDescription>{addError}</AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2">
                  <Label htmlFor="inn">ИНН</Label>
                  <Input
                    id="inn"
                    inputMode="numeric"
                    placeholder="10 или 12 цифр"
                    maxLength={12}
                    disabled={addLoading}
                    aria-invalid={!!errors.inn}
                    aria-describedby={errors.inn ? "inn-error" : "inn-hint"}
                    {...register("inn", {
                      // Маска: только цифры, не более 12
                      setValueAs: (value: string) => value.replace(/\D/g, "").slice(0, 12),
                      onChange: (e) => {
                        e.target.value = e.target.value.replace(/\D/g, "").slice(0, 12);
                      },
                    })}
                  />
                  {errors.inn ? (
                    <FieldError id="inn-error" message={errors.inn.message} />
                  ) : (
                    <p id="inn-hint" className="text-xs text-muted-foreground">
                      10 цифр для организации, 12 — для ИП
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Название</Label>
                  <Input
                    id="name"
                    placeholder="ООО «Компания»"
                    maxLength={255}
                    disabled={addLoading}
                    aria-invalid={!!errors.name}
                    aria-describedby={errors.name ? "name-error" : undefined}
                    {...register("name", {
                      setValueAs: (value: string) => value.replace(/\s{2,}/g, " "),
                      onChange: (e) => {
                        e.target.value = e.target.value.replace(/\s{2,}/g, " ");
                      },
                      onBlur: (e) => {
                        e.target.value = e.target.value.trim();
                      },
                    })}
                  />
                  {errors.name && <FieldError id="name-error" message={errors.name.message} />}
                </div>
                <div className="space-y-2">
                  <Label>Регион</Label>
                  <Controller
                    name="region"
                    control={control}
                    render={({ field }) => (
                      <SearchSelect
                        options={regionOptions}
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        placeholder="Регион"
                        searchPlaceholder="Поиск региона..."
                        disabled={addLoading}
                        ariaInvalid={!!errors.region}
                      />
                    )}
                  />
                  {errors.region && <FieldError id="region-error" message={errors.region.message} />}
                </div>
                <div className="space-y-2">
                  <Label>Классификатор</Label>
                  <Controller
                    name="classifierIds"
                    control={control}
                    render={({ field }) => (
                      <MultiSelect
                        options={classifierOptions}
                        value={field.value ?? []}
                        onChange={field.onChange}
                        placeholder="Выберите категории классификатора"
                        searchPlaceholder="Поиск по классификатору..."
                        filter={matchClassifier}
                        hideSelectedLabels
                        disabled={addLoading}
                        ariaInvalid={!!errors.classifierIds}
                      />
                    )}
                  />
                  {errors.classifierIds && (
                    <FieldError
                      id="classifierIds-error"
                      message={(errors.classifierIds as { message?: string }).message}
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Эл. почта</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="company@mail.ru"
                    disabled={addLoading}
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? "email-error" : undefined}
                    {...register("email", {
                      // Маска: без пробелов, в нижнем регистре
                      setValueAs: (value: string) => value.replace(/\s/g, "").toLowerCase(),
                      onChange: (e) => {
                        e.target.value = e.target.value.replace(/\s/g, "").toLowerCase();
                      },
                    })}
                  />
                  {errors.email && <FieldError id="email-error" message={errors.email.message} />}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Телефон</Label>
                  <Input
                    id="phone"
                    type="tel"
                    inputMode="tel"
                    placeholder="+7 (999) 123-45-67"
                    maxLength={18}
                    disabled={addLoading}
                    aria-invalid={!!errors.phone}
                    aria-describedby={errors.phone ? "phone-error" : undefined}
                    {...register("phone", {
                      setValueAs: (value: string) => formatRussianPhone(value),
                      onChange: (e) => applyPhoneMask(e.target),
                      onBlur: (e) => {
                        const formatted = formatRussianPhone(e.target.value);
                        e.target.value = formatted;
                        setValue("phone", formatted, { shouldValidate: true, shouldDirty: true });
                      },
                    })}
                  />
                  {errors.phone && <FieldError id="phone-error" message={errors.phone.message} />}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website">Сайт (необязательно)</Label>
                  <Input
                    id="website"
                    placeholder="example.ru"
                    maxLength={255}
                    disabled={addLoading}
                    aria-invalid={!!errors.website}
                    aria-describedby={errors.website ? "website-error" : undefined}
                    {...register("website", {
                      onChange: (e) => {
                        e.target.value = e.target.value.replace(/\s/g, "");
                      },
                      onBlur: (e) => {
                        e.target.value = e.target.value.trim();
                      },
                    })}
                  />
                  {errors.website && (
                    <FieldError id="website-error" message={errors.website.message} />
                  )}
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
          <SelectTrigger className="w-[140px]">
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
          onChange={(v) => updateQuery({ region: v.join(","), page: null })}
          placeholder="Регион"
          searchPlaceholder="Поиск региона..."
          className="w-[200px]"
        />
        <MultiSelect
          options={classifierOptions}
          value={classifierFilter}
          onChange={(v) => updateQuery({ classifier: v.join(","), page: null })}
          placeholder="Классификатор"
          searchPlaceholder="Поиск категории..."
          className="w-[220px]"
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
                            <button
                              type="button"
                              onClick={() => openReviewsPopup({ id: company.id, kind: company.kind, name: company.name })}
                              className="flex items-center gap-1 cursor-pointer hover:opacity-80"
                              title="Показать отзывы"
                            >
                              <StarRating rating={company.rating} size="sm" />
                              <span className="text-xs text-muted-foreground">
                                {company.rating}
                              </span>
                            </button>
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
                            <a
                              href={telHref(company.phone)}
                              className="text-sm flex items-center gap-1 hover:text-menthol transition-colors"
                            >
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              {company.phone}
                            </a>
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
                            <a
                              href={mailtoHref(company.email)}
                              className="text-sm flex items-center gap-1 hover:text-menthol transition-colors"
                            >
                              <Mail className="h-3 w-3 text-muted-foreground" />
                              {company.email}
                            </a>
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
                      {company.website ? (
                        <div className="flex items-center gap-1">
                          {rev.website ? (
                            <a
                              href={company.website}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sm flex items-center gap-1 hover:text-menthol transition-colors"
                            >
                              <Globe className="h-3 w-3 text-muted-foreground" />
                              {company.website.replace(/^https?:\/\//, "")}
                            </a>
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              <Globe className="h-3 w-3 text-muted-foreground" />
                              <EyeButton
                                onClick={() => handleReveal(key, "website")}
                                fieldLabel="сайт"
                              />
                            </span>
                          )}
                          {isAdmin && (
                            <span className="text-[10px] text-muted-foreground">
                              ({company.metrics.websiteViews})
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
                            {classifierPathById.get(id) || id}
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
                          ? company.ownerRoles.map(roleLabel).join(", ")
                          : company.inn ? "Поставщик" : "—"}
                      </span>
                    </TableCell>
                    <TableCell>
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
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {company.kind === "company" && (canReview || !session?.user) && (
                          <GuestGuard actionLabel="оставить отзыв о компании">
                            <Button size="sm" variant="outline" className="h-7 text-[10px]"
                              onClick={() => setReviewTarget({ id: company.id, name: company.name, companyId: company.id, label: "компанию" })}>
                              <MessageSquare className="h-3 w-3 mr-1" />Компании
                            </Button>
                          </GuestGuard>
                        )}
                        {company.kind === "participant" && (canReview || !session?.user) && (
                          <GuestGuard actionLabel="оставить отзыв об участнике">
                            <Button size="sm" variant="outline" className="h-7 text-[10px]"
                              onClick={() => setReviewTarget({ id: company.id, name: company.ownerNick || company.name, label: "участника" })}>
                              <MessageSquare className="h-3 w-3 mr-1" />Участнику
                            </Button>
                          </GuestGuard>
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
                      <p className="text-xs text-muted-foreground">
                        {new Date(r.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
                      </p>
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
