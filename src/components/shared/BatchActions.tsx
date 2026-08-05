"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toastSuccess, toastError } from "@/lib/toast";

interface BatchActionsProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  actions: {
    label: string;
    icon?: React.ReactNode;
    onClick: (selectedIds: string[]) => Promise<void>;
    variant?: "default" | "destructive" | "outline" | "secondary";
    confirmText?: string;
  }[];
  allSelected: boolean;
}

export function BatchActions({
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
  actions,
  allSelected,
}: BatchActionsProps) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  if (totalCount === 0) return null;

  return (
    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border mb-4 flex-wrap">
      <div className="flex items-center gap-2">
        <Checkbox
          id="select-all-batch"
          checked={allSelected}
          onCheckedChange={(checked) => {
            if (checked) onSelectAll();
            else onDeselectAll();
          }}
        />
        <Label htmlFor="select-all-batch" className="text-sm cursor-pointer">
          {selectedCount > 0
            ? `Выбрано: ${selectedCount} из ${totalCount}`
            : "Выбрать все"}
        </Label>
      </div>

      {selectedCount > 0 && (
        <div className="flex gap-2 flex-wrap">
          {actions.map((action) => (
            <Button
              key={action.label}
              variant={action.variant || "outline"}
              size="sm"
              disabled={loadingAction === action.label}
              onClick={async () => {
                if (action.confirmText) {
                  if (!confirm(action.confirmText)) return;
                }
                setLoadingAction(action.label);
                try {
                  // selectedIds передаются через замыкание
                  await action.onClick([]);
                  toastSuccess(action.label);
                } catch {
                  toastError("Ошибка", `Не удалось выполнить «${action.label}»`);
                }
                setLoadingAction(null);
              }}
            >
              {loadingAction === action.label ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                action.icon
              )}
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
