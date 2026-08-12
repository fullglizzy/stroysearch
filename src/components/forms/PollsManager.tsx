"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { SearchSelect } from "@/components/shared/SearchSelect";
import { FieldError } from "@/components/forms/fields";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Trash2, Vote, Loader2, BarChart3, X } from "lucide-react";

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

// Сообщения совпадают с серверной схемой pollSchema
const pollFormSchema = z.object({
  question: z.string().trim().min(1, "Вопрос обязателен"),
  pollType: z.enum(["DICHOTOMOUS", "MULTIPLE"]),
  treeItemId: z
    .string()
    .uuid("Некорректная категория")
    .optional()
    .or(z.literal("")),
  coinReward: z
    .string()
    .trim()
    .regex(/^\d+([.,]\d{1,2})?$/, "Некорректная награда")
    .optional()
    .or(z.literal("")),
  options: z
    .array(
      z.object({
        text: z
          .string()
          .trim()
          .min(1, "Введите вариант ответа")
          .max(255, "Вариант должен быть не более 255 символов"),
      }),
    )
    .min(2, "Минимум 2 варианта ответа"),
});

type PollFormValues = z.infer<typeof pollFormSchema>;

const POLL_FORM_DEFAULTS: PollFormValues = {
  question: "",
  pollType: "DICHOTOMOUS",
  treeItemId: "",
  coinReward: "0.1",
  options: [{ text: "" }, { text: "" }],
};

export function PollsManager({ polls, treeItems }: Props) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<PollFormValues>({
    resolver: zodResolver(pollFormSchema),
    // Валидируем после первого «касания» поля, а не сразу при наборе
    mode: "onTouched",
    defaultValues: POLL_FORM_DEFAULTS,
  });

  const {
    fields: optionFields,
    append,
    remove,
  } = useFieldArray({ control, name: "options" });

  async function handleCreate(data: PollFormValues) {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/polls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: data.question,
          treeItemId: data.treeItemId || null,
          pollType: data.pollType,
          coinReward: data.coinReward ? parseFloat(data.coinReward.replace(",", ".")) : 0.1,
          options: data.options.map((o, i) => ({ text: o.text, sortOrder: i })),
        }),
      });
      if (res.ok) {
        setAddOpen(false);
        reset(POLL_FORM_DEFAULTS);
        router.refresh();
      } else {
        const d = await res.json().catch(() => ({}));
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
    await fetch(`/api/polls/${deleteId}`, { method: "DELETE" });
    setDeleteId(null);
    setDeleteLoading(false);
    router.refresh();
  }

  const optionsError = (errors.options as { message?: string } | undefined)?.message;

  return (
    <div className="space-y-6">
      <Dialog open={addOpen} onOpenChange={(v) => { setAddOpen(v); if (!v) reset(POLL_FORM_DEFAULTS); }}>
        <DialogTrigger>
          <Button className="bg-menthol hover:bg-menthol-dark gap-2"><Plus className="h-4 w-4" /> Создать опрос</Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Новый опрос</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(handleCreate)} className="space-y-4" noValidate>
            {error && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-2.5">
                <FieldError message={error} />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="question">Вопрос</Label>
              <Input
                id="question"
                maxLength={255}
                aria-invalid={!!errors.question}
                aria-describedby={errors.question ? "question-error" : undefined}
                {...register("question")}
              />
              {errors.question && <FieldError id="question-error" message={errors.question.message} />}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Тип</Label>
                <Controller
                  name="pollType"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      items={{ DICHOTOMOUS: "Да/Нет", MULTIPLE: "Несколько" }}
                      onValueChange={(v) => field.onChange((v as PollFormValues["pollType"]) ?? "DICHOTOMOUS")}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DICHOTOMOUS" label="Да/Нет">Да/Нет</SelectItem>
                        <SelectItem value="MULTIPLE" label="Несколько">Несколько</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="coinReward">Монет</Label>
                <Input
                  id="coinReward"
                  type="number"
                  min="0"
                  step="0.1"
                  aria-invalid={!!errors.coinReward}
                  aria-describedby={errors.coinReward ? "coinReward-error" : undefined}
                  {...register("coinReward")}
                />
                {errors.coinReward && (
                  <FieldError id="coinReward-error" message={errors.coinReward.message} />
                )}
              </div>
              <div className="space-y-2">
                <Label>Категория</Label>
                <Controller
                  name="treeItemId"
                  control={control}
                  render={({ field }) => (
                    <SearchSelect
                      options={[
                        { value: "", label: "Без категории" },
                        ...treeItems.map(t => ({ value: t.id, label: `${t.fullNumberPath} — ${t.name}` })),
                      ]}
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      placeholder="—"
                      searchPlaceholder="Поиск категории..."
                    />
                  )}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Варианты ответа</Label>
              {optionFields.map((field, i) => (
                <div key={field.id} className="flex gap-2 mb-1">
                  <Input
                    placeholder={`Вариант ${i + 1}`}
                    maxLength={255}
                    aria-invalid={!!errors.options?.[i]?.text}
                    {...register(`options.${i}.text` as const)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0 text-red-500"
                    onClick={() => remove(i)}
                    disabled={optionFields.length <= 2}
                    aria-label={`Удалить вариант ${i + 1}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  {errors.options?.[i]?.text && (
                    <div className="col-span-2 -mt-1">
                      <FieldError message={errors.options[i].text.message} />
                    </div>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => append({ text: "" })}
                disabled={optionFields.length >= 10}
              >
                <Plus className="h-3 w-3" />
                Добавить вариант
              </Button>
              {optionsError && <FieldError id="options-error" message={optionsError} />}
            </div>

            <Button type="submit" className="w-full bg-menthol hover:bg-menthol-dark" disabled={loading}>
              {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Создание...</> : "Создать"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {polls.length === 0 ? (
        <div className="border rounded-lg p-12 text-center text-muted-foreground">
          <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg">Нет опросов</p>
          <p className="text-sm mt-2">Создайте первый опрос для участников платформы</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {polls.map((p) => (
            <Card key={p.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{p.question}</CardTitle>
                  <Button variant="ghost" size="icon" className="text-red-500 h-7 w-7" onClick={() => setDeleteId(p.id)}><Trash2 className="h-3 w-3" /></Button>
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

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(v) => { if (!v) setDeleteId(null); }}
        title="Удалить опрос?"
        message="Результаты голосования будут потеряны."
        confirmLabel="Удалить"
        onConfirm={handleDelete}
        loading={deleteLoading}
      />
    </div>
  );
}
