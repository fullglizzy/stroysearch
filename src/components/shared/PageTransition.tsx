"use client";

import { ReactNode } from "react";

interface PageTransitionProps {
  children: ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      {children}
    </div>
  );
}
