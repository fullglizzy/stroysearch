"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SessionUser } from "@/types";

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

export function NotificationBell() {
  const { data: session } = useSession();

  if (!session?.user) return null;

  // key по id пользователя: при смене аккаунта состояние сбрасывается
  return <NotificationBellInner key={(session.user as SessionUser).id} />;
}

function NotificationBellInner() {
  const router = useRouter();
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<NotificationRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch("/api/notifications")
        .then((r) => r.json())
        .then((d) => {
          if (cancelled) return;
          setUnread(d.unread || 0);
          setItems(d.notifications || []);
        })
        .catch(() => {});
    load();
    const timer = setInterval(load, 60000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  function handleOpenItem(item: NotificationRow) {
    if (!item.isRead) {
      fetch(`/api/notifications/${item.id}/read`, { method: "POST" }).catch(() => {});
      setUnread((u) => Math.max(0, u - 1));
    }
    if (item.link) router.push(item.link);
  }

  function handleReadAll() {
    fetch("/api/notifications", { method: "POST" }).catch(() => {});
    setUnread(0);
    setItems((list) => list.map((i) => ({ ...i, isRead: true })));
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button variant="outline" size="sm" className="relative">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-orange-accent text-white text-[10px] font-medium">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[26rem] max-w-[92vw]">
        <DropdownMenuGroup>
          <div className="flex items-center justify-between gap-2 px-2 py-1.5">
            <DropdownMenuLabel className="py-0">Уведомления</DropdownMenuLabel>
            {unread > 0 && (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleReadAll}>
                Прочитать все
              </Button>
            )}
          </div>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
            Нет уведомлений
          </div>
        ) : (
          items.map((n) => (
            <DropdownMenuItem
              key={n.id}
              onClick={() => handleOpenItem(n)}
              className="flex-col items-start gap-1 cursor-pointer py-2.5"
            >
              <div className="flex items-center gap-2 w-full">
                {!n.isRead && (
                  <span className="h-2 w-2 rounded-full bg-orange-accent shrink-0" />
                )}
                <span className="font-medium text-sm">{n.title}</span>
                <span className="ml-auto text-xs text-muted-foreground shrink-0">
                  {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: ru })}
                </span>
              </div>
              <span className="text-xs text-muted-foreground line-clamp-3 pl-4">{n.message}</span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
