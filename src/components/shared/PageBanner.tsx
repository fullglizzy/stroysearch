"use client";

import { useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";

interface PageBannerProps {
  url: string;
  alt: string;
  className?: string;
}

/**
 * Баннер страницы с кнопкой закрытия (скрывается на время сессии)
 */
export function PageBanner({ url, alt, className }: PageBannerProps) {
  const [hidden, setHidden] = useState(false);

  if (hidden) return null;

  return (
    <div className={`relative mb-4 rounded-lg overflow-hidden ${className || ""}`}>
      <Image src={url} alt={alt} width={1600} height={400} className="w-full h-auto max-h-32 object-cover" loading="lazy" decoding="async" sizes="100vw" />
      <button
        type="button"
        onClick={() => setHidden(true)}
        title="Скрыть баннер"
        aria-label="Скрыть баннер"
        className="absolute top-2 right-2 h-7 w-7 rounded-full bg-background/80 hover:bg-background flex items-center justify-center shadow-sm transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
