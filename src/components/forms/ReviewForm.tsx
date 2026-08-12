"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Star, Loader2, AlertCircle } from "lucide-react";
import { toastSuccess, toastError } from "@/lib/toast";

interface ReviewFormProps {
  targetId: string;
  targetName: string;
  companyId?: string;
  criteriaLabels: string[];
}

export function ReviewForm({ targetId, targetName, companyId, criteriaLabels }: ReviewFormProps) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [signatureType, setSignatureType] = useState("nick");
  const [scores, setScores] = useState<number[]>(Array(9).fill(0));
  const [fieldErrors, setFieldErrors] = useState<{ comment?: string; scores?: string }>({});
  const [loading, setLoading] = useState(false);

  const commentLength = comment.length;
  const commentValid = commentLength >= 100;
  const allScored = !scores.some((s) => s === 0);

  function setScore(index: number, value: number) {
    const newScores = [...scores];
    newScores[index] = value;
    setScores(newScores);
    if (fieldErrors.scores) setFieldErrors((prev) => ({ ...prev, scores: undefined }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errors: { comment?: string; scores?: string } = {};

    if (comment.length < 100) {
      errors.comment = `Минимум 100 знаков (сейчас ${comment.length})`;
    }
    if (scores.some((s) => s === 0)) {
      errors.scores = "Оцените все 9 критериев";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetId,
          companyId: companyId || undefined,
          comment,
          signatureType,
          criteria: scores.map((score, i) => ({
            criteriaIndex: i + 1,
            score,
          })),
        }),
      });

      if (res.ok) {
        const d = await res.json().catch(() => ({}));
        if (d.updated) {
          toastSuccess("Отзыв обновлён!", "Ваши изменения сохранены");
        } else {
          toastSuccess("Отзыв опубликован!", "+1 монета начислена на ваш счёт");
        }
        router.refresh();
        setComment("");
        setScores(Array(9).fill(0));
        setFieldErrors({});
      } else if (res.status === 401) {
        toastError("Требуется авторизация", "Войдите в аккаунт, чтобы оставить отзыв");
      } else {
        const d = await res.json().catch(() => ({}));
        toastError("Ошибка", d.error || "Не удалось опубликовать отзыв");
      }
    } catch {
      toastError("Ошибка соединения", "Проверьте подключение к интернету и попробуйте снова");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Оставить отзыв: {targetName}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 9 Criteria */}
          <div className="space-y-3">
            <Label className="font-medium">
              Критерии оценки
              {fieldErrors.scores && (
                <span className="text-destructive text-xs ml-2">{fieldErrors.scores}</span>
              )}
            </Label>
            {criteriaLabels.map((label, i) => (
              <div key={i} className="flex items-center justify-between gap-2 group">
                <span className="text-sm flex-1 leading-tight">{i + 1}. {label}</span>
                <div className="flex gap-0.5 flex-shrink-0">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setScore(i, star)}
                      className="p-0.5 transition-transform hover:scale-110 active:scale-95"
                      title={`${star} из 5`}
                    >
                      <Star
                        className={`h-5 w-5 transition-colors ${
                          star <= scores[i]
                            ? "fill-orange-accent text-orange-accent"
                            : "text-muted-foreground/30 group-hover:text-muted-foreground/50"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Comment */}
          <div className="space-y-2">
            <Label htmlFor="comment">
              Комментарий (мин. 100 знаков)
              {fieldErrors.comment && (
                <span className="text-destructive text-xs ml-2">{fieldErrors.comment}</span>
              )}
            </Label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => {
                setComment(e.target.value);
                if (fieldErrors.comment) setFieldErrors((prev) => ({ ...prev, comment: undefined }));
              }}
              rows={4}
              placeholder="Опишите ваш опыт работы..."
              className={fieldErrors.comment ? "border-destructive" : ""}
            />
            <p
              className={`text-xs transition-colors ${
                commentLength === 0
                  ? "text-muted-foreground"
                  : commentValid
                    ? "text-menthol"
                    : "text-orange-accent"
              }`}
            >
              {commentLength}/100 знаков
              {commentLength > 0 && !commentValid && (
                <span className="ml-1 inline-flex items-center gap-0.5">
                  <AlertCircle className="h-3 w-3" />
                  ещё {100 - commentLength}
                </span>
              )}
              {commentValid && (
                <span className="ml-1">✓</span>
              )}
            </p>
          </div>

          {/* Signature */}
          <div className="space-y-2">
            <Label>Подпись</Label>
            <RadioGroup value={signatureType} onValueChange={setSignatureType} className="flex gap-4">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="nick" id="sig-nick" />
                <Label htmlFor="sig-nick" className="cursor-pointer">Ник</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="name" id="sig-name" />
                <Label htmlFor="sig-name" className="cursor-pointer">Имя</Label>
              </div>
            </RadioGroup>
          </div>

          <Button
            type="submit"
            className="w-full bg-menthol hover:bg-menthol-dark"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Публикация...
              </>
            ) : (
              "Опубликовать отзыв (+1 монета)"
            )}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
