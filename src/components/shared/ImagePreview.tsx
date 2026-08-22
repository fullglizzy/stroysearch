"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import Image from "next/image";

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
        className={cn("relative cursor-pointer hover:opacity-80 transition-opacity overflow-hidden", className)}
        title={title ?? "Открыть фото"}
      >
        <Image src={src} alt={alt} fill sizes="200px" className="object-cover" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{alt || "Фото"}</DialogTitle>
          </DialogHeader>
          <Image
            src={src}
            alt={alt}
            width={1200}
            height={800}
            className="w-full h-auto max-h-[75vh] object-contain rounded-lg bg-secondary"
            sizes="50vw"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
