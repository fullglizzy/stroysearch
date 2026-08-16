"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { SearchSelect } from "@/components/shared/SearchSelect";
import { ProductCard } from "@/components/shared/ProductCard";
import { MultiSelect } from "@/components/shared/MultiSelect";
import { FieldError } from "@/components/forms/fields";
import { matchClassifier } from "@/lib/classifier";
import { ALL_REGIONS, toggleAllRegions } from "@/lib/regions";
import { toastError, toastWarning, toastSuccess } from "@/lib/toast";
import { Plus, Edit, Trash2, Eye, Package, Upload, X, Loader2, Search, Copy, Download, UploadCloud } from "lucide-react";

interface ProductRow {
  id: string;
  name: string;
  description: string | null;
  status: string;
  treeItemId: string;
  treeItemPath: string;
  treeItemName: string;
  classes: string[];
  regions: string[];
  unit: string | null;
  characteristics: string[];
  price: number | null;
  imageUrl: string | null;
  views: number;
  /** Компания-владелец (режим админа) */
  companyName?: string;
  companyInn?: string;
}

interface TreeItem {
  id: string;
  name: string;
  fullNumberPath: string;
  units: string[];
  characteristics: { name: string; value: string; unit: string }[];
}

interface Props {
  products: ProductRow[];
  treeItems: TreeItem[];
  regions: string[];
  /** Режим компании: id компании, от имени которой создаются товары */
  companyId?: string;
  /** Режим админа: список компаний для выбора при создании товара */
  companies?: { id: string; name: string }[];
}

const CLASS_VALUES = ["STANDARD", "COMFORT", "BUSINESS", "PREMIUM"] as const;
type ClassValue = (typeof CLASS_VALUES)[number];
const classLabels: Record<ClassValue, string> = {
  STANDARD: "Стандарт", COMFORT: "Комфорт", BUSINESS: "Бизнес", PREMIUM: "Премиум",
};

const productFormSchema = z.object({
  companyId: z
    .string()
    .uuid("Некорректная компания")
    .optional()
    .or(z.literal("")),
  treeItemId: z.string().uuid("Выберите категорию классификатора"),
  name: z
    .string()
    .trim()
    .min(1, "Укажите название товара")
    .max(511, "Название должно быть не более 511 символов"),
  classes: z.array(z.enum(CLASS_VALUES)).min(1, "Выберите хотя бы один класс товара"),
  regions: z.array(z.string().min(1).max(255, "Регион должен быть не более 255 символов")).optional(),
  unit: z.string().max(63, "Ед. измерения не более 63 символов").optional(),
  price: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, "Некорректная цена")
    .optional()
    .or(z.literal("")),
  description: z.string().max(2000, "Описание не более 2000 символов").optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
});

type ProductFormValues = z.infer<typeof productFormSchema>;

/**
 * Управление товарами: каталог с поиском и фильтром по категории,
 * создание/редактирование/удаление.
 *
 * Два режима:
 * - компания (передан companyId) — товары своей компании;
 * - админ (передан список companies) — все товары платформы, при создании
 *   выбирается компания-владелец.
 */
