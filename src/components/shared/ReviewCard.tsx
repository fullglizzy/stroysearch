"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StarRating } from "@/components/shared/StarRating";
import { ReportReviewButton } from "@/components/shared/ReportReviewButton";
import { Building2 } from "lucide-react";

// Те же наборы критериев, что и на /suppliers
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

export interface ReviewCriteriaItem {
  criteriaIndex: number;
  score: number;
}

export interface ReviewCardProps {
  id: string;
  /** От кого отзыв (для «Полученных») */
  authorNick?: string | null;
  /** Для кого отзыв (для «Оставленных») */
  targetName?: string | null;
  comment: string;
  weightedAverage: number;
  createdAt: Date | string;
  criteria: ReviewCriteriaItem[];
  /** Название компании-бейджа, если отзыв о компании */
  companyName?: string | null;
  /** null — отзыв об участнике (набор критериев участника) */
  companyId?: string | null;
  /** Отзыв скрыт модератором (видно только автору) */
  hidden?: boolean;
}

/**
 * Карточка отзыва с раскрываемыми оценками по критериям —
 * такой же вид, как в попапе отзывов на /suppliers.
 */
export function ReviewCard({
  id,
  authorNick,
  targetName,
  comment,
  weightedAverage,
  createdAt,
  criteria,
  companyName,
  companyId,
  hidden = false,
}: ReviewCardProps) {
  const [expanded, setExpanded] = useState(false);
  const criteriaLabels = companyId ? COMPANY_CRITERIA_LABELS : PARTICIPANT_CRITERIA_LABELS;

  return (
    <Card>
      <CardContent className="px-4">
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-medium break-words min-w-0">
              {authorNick ? `От: ${authorNick}` : ""}
              {targetName ? `Для: ${targetName}` : ""}
            </span>
            {companyName && (
              <Badge variant="outline" className="text-[10px] min-w-0 max-w-[50%]">
                <Building2 className="h-2 w-2 mr-1 shrink-0" />
                <span className="truncate">{companyName}</span>
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <StarRating rating={weightedAverage} size="sm" />
            <span className="text-xs text-muted-foreground">{weightedAverage.toFixed(1)}</span>
          </div>
        </div>
        <p className="text-sm mb-1 wrap-anywhere whitespace-pre-wrap">{comment}</p>
        <div className="flex flex-wrap items-center justify-between gap-1">
          <p className="text-xs text-muted-foreground">
            {new Date(createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
          </p>
          <div className="flex items-center gap-2">
            {hidden && (
              <Badge variant="destructive" className="text-[10px]">Скрыт модератором</Badge>
            )}
            <ReportReviewButton reviewId={id} />
          </div>
        </div>
        {criteria.length > 0 && (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-menthol hover:underline cursor-pointer"
            >
              {expanded ? "Скрыть оценки по критериям" : "Показать оценки по критериям"}
            </button>
            {expanded && (
              <div className="mt-2 space-y-1 border-t pt-2">
                {criteria.map((c) => (
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
      </CardContent>
    </Card>
  );
}
