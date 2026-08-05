"use client";

import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface EyeButtonProps {
  onClick: () => void | Promise<void>;
  className?: string;
  fieldLabel?: string;
}

export function EyeButton({ onClick, className, fieldLabel = "данные" }: EyeButtonProps) {
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      await onClick();
      setRevealed(!revealed);
    } catch {
      // silent
    }
    setLoading(false);
  }

  return (
    <Tooltip>
      <TooltipTrigger>
        <button
          type="button"
          onClick={handleClick}
          disabled={loading}
          className={`inline-flex items-center justify-center p-2 rounded-md hover:bg-secondary transition-colors disabled:opacity-50 ${className || ""}`}
          title={revealed ? "Скрыть" : "Показать"}
          aria-label={revealed ? `Скрыть ${fieldLabel}` : `Показать ${fieldLabel}`}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
          ) : revealed ? (
            <EyeOff className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Eye className="h-4 w-4 text-menthol" />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs">
          {revealed
            ? "Скрыть"
            : `Нажмите, чтобы показать ${fieldLabel}`}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
