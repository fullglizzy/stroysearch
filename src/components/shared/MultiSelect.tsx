"use client";

import { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  value: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  disabled?: boolean;
  /** Помечает триггер как невалидный (красная обводка) */
  ariaInvalid?: boolean;
  /** Кастомный поиск (иначе — поиск по подстроке label) */
  filter?: (option: MultiSelectOption, search: string) => boolean;
  /** Не показывать названия выбранных — только счётчик «Выбрано: N» */
  hideSelectedLabels?: boolean;
}

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = "Выбрать...",
  searchPlaceholder = "Поиск...",
  className,
  disabled = false,
  ariaInvalid = false,
  filter,
  hideSelectedLabels = false,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    // На узких экранах дропдаун растягиваем почти на весь экран —
    // иначе список («1.2.3 — Название категории») нечитаем в ширину триггера
    const vw = window.innerWidth;
    if (vw < 640) {
      setDropdownStyle({
        position: "fixed",
        left: 8,
        top: rect.bottom + 4,
        width: vw - 16,
        zIndex: 50,
      });
      return;
    }
    setDropdownStyle({
      position: "fixed",
      left: rect.left,
      top: rect.bottom + 4,
      minWidth: rect.width,
      zIndex: 50,
    });
  }, []);

  // Position dropdown synchronously before paint (no flicker)
  useLayoutEffect(() => {
    if (open) {
      updatePosition();
    }
  }, [open, updatePosition]);

  // Track scroll/resize while open
  useEffect(() => {
    if (open) {
      window.addEventListener("scroll", updatePosition, true);
      window.addEventListener("resize", updatePosition);
      return () => {
        window.removeEventListener("scroll", updatePosition, true);
        window.removeEventListener("resize", updatePosition);
      };
    }
  }, [open, updatePosition]);

  // Close on outside click (exclude clicks inside trigger + portal dropdown)
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setOpen(false);
        setSearch("");
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  // Focus search input when opened (without scrolling)
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus({ preventScroll: true });
    }
  }, [open]);

  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const lower = search.toLowerCase();
    return filter
      ? options.filter((o) => filter(o, search.trim()))
      : options.filter((o) => o.label.toLowerCase().includes(lower));
  }, [options, search, filter]);

  const selectedSet = new Set(value);

  function toggle(optValue: string) {
    if (selectedSet.has(optValue)) {
      onChange(value.filter((v) => v !== optValue));
    } else {
      onChange([...value, optValue]);
    }
  }

  function selectAll() {
    onChange(filtered.map((o) => o.value));
  }

  function clearAll() {
    onChange([]);
  }

  const allFilteredSelected = filtered.length > 0 && filtered.every((o) => selectedSet.has(o.value));

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={open}
        aria-invalid={ariaInvalid || undefined}
        disabled={disabled}
        ref={triggerRef}
        className="w-full justify-between h-auto min-h-10 py-2 px-3 font-normal"
        onClick={() => setOpen(!open)}
      >
        <span className="flex flex-wrap gap-1 items-center">
          {value.length === 0 ? (
            <span className="text-muted-foreground">{placeholder}</span>
          ) : hideSelectedLabels ? (
            <Badge variant="secondary" className="text-xs font-normal">
              Выбрано: {value.length}
            </Badge>
          ) : value.length <= 2 ? (
            value.map((v) => {
              const opt = options.find((o) => o.value === v);
              return (
                <Badge key={v} variant="secondary" className="text-xs font-normal">
                  {opt?.label || v}
                </Badge>
              );
            })
          ) : (
            <Badge variant="secondary" className="text-xs font-normal">
              Выбрано: {value.length}
            </Badge>
          )}
        </span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>

      {open &&
        createPortal(
          <div
            ref={dropdownRef}
            className="rounded-md border bg-popover shadow-md"
            style={dropdownStyle}
          >
            {/* Search */}
            <div className="flex items-center border-b px-3 py-2">
              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              <Input
                ref={inputRef}
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 border-0 p-0 shadow-none focus-visible:ring-0"
              />
              {search && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={() => setSearch("")}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 border-b px-3 py-1.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={selectAll}
              >
                {allFilteredSelected ? "Снять все" : "Выбрать все"}
              </Button>
              {value.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={clearAll}
                >
                  Очистить
                </Button>
              )}
            </div>

            {/* Options */}
            <div className="max-h-60 overflow-y-auto p-1">
              {filtered.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Ничего не найдено
                </p>
              ) : (
                filtered.map((opt) => {
                  const isSelected = selectedSet.has(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      className={cn(
                        "relative flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                        isSelected && "bg-menthol/10",
                      )}
                      onClick={() => toggle(opt.value)}
                    >
                      <Checkbox
                        checked={isSelected}
                        className="pointer-events-none"
                        tabIndex={-1}
                      />
                      <span className="flex-1 text-left">{opt.label}</span>
                      {isSelected && <Check className="h-4 w-4 text-menthol shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
