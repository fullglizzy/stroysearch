"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ImagePreviewProps {
  src: string;
  alt: string;
  className?: string;
  title?: string;
}

/**
 * Миниатюра с предпросмотром по клику (лайтбокс)
 */
export function ImagePreview({ src, alt, className, title }: ImagePreviewProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn("cursor-pointer hover:opacity-80 transition-opacity overflow-hidden", className)}
        title={title ?? "Открыть фото"}
      >
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{alt || "Фото"}</DialogTitle>
          </DialogHeader>
          <img
            src={src}
            alt={alt}
            className="w-full max-h-[75vh] object-contain rounded-lg bg-secondary"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
