import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function Steps({ current }: { current: 1 | 2 | 3 }) {
  const steps = ["Select room", "Guest & payment", "Confirmation"];
  return (
    <ol className="flex items-center gap-2 text-xs font-medium sm:gap-4 sm:text-sm">
      {steps.map((s, i) => {
        const n = i + 1;
        return (
          <li key={s} className="flex items-center gap-2 sm:gap-4">
            <span className={cn("flex items-center gap-2", n <= current ? "text-primary" : "text-muted-foreground")}>
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full text-xs",
                  n < current ? "bg-gold text-white" : n === current ? "bg-primary text-white" : "border border-border bg-white",
                )}
              >
                {n < current ? <Check className="size-3.5" /> : n}
              </span>
              {s}
            </span>
            {n < steps.length && <span className="h-px w-6 bg-border sm:w-12" />}
          </li>
        );
      })}
    </ol>
  );
}
