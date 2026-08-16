"use client";

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ReviewForm } from "@/components/forms/ReviewForm";
import { Search, Building2, User } from "lucide-react";

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

export interface ReviewCandidateCompany {
  id: string;
  name: string;
  inn: string;
}

export interface ReviewCandidateParticipant {
  id: string;
  nick: string | null;
  name: string;
}

interface AddReviewSectionProps {
  companies: ReviewCandidateCompany[];
  participants: ReviewCandidateParticipant[];
  /** Аккаунт может оставлять отзывы (status === ACTIVE) */
  canReview: boolean;
}

const MAX_SHOWN = 30;

/**
 * Вкладка «Оставить отзыв»: поиск по компаниям и участникам,
 * выбор цели открывает форму отзыва (как на /suppliers).
 */
export function AddReviewSection({ companies, participants, canReview }: AddReviewSectionProps) {
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState<{
    id: string;
    name: string;
    companyId?: string;
    kind: "company" | "participant";
  } | null>(null);

  const results = useMemo(() => {
    const s = search.trim().toLowerCase();
    const matchedCompanies = s
      ? companies.filter((c) => c.name.toLowerCase().includes(s) || c.inn.includes(s))
      : companies;
    const matchedParticipants = s
      ? participants.filter((p) => p.name.toLowerCase().includes(s) || (p.nick || "").toLowerCase().includes(s))
      : participants;

    return {
      companies: matchedCompanies.slice(0, s ? MAX_SHOWN : 12),
      participants: matchedParticipants.slice(0, s ? MAX_SHOWN : 12),
    };
  }, [search, companies, participants]);

  if (!canReview) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Ваш аккаунт не активен — оставлять отзывы нельзя.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Поиск компании или участника по названию, нику, ИНН..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {results.companies.length === 0 && results.participants.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Никого не найдено</p>
      ) : (
        <>
          {results.companies.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-menthol" /> Компании
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {results.companies.map((c) => (
                  <Card
                    key={c.id}
                    className="hover:border-menthol/50 transition-colors cursor-pointer"
                    onClick={() => setTarget({ id: c.id, name: c.name, companyId: c.id, kind: "company" })}
                  >
                    <CardContent className="px-4">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-menthol flex-shrink-0" />
                        <span className="font-medium text-sm truncate">{c.name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">ИНН: {c.inn}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {results.participants.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <User className="h-4 w-4 text-menthol" /> Участники
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {results.participants.map((p) => (
                  <Card
                    key={p.id}
                    className="hover:border-menthol/50 transition-colors cursor-pointer"
                    onClick={() => setTarget({ id: p.id, name: p.name, kind: "participant" })}
                  >
                    <CardContent className="px-4">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-menthol flex-shrink-0" />
                        <span className="font-medium text-sm truncate">{p.name}</span>
                      </div>
                      {p.nick && <p className="text-xs text-muted-foreground mt-1">Ник: {p.nick}</p>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <Dialog open={!!target} onOpenChange={(o) => { if (!o) setTarget(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Оставить отзыв</DialogTitle>
            <DialogDescription>
              Оцените по 9 критериям (☆1–5) и оставьте комментарий от 100 знаков.
              За отзыв начисляется +1 монета.
            </DialogDescription>
          </DialogHeader>
          {target && (
            <ReviewForm
              targetId={target.id}
              targetName={target.name}
              companyId={target.companyId}
              criteriaLabels={target.kind === "company" ? COMPANY_CRITERIA_LABELS : PARTICIPANT_CRITERIA_LABELS}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
