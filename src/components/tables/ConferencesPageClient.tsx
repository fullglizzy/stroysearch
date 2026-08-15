"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuthGuard } from "@/components/shared/useAuthGuard";
import { Pagination } from "@/components/shared/Pagination";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SearchSelect } from "@/components/shared/SearchSelect";
import { FieldError } from "@/components/forms/fields";
import { PageBanner } from "@/components/shared/PageBanner";
import { ImagePreview } from "@/components/shared/ImagePreview";
import { ExpandableText } from "@/components/shared/ExpandableText";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { toastError, toastSuccess, toastWarning } from "@/lib/toast";
import { Search, Calendar, Clock, Plus, Coins, ExternalLink, Loader2, AlertCircle, Upload, X } from "lucide-react";

interface ConfRow {
  id: string;
  title: string;
  organizerName: string;
  logoUrl: string | null;
  date: Date;
  time: string;
  description: string;
  treeItemPath: string | null;
  treeItemName: string | null;
  coinPrice: number;
  isPublic: boolean;
  connectionLink: string | null;
  views: number;
  participantCount: number;
}

interface TreeItem {
  id: string;
  name: string;
  fullNumberPath: string;
}

interface Props {
  conferences: ConfRow[];
  total: number;
  page: number;
  totalPages: number;
  showPast: boolean;
  treeItems: TreeItem[];
  moderatorText: string | null;
  pageTitle: string | null;
  bannerUrl: string | null;
}

// Сообщения совпадают с серверной схемой conferenceSchema
const conferenceFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Название обязательно")
    .max(511, "Название должно быть не более 511 символов"),
  date: z.string().min(1, "Укажите дату"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Формат времени: ЧЧ:ММ"),
  description: z
    .string()
    .trim()
    .min(1, "Описание обязательно")
    .max(2500, "Описание должно быть не более 2500 символов"),
  treeItemId: z
    .string()
    .uuid("Некорректная категория")
    .optional()
    .or(z.literal("")),
  coinPrice: z
    .string()
    .trim()
    .regex(/^\d+$/, "Цена — целое число монет")
    .optional()
    .or(z.literal("")),
  isPublic: z.boolean(),
  connectionLink: z
    .string()
    .trim()
    .url("Введите корректную ссылку (https://...)")
    .optional()
    .or(z.literal("")),
});

type ConferenceFormValues = z.infer<typeof conferenceFormSchema>;

const CONFERENCE_FORM_DEFAULTS: ConferenceFormValues = {
  title: "",
  date: "",
  time: "10:00",
  description: "",
  treeItemId: "",
  coinPrice: "0",
  isPublic: true,
  connectionLink: "",
};

