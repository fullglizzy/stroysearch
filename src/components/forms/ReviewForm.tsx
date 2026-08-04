"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Star, Loader2 } from "lucide-react";

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
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  function setScore(index: number, value: number) {
    const newScores = [...scores];
    newScores[index] = value;
    setScores(newScores);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (comment.length < 100) {
      setError("Комментарий должен быть не менее 100 знаков");
      return;
    }
    if (scores.some((s) => s === 0)) {
      setError("Оцените все 9 критериев");
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
        setSuccess(true);
        router.refresh();
        setTimeout(() => {
          setComment("");
          setScores(Array(9).fill(0));
        }, 2000);
      } else {
        const d = await res.json();
        setError(d.error || "Ошибка");
      }
    } catch {
      setError("Ошибка соединения");
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Оставить отзыв: {targetName}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          {success && <Alert><AlertDescription>✅ Отзыв опубликован! +1 монета начислена.</AlertDescription></Alert>}

          {/* 9 Criteria */}
          <div className="space-y-3">
            <Label className="font-medium">Критерии оценки</Label>
            {criteriaLabels.map((label, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <span className="text-sm flex-1">{i + 1}. {label}</span>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setScore(i, star)}
                      className="p-0.5"
                    >
                      <Star
                        className={`h-5 w-5 ${
                          star <= scores[i]
                            ? "fill-orange-accent text-orange-accent"
                            : "text-muted-foreground/30"
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
            <Label htmlFor="comment">Комментарий (мин. 100 знаков)</Label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              placeholder="Опишите ваш опыт работы..."
            />
            <p className="text-xs text-muted-foreground">{comment.length}/100 знаков</p>
          </div>

          {/* Signature */}
          <div className="space-y-2">
            <Label>Подпись</Label>
            <RadioGroup value={signatureType} onValueChange={setSignatureType} className="flex gap-4">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="nick" id="sig-nick" />
                <Label htmlFor="sig-nick">Ник</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="name" id="sig-name" />
                <Label htmlFor="sig-name">Имя</Label>
              </div>
            </RadioGroup>
          </div>

          <Button type="submit" className="bg-menthol hover:bg-menthol-dark" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Опубликовать отзыв (+1 монета)
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
