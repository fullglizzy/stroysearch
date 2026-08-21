"use client";

import { useState } from "react";
import Link from "next/link";
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
import { cn, telHref, mailtoHref, parseCharacteristic } from "@/lib/utils";
import { Phone, Mail, Globe, MapPin, Lock } from "lucide-react";

export interface ProductCardData {
  name: string;
  description?: string | null;
  classes: string[];
  regions: string[];
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
  /** Клик по рейтингу (например, попап отзывов в матрице) */
  onRatingClick?: () => void;
  /** Контакты с раскрытием (для матрицы) */
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  revealed?: { phone?: boolean; email?: boolean; website?: boolean; rating?: boolean };
  onReveal?: (field: "phone" | "email" | "website" | "rating") => void;
  /** Санкция: контакты компании скрыты администратором */
  contactsBlocked?: boolean;
  /** Бейдж под названием (например, категория — для ЛК) */
  badge?: React.ReactNode;
  /** Кнопки действий (например, редактировать/удалить — для ЛК) */
  actions?: React.ReactNode;
  /** Дополнительный футер (например, просмотры — для ЛК) */
  footer?: React.ReactNode;
  /** Ссылка на публичную страницу товара (название станет ссылкой) */
  nameHref?: string;
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
  onRatingClick,
  phone,
  email,
  website,
  revealed = {},
  onReveal,
  contactsBlocked,
  badge,
  actions,
  footer,
  nameHref,
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
                <img src={data.imageUrl} alt={data.name} className="h-full w-full object-cover" loading="lazy" decoding="async" />
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
                {nameHref ? (
                  <Link href={nameHref} className="font-semibold text-sm hover:text-menthol transition-colors">
                    {data.name}
                  </Link>
                ) : (
                  <h3 className="font-semibold text-sm">{data.name}</h3>
                )}
                {actions && <div className="flex gap-1 shrink-0">{actions}</div>}
              </div>
              {badge && <div className="mt-1">{badge}</div>}
            </div>
          </div>

          {rating !== null && rating !== undefined && (
            <div className="flex items-center gap-1 mb-2">
              {!onReveal || revealed.rating ? (
                onRatingClick ? (
                  <button
                    type="button"
                    onClick={onRatingClick}
                    className="flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity"
                    title="Показать отзывы"
                  >
                    <StarRating rating={rating} size="sm" />
                    <span className="text-xs text-muted-foreground">{rating}</span>
                  </button>
                ) : (
                  <>
                    <StarRating rating={rating} size="sm" />
                    <span className="text-xs text-muted-foreground">{rating}</span>
                  </>
                )
              ) : (
                <>
                  <EyeButton onClick={() => onReveal("rating")} fieldLabel="рейтинг" />
                  <span className="text-xs text-muted-foreground">Скрыт</span>
                </>
              )}
            </div>
          )}

          {data.description && (
            <p className="text-xs text-muted-foreground mb-2 line-clamp-3">{data.description}</p>
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

          {data.regions.length > 0 && (
            <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
              <MapPin className="h-3 w-3 shrink-0" />
              {data.regions.join(", ")}
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

          {(phone || email || website || contactsBlocked) && (
            <div className="flex items-center gap-2 mt-auto pt-2 border-t">
              {contactsBlocked ? (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" title="Контакты скрыты администратором">
                  <Lock className="h-3 w-3" />
                  Контакты скрыты
                </span>
              ) : (
                <>
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
                  {website && (
                    revealed.website ? (
                      <a
                        href={website}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs flex items-center gap-1 hover:text-menthol transition-colors"
                      >
                        <Globe className="h-3 w-3 text-muted-foreground" />
                        {website.replace(/^https?:\/\//, "")}
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <Globe className="h-3 w-3 text-muted-foreground" />
                        <EyeButton onClick={() => onReveal?.("website")} fieldLabel="сайт" />
                      </span>
                    )
                  )}
                </>
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
