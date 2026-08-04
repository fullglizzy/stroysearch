"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Plus, Edit, Trash2, Eye, Package } from "lucide-react";

interface ProductRow {
  id: string;
  name: string;
  treeItemPath: string;
  treeItemName: string;
  classes: string[];
  region: string | null;
  unit: string | null;
  characteristics: string[];
  price: number | null;
  views: number;
}

interface TreeItem {
  id: string;
  name: string;
  fullNumberPath: string;
}

interface Props {
  products: ProductRow[];
  treeItems: TreeItem[];
  companyId: string;
}

const classOptions = ["STANDARD", "COMFORT", "BUSINESS", "PREMIUM"];
const classLabels: Record<string, string> = {
  STANDARD: "Стандарт", COMFORT: "Комфорт", BUSINESS: "Бизнес", PREMIUM: "Премиум",
};

export function CompanyProductsManager({ products, treeItems, companyId }: Props) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const productToEdit = editId ? products.find((p) => p.id === editId) : null;

  async function handleSave(e: React.FormEvent<HTMLFormElement>, isEdit: boolean) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const selectedClasses = classOptions.filter((c) => fd.get(`class_${c}`) === "on");
    const chars = (fd.get("characteristics") as string).split("\n").filter(Boolean);

    const body = {
      companyId,
      treeItemId: fd.get("treeItemId"),
      name: fd.get("name"),
      classes: selectedClasses,
      region: fd.get("region") || null,
      unit: fd.get("unit") || null,
      characteristics: chars,
      price: fd.get("price") ? parseFloat(fd.get("price") as string) : null,
    };

    try {
      const url = isEdit ? `/api/products/${editId}` : "/api/products";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) {
        setAddOpen(false);
        setEditId(null);
        router.refresh();
      } else {
        const d = await res.json();
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
    try {
      await fetch(`/api/products/${deleteId}`, { method: "DELETE" });
      setDeleteId(null);
      router.refresh();
    } catch { setError("Ошибка удаления"); }
    setDeleteLoading(false);
  }

  const ProductForm = ({ isEdit }: { isEdit: boolean }) => (
    <form onSubmit={(e) => handleSave(e, isEdit)} className="space-y-4">
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      <div className="space-y-2"><Label htmlFor="name">Название товара</Label><Input id="name" name="name" defaultValue={productToEdit?.name} required /></div>
      <div className="space-y-2">
        <Label htmlFor="treeItemId">Категория классификатора *</Label>
        <Select name="treeItemId" defaultValue={productToEdit?.treeItemPath ? treeItems.find(t => t.fullNumberPath === productToEdit.treeItemPath)?.id : ""} required>
          <SelectTrigger><SelectValue placeholder="Выберите категорию" /></SelectTrigger>
          <SelectContent>{treeItems.map(t => <SelectItem key={t.id} value={t.id}>{t.fullNumberPath} — {t.name.slice(0, 50)}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Класс товара</Label>
        <div className="flex flex-wrap gap-3">
          {classOptions.map(c => (
            <label key={c} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name={`class_${c}`} defaultChecked={productToEdit?.classes.includes(c)} /> {classLabels[c]}
            </label>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label htmlFor="price">Цена (₽)</Label><Input id="price" name="price" type="number" min="0" step="0.01" defaultValue={productToEdit?.price ?? ""} placeholder="0.00" /></div>
        <div className="space-y-2"><Label htmlFor="unit">Ед. измерения</Label><Input id="unit" name="unit" defaultValue={productToEdit?.unit || ""} placeholder="шт, м², кг..." /></div>
      </div>
      <div className="space-y-2"><Label htmlFor="region">Регион</Label><Input id="region" name="region" defaultValue={productToEdit?.region || ""} /></div>
      <div className="space-y-2"><Label htmlFor="characteristics">Характеристики (каждая с новой строки)</Label><Input id="characteristics" name="characteristics" defaultValue={productToEdit?.characteristics.join("\n") || ""} /></div>
      <Button type="submit" className="w-full bg-menthol hover:bg-menthol-dark" disabled={loading}>
        {loading ? "Сохранение..." : isEdit ? "Сохранить" : "Добавить товар"}
      </Button>
    </form>
  );

  return (
    <div className="space-y-6">
      <Dialog open={addOpen || !!editId} onOpenChange={(v) => { setAddOpen(v); if (!v) setEditId(null); }}>
        <DialogTrigger>
          <Button className="bg-menthol hover:bg-menthol-dark gap-2" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Добавить свой продукт
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? "Редактировать товар" : "Добавить товар"}</DialogTitle>
            <DialogDescription>Товар появится в матрице материалов</DialogDescription>
          </DialogHeader>
          <ProductForm isEdit={!!editId} />
        </DialogContent>
      </Dialog>

      {products.length === 0 ? (
        <div className="border rounded-lg p-12 text-center text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg">Нет товаров</p>
          <p className="text-sm mt-2">Добавьте свой первый продукт в матрицу материалов</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((p) => (
            <Card key={p.id}>
              <CardContent>
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-sm flex-1">{p.name}</h3>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditId(p.id)}>
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => setDeleteId(p.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <Badge variant="secondary" className="font-mono text-[10px] mb-2">{p.treeItemPath} — {p.treeItemName}</Badge>
                <div className="flex flex-wrap gap-1 mb-2">
                  {p.classes.map((c) => <Badge key={c} variant="outline" className="text-[10px]">{classLabels[c] || c}</Badge>)}
                </div>
                {p.price !== null && <p className="text-lg font-bold text-menthol">{p.price.toLocaleString("ru-RU")} ₽{p.unit ? ` / ${p.unit}` : ""}</p>}
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                  <Eye className="h-3 w-3" /> {p.views} просмотров
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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
