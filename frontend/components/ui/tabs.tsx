"use client";
import type { KeyboardEvent } from "react";
import { cn } from "../../lib/utils";

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  idPrefix,
  label,
}: {
  items: readonly { id: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  idPrefix: string;
  label: string;
}) {
  function handleKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let target: number;
    switch (event.key) {
      case "ArrowRight":
        target = (index + 1) % items.length;
        break;
      case "ArrowLeft":
        target = (index - 1 + items.length) % items.length;
        break;
      case "Home":
        target = 0;
        break;
      case "End":
        target = items.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    onChange(items[target].id);
    document.getElementById(`${idPrefix}-tab-${items[target].id}`)?.focus();
  }
  return (
    <div role="tablist" aria-label={label} className="flex min-w-0 gap-1">
      {items.map((item, index) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          id={`${idPrefix}-tab-${item.id}`}
          aria-controls={`${idPrefix}-panel-${item.id}`}
          aria-selected={item.id === value}
          tabIndex={item.id === value ? 0 : -1}
          onClick={() => onChange(item.id)}
          onKeyDown={(event) => handleKey(event, index)}
          className={cn(
            "relative min-h-12 shrink-0 whitespace-nowrap px-2 py-3 text-sm font-medium transition-colors duration-fast sm:px-4",
            item.id === value
              ? "text-primary after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary"
              : "text-muted hover:text-text",
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