export function ConferencesPageClient({ conferences, total, page, totalPages, showPast, treeItems, moderatorText, pageTitle, bannerUrl }: Props) {
  const { data: session } = useSession();
  const router = useRouter();
  const { guard, dialog: authDialog } = useAuthGuard();

  // Участие пользователя догружаем клиентом, чтобы страница могла кэшироваться
  const [joinedConfIds, setJoinedConfIds] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/conferences/joined")
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setJoinedConfIds(d.ids || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [session?.user]);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createLogo, setCreateLogo] = useState("");
  const [logoLoading, setLogoLoading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [joinLoading, setJoinLoading] = useState<string | null>(null);
  const [joinError, setJoinError] = useState("");
  const [joinTarget, setJoinTarget] = useState<{ id: string; title: string; price: number } | null>(null);

  // Пагинация и архив живут в URL
  function updateQuery(next: Record<string, string | null>) {
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(next)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    const qs = params.toString();
    router.replace(qs ? `/conferences?${qs}` : "/conferences", { scroll: false });
  }

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<ConferenceFormValues>({
    resolver: zodResolver(conferenceFormSchema),
    // Валидируем после первого «касания» поля, а не сразу при наборе
    mode: "onTouched",
    defaultValues: CONFERENCE_FORM_DEFAULTS,
  });

  async function handleLogoUpload(file: File) {
    if (!file.type.startsWith("image/")) {
      toastWarning("Проверьте файл", "Фото должно быть изображением");
      return;
    }
    setLogoLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setCreateLogo(data.fileUrl);
      } else {
        toastError("Ошибка загрузки", data.error || "Не удалось загрузить фото");
      }
    } catch {
      toastError("Ошибка соединения");
    }
    setLogoLoading(false);
  }

  const filtered = conferences.filter((c) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return c.title.toLowerCase().includes(s) || c.organizerName.toLowerCase().includes(s);
  });

  async function handleCreate(data: ConferenceFormValues) {
    if (!session?.user) { setCreateError("Требуется авторизация"); return; }
    setCreateLoading(true);
    setCreateError("");
    try {
      const res = await fetch("/api/conferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: data.title,
          date: data.date,
          time: data.time,
          description: data.description,
          treeItemId: data.treeItemId || null,
          coinPrice: data.coinPrice ? parseInt(data.coinPrice, 10) : 0,
          isPublic: data.isPublic,
          connectionLink: data.connectionLink || null,
          logoUrl: createLogo || null,
        }),
      });
      if (res.ok) {
        setCreateOpen(false);
        setCreateLogo("");
        reset(CONFERENCE_FORM_DEFAULTS);
        toastSuccess("Конференция создана", "Конференция отправлена на модерацию");
        router.refresh();
      } else {
        const d = await res.json().catch(() => ({}));
        setCreateError(d.error || "Ошибка");
      }
    } catch { setCreateError("Ошибка соединения"); }
    setCreateLoading(false);
  }

  async function handleJoinFree(confId: string) {
    setJoinLoading(confId);
    try {
      const res = await fetch(`/api/conferences/${confId}/join`, { method: "POST" });
      if (res.ok) {
        // Моментальное обновление кнопки без ожидания перезагрузки
        setJoinedConfIds((prev) => (prev.includes(confId) ? prev : [...prev, confId]));
        setJoinError("");
        router.refresh();
      } else {
        const d = await res.json().catch(() => ({}));
        setJoinError(d.error || "Недостаточно монет");
      }
    } catch {
      setJoinError("Ошибка соединения");
    }
    setJoinLoading(null);
  }

  async function confirmJoin() {
    if (!joinTarget) return;
    setJoinLoading(joinTarget.id);
    try {
      const res = await fetch(`/api/conferences/${joinTarget.id}/join`, { method: "POST" });
      if (res.ok) {
        // Моментальное обновление кнопки без ожидания перезагрузки
        setJoinedConfIds((prev) => (prev.includes(joinTarget.id) ? prev : [...prev, joinTarget.id]));
        setJoinTarget(null);
        setJoinError("");
        toastSuccess("Вы участвуете", `Вы записаны на «${joinTarget.title}»`);
        router.refresh();
      } else {
        const d = await res.json().catch(() => ({}));
        setJoinError(d.error || "Недостаточно монет");
        toastError("Ошибка", d.error || "Не удалось записаться");
        setJoinTarget(null);
      }
    } catch {
      setJoinError("Ошибка соединения");
      toastError("Ошибка соединения");
    }
    setJoinLoading(null);
  }

  const formatDate = (d: Date) => new Date(d).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="container-page py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">Конференции</h1>
          <p className="text-muted-foreground mt-1">Вебинары, лекции и презентации продуктов</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => updateQuery({ past: showPast ? null : "1", page: null })}
          >
            {showPast ? "Показать предстоящие" : "Показать прошедшие"}
          </Button>
        </div>
        <Dialog open={createOpen} onOpenChange={(v) => { setCreateOpen(v); if (!v) { setCreateLogo(""); reset(CONFERENCE_FORM_DEFAULTS); } }}>
          <Button
            className="bg-orange-accent hover:bg-orange-accent/90 gap-2"
            onClick={guard(() => setCreateOpen(true))}
          >
            <Plus className="h-4 w-4" /> Создать конференцию
          </Button>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Создать конференцию</DialogTitle>
              <DialogDescription>После создания конференция будет отправлена на модерацию</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(handleCreate)} className="space-y-4" noValidate>
              {createError && <Alert variant="destructive"><AlertDescription>{createError}</AlertDescription></Alert>}

              <div className="space-y-2">
                <Label htmlFor="title">Название</Label>
                <Input
                  id="title"
                  maxLength={511}
                  aria-invalid={!!errors.title}
                  aria-describedby={errors.title ? "title-error" : undefined}
                  {...register("title", {
                    setValueAs: (value: string) => value.replace(/\s{2,}/g, " "),
                    onChange: (e) => {
                      e.target.value = e.target.value.replace(/\s{2,}/g, " ");
                    },
                    onBlur: (e) => {
                      e.target.value = e.target.value.trim();
                    },
                  })}
                />
                {errors.title && <FieldError id="title-error" message={errors.title.message} />}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Дата</Label>
                  <Input
                    id="date"
                    type="date"
                    aria-invalid={!!errors.date}
                    aria-describedby={errors.date ? "date-error" : undefined}
                    {...register("date")}
                  />
                  {errors.date && <FieldError id="date-error" message={errors.date.message} />}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="time">Время (МСК)</Label>
                  <Input
                    id="time"
                    type="time"
                    aria-invalid={!!errors.time}
                    aria-describedby={errors.time ? "time-error" : undefined}
                    {...register("time")}
                  />
                  {errors.time && <FieldError id="time-error" message={errors.time.message} />}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Описание</Label>
                <Textarea
                  id="description"
                  rows={3}
                  maxLength={2500}
                  aria-invalid={!!errors.description}
                  aria-describedby={errors.description ? "description-error" : undefined}
                  {...register("description")}
                />
                {errors.description && (
                  <FieldError id="description-error" message={errors.description.message} />
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="coinPrice">Цена (монет, 0 = бесплатно)</Label>
                  <Input
                    id="coinPrice"
                    type="number"
                    min={0}
                    aria-invalid={!!errors.coinPrice}
                    aria-describedby={errors.coinPrice ? "coinPrice-error" : undefined}
                    {...register("coinPrice")}
                  />
                  {errors.coinPrice && (
                    <FieldError id="coinPrice-error" message={errors.coinPrice.message} />
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
                        placeholder="Выбрать"
                        searchPlaceholder="Поиск категории..."
                        ariaInvalid={!!errors.treeItemId}
                      />
                    )}
                  />
                  {errors.treeItemId && (
                    <FieldError id="treeItemId-error" message={errors.treeItemId.message} />
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Фото конференции</Label>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleLogoUpload(file);
                    e.target.value = "";
                  }}
                />
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={logoLoading}
                  >
                    {logoLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    {createLogo ? "Заменить фото" : "Загрузить фото"}
                  </Button>
                  {createLogo && (
                    <>
                      <img src={createLogo} alt="Фото конференции" className="h-12 w-12 rounded-md border object-cover" loading="lazy" decoding="async" />
                      <Button type="button" variant="ghost" size="sm" onClick={() => setCreateLogo("")}>
                        <X className="h-4 w-4 mr-1" />
                        Убрать
                      </Button>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="connectionLink">Ссылка для подключения</Label>
                <Input
                  id="connectionLink"
                  placeholder="https://..."
                  aria-invalid={!!errors.connectionLink}
                  aria-describedby={errors.connectionLink ? "connectionLink-error" : undefined}
                  {...register("connectionLink", {
                    onChange: (e) => {
                      e.target.value = e.target.value.replace(/\s/g, "");
                    },
                  })}
                />
                {errors.connectionLink && (
                  <FieldError id="connectionLink-error" message={errors.connectionLink.message} />
                )}
              </div>

              <Controller
                name="isPublic"
                control={control}
                render={({ field }) => (
                  <div className="flex items-center gap-2 text-sm">
                    <Checkbox
                      id="isPublic"
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
                    />
                    <Label htmlFor="isPublic" className="cursor-pointer font-normal">
                      Только для зарегистрированных
                    </Label>
                  </div>
                )}
              />

              <Button type="submit" className="w-full bg-menthol hover:bg-menthol-dark" disabled={createLoading}>{createLoading ? "Создание..." : "Создать"}</Button>
            </form>
          </DialogContent>
        </Dialog>
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

      {/* Баннер (ТЗ §9) */}
      {bannerUrl && <PageBanner url={bannerUrl} alt="Баннер конференций" />}

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Поиск конференций..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {joinError && <Alert variant="destructive" className="mb-4"><AlertDescription>{joinError}</AlertDescription></Alert>}

      {filtered.length === 0 ? (
        <div className="border rounded-lg p-12 text-center text-muted-foreground">
          <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg">Конференций пока нет</p>
          <p className="text-sm mt-2">Презентуйте свой продукт, проведите лекцию</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((conf) => (
            <Card key={conf.id} className="hover:shadow-md transition-shadow">
              <CardContent>
                <div className="flex items-start gap-3 mb-2">
                  {conf.logoUrl && (
                    <ImagePreview
                      src={conf.logoUrl}
                      alt={conf.title}
                      className="h-14 w-14 rounded-md border shrink-0"
                    />
                  )}
                  <h3 className="font-semibold text-lg flex-1">{conf.title}</h3>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mb-3">
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {formatDate(conf.date)}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {conf.time} МСК</span>
                </div>
                <ExpandableText text={conf.description} />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">{conf.organizerName}</Badge>
                    {conf.treeItemPath && <Badge variant="outline" className="text-[10px]">{conf.treeItemPath}{conf.treeItemName ? ` — ${conf.treeItemName}` : ""}</Badge>}
                  </div>
                  <div className="flex items-center gap-2">
                    {conf.coinPrice > 0 ? (
                      <Badge className="gap-1"><Coins className="h-3 w-3" /> {conf.coinPrice}</Badge>
                    ) : (
                      <Badge variant="outline" className="text-menthol">Бесплатно</Badge>
                    )}
                    {joinedConfIds.includes(conf.id) ? (
                      conf.connectionLink ? (
                        <a href={conf.connectionLink} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="outline" className="gap-1"><ExternalLink className="h-3 w-3" /> Подключиться</Button>
                        </a>
                      ) : (
                        <Badge className="bg-green-100 text-green-700">Вы участвуете</Badge>
                      )
                    ) : conf.coinPrice > 0 ? (
                      <Button size="sm" className="bg-orange-accent hover:bg-orange-accent/90" onClick={guard(() => setJoinTarget({ id: conf.id, title: conf.title, price: conf.coinPrice }))} disabled={joinLoading === conf.id}>
                        {joinLoading === conf.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Участвовать"}
                      </Button>
                    ) : conf.connectionLink ? (
                      <a href={conf.connectionLink} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="outline" className="gap-1"><ExternalLink className="h-3 w-3" /> Подключиться</Button>
                      </a>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => handleJoinFree(conf.id)} disabled={joinLoading === conf.id}>
                        {joinLoading === conf.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Участвовать"}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
          <span>Всего: {total} конференций</span>
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={(p) => updateQuery({ page: String(p) })} />
        </div>
      )}

      {authDialog}

      <ConfirmDialog
        open={!!joinTarget}
        onOpenChange={(v) => { if (!v) setJoinTarget(null); }}
        title="Участвовать в конференции?"
        message={joinTarget ? `Конференция «${joinTarget.title}» за ${joinTarget.price} монет. Монеты спишутся с вашего счёта.` : ""}
        variant="info"
        confirmLabel="Участвовать"
        onConfirm={confirmJoin}
        loading={!!joinLoading}
      />
    </div>
  );
}
