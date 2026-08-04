"use client";

import { useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EyeButton } from "@/components/shared/EyeButton";
import { StarRating } from "@/components/shared/StarRating";
import { ReviewForm } from "@/components/forms/ReviewForm";
import { Plus, Search, MessageSquare } from "lucide-react";

interface CompanyRow {
  id: string;
  inn: string;
  name: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  region: string | null;
  classifierIds: string[];
  rating: number | null;
  reviewCount: number;
  ownerNick: string | null;
  ownerRoles: string[];
  metrics: {
    phoneViews: number;
    emailViews: number;
    websiteViews: number;
  };
}

interface Props {
  companies: CompanyRow[];
}

export function SuppliersPageClient({ companies }: Props) {
  const { data: session } = useSession();
  const isAdmin =
    session?.user &&
    ["MODERATOR", "EDITOR", "SUPER", "ROOT"].includes(
      (session.user as any).type,
    );

  const [revals, setRevals] = useState<Record<string, Record<string, boolean>>>({});
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all"); // all | company | participant
  const [addOpen, setAddOpen] = useState(false);
  const [addError, setAddError] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<{ id: string; name: string; companyId?: string } | null>(null);

  const filtered = companies.filter((c) => {
    if (!search) {
      // only apply type filter when no search
      if (typeFilter === "company" && !c.inn) return false;
      if (typeFilter === "participant" && c.inn && !c.ownerNick) return false;
      return true;
    }
    const s = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(s) ||
      c.inn.includes(s) ||
      (c.ownerNick?.toLowerCase().includes(s)) ||
      (c.region?.toLowerCase().includes(s))
    );
  });

  const handleReveal = useCallback(
    async (companyId: string, field: string) => {
      const key = `${companyId}`;
      setRevals((prev) => ({
        ...prev,
        [key]: { ...prev[key], [field]: !prev[key]?.[field] },
      }));

      try {
        await fetch(`/api/suppliers/metrics/${companyId}/click`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ field }),
        });
      } catch {
        // silent
      }
    },
    [],
  );

  async function handleAddCompany(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAddError("");
    setAddLoading(true);

    const formData = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inn: formData.get("inn"),
          email: formData.get("email"),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setAddError(data.error || "Ошибка добавления");
      } else {
        setAddOpen(false);
        window.location.reload();
      }
    } catch {
      setAddError("Ошибка соединения");
    }
    setAddLoading(false);
  }

  return (
    <div className="container-page py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">База поставщиков и заказчиков</h1>
          <p className="text-muted-foreground mt-1">
            Контакты открываются по клику на иконку глаза
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger>
              <Button className="bg-menthol hover:bg-menthol-dark gap-2">
                <Plus className="h-4 w-4" />
                Добавить компанию
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Добавить компанию по ИНН</DialogTitle>
                <DialogDescription>
                  За добавление компании начисляется +1 монета
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddCompany} className="space-y-4">
                {addError && (
                  <Alert variant="destructive">
                    <AlertDescription>{addError}</AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2">
                  <Label htmlFor="inn">ИНН</Label>
                  <Input id="inn" name="inn" placeholder="10 или 12 цифр" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email компании</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="company@mail.ru"
                    required
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-menthol hover:bg-menthol-dark"
                  disabled={addLoading}
                >
                  {addLoading ? "Добавление..." : "Добавить (+1 монета)"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по названию, ИНН, нику, региону..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="border rounded-md px-3 py-2 text-sm bg-background"
        >
          <option value="all">Все</option>
          <option value="company">Компании</option>
          <option value="participant">Участники</option>
        </select>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ник</TableHead>
              <TableHead>ИНН</TableHead>
              <TableHead>Название</TableHead>
              <TableHead>Рейтинг</TableHead>
              <TableHead>Телефон</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Классификатор</TableHead>
              <TableHead>Роль</TableHead>
              <TableHead>Отзывы</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                  Компании не найдены
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((company) => {
                const key = company.id;
                const rev = revals[key] || {};

                return (
                  <TableRow key={company.id}>
                    <TableCell>{company.ownerNick || "—"}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {company.inn || "—"}
                    </TableCell>
                    <TableCell className="font-medium max-w-[180px] truncate">
                      {company.name}
                    </TableCell>
                    <TableCell>
                      {company.rating !== null ? (
                        <div className="flex items-center gap-1">
                          {rev.rating ? (
                            <>
                              <StarRating rating={company.rating} size="sm" />
                              <span className="text-xs text-muted-foreground">
                                {company.rating}/100
                              </span>
                            </>
                          ) : (
                            <div className="flex items-center gap-1">
                              <EyeButton
                                onClick={() => handleReveal(key, "rating")}
                              />
                              <span className="text-xs text-muted-foreground">
                                Скрыт
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {company.phone ? (
                        <div className="flex items-center gap-1">
                          {rev.phone ? (
                            <span className="text-sm">{company.phone}</span>
                          ) : (
                            <EyeButton
                              onClick={() => handleReveal(key, "phone")}
                            />
                          )}
                          {isAdmin && (
                            <span className="text-[10px] text-muted-foreground">
                              ({company.metrics.phoneViews})
                            </span>
                          )}
                        </div>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      {company.email ? (
                        <div className="flex items-center gap-1">
                          {rev.email ? (
                            <span className="text-sm">{company.email}</span>
                          ) : (
                            <EyeButton
                              onClick={() => handleReveal(key, "email")}
                            />
                          )}
                          {isAdmin && (
                            <span className="text-[10px] text-muted-foreground">
                              ({company.metrics.emailViews})
                            </span>
                          )}
                        </div>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {company.classifierIds.slice(0, 2).map((id) => (
                          <Badge key={id} variant="secondary" className="text-[10px]">
                            {id}
                          </Badge>
                        ))}
                        {company.classifierIds.length > 2 && (
                          <Badge variant="outline" className="text-[10px]">
                            +{company.classifierIds.length - 2}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs">
                        {company.ownerRoles.length > 0
                          ? company.ownerRoles.join(", ")
                          : company.inn ? "поставщик" : "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      {company.reviewCount > 0 ? (
                        <div className="flex items-center gap-1">
                          {rev.reviews ? (
                            <span className="text-xs">{company.reviewCount} отз.</span>
                          ) : (
                            <EyeButton onClick={() => handleReveal(key, "reviews")} />
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {session?.user && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() =>
                            setReviewTarget({
                              id: company.ownerNick ? company.id : company.id,
                              name: company.name,
                              companyId: company.inn ? company.id : undefined,
                            })
                          }
                        >
                          <MessageSquare className="h-3 w-3 mr-1" />
                          Отзыв
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Review Dialog */}
      {reviewTarget && (
        <Dialog open={!!reviewTarget} onOpenChange={() => setReviewTarget(null)}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Оставить отзыв</DialogTitle>
              <DialogDescription>
                Оцените по 9 критериям (☆1-5). За отзыв начисляется +1 монета.
              </DialogDescription>
            </DialogHeader>
            <ReviewForm
              targetId={reviewTarget.id}
              targetName={reviewTarget.name}
              companyId={reviewTarget.companyId}
              criteriaLabels={[
                "Качество оказанной работы/услуги/материала/поставки",
                "Организация работы на объекте / организация поставки",
                "Взаимодействие со специалистами компании",
                "Наличие средств, необходимых для выполнения работ",
                "Финансовое состояние предприятия",
                "Наличие квалифицированных специалистов и руководителей",
                "Срок выполнения работ/поставки",
                "Стоимость и условия оплаты",
                "Особые условия/гибкость в договорных отношениях",
              ]}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
