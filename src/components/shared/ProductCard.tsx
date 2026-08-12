"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EyeButton } from "@/components/shared/EyeButton";
import { StarRating } from "@/components/shared/StarRating";
import { cn, telHref, mailtoHref } from "@/lib/utils";
import { Phone, Mail, MapPin } from "lucide-react";

/** Разбирает строку характеристики «Название: значение ед.» на пару */
export function parseCharacteristic(raw: string): { name: string; value: string } {
  const idx = raw.indexOf(": ");
  if (idx === -1) return { name: raw, value: "" };
  return { name: raw.slice(0, idx), value: raw.slice(idx + 2).trim() };
}

export interface ProductCardData {
  name: string;
  classes: string[];
  region: string | null;
  unit: string | null;
  characteristics: string[];
  price: number | null;
  imageUrl: string | null;
}

interface ProductCardProps {
  data: ProductCardData;
  className?: string;
  classLabels?: Record<string, string>;
  /** Компания (для матрицы) */
  companyName?: string;
  companyInn?: string;
  rating?: number | null;
  /** Контакты с раскрытием (для матрицы) */
  phone?: string | null;
  email?: string | null;
  revealed?: { phone?: boolean; email?: boolean };
  onReveal?: (field: "phone" | "email") => void;
  /** Бейдж под названием (например, категория — для ЛК) */
  badge?: React.ReactNode;
  /** Кнопки действий (например, редактировать/удалить — для ЛК) */
  actions?: React.ReactNode;
  /** Дополнительный футер (например, просмотры — для ЛК) */
  footer?: React.ReactNode;
}

/**
 * Карточка товара — общая для матрицы материалов и личного кабинета компании.
 */
export function ProductCard({
  data,
  className,
  classLabels = {},
  companyName,
  companyInn,
  rating,
  phone,
  email,
  revealed = {},
  onReveal,
  badge,
  actions,
  footer,
}: ProductCardProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const chars = data.characteristics.map(parseCharacteristic);

  return (
    <>
      <Card className={cn("flex flex-col", className)}>
        <CardContent className="pt-3 flex-1 flex flex-col">
          {/* Фото слева + компания/название */}
          <div className="flex items-start gap-2 mb-2">
            {data.imageUrl && (
              <button
                type="button"
                onClick={() => setPreviewUrl(data.imageUrl)}
                className="shrink-0 w-16 h-16 rounded-md border overflow-hidden bg-secondary cursor-pointer hover:opacity-80 transition-opacity"
                title="Открыть фото"
              >
                <img src={data.imageUrl} alt={data.name} className="h-full w-full object-cover" />
              </button>
            )}
            <div className="min-w-0 flex-1">
              {companyName && (
                <div className="text-xs text-muted-foreground mb-1">
                  <p className="font-medium text-foreground truncate">{companyName}</p>
                  <p className="truncate">ИНН {companyInn}</p>
                </div>
              )}
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-sm">{data.name}</h3>
                {actions && <div className="flex gap-1 shrink-0">{actions}</div>}
              </div>
              {badge && <div className="mt-1">{badge}</div>}
            </div>
          </div>

          {rating !== null && rating !== undefined && (
            <div className="flex items-center gap-1 mb-2">
              <StarRating rating={rating} size="sm" />
              <span className="text-xs text-muted-foreground">{rating}</span>
            </div>
          )}

          <div className="flex items-baseline gap-1 mb-2">
            <span className="text-lg font-bold text-menthol">
              {data.price !== null ? `${data.price.toLocaleString("ru-RU")} ₽` : "Цена по запросу"}
            </span>
            {data.unit && <span className="text-xs text-muted-foreground">/ {data.unit}</span>}
          </div>

          <div className="flex flex-wrap gap-1 mb-2">
            {data.classes.map((c) => (
              <Badge key={c} variant="outline" className="text-[10px]">{classLabels[c] || c}</Badge>
            ))}
          </div>

          {data.region && (
            <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
              <MapPin className="h-3 w-3 shrink-0" />
              {data.region}
            </p>
          )}

          {chars.length > 0 && (
            <div className="text-xs mb-3 space-y-1 border-t pt-2">
              {chars.map((c, i) => (
                <div key={i} className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{c.name}</span>
                  <span className="font-medium text-right">{c.value}</span>
                </div>
              ))}
            </div>
          )}

          {(phone || email) && (
            <div className="flex items-center gap-2 mt-auto pt-2 border-t">
              {phone && (
                revealed.phone ? (
                  <a href={telHref(phone)} className="text-xs flex items-center gap-1 hover:text-menthol transition-colors">
                    <Phone className="h-3 w-3 text-muted-foreground" />
                    {phone}
                  </a>
                ) : (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="h-3 w-3 text-muted-foreground" />
                    <EyeButton onClick={() => onReveal?.("phone")} fieldLabel="телефон" />
                  </span>
                )
              )}
              {email && (
                revealed.email ? (
                  <a href={mailtoHref(email)} className="text-xs flex items-center gap-1 hover:text-menthol transition-colors">
                    <Mail className="h-3 w-3 text-muted-foreground" />
                    {email}
                  </a>
                ) : (
                  <span className="inline-flex items-center gap-1">
                    <Mail className="h-3 w-3 text-muted-foreground" />
                    <EyeButton onClick={() => onReveal?.("email")} fieldLabel="email" />
                  </span>
                )
              )}
            </div>
          )}

          {footer}
        </CardContent>
      </Card>

      {/* Предпросмотр фото */}
      <Dialog open={!!previewUrl} onOpenChange={(v) => { if (!v) setPreviewUrl(null); }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Фото товара</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <img
              src={previewUrl}
              alt="Фото товара"
              className="w-full max-h-[75vh] object-contain rounded-lg bg-secondary"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
