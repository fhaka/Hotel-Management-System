import Link from "next/link";
import { cn } from "@/lib/utils";

export function Crown({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 24" fill="none" aria-hidden className={className}>
      <path
        d="M3 19.5 1.5 6.5l7.5 6L16 2l7 10.5 7.5-6L29 19.5H3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity="0.12"
      />
      <path d="M3.5 22.5h25" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="16" cy="2" r="1.4" fill="currentColor" />
      <circle cx="1.5" cy="6.5" r="1.2" fill="currentColor" />
      <circle cx="30.5" cy="6.5" r="1.2" fill="currentColor" />
    </svg>
  );
}

export function Logo({ href = "/", tone = "dark", compact, className }: { href?: string; tone?: "dark" | "light"; compact?: boolean; className?: string }) {
  return (
    <Link href={href} className={cn("group inline-flex items-center gap-3", className)} aria-label="Hotel Imperial home">
      <span
        className={cn(
          "flex size-10 items-center justify-center rounded-full border",
          tone === "light" ? "border-gold-light/50 text-gold-light" : "border-gold/40 text-gold",
        )}
      >
        <Crown className="h-4 w-5" />
      </span>
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className={cn("font-serif text-lg tracking-[0.18em]", tone === "light" ? "text-white" : "text-primary")}>IMPERIAL</span>
          <span className={cn("mt-1 text-[0.6rem] tracking-[0.42em]", tone === "light" ? "text-gold-light" : "text-gold")}>HOTEL · TIRANA</span>
        </span>
      )}
    </Link>
  );
}
