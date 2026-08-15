"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { SearchSelect } from "@/components/shared/SearchSelect";
import { FieldError } from "@/components/forms/fields";
import { Pagination } from "@/components/shared/Pagination";
import { toastSuccess, toastError } from "@/lib/toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Trash2, Vote, Loader2, BarChart3, X, Pencil, Archive, RotateCcw, Search } from "lucide-react";

interface PollData {
  id: string;
  question: string;
  pollType: string;
  coinReward: number;
  isActive: boolean;
  treeItem: { id: string; fullNumberPath: string; name: string } | null;
  _count: { votes: number };
  options: { id: string; text: string; _count: { votes: number } }[];
  votes: { user: { username: string; profile: { nick: string } | null } }[];
}

interface TreeItem {
  id: string;
  fullNumberPath: string;
  name: string;
}

interface Props {
  polls: PollData[];
  treeItems: TreeItem[];
  total: number;
  page: number;
  totalPages: number;
  initialQuery: { q: string; type: string; active: string; sort: string };
}

// Сообщения совпадают с серверной схемой pollSchema
const pollFormSchema = z.object({
  question: z.string().trim().min(1, "Вопрос обязателен"),
  pollType: z.enum(["DICHOTOMOUS", "MULTIPLE"]),
  treeItemId: z
    .string()
    .uuid("Некорректная категория")
    .optional()
    .or(z.literal("")),
  coinReward: z
    .string()
    .trim()
    .regex(/^\d+([.,]\d{1,2})?$/, "Некорректная награда")
    .optional()
    .or(z.literal("")),
  options: z
    .array(
      z.object({
        id: z.string().optional(), // при редактировании — id существующего варианта
        text: z
          .string()
          .trim()
          .min(1, "Введите вариант ответа")
          .max(255, "Вариант должен быть не более 255 символов"),
      }),
    )
    .min(2, "Минимум 2 варианта ответа"),
});

type PollFormValues = z.infer<typeof pollFormSchema>;

const POLL_FORM_DEFAULTS: PollFormValues = {
  question: "",
  pollType: "DICHOTOMOUS",
  treeItemId: "",
  coinReward: "0.1",
  options: [{ text: "" }, { text: "" }],
};

