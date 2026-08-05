"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw, HelpCircle } from "lucide-react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Page error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <AlertCircle className="h-16 w-16 text-destructive mb-4" />
      <h1 className="text-2xl font-bold mb-2">Что-то пошло не так</h1>
      <p className="text-muted-foreground mb-2 max-w-md">
        Произошла непредвиденная ошибка при загрузке страницы.
      </p>
      {error.digest && (
        <p className="text-xs text-muted-foreground mb-6 font-mono">
          Код ошибки: {error.digest}
        </p>
      )}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button onClick={reset} className="bg-menthol hover:bg-menthol-dark gap-2">
          <RefreshCw className="h-4 w-4" />
          Попробовать снова
        </Button>
        <Link href="/">
          <Button variant="outline" className="gap-2">
            <HelpCircle className="h-4 w-4" />
            На главную
          </Button>
        </Link>
      </div>
    </div>
  );
}
