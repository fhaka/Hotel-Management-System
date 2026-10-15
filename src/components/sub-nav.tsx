"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function SubNav({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav className="scrollbar-thin mb-6 flex gap-6 overflow-x-auto overflow-y-hidden border-b border-border">
      {items.map((i) => {
        const active = pathname === i.href;
        return (
          <Link
            key={i.href}
            href={i.href}
            className={cn("-mb-px whitespace-nowrap border-b-2 pb-3 text-sm font-medium transition-colors", active ? "border-gold text-primary" : "border-transparent text-muted-foreground hover:text-primary")}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
