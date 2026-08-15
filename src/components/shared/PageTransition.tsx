"use client";

import { ReactNode, useEffect } from "react";
import { usePathname } from "next/navigation";

interface PageTransitionProps {
  children: ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname();

  // При переходе между страницами всегда открываем их с самого верха.
  // scroll-behavior: smooth на <html> мешает обычному сбросу прокрутки —
  // используем мгновенный скролл, не зависящий от CSS.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      {children}
    </div>
  );
}
