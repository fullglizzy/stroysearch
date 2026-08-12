"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuthGuard } from "@/components/shared/useAuthGuard";
import { Pagination } from "@/components/shared/Pagination";
import { toastSuccess, toastError } from "@/lib/toast";
import { Coins, Vote, BarChart3, Loader2, AlertCircle, ChevronRight, PlusCircle } from "lucide-react";
import { PageBanner } from "@/components/shared/PageBanner";

interface PollRow {
  id: string;
  question: string;
  pollType: "DICHOTOMOUS" | "MULTIPLE";
  coinReward: number;
  isActive: boolean;
  treeItemPath: string | null;
  treeItemName: string | null;
  totalVotes: number;
  options: { id: string; text: string; voteCount: number }[];
}

interface Props {
  polls: PollRow[];
  total: number;
  page: number;
  totalPages: number;
  moderatorText: string | null;
  pageTitle: string | null;
  bannerUrl: string | null;
}

export function PollsPageClient({ polls, total, page, totalPages, moderatorText, pageTitle, bannerUrl }: Props) {
  const { data: session } = useSession();
  const router = useRouter();
  const { guard, dialog: authDialog } = useAuthGuard();

  // Голоса пользователя догружаем клиентом, чтобы страница могла кэшироваться
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    let cancelled = false;
    fetch("/api/polls/voted")
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setVotedIds(new Set(d.ids || [])); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [session?.user]);
  const [resultsPollIds, setResultsPollIds] = useState<Set<string>>(new Set());
  const [activePollId, setActivePollId] = useState<string | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [voteError, setVoteError] = useState("");
  const [requestLoading, setRequestLoading] = useState(false);
  // Актуальные счётчики сразу после голосования (без ожидания refresh)
  const [countOverrides, setCountOverrides] = useState<
    Record<string, { totalVotes: number; optionCounts: Record<string, number> }>
  >({});

  const displayPolls = polls.map((p) => {
    const override = countOverrides[p.id];
    if (!override) return p;
    return {
      ...p,
      totalVotes: override.totalVotes,
      options: p.options.map((o) => ({ ...o, voteCount: override.optionCounts[o.id] ?? o.voteCount })),
    };
  });

  const activePoll = activePollId ? displayPolls.find((p) => p.id === activePollId) || null : null;

  function openPoll(pollId: string) {
    setActivePollId(pollId);
    setSelectedOptions((prev) => ({ ...prev, [pollId]: [] }));
    setVoteError("");
  }

  async function handleVote(pollId: string) {
    if (!session?.user) { router.push("/login"); return; }
    setLoading(pollId);
    setVoteError("");

    const optionIds = selectedOptions[pollId] || [];

    try {
      const res = await fetch(`/api/polls/${pollId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionIds: optionIds.filter(Boolean) }),
      });

      if (res.ok) {
        const d = await res.json();
        // Сразу применяем новые результаты
        if (Array.isArray(d.options)) {
          setCountOverrides((prev) => ({
            ...prev,
            [pollId]: {
              totalVotes: d.totalVotes ?? 0,
              optionCounts: Object.fromEntries(d.options.map((o: { id: string; voteCount: number }) => [o.id, o.voteCount])),
            },
          }));
        }
        setVotedIds((prev) => new Set(prev).add(pollId));
        setResultsPollIds((prev) => {
          const next = new Set(prev);
          next.delete(pollId);
          return next;
        });
        setVoteError("");
        toastSuccess("Голос принят", "Монеты начислены за участие");
        router.refresh();
      } else {
        const d = await res.json();
        setVoteError(d.error || "Ошибка голосования");
      }
    } catch {
      setVoteError("Ошибка соединения");
    }
    setLoading(null);
  }

  async function handleRequestPoll() {
    setRequestLoading(true);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: "Опросы и статистика",
          message: "Заявка на создание опроса. Пользователь хочет предложить тему для нового опроса.",
        }),
      });
      if (res.ok) {
        const d = await res.json();
        const userType = (session?.user as any)?.type as string;
        const dashboard =
          userType === "COMPANY"
            ? "/company"
            : ["MODERATOR", "EDITOR", "SUPER", "ROOT"].includes(userType)
              ? "/admin"
              : "/account";
        toastSuccess("Заявка отправлена", "Открываем тикет в поддержке");
        router.push(`${dashboard}/support?ticket=${d.id}`);
      } else {
        const d = await res.json().catch(() => ({}));
        toastError("Ошибка", d.error || "Не удалось отправить заявку");
      }
    } catch {
      toastError("Ошибка соединения");
    }
    setRequestLoading(false);
  }

  function getPercent(count: number, total: number): number {
    return total > 0 ? Math.round((count / total) * 100) : 0;
  }

  return (
    <div className="container-page py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">Статистика и опросы</h1>
          <p className="text-muted-foreground mt-1">Голосуйте и получайте монеты</p>
        </div>
        <Button
          className="bg-orange-accent hover:bg-orange-accent/90 gap-2"
          onClick={guard(handleRequestPoll)}
          disabled={requestLoading}
        >
          {requestLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
          Хочу создать опрос
        </Button>
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

      {/* Баннер (ТЗ §10.1) */}
      {bannerUrl && <PageBanner url={bannerUrl} alt="Баннер опросов" />}

      {polls.length === 0 ? (
        <div className="border rounded-lg p-12 text-center text-muted-foreground">
          <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg">Нет активных опросов</p>
          <p className="text-sm mt-2">Хотите запустить опрос? Нажмите «Хочу создать опрос»</p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayPolls.map((poll) => {
            const voted = votedIds.has(poll.id);
            return (
              <button
                key={poll.id}
                type="button"
                onClick={() => openPoll(poll.id)}
                className="w-full text-left"
              >
                <Card className="hover:border-menthol/50 transition-colors cursor-pointer">
                  <CardContent className="flex items-center justify-between gap-3 py-1">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium break-words">{poll.question}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Vote className="h-3 w-3" /> {poll.totalVotes} голосов
                        </span>
                        {poll.treeItemPath && (
                          <span>
                            {poll.treeItemPath}
                            {poll.treeItemName ? ` — ${poll.treeItemName}` : ""}
                          </span>
                        )}
                        {voted && (
                          <Badge className="bg-menthol text-[10px] h-4">Вы проголосовали</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="secondary" className="gap-1">
                        <Coins className="h-3 w-3" /> +{poll.coinReward}
                      </Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </button>
            );
          })}
        </div>
      )}

      {/* Попап голосования */}
      <Dialog open={!!activePoll} onOpenChange={(v) => { if (!v) setActivePollId(null); }}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
          {activePoll && (() => {
            const poll = activePoll;
            const voted = votedIds.has(poll.id);
            const showResults = voted || resultsPollIds.has(poll.id);
            const selected = selectedOptions[poll.id] || [];

            return (
              <>
                <DialogHeader>
                  <DialogTitle className="break-words">{poll.question}</DialogTitle>
                  {poll.treeItemPath && (
                    <p className="text-xs text-muted-foreground">
                      {poll.treeItemPath}
                      {poll.treeItemName ? ` — ${poll.treeItemName}` : ""}
                    </p>
                  )}
                </DialogHeader>
                <div className="space-y-4">
                  {voteError && (
                    <Alert variant="destructive">
                      <AlertDescription>{voteError}</AlertDescription>
                    </Alert>
                  )}

                  {poll.pollType === "DICHOTOMOUS" ? (
                    <RadioGroup
                      disabled={voted || showResults}
                      onValueChange={(v) =>
                        setSelectedOptions((prev) => ({ ...prev, [poll.id]: [v] }))
                      }
                    >
                      {poll.options.map((opt) => (
                        <div key={opt.id} className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <RadioGroupItem value={opt.id} id={`poll-${poll.id}-${opt.id}`} />
                              <Label htmlFor={`poll-${poll.id}-${opt.id}`} className="break-words">{opt.text}</Label>
                            </div>
                            {showResults && (
                              <span className="text-sm text-muted-foreground shrink-0">
                                {getPercent(opt.voteCount, poll.totalVotes)}%
                              </span>
                            )}
                          </div>
                          {showResults && (
                            <Progress value={getPercent(opt.voteCount, poll.totalVotes)} className="h-2" />
                          )}
                        </div>
                      ))}
                    </RadioGroup>
                  ) : (
                    <div className="space-y-3">
                      {poll.options.map((opt) => (
                        <div key={opt.id} className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Checkbox
                                id={`poll-${poll.id}-${opt.id}`}
                                disabled={voted || showResults}
                                checked={selected.includes(opt.id)}
                                onCheckedChange={(checked) =>
                                  setSelectedOptions((prev) => ({
                                    ...prev,
                                    [poll.id]: checked
                                      ? [...selected, opt.id]
                                      : selected.filter((id) => id !== opt.id),
                                  }))
                                }
                              />
                              <Label htmlFor={`poll-${poll.id}-${opt.id}`} className="break-words">{opt.text}</Label>
                            </div>
                            {showResults && (
                              <span className="text-sm text-muted-foreground shrink-0">
                                {getPercent(opt.voteCount, poll.totalVotes)}%
                              </span>
                            )}
                          </div>
                          {showResults && (
                            <Progress value={getPercent(opt.voteCount, poll.totalVotes)} className="h-2" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t">
                    <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                      <Vote className="h-3 w-3" /> {poll.totalVotes} голосов
                    </span>
                    <div className="flex gap-2">
                      {!voted && showResults && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setResultsPollIds((prev) => {
                              const next = new Set(prev);
                              next.delete(poll.id);
                              return next;
                            })
                          }
                        >
                          Вернуться к голосованию
                        </Button>
                      )}
                      {!voted && !showResults && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setResultsPollIds((prev) => new Set(prev).add(poll.id))
                          }
                        >
                          Узнать результаты
                        </Button>
                      )}
                      {!voted && !showResults && (
                        <Button
                          size="sm"
                          className="bg-menthol hover:bg-menthol-dark"
                          onClick={() => handleVote(poll.id)}
                          disabled={loading === poll.id || selected.length === 0}
                        >
                          {loading === poll.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Проголосовать"}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
          <span>Всего: {total} опросов</span>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={(p) => {
              const params = new URLSearchParams(window.location.search);
              params.set("page", String(p));
              router.replace(`${window.location.pathname}?${params.toString()}`, { scroll: false });
            }}
          />
        </div>
      )}

      {authDialog}
    </div>
  );
}
