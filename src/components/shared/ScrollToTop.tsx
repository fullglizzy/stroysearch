"use client";

import { useEffect, useState } from "react";
import { ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function handleScroll() {
      setVisible(window.scrollY > 300);
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (!visible) return null;

  return (
    <Button
      className="fixed bottom-20 right-6 z-40 rounded-full shadow-lg h-10 w-10 p-0 bg-menthol hover:bg-menthol-dark"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      title="Наверх"
      aria-label="Прокрутить наверх"
    >
      <ChevronUp className="h-5 w-5" />
    </Button>
  );
}
