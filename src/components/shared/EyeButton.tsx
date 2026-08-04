"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

interface EyeButtonProps {
  onClick: () => void;
  className?: string;
}

export function EyeButton({ onClick, className }: EyeButtonProps) {
  const [revealed, setRevealed] = useState(false);

  function handleClick() {
    setRevealed(!revealed);
    onClick();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center justify-center p-1 rounded hover:bg-secondary transition-colors ${className || ""}`}
      title={revealed ? "Скрыть" : "Показать"}
    >
      {revealed ? (
        <EyeOff className="h-4 w-4 text-muted-foreground" />
      ) : (
        <Eye className="h-4 w-4 text-menthol" />
      )}
    </button>
  );
}