export function ProductsManager({ products, treeItems, regions, companyId, companies }: Props) {
  const router = useRouter();
  const isAdmin = companyId === undefined;

  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [charInputs, setCharInputs] = useState<{ value: string; unit: string }[]>([]);
  const [freeChars, setFreeChars] = useState("");
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [photoLoading, setPhotoLoading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkError, setBulkError] = useState("");
  const [shown, setShown] = useState(12);
  const [importOpen, setImportOpen] = useState(false);
  const [importError, setImportError] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  const emptyForm = useMemo<ProductFormValues>(
    () => ({
      companyId: isAdmin ? "" : companyId ?? "",
      treeItemId: "",
      name: "",
      classes: [],
      regions: [],
      unit: "",
      price: "",
      description: "",
      status: "PUBLISHED",
    }),
    [isAdmin, companyId],
  );

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    setError: setFieldError,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    // Валидируем после первого «касания» поля, а не сразу при наборе
    mode: "onTouched",
    defaultValues: emptyForm,
  });

  const isEdit = !!editId;

  // Категория — поле формы, но также управляет шаблонами ед. измерения и характеристик
  const category = useWatch({ control, name: "treeItemId" }) ?? "";

  const categoryOptions = useMemo(
    () => treeItems.map((t) => ({ value: t.id, label: `${t.fullNumberPath} — ${t.name}` })),
    [treeItems],
  );

  // Фильтрация: категории + поиск по названию, категории и компании + статус
  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (categoryFilter.length > 0 && !categoryFilter.includes(p.treeItemId)) return false;
      if (statusFilter && p.status !== statusFilter) return false;
      if (!q) return true;
      return [p.name, p.treeItemPath, p.treeItemName, p.companyName ?? ""].some((f) =>
        f.toLowerCase().includes(q),
      );
    });
  }, [products, categoryFilter, search, statusFilter]);

  const visibleProducts = filteredProducts.slice(0, shown);

  const categoryUnits = useMemo(
    () => treeItems.find((t) => t.id === category)?.units || [],
    [category, treeItems],
  );
  const categoryChars = useMemo(
    () => treeItems.find((t) => t.id === category)?.characteristics || [],
    [category, treeItems],
  );

  // Живые значения для предпросмотра карточки
  const previewName = useWatch({ control, name: "name" }) ?? "";
  const previewClasses = useWatch({ control, name: "classes" }) ?? [];
  const previewPrice = useWatch({ control, name: "price" });
  const previewUnit = useWatch({ control, name: "unit" }) ?? "";

  const previewCharacteristics = useMemo(() => {
    if (categoryChars.length > 0) {
      return categoryChars
        .map((c, i) => {
          const v = (charInputs[i]?.value || "").trim();
          if (!v) return null;
          const u = (charInputs[i]?.unit || c.unit || "").trim();
          return `${c.name}: ${v}${u ? ` ${u}` : ""}`;
        })
        .filter((x): x is string => !!x);
    }
    return freeChars.split("\n").map((s) => s.trim()).filter(Boolean);
  }, [categoryChars, charInputs, freeChars]);

  function resetFormState() {
    reset(emptyForm);
    setCharInputs([]);
    setImageUrl("");
    setFreeChars("");
  }

  /** Заполняет шаблон характеристик по выбранной категории (сохраняя прежние значения при редактировании) */
  function applyCategory(id: string, savedChars?: string[]) {
    const item = treeItems.find((t) => t.id === id);
    setCharInputs(
      (item?.characteristics || []).map((c) => {
        const saved = savedChars?.find((s) => s.startsWith(`${c.name}:`));
        return {
          value: saved ? saved.slice(c.name.length + 1).trim() : "",
          unit: c.unit,
        };
      }),
    );
  }

  async function handlePhotoUpload(file: File) {
    if (!file.type.startsWith("image/")) {
      toastWarning("Проверьте файл", "Фото должно быть изображением");
      return;
    }
    setPhotoLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setImageUrl(data.fileUrl);
      } else {
        toastError("Ошибка загрузки", data.error || "Не удалось загрузить фото");
      }
    } catch {
      toastError("Ошибка соединения");
    }
    setPhotoLoading(false);
  }

  async function onSubmit(values: ProductFormValues) {
    setFormError("");

    // В режиме админа при создании нужна компания-владелец
    if (!isEdit && !values.companyId) {
      setFieldError("companyId", { message: "Выберите компанию" });
      return;
    }

    setLoading(true);

    // Характеристики: по шаблону категории или свободный ввод (если шаблона нет)
    const characteristics = categoryChars.length > 0
      ? categoryChars
          .map((c, i) => {
            const v = (charInputs[i]?.value || "").trim();
            if (!v) return null;
            // Единица измерения — из шаблона категории (задаётся администратором)
            const u = (charInputs[i]?.unit || c.unit || "").trim();
            return `${c.name}: ${v}${u ? ` ${u}` : ""}`;
          })
          .filter((x): x is string => !!x)
      : freeChars.split("\n").map((s) => s.trim()).filter(Boolean);

    const body = {
      companyId: values.companyId || undefined,
      treeItemId: values.treeItemId,
      name: values.name,
      classes: values.classes,
      regions: values.regions ?? [],
      unit: values.unit || null,
      characteristics,
      imageUrl: imageUrl || null,
      price: values.price ? parseFloat(values.price) : null,
      description: values.description?.trim() || null,
      status: values.status ?? "PUBLISHED",
    };

    try {
      const url = isEdit ? `/api/products/${editId}` : "/api/products";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) {
        setAddOpen(false);
        setEditId(null);
        resetFormState();
        router.refresh();
      } else {
        const d = await res.json().catch(() => ({}));
        setFormError(d.error || "Ошибка");
      }
    } catch {
      setFormError("Ошибка соединения");
    }
    setLoading(false);
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/products/${deleteId}`, { method: "DELETE" });
      if (res.ok) {
        setDeleteId(null);
        router.refresh();
      } else {
        const d = await res.json().catch(() => ({}));
        setFormError(d.error || "Ошибка удаления");
        setDeleteId(null);
      }
    } catch {
      setFormError("Ошибка удаления");
      setDeleteId(null);
    }
    setDeleteLoading(false);
  }

  const classesError = (errors.classes as { message?: string } | undefined)?.message;

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    const allIds = visibleProducts.map((p) => p.id);
    const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));
    setSelected(allSelected ? new Set() : new Set(allIds));
  }

  async function handleDuplicate(p: ProductRow) {
    setFormError("");
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: isAdmin ? undefined : companyId,
          treeItemId: p.treeItemId,
          name: `${p.name} (копия)`,
          classes: p.classes,
          regions: p.regions,
          unit: p.unit,
          characteristics: p.characteristics,
          imageUrl: p.imageUrl,
          price: p.price,
          description: p.description,
          status: "DRAFT",
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setFormError(d.error || "Не удалось создать копию");
        return;
      }
      router.refresh();
    } catch {
      setFormError("Ошибка соединения");
    }
  }

  async function handleBulk(action: "publish" | "draft" | "delete") {
    setBulkError("");
    setBulkLoading(true);
    try {
      const res = await fetch("/api/products/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ids: Array.from(selected) }),
      });
      if (res.ok) {
        setSelected(new Set());
        router.refresh();
      } else {
        const d = await res.json().catch(() => ({}));
        setBulkError(d.error || "Ошибка");
      }
    } catch {
      setBulkError("Ошибка соединения");
    }
    setBulkLoading(false);
  }

  function exportCsv() {
    const header = ["Название", "Категория", "Цена", "Ед.", "Классы", "Регионы", "Статус", "Описание"];
    const escapeCell = (v: string) => {
      if (v.includes(";") || v.includes('"') || v.includes("\n")) {
        return `"${v.replace(/"/g, '""')}"`;
      }
      return v;
    };
    const rows = filteredProducts.map((p) =>
      [
        p.name,
        `${p.treeItemPath} — ${p.treeItemName}`,
        p.price != null ? String(p.price) : "",
        p.unit || "",
        p.classes.join("|"),
        p.regions.join("|"),
        p.status === "DRAFT" ? "Черновик" : "Опубликован",
        p.description || "",
      ]
        .map(escapeCell)
        .join(";"),
    );
    const csv = "\uFEFF" + [header.join(";"), ...rows].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "products.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function parseCsvLine(line: string): string[] {
    const cells: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          cur += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ";") {
        cells.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    cells.push(cur);
    return cells;
  }

  async function handleImport(file: File) {
    setImportError("");
    setImportLoading(true);
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      if (lines.length < 2) {
        setImportError("Файл пуст или содержит только заголовок");
        setImportLoading(false);
        return;
      }
      const dataLines = lines.slice(1);
      const byPath = new Map<string, string>();
      const byName = new Map<string, string>();
      for (const t of treeItems) {
        byPath.set(`${t.fullNumberPath} — ${t.name}`, t.id);
        byName.set(t.name.toLowerCase(), t.id);
      }

      let created = 0;
      let skipped = 0;
      for (const line of dataLines) {
        const [name, categoryRaw, priceRaw, unit, classesRaw, regionsRaw, , description] = parseCsvLine(line);
        if (!name) { skipped++; continue; }
        const category = (categoryRaw || "").trim();
        const treeItemId = byPath.get(category) || (byName.get(category.toLowerCase()) ?? "");
        if (!treeItemId) { skipped++; continue; }
        const price = parseFloat((priceRaw || "").replace(",", "."));
        const classes = (classesRaw || "")
          .split("|")
          .map((c) => c.trim().toUpperCase())
          .filter((c) => CLASS_VALUES.includes(c as ClassValue));
        const regions = (regionsRaw || "").split("|").map((r) => r.trim()).filter(Boolean);
        const res = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyId: isAdmin ? undefined : companyId,
            treeItemId,
            name: name.slice(0, 511),
            classes: classes.length > 0 ? classes : ["STANDARD"],
            regions,
            unit: unit || null,
            price: Number.isFinite(price) && price > 0 ? price : null,
            description: description || null,
            status: "DRAFT",
          }),
        });
        if (res.ok) created++;
        else skipped++;
      }
      setImportOpen(false);
      if (importInputRef.current) importInputRef.current.value = "";
      toastSuccess(
        "Импорт завершён",
        `Создано товаров: ${created}${skipped > 0 ? `, пропущено: ${skipped}` : ""}. Товары добавлены как черновики.`,
      );
      router.refresh();
    } catch {
      setImportError("Не удалось прочитать файл");
    }
    setImportLoading(false);
  }

  // Форма вставляется как обычный JSX (без вложенного компонента),
  // чтобы ре-рендеры родителя не перемонтировали форму и не сбрасывали значения.
  // key — пересоздаёт форму при каждом открытии/смене товара (чистые defaultValue).
  const productForm = (
    <form key={editId ?? `new-${addOpen ? 1 : 0}`} onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {formError && <Alert variant="destructive"><AlertDescription>{formError}</AlertDescription></Alert>}

      {isAdmin && !isEdit && (
        <div className="space-y-2">
          <Label>Компания *</Label>
          <Controller
            name="companyId"
            control={control}
            render={({ field }) => (
              <SearchSelect
                options={(companies || []).map((c) => ({ value: c.id, label: c.name }))}
                value={field.value ?? ""}
                onChange={field.onChange}
                placeholder="Выберите компанию"
                searchPlaceholder="Поиск компании..."
                ariaInvalid={!!errors.companyId}
              />
            )}
          />
          {errors.companyId && (
            <FieldError id="companyId-error" message={errors.companyId.message} />
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="name">Название товара</Label>
        <Input
          id="name"
          maxLength={511}
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
        <Label>Категория классификатора *</Label>
        <Controller
          name="treeItemId"
          control={control}
          render={({ field }) => (
            <SearchSelect
              options={treeItems.map((t) => ({ value: t.id, label: `${t.fullNumberPath} — ${t.name}` }))}
              value={field.value ?? ""}
              onChange={(v) => {
                field.onChange(v);
                applyCategory(v);
                setValue("unit", "");
              }}
              placeholder="Выберите категорию"
              searchPlaceholder="Поиск категории..."
              hideSelectedLabels
              ariaInvalid={!!errors.treeItemId}
            />
          )}
        />
        {errors.treeItemId && (
          <FieldError id="treeItemId-error" message={errors.treeItemId.message} />
        )}
      </div>

      <div className="space-y-2">
        <Label>Класс товара</Label>
        <Controller
          name="classes"
          control={control}
          render={({ field }) => (
            <div className="flex flex-wrap gap-3">
              {CLASS_VALUES.map((c) => {
                const checked = field.value.includes(c);
                return (
                  <div key={c} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      id={`class_${c}`}
                      checked={checked}
                      onCheckedChange={(v) => {
                        const next = v === true
                          ? [...field.value, c]
                          : field.value.filter((x) => x !== c);
                        field.onChange(next);
                      }}
                      aria-invalid={!!classesError}
                    />
                    <Label htmlFor={`class_${c}`} className="cursor-pointer font-normal">
                      {classLabels[c]}
                    </Label>
                  </div>
                );
              })}
            </div>
          )}
        />
        {classesError && <FieldError id="classes-error" message={classesError} />}
      </div>

      <div className={`grid gap-4 ${category ? "grid-cols-2" : "grid-cols-1"}`}>
        <div className="space-y-2">
          <Label htmlFor="price">Цена (₽)</Label>
          <Input
            id="price"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            aria-invalid={!!errors.price}
            aria-describedby={errors.price ? "price-error" : undefined}
            {...register("price")}
          />
          {errors.price && <FieldError id="price-error" message={errors.price.message} />}
        </div>
        {category && (
          <div className="space-y-2">
            <Label>Ед. измерения</Label>
            <Controller
              name="unit"
              control={control}
              render={({ field }) =>
                categoryUnits.length > 0 ? (
                  <Select
                    value={field.value ?? ""}
                    items={Object.fromEntries(categoryUnits.map((u) => [u, u]))}
                    onValueChange={(v) => field.onChange(v ?? "")}
                  >
                    <SelectTrigger className="w-full justify-between">
                      <SelectValue placeholder="Выберите единицу" />
                    </SelectTrigger>
                    <SelectContent>
                      {categoryUnits.map((u) => (
                        <SelectItem key={u} value={u} label={u}>{u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    maxLength={63}
                    placeholder="шт, м², кг..."
                    aria-invalid={!!errors.unit}
                  />
                )
              }
            />
            {errors.unit && <FieldError id="unit-error" message={errors.unit.message} />}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>Регион</Label>
        <Controller
          name="regions"
          control={control}
          render={({ field }) => (
            <MultiSelect
              options={[{ value: ALL_REGIONS, label: ALL_REGIONS }, ...regions.map((r) => ({ value: r, label: r }))]}
              value={field.value ?? []}
              onChange={(v) => field.onChange(toggleAllRegions(field.value ?? [], v))}
              placeholder="Выберите регионы"
              searchPlaceholder="Поиск региона..."
              ariaInvalid={!!errors.regions}
            />
          )}
        />
        {errors.regions && <FieldError id="regions-error" message={errors.regions.message} />}
      </div>

      <div className="space-y-2">
        <Label>Фото товара</Label>
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handlePhotoUpload(file);
            e.target.value = "";
          }}
        />
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => photoInputRef.current?.click()}
            disabled={photoLoading}
          >
            {photoLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            {imageUrl ? "Заменить фото" : "Загрузить фото"}
          </Button>
          {imageUrl && (
            <>
              <img src={imageUrl} alt="Фото товара" className="h-12 w-12 rounded-md border object-cover" />
              <Button type="button" variant="ghost" size="sm" onClick={() => setImageUrl("")}>
                <X className="h-4 w-4 mr-1" />
                Убрать
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="desc">Описание товара</Label>
        <Textarea
          id="desc"
          rows={3}
          maxLength={2000}
          placeholder="Краткое описание для покупателей (необязательно)"
          {...register("description")}
        />
      </div>

      <div className="space-y-2">
        <Label>Статус</Label>
        <Controller
          name="status"
          control={control}
          render={({ field }) => (
            <Select
              value={field.value ?? "PUBLISHED"}
              items={{ PUBLISHED: "Опубликован", DRAFT: "Черновик" }}
              onValueChange={(v) => field.onChange(v ?? "PUBLISHED")}
            >
              <SelectTrigger className="w-full justify-between">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PUBLISHED" label="Опубликован">
                  Опубликован — виден в матрице материалов
                </SelectItem>
                <SelectItem value="DRAFT" label="Черновик">
                  Черновик — не виден покупателям
                </SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </div>

      {category && (categoryChars.length > 0 ? (
        <div className="space-y-2">
          <Label>Характеристики</Label>
          <div className="space-y-2">
            {categoryChars.map((c, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                <span className="text-sm text-muted-foreground">{c.name}</span>
                <div className="flex gap-2">
                  <Input
                    value={charInputs[i]?.value || ""}
                    onChange={(e) =>
                      setCharInputs((prev) =>
                        prev.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)),
                      )
                    }
                    placeholder="Значение"
                  />
                  {/* Ед. изм.: если задана администратором — показываем неактивным полем,
                      если не задана — поле не показываем вовсе */}
                  {c.unit ? (
                    <Input
                      value={charInputs[i]?.unit || c.unit}
                      disabled
                      title="Единица измерения задана администратором"
                      className="w-24"
                    />
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="characteristics">Характеристики (каждая с новой строки)</Label>
          <Textarea
            id="characteristics"
            rows={3}
            value={freeChars}
            onChange={(e) => setFreeChars(e.target.value)}
            placeholder="Например: Толщина: 10 мм"
          />
        </div>
      ))}

      {/* Предпросмотр карточки — как увидят покупатели */}
      <div className="rounded-lg border p-3">
        <p className="text-xs font-medium text-muted-foreground mb-2">Предпросмотр карточки</p>
        <ProductCard
          data={{
            name: previewName || "Название товара",
            classes: previewClasses as string[],
            regions: [],
            unit: previewUnit || null,
            characteristics: previewCharacteristics,
            price: previewPrice ? parseFloat(previewPrice) : null,
            imageUrl: imageUrl || null,
          }}
          classLabels={classLabels}
        />
      </div>

      <Button type="submit" className="w-full bg-menthol hover:bg-menthol-dark" disabled={loading}>
        {loading ? "Сохранение..." : isEdit ? "Сохранить" : "Добавить товар"}
      </Button>
    </form>
  );

  return (
    <div className="space-y-6">
      <Dialog open={addOpen || !!editId} onOpenChange={(v) => { setAddOpen(v); if (!v) { setEditId(null); resetFormState(); } }}>
        <DialogTrigger>
          <Button className="bg-menthol hover:bg-menthol-dark gap-2" onClick={() => { setAddOpen(true); resetFormState(); }}>
            <Plus className="h-4 w-4" /> {isAdmin ? "Добавить товар" : "Добавить свой продукт"}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Редактировать товар" : "Добавить товар"}</DialogTitle>
            <DialogDescription>Товар появится в матрице материалов</DialogDescription>
          </DialogHeader>
          {productForm}
        </DialogContent>
      </Dialog>

      {products.length === 0 ? (
        <div className="border rounded-lg p-12 text-center text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg">Нет товаров</p>
          <p className="text-sm mt-2">
            {isAdmin
              ? "На платформе пока нет товаров"
              : "Добавьте свой первый продукт в матрицу материалов"}
          </p>
        </div>
      ) : (
        <>
          {/* Поиск + фильтр по категории */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={
                  isAdmin
                    ? "Поиск по названию, категории или компании..."
                    : "Поиск по названию или категории..."
                }
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <MultiSelect
              options={categoryOptions}
              value={categoryFilter}
              onChange={setCategoryFilter}
              placeholder="Категория классификатора"
              searchPlaceholder="Поиск категории..."
              filter={matchClassifier}
              hideSelectedLabels
              className="w-full sm:max-w-md"
            />
          </div>

          {/* Статус, выбор всех, CSV */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { value: "", label: "Все" },
              { value: "PUBLISHED", label: "Опубликованные" },
              { value: "DRAFT", label: "Черновики" },
            ].map((f) => (
              <Button
                key={f.value}
                variant={statusFilter === f.value ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setStatusFilter(f.value);
                  setShown(12);
                  setSelected(new Set());
                }}
              >
                {f.label}
              </Button>
            ))}
            <div className="flex items-center gap-2 ml-2">
              <Checkbox
                checked={visibleProducts.length > 0 && visibleProducts.every((p) => selected.has(p.id))}
                onCheckedChange={() => toggleSelectAll()}
                aria-label="Выбрать все товары на странице"
              />
              <span className="text-xs text-muted-foreground">Все на странице</span>
            </div>
            <div className="ml-auto flex gap-2">
              <Button variant="outline" size="sm" onClick={exportCsv}>
                <Download className="h-3 w-3 mr-1" /> Экспорт CSV
              </Button>
            </div>
          </div>

          {/* Панель массовых операций */}
          {selected.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-menthol/50 bg-menthol/5 p-3">
              <span className="text-sm font-medium">Выбрано: {selected.size}</span>
              <Button size="sm" className="bg-menthol hover:bg-menthol-dark" onClick={() => handleBulk("publish")} disabled={bulkLoading}>
                Опубликовать
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleBulk("draft")} disabled={bulkLoading}>
                В черновик
              </Button>
              <Button size="sm" variant="destructive" onClick={() => handleBulk("delete")} disabled={bulkLoading}>
                Удалить
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} disabled={bulkLoading}>
                Сбросить
              </Button>
              {bulkError && <span className="text-xs text-destructive">{bulkError}</span>}
              {bulkLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
          )}

          {filteredProducts.length === 0 ? (
            <div className="border rounded-lg p-8 text-center text-muted-foreground">
              <p className="text-sm">По вашему запросу ничего не найдено</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleProducts.map((p) => (
            <ProductCard
              key={p.id}
              data={p}
              classLabels={classLabels}
              companyName={isAdmin ? p.companyName : undefined}
              companyInn={isAdmin ? p.companyInn : undefined}
              badge={
                <>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="secondary" className="font-mono text-[10px]">
                      {p.treeItemPath}
                    </Badge>
                    {p.status === "DRAFT" && (
                      <Badge variant="outline" className="text-[10px] text-orange-accent">
                        Черновик
                      </Badge>
                    )}
                  </div>
                  {p.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{p.description}</p>
                  )}
                </>
              }
              actions={
                <>
                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Дублировать" onClick={() => handleDuplicate(p)}>
                    <Copy className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                    setEditId(p.id);
                    const item = treeItems.find(t => t.id === p.treeItemId);
                    const itemId = item?.id ?? "";
                    reset({
                      companyId: "",
                      treeItemId: itemId,
                      name: p.name,
                      classes: (p.classes as ClassValue[]).filter((c) => CLASS_VALUES.includes(c)),
                      regions: p.regions,
                      unit: p.unit ?? "",
                      price: p.price != null ? String(p.price) : "",
                      description: p.description ?? "",
                      status: p.status === "DRAFT" ? "DRAFT" : "PUBLISHED",
                    });
                    if (item) applyCategory(itemId, p.characteristics);
                    setImageUrl(p.imageUrl || "");
                    setFreeChars(item && item.characteristics.length === 0 ? p.characteristics.join("\n") : "");
                  }}>
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => setDeleteId(p.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </>
              }
              footer={
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground mt-auto pt-2 border-t">
                  <span className="flex items-center gap-1">
                    <Eye className="h-3 w-3" /> {p.views} просмотров
                  </span>
                  <span
                    className="flex items-center gap-1.5 cursor-pointer select-none"
                    title="Выбрать для массовых операций"
                  >
                    <Checkbox
                      checked={selected.has(p.id)}
                      onCheckedChange={() => toggleSelect(p.id)}
                      aria-label={`Выбрать товар ${p.name}`}
                    />
                    Выбрать
                  </span>
                </div>
              }
            />
              ))}
            </div>
          )}

          {filteredProducts.length > shown && (
            <div className="flex justify-center">
              <Button variant="outline" size="sm" onClick={() => setShown((s) => s + 12)}>
                Показать ещё ({filteredProducts.length - shown})
              </Button>
            </div>
          )}
        </>
      )}

      {/* Импорт CSV */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Импорт товаров из CSV</DialogTitle>
            <DialogDescription>
              Колонки через «;»: Название;Категория;Цена;Ед.;Классы;Регионы;Статус;Описание.
              Категорию можно указать как «1.2 — Название» или просто название.
              Товары импортируются как черновики.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {importError && <Alert variant="destructive"><AlertDescription>{importError}</AlertDescription></Alert>}
            <input
              ref={importInputRef}
              type="file"
              accept=".csv,text/csv"
              className="text-sm"
              disabled={importLoading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImport(file);
              }}
            />
            {importLoading && <p className="text-xs text-muted-foreground">Импорт выполняется...</p>}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(v) => { if (!v) setDeleteId(null); }}
        title="Удалить товар?"
        message="Товар будет удалён из матрицы материалов."
        confirmLabel="Удалить"
        onConfirm={handleDelete}
        loading={deleteLoading}
      />
    </div>
  );
}
