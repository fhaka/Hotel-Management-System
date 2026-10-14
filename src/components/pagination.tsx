import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export const PAGE_SIZE = 25;

export function Pagination({ page, total, pageSize = PAGE_SIZE, href }: { page: number; total: number; pageSize?: number; href: (page: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const link = "inline-flex size-8 items-center justify-center rounded-lg border border-border bg-white text-sm hover:bg-muted";
  return (
    <div className="flex items-center justify-between gap-4 border-t border-border px-5 py-3 text-sm text-muted-foreground">
      <span>
        {from}–{to} of {total.toLocaleString("en")}
      </span>
      <div className="flex items-center gap-1.5">
        {page > 1 ? (
          <Link href={href(page - 1)} className={link} aria-label="Previous page">
            <ChevronLeft className="size-4" />
          </Link>
        ) : (
          <span className={cn(link, "opacity-40")}><ChevronLeft className="size-4" /></span>
        )}
        <span className="px-2">
          Page {page} of {pages}
        </span>
        {page < pages ? (
          <Link href={href(page + 1)} className={link} aria-label="Next page">
            <ChevronRight className="size-4" />
          </Link>
        ) : (
          <span className={cn(link, "opacity-40")}><ChevronRight className="size-4" /></span>
        )}
      </div>
    </div>
  );
}

export function pageParam(value: string | undefined) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

export function buildHref(base: string, params: Record<string, string | number | undefined>) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)])).toString();
  return qs ? `${base}?${qs}` : base;
}
