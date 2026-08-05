"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    function handleOnline() {
      setIsOffline(false);
    }
    function handleOffline() {
      setIsOffline(true);
    }

    // initial check
    setIsOffline(!navigator.onLine);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[60] bg-destructive text-destructive-foreground py-2 px-4 text-center text-sm flex items-center justify-center gap-2">
      <WifiOff className="h-4 w-4" />
      <span>Нет соединения с интернетом. Проверьте подключение.</span>
    </div>
  );
}
