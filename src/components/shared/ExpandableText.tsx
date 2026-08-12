"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface ExpandableTextProps {
  text: string;
  className?: string;
}

/**
 * Текст с переносами строк и раскрытием длинных описаний («Подробнее»/«Свернуть»)
 */
export function ExpandableText({ text, className }: ExpandableTextProps) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > 220;

  return (
    <div>
      <p
        className={cn(
          "text-sm text-muted-foreground mb-1 whitespace-pre-line break-words",
          !expanded && "line-clamp-3",
          className,
        )}
      >
        {text}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-menthol hover:underline cursor-pointer"
        >
          {expanded ? "Свернуть" : "Подробнее"}
        </button>
      )}
    </div>
  );
}
