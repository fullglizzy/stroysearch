"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SearchSelect } from "@/components/shared/SearchSelect";
import { toastSuccess, toastError, toastWarning } from "@/lib/toast";
import { Plus, Trash2, Save, Loader2, Ruler, ListChecks } from "lucide-react";

interface CategoryItem {
  id: string;
  name: string;
  fullNumberPath: string;
  units: string[];
  characteristics: { name: string; value: string; unit: string }[];
}

interface CategorySettingsManagerProps {
  items: CategoryItem[];
}

export function CategorySettingsManager({ items }: CategorySettingsManagerProps) {
  const router = useRouter();
  const [categoryId, setCategoryId] = useState("");
  const [units, setUnits] = useState<string[]>([]);
  const [newUnit, setNewUnit] = useState("");
  const [chars, setChars] = useState<{ name: string; unit: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const selected = items.find((i) => i.id === categoryId);

  function selectCategory(id: string) {
    setCategoryId(id);
    const item = items.find((i) => i.id === id);
    setUnits(item ? [...item.units] : []);
    setChars(item ? item.characteristics.map((c) => ({ name: c.name, unit: c.unit })) : []);
    setNewUnit("");
  }

  function addUnit() {
    const v = newUnit.trim();
    if (!v) return;
    if (units.includes(v)) {
      toastWarning("Проверьте данные", "Такая единица измерения уже есть");
      return;
    }
    setUnits([...units, v]);
    setNewUnit("");
  }

  function updateChar(index: number, field: "name" | "unit", value: string) {
    setChars((prev) => prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
  }

  async function handleSave() {
    if (!categoryId) {
      toastWarning("Проверьте данные", "Выберите категорию классификатора");
      return;
    }
    if (chars.some((c) => !c.name.trim())) {
      toastWarning("Проверьте данные", "У всех характеристик должно быть название");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          treeItemId: categoryId,
          units,
          characteristics: chars.map((c) => ({
            name: c.name.trim(),
            value: "",
            unit: c.unit.trim(),
          })),
        }),
      });
      if (res.ok) {
        toastSuccess("Настройки сохранены", selected ? `${selected.fullNumberPath} — ${selected.name}` : "");
        router.refresh();
      } else {
        const d = await res.json().catch(() => ({}));
        toastError("Ошибка", d.error || "Не удалось сохранить");
      }
    } catch {
      toastError("Ошибка соединения");
    }
    setLoading(false);
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Выбор категории */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Категория классификатора</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <SearchSelect
            options={items.map((i) => ({ value: i.id, label: `${i.fullNumberPath} — ${i.name}` }))}
            value={categoryId}
            onChange={selectCategory}
            placeholder="Выберите категорию"
            searchPlaceholder="Поиск категории..."
          />
        </CardContent>
      </Card>

      {categoryId && (
        <>
          {/* Единицы измерения */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Ruler className="h-4 w-4 text-menthol" />
                Единицы измерения
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {units.length === 0 ? (
                <p className="text-sm text-muted-foreground">Единицы не заданы</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {units.map((u) => (
                    <span
                      key={u}
                      className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-sm"
                    >
                      {u}
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => setUnits(units.filter((x) => x !== u))}
                        title="Удалить"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  value={newUnit}
                  onChange={(e) => setNewUnit(e.target.value)}
                  placeholder="Например: шт, м², кг..."
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addUnit();
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={addUnit}>
                  <Plus className="h-4 w-4 mr-1" />
                  Добавить
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Характеристики */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-menthol" />
                Характеристики (шаблон для формы товара)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {chars.length === 0 ? (
                <p className="text-sm text-muted-foreground">Характеристики не заданы</p>
              ) : (
                chars.map((c, i) => (
                  <div key={i} className="flex flex-col sm:flex-row gap-2 items-start">
                    <Input
                      value={c.name}
                      onChange={(e) => updateChar(i, "name", e.target.value)}
                      placeholder="Название"
                      className="flex-1"
                    />
                    <Input
                      value={c.unit}
                      onChange={(e) => updateChar(i, "unit", e.target.value)}
                      placeholder="Ед. изм."
                      className="sm:w-28"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setChars(chars.filter((_, j) => j !== i))}
                      title="Удалить"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => setChars([...chars, { name: "", unit: "" }])}
              >
                <Plus className="h-4 w-4 mr-1" />
                Добавить характеристику
              </Button>
            </CardContent>
          </Card>

          <Button
            className="w-full bg-menthol hover:bg-menthol-dark"
            onClick={handleSave}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            {loading ? "Сохранение..." : "Сохранить"}
          </Button>
        </>
      )}
    </div>
  );
}
