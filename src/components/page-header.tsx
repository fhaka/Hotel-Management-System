import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-6">
      {back && (
        <Link href={back.href} className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-4" /> {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-serif text-[1.75rem] leading-tight text-primary">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  accent?: "gold" | "success" | "info" | "warning";
}) {
  const tone = {
    gold: "bg-gold-soft text-[#8a6a32]",
    success: "bg-success-soft text-success",
    info: "bg-info-soft text-info",
    warning: "bg-warning-soft text-warning",
  }[accent ?? "gold"];
  return (
    <div className="rounded-xl border border-border bg-white p-5 shadow-[0_1px_2px_rgba(15,26,46,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        {icon && <span className={`flex size-9 items-center justify-center rounded-lg [&_svg]:size-4 ${tone}`}>{icon}</span>}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
