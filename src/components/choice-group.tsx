"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ChoiceOption<T extends string> = {
  value: T;
  label: string;
  hint?: string;
};

const gridColumns: Record<number, string> = {
  3: "grid-cols-3",
  4: "grid-cols-4",
  6: "grid-cols-3 sm:grid-cols-6",
};

/** Accessible radio group rendered as large tap targets. */
export function ChoiceGroup<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
}: {
  legend: ReactNode;
  name: string;
  options: ChoiceOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      <div
        className={cn(
          "grid gap-2",
          gridColumns[options.length] ?? "sm:grid-cols-2",
        )}
      >
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              "flex min-h-12 cursor-pointer flex-col justify-center rounded-lg border px-3 py-2 transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/60",
              options.length >= 3 && "items-center text-center",
              option.value === value
                ? "border-primary bg-primary/10"
                : "hover:bg-secondary",
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={option.value === value}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            <span
              className={cn(
                "text-sm font-medium",
                option.value === value && "text-primary",
              )}
            >
              {option.label}
            </span>
            {option.hint && (
              <span className="text-xs text-muted-foreground">
                {option.hint}
              </span>
            )}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
