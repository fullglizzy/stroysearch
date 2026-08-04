"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle, Info, Loader2 } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  message: string;
  variant?: "danger" | "success" | "info";
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void | Promise<void>;
  loading?: boolean;
  /** Если true — только кнопка OK, без отмены */
  alert?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  message,
  variant = "danger",
  confirmLabel = "Подтвердить",
  cancelLabel = "Отмена",
  onConfirm,
  loading = false,
  alert = false,
}: ConfirmDialogProps) {
  const Icon = variant === "success" ? CheckCircle : variant === "info" ? Info : AlertTriangle;
  const iconColor = variant === "success" ? "text-green-500" : variant === "info" ? "text-menthol" : "text-orange-accent";

  async function handleConfirm() {
    if (onConfirm) {
      await onConfirm();
    }
    if (!loading) {
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className={`p-2 rounded-full ${variant === "danger" ? "bg-red-50" : variant === "success" ? "bg-green-50" : "bg-menthol/10"}`}>
              <Icon className={`h-5 w-5 ${iconColor}`} />
            </div>
            <DialogTitle>{title}</DialogTitle>
          </div>
          <DialogDescription className="text-sm">{message}</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2 justify-end mt-4">
          {!alert && (
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              {cancelLabel}
            </Button>
          )}
          <Button
            onClick={handleConfirm}
            disabled={loading}
            className={
              variant === "danger"
                ? "bg-red-600 hover:bg-red-700"
                : variant === "success"
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-menthol hover:bg-menthol-dark"
            }
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