export function PollsManager({ polls, treeItems, total, page, totalPages, initialQuery }: Props) {
  const router = useRouter();

  // ── Фильтры в URL ──
  const [search, setSearch] = useState(initialQuery.q);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function updateQuery(next: Record<string, string | null>) {
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(next)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    const qs = params.toString();
    router.replace(qs ? `/admin/polls?${qs}` : "/admin/polls", { scroll: false });
  }

  function handleSearchChange(value: string) {
    setSearch(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      updateQuery({ q: value, page: null });
    }, 300);
  }

  const hasFilters = !!(
    initialQuery.q ||
    initialQuery.type ||
    initialQuery.active ||
    initialQuery.sort !== "created"
  );

  // ── Форма создания/редактирования ──
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<PollFormValues>({
    resolver: zodResolver(pollFormSchema),
    // Валидируем после первого «касания» поля, а не сразу при наборе
    mode: "onTouched",
    defaultValues: POLL_FORM_DEFAULTS,
  });

  const {
    fields: optionFields,
    append,
    remove,
  } = useFieldArray({ control, name: "options" });

  function openCreate() {
    setEditId(null);
    reset(POLL_FORM_DEFAULTS);
    setError("");
    setFormOpen(true);
  }

  function openEdit(p: PollData) {
    setEditId(p.id);
    reset({
      question: p.question,
      pollType: p.pollType as PollFormValues["pollType"],
      treeItemId: p.treeItem?.id ?? "",
      coinReward: String(p.coinReward),
      options: p.options.map((o) => ({ id: o.id, text: o.text })),
    });
    setError("");
    setFormOpen(true);
  }

  async function handleSubmitForm(data: PollFormValues) {
    setLoading(true);
    setError("");

    const isEdit = !!editId;
    try {
      const res = await fetch(isEdit ? `/api/polls/${editId}` : "/api/polls", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: data.question,
          treeItemId: data.treeItemId || null,
          pollType: data.pollType,
          coinReward: data.coinReward ? parseFloat(data.coinReward.replace(",", ".")) : 0.1,
          options: data.options.map((o, i) => ({ id: o.id, text: o.text, sortOrder: i })),
        }),
      });
      if (res.ok) {
        const d = await res.json().catch(() => ({}));
        if (isEdit && d.removedOptions > 0) {
          toastSuccess("Опрос обновлён", `Удалено вариантов: ${d.removedOptions} — их голоса потеряны`);
        } else {
          toastSuccess(isEdit ? "Опрос обновлён" : "Опрос создан");
        }
        setFormOpen(false);
        reset(POLL_FORM_DEFAULTS);
        router.refresh();
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Ошибка");
      }
    } catch {
      setError("Ошибка соединения");
    }
    setLoading(false);
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleteLoading(true);
    await fetch(`/api/polls/${deleteId}`, { method: "DELETE" });
    setDeleteId(null);
    setDeleteLoading(false);
    router.refresh();
  }

  async function handleToggle(p: PollData) {
    setTogglingId(p.id);
    try {
      const res = await fetch(`/api/polls/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle" }),
      });
      if (res.ok) {
        toastSuccess(p.isActive ? "Опрос архивирован" : "Опрос активирован");
        router.refresh();
      } else {
        const d = await res.json().catch(() => ({}));
        toastError("Ошибка", d.error || "Не удалось изменить статус");
      }
    } catch {
      toastError("Ошибка соединения");
    }
    setTogglingId(null);
  }

  const optionsError = (errors.options as { message?: string } | undefined)?.message;

  return (
    <div className="space-y-6">
      {/* Поиск и фильтры */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по вопросу..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={initialQuery.type || "all"}
          items={{ all: "Все типы", DICHOTOMOUS: "Да/Нет", MULTIPLE: "Несколько" }}
          onValueChange={(v) => updateQuery({ type: v === "all" ? null : v, page: null })}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Тип" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" label="Все типы">Все типы</SelectItem>
            <SelectItem value="DICHOTOMOUS" label="Да/Нет">Да/Нет</SelectItem>
            <SelectItem value="MULTIPLE" label="Несколько">Несколько</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={initialQuery.active || "all"}
          items={{ all: "Все", 1: "Активные", 0: "Архивные" }}
          onValueChange={(v) => updateQuery({ active: v === "all" ? null : v, page: null })}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Статус" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" label="Все">Все</SelectItem>
            <SelectItem value="1" label="Активные">Активные</SelectItem>
            <SelectItem value="0" label="Архивные">Архивные</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={initialQuery.sort}
          items={{ created: "Сначала новые", votes: "По популярности", reward: "По награде" }}
          onValueChange={(v) => updateQuery({ sort: v === "created" ? null : v, page: null })}
        >
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Сортировка" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created" label="Сначала новые">Сначала новые</SelectItem>
            <SelectItem value="votes" label="По популярности">По популярности</SelectItem>
            <SelectItem value="reward" label="По награде">По награде</SelectItem>
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              updateQuery({ q: null, type: null, active: null, sort: null, page: null });
            }}
          >
            <X className="h-3 w-3 mr-1" />
            Сбросить
          </Button>
        )}
        <Button className="bg-menthol hover:bg-menthol-dark gap-2 ml-auto" onClick={openCreate}>
          <Plus className="h-4 w-4" /> Создать опрос
        </Button>
      </div>

      {/* Диалог создания/редактирования */}
      <Dialog open={formOpen} onOpenChange={(v) => { setFormOpen(v); if (!v) reset(POLL_FORM_DEFAULTS); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Редактировать опрос" : "Новый опрос"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(handleSubmitForm)} className="space-y-4" noValidate>
            {error && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-2.5">
                <FieldError message={error} />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="question">Вопрос</Label>
              <Input
                id="question"
                maxLength={255}
                aria-invalid={!!errors.question}
                aria-describedby={errors.question ? "question-error" : undefined}
                {...register("question")}
              />
              {errors.question && <FieldError id="question-error" message={errors.question.message} />}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Тип</Label>
                <Controller
                  name="pollType"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      items={{ DICHOTOMOUS: "Да/Нет", MULTIPLE: "Несколько" }}
                      onValueChange={(v) => field.onChange((v as PollFormValues["pollType"]) ?? "DICHOTOMOUS")}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DICHOTOMOUS" label="Да/Нет">Да/Нет</SelectItem>
                        <SelectItem value="MULTIPLE" label="Несколько">Несколько</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="coinReward">Монет</Label>
                <Input
                  id="coinReward"
                  type="number"
                  min="0"
                  step="0.1"
                  aria-invalid={!!errors.coinReward}
                  aria-describedby={errors.coinReward ? "coinReward-error" : undefined}
                  {...register("coinReward")}
                />
                {errors.coinReward && (
                  <FieldError id="coinReward-error" message={errors.coinReward.message} />
                )}
              </div>
              <div className="space-y-2">
                <Label>Категория</Label>
                <Controller
                  name="treeItemId"
                  control={control}
                  render={({ field }) => (
                    <SearchSelect
                      options={[
                        { value: "", label: "Без категории" },
                        ...treeItems.map(t => ({ value: t.id, label: `${t.fullNumberPath} — ${t.name}` })),
                      ]}
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      placeholder="—"
                      searchPlaceholder="Поиск категории..."
                    />
                  )}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Варианты ответа</Label>
              {optionFields.map((field, i) => (
                <div key={field.id} className="flex gap-2 mb-1">
                  <Input
                    placeholder={`Вариант ${i + 1}`}
                    maxLength={255}
                    aria-invalid={!!errors.options?.[i]?.text}
                    {...register(`options.${i}.text` as const)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0 text-red-500"
                    onClick={() => remove(i)}
                    disabled={optionFields.length <= 2}
                    aria-label={`Удалить вариант ${i + 1}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  {errors.options?.[i]?.text && (
                    <div className="col-span-2 -mt-1">
                      <FieldError message={errors.options[i].text.message} />
                    </div>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => append({ text: "" })}
                disabled={optionFields.length >= 10}
              >
                <Plus className="h-3 w-3" />
                Добавить вариант
              </Button>
              {optionsError && <FieldError id="options-error" message={optionsError} />}
              {editId && (
                <p className="text-xs text-muted-foreground">
                  Удалённые при редактировании варианты теряют набранные голоса.
                </p>
              )}
            </div>

            <Button type="submit" className="w-full bg-menthol hover:bg-menthol-dark" disabled={loading}>
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Сохранение...</>
              ) : (
                editId ? "Сохранить изменения" : "Создать"
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {polls.length === 0 ? (
        <div className="border rounded-lg p-12 text-center text-muted-foreground">
          <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg">{hasFilters ? "Ничего не найдено" : "Нет опросов"}</p>
          <p className="text-sm mt-2">
            {hasFilters ? "Попробуйте изменить или сбросить фильтры" : "Создайте первый опрос для участников платформы"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {polls.map((p) => (
            <Card key={p.id} className={!p.isActive ? "opacity-70" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{p.question}</CardTitle>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" title="Редактировать"
                      onClick={() => openEdit(p)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title={p.isActive ? "Архивировать" : "Активировать"}
                      disabled={togglingId === p.id}
                      onClick={() => handleToggle(p)}
                    >
                      {togglingId === p.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : p.isActive ? (
                        <Archive className="h-3 w-3" />
                      ) : (
                        <RotateCcw className="h-3 w-3" />
                      )}
                    </Button>
                    <Button variant="ghost" size="icon" className="text-red-500 h-7 w-7" onClick={() => setDeleteId(p.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-1">
                  <Badge variant="secondary" className="text-[10px]">{p.pollType === "DICHOTOMOUS" ? "Да/Нет" : "Множественный"}</Badge>
                  <Badge variant="outline" className="text-[10px]">+{p.coinReward} мон.</Badge>
                  <Badge variant="outline" className="text-[10px]"><Vote className="h-3 w-3 mr-1" />{p._count.votes}</Badge>
                  {!p.isActive && (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">Архивный</Badge>
                  )}
                  {p.treeItem && (
                    <Badge variant="outline" className="text-[10px]">{p.treeItem.fullNumberPath}</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {p.options.map((o) => (
                  <div key={o.id} className="flex justify-between text-sm py-1 border-b last:border-0">
                    <span>{o.text}</span>
                    <span className="text-muted-foreground">{o._count.votes} ({p._count.votes > 0 ? Math.round(o._count.votes / p._count.votes * 100) : 0}%)</span>
                  </div>
                ))}
                {p.votes.length > 0 && (
                  <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
                    Проголосовали: {p.votes.slice(0, 5).map(v => v.user.profile?.nick || v.user.username).join(", ")}
                    {p.votes.length > 5 && ` + ещё ${p.votes.length - 5}`}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
          <span>Всего: {total} опросов</span>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={(p) => updateQuery({ page: String(p) })}
          />
        </div>
      )}

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(v) => { if (!v) setDeleteId(null); }}
        title="Удалить опрос?"
        message="Результаты голосования будут потеряны."
        confirmLabel="Удалить"
        onConfirm={handleDelete}
        loading={deleteLoading}
      />
    </div>
  );
}
