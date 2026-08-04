"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Coins, Vote, BarChart3 } from "lucide-react";

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
}

export function PollsPageClient({ polls }: Props) {
  const { data: session } = useSession();
  const router = useRouter();
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set());
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string | string[]>>({});
  const [loading, setLoading] = useState<string | null>(null);

  async function handleVote(pollId: string) {
    if (!session?.user) { router.push("/login"); return; }
    setLoading(pollId);

    const optionIds = selectedOptions[pollId];
    const ids = Array.isArray(optionIds) ? optionIds : [optionIds];

    try {
      const res = await fetch(`/api/polls/${pollId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionIds: ids.filter(Boolean) }),
      });

      if (res.ok) {
        setVotedIds((prev) => new Set(prev).add(pollId));
        router.refresh();
      } else {
        const d = await res.json();
        alert(d.error || "Ошибка голосования");
      }
    } catch {
      alert("Ошибка соединения");
    }
    setLoading(null);
  }

  function getPercent(count: number, total: number): number {
    return total > 0 ? Math.round((count / total) * 100) : 0;
  }

  if (polls.length === 0) {
    return (
      <div className="container-page py-8">
        <h1 className="text-3xl font-bold mb-2">Статистика и опросы</h1>
        <div className="border rounded-lg p-12 text-center text-muted-foreground">
          <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg">Нет активных опросов</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container-page py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Статистика и опросы</h1>
          <p className="text-muted-foreground mt-1">Голосуйте и получайте монеты</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {polls.map((poll) => {
          const voted = votedIds.has(poll.id);
          const maxVotes = Math.max(...poll.options.map((o) => o.voteCount), 1);

          return (
            <Card key={poll.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{poll.question}</CardTitle>
                  <Badge variant="secondary" className="gap-1 flex-shrink-0">
                    <Coins className="h-3 w-3" /> +{poll.coinReward}
                  </Badge>
                </div>
                {poll.treeItemPath && (
                  <Badge variant="outline" className="font-mono text-[10px] w-fit">
                    {poll.treeItemPath}
                  </Badge>
                )}
              </CardHeader>
              <CardContent>
                {poll.pollType === "DICHOTOMOUS" ? (
                  <RadioGroup
                    disabled={voted}
                    onValueChange={(v) => setSelectedOptions({ ...selectedOptions, [poll.id]: v })}
                  >
                    {poll.options.map((opt) => (
                      <div key={opt.id} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value={opt.id} id={`${poll.id}-${opt.id}`} />
                            <Label htmlFor={`${poll.id}-${opt.id}`}>{opt.text}</Label>
                          </div>
                          {voted && (
                            <span className="text-sm text-muted-foreground">
                              {getPercent(opt.voteCount, poll.totalVotes)}%
                            </span>
                          )}
                        </div>
                        {voted && (
                          <Progress value={getPercent(opt.voteCount, poll.totalVotes)} className="h-2" />
                        )}
                      </div>
                    ))}
                  </RadioGroup>
                ) : (
                  <div className="space-y-3">
                    {poll.options.map((opt) => (
                      <div key={opt.id} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id={`${poll.id}-${opt.id}`}
                              disabled={voted}
                              onCheckedChange={(checked) => {
                                const current = (selectedOptions[poll.id] as string[]) || [];
                                setSelectedOptions({
                                  ...selectedOptions,
                                  [poll.id]: checked
                                    ? [...current, opt.id]
                                    : current.filter((id) => id !== opt.id),
                                });
                              }}
                            />
                            <Label htmlFor={`${poll.id}-${opt.id}`}>{opt.text}</Label>
                          </div>
                          {voted && (
                            <span className="text-sm text-muted-foreground">
                              {getPercent(opt.voteCount, poll.totalVotes)}%
                            </span>
                          )}
                        </div>
                        {voted && (
                          <Progress value={getPercent(opt.voteCount, poll.totalVotes)} className="h-2" />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between mt-4 pt-3 border-t">
                  <span className="text-xs text-muted-foreground">
                    <Vote className="h-3 w-3 inline mr-1" />
                    {poll.totalVotes} голосов
                  </span>
                  {!voted && (
                    <Button
                      size="sm"
                      className="bg-menthol hover:bg-menthol-dark"
                      onClick={() => handleVote(poll.id)}
                      disabled={loading === poll.id || !selectedOptions[poll.id]}
                    >
                      {loading === poll.id ? "..." : "Проголосовать"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
