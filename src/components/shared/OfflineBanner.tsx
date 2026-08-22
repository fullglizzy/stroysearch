"use client";

import { useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";

function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

export function OfflineBanner() {
  // Онлайн-статус как внешний стор: SSR отдаёт "online" (как и сейчас),
  // на клиенте подписка на online/offline события перерисовывает баннер.
  const isOffline = useSyncExternalStore(
    subscribe,
    () => !navigator.onLine,
    () => false,
  );

  if (!isOffline) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[60] bg-destructive text-destructive-foreground py-2 px-4 text-center text-sm flex items-center justify-center gap-2">
      <WifiOff className="h-4 w-4" />
      <span>Нет соединения с интернетом. Проверьте подключение.</span>
    </div>
  );
}
