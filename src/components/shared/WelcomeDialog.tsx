"use client";

import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  PartyPopper,
  ArrowRight,
  Network,
  Users,
  BookOpen,
  Presentation,
  MessageSquareText,
  ChartColumn,
  Package,
  type LucideIcon,
} from "lucide-react";

interface WelcomeFeature {
  icon: LucideIcon;
  title: string;
  description: string;
}

const PARTICIPANT_FEATURES: WelcomeFeature[] = [
  {
    icon: Network,
    title: "Дерево продуктовых решений",
    description: "Иерархический классификатор строительного цикла",
  },
  {
    icon: Users,
    title: "База поставщиков",
    description: "Поиск компаний и участников строительной отрасли",
  },
  {
    icon: BookOpen,
    title: "Библиотека",
    description: "Доступ к техническим документам и их размещение",
  },
  {
    icon: Presentation,
    title: "Презентация новых продуктов",
    description: "Участие и организация конференций",
  },
  {
    icon: MessageSquareText,
    title: "Отзывы",
    description: "Возможность оставлять отзывы",
  },
  {
    icon: ChartColumn,
    title: "Опросы и статистика",
    description: "Участвовать в опросах, формировать мнение на строительном рынке",
  },
];

const COMPANY_FEATURES: WelcomeFeature[] = [
  {
    icon: Network,
    title: "Дерево продуктовых решений",
    description: "Иерархический классификатор строительного цикла",
  },
  {
    icon: Package,
    title: "Товары и продукция",
    description: "Размещение и управление товарами компании",
  },
  {
    icon: Users,
    title: "База поставщиков",
    description: "Поиск компаний и участников строительной отрасли",
  },
  {
    icon: Presentation,
    title: "Презентация новых продуктов",
    description: "Участие и организация конференций",
  },
  {
    icon: MessageSquareText,
    title: "Отзывы",
    description: "Возможность оставлять отзывы",
  },
  {
    icon: BookOpen,
    title: "Библиотека",
    description: "Доступ к техническим документам и их размещение",
  },
];

interface WelcomeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Отображаемое имя: имя участника или название компании (не логин) */
  displayName: string;
  /** Роль аккаунта — определяет список возможностей */
  role: "participant" | "company";
  dashboardHref: string;
}

export function WelcomeDialog({
  open,
  onOpenChange,
  displayName,
  role,
  dashboardHref,
}: WelcomeDialogProps) {
  const router = useRouter();
  const features = role === "company" ? COMPANY_FEATURES : PARTICIPANT_FEATURES;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto text-center">
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-menthol/10">
            <PartyPopper className="h-8 w-8 text-menthol" />
          </div>
          <DialogTitle className="text-xl">
            Добро пожаловать на платформу, {displayName}!
          </DialogTitle>
          <DialogDescription className="text-base pt-2">
            Ваш аккаунт успешно создан. Вот что доступно на платформе:
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 text-left my-4 sm:grid-cols-2">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="flex items-start gap-2.5 p-3 rounded-lg bg-secondary/50"
              >
                <Icon
                  className={cn(
                    "h-5 w-5 flex-shrink-0 mt-0.5",
                    index % 2 === 0 ? "text-menthol" : "text-orange-accent",
                  )}
                />
                <div>
                  <p className="font-medium text-sm">{feature.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{feature.description}</p>
                </div>
              </div>
            );
          })}
        </div>

        <Button
          className="w-full bg-menthol hover:bg-menthol-dark gap-2"
          onClick={() => {
            onOpenChange(false);
            router.push(dashboardHref);
          }}
        >
          Перейти в личный кабинет
          <ArrowRight className="h-4 w-4" />
        </Button>
      </DialogContent>
    </Dialog>
  );
}
