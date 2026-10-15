"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

const WORDS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

/** Read-only star rating; supports fractional averages. */
export function Stars({ value, size = "sm", className }: { value: number; size?: "sm" | "md" | "lg"; className?: string }) {
  const px = { sm: "size-3.5", md: "size-4", lg: "size-5" }[size];
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} role="img" aria-label={`${value.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, value - i + 1));
        return (
          <span key={i} className={cn("relative inline-block", px)}>
            <Star className={cn("absolute inset-0 text-border", px)} />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className={cn("fill-gold text-gold", px)} />
            </span>
          </span>
        );
      })}
    </span>
  );
}

/** Accessible 1–5 star input (radio group) that submits as a named form field. */
export function StarInput({ name, label, required, defaultValue = 0, size = "lg" }: { name: string; label: string; required?: boolean; defaultValue?: number; size?: "md" | "lg" }) {
  const [value, setValue] = useState(defaultValue);
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  const px = size === "lg" ? "size-8" : "size-6";
  return (
    <fieldset>
      <legend className="text-sm font-medium">
        {label}
        {!required && <span className="font-normal text-muted-foreground"> (optional)</span>}
      </legend>
      <div className="mt-1.5 flex items-center gap-3">
        <div className="flex" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((i) => (
            <label key={i} className="cursor-pointer p-0.5" onMouseEnter={() => setHover(i)}>
              <input type="radio" name={name} value={i} checked={value === i} onChange={() => setValue(i)} required={required && i === 1} className="peer sr-only" />
              <Star className={cn(px, "transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-gold", i <= shown ? "fill-gold text-gold" : "text-border")} />
              <span className="sr-only">{i} star{i > 1 ? "s" : ""}</span>
            </label>
          ))}
        </div>
        <span className="min-w-20 text-sm text-muted-foreground">{WORDS[shown]}</span>
      </div>
    </fieldset>
  );
}
