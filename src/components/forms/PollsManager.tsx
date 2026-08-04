"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Trash2, Vote } from "lucide-react";

interface PollData {
  id: string;
  question: string;
  pollType: string;
  coinReward: number;
  isActive: boolean;
  treeItem: { fullNumberPath: string } | null;
  _count: { votes: number };
  options: { id: string; text: string; _count: { votes: number } }[];
  votes: { user: { username: string; profile: { nick: string } | null } }[];
}

interface TreeItem {
  id: string;
  fullNumberPath: string;
  name: string;
}

interface Props { polls: PollData[]; treeItems: TreeItem[]; }

export function PollsManager({ polls, treeItems }: Props) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    const options = [fd.get("opt1"), fd.get("opt2"), fd.get("opt3"), fd.get("opt4")].filter(Boolean);

    try {
      const res = await fetch("/api/polls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: fd.get("question"),
          treeItemId: fd.get("treeItemId") || null,
          pollType: fd.get("pollType") || "DICHOTOMOUS",
          coinReward: parseFloat(fd.get("coinReward") as string) || 0.1,
          options: options.map((text, i) => ({ text, sortOrder: i })),
        }),
      });
      if (res.ok) { setAddOpen(false); router.refresh(); }
      else { const d = await res.json(); setError(d.error || "Ошибка"); }
    } catch { setError("Ошибка соединения"); }
    setLoading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Удалить опрос?")) return;
    await fetch(`/api/polls/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogTrigger>
          <Button className="bg-menthol hover:bg-menthol-dark gap-2"><Plus className="h-4 w-4" /> Создать опрос</Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Новый опрос</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <div className="space-y-2"><Label>Вопрос</Label><Input name="question" required /></div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2"><Label>Тип</Label><Select name="pollType" defaultValue="DICHOTOMOUS"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="DICHOTOMOUS">Да/Нет</SelectItem><SelectItem value="MULTIPLE">Несколько</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label>Монет</Label><Input name="coinReward" type="number" step="0.1" defaultValue="0.1" /></div>
              <div className="space-y-2"><Label>Категория</Label><Select name="treeItemId"><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger><SelectContent><SelectItem value="">Без категории</SelectItem>{treeItems.slice(0,30).map(t => <SelectItem key={t.id} value={t.id}>{t.fullNumberPath}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="space-y-2"><Label>Варианты ответа</Label>
              {[1,2,3,4].map(i => <Input key={i} name={`opt${i}`} placeholder={`Вариант ${i}`} className="mb-1" />)}
            </div>
            <Button type="submit" className="w-full bg-menthol hover:bg-menthol-dark" disabled={loading}>{loading ? "Создание..." : "Создать"}</Button>
          </form>
        </DialogContent>
      </Dialog>

      {polls.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">Нет опросов</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {polls.map((p) => (
            <Card key={p.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{p.question}</CardTitle>
                  <Button variant="ghost" size="icon" className="text-red-500 h-7 w-7" onClick={() => handleDelete(p.id)}><Trash2 className="h-3 w-3" /></Button>
                </div>
                <div className="flex gap-2 mt-1">
                  <Badge variant="secondary" className="text-[10px]">{p.pollType === "DICHOTOMOUS" ? "Да/Нет" : "Множественный"}</Badge>
                  <Badge variant="outline" className="text-[10px]">+{p.coinReward} мон.</Badge>
                  <Badge variant="outline" className="text-[10px]"><Vote className="h-3 w-3 mr-1" />{p._count.votes}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                {p.options.map((o) => (
                  <div key={o.id} className="flex justify-between text-sm py-1 border-b last:border-0">
                    <span>{o.text}</span>
                    <span className="text-muted-foreground">{o._count.votes} ({p._count.votes > 0 ? Math.round(o._count.votes / p._count.votes * 100) : 0}%)</span>
                  </div>
                ))}
                {p.votes.length > 0 && (
                  <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
                    Проголосовали: {p.votes.slice(0, 5).map(v => v.user.profile?.nick || v.user.username).join(", ")}
                    {p.votes.length > 5 && ` + ещё ${p.votes.length - 5}`}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
