import { cva, type VariantProps } from "class-variance-authority";
import { cn, initials } from "@/lib/utils";

export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(15,26,46,0.04)]", className)} {...props} />;
}

export function CardHeader({ className, title, description, action }: { className?: string; title: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 border-b border-border px-5 py-4", className)}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

export function CardBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("p-5", className)} {...props} />;
}

export const badgeVariants = cva("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium", {
  variants: {
    tone: {
      neutral: "bg-muted text-muted-foreground",
      success: "bg-success-soft text-success",
      warning: "bg-warning-soft text-warning",
      danger: "bg-danger-soft text-danger",
      info: "bg-info-soft text-info",
      violet: "bg-violet-soft text-violet",
      gold: "bg-gold-soft text-[#8a6a32]",
      dark: "bg-primary text-white",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>;

export function Badge({ className, tone, dot, children, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { dot?: boolean }) {
  return (
    <span className={cn(badgeVariants({ tone }), className)} {...props}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-gold-soft text-xs font-semibold text-[#8a6a32]", className)}>
      {initials(name)}
    </span>
  );
}

export function Separator({ className }: { className?: string }) {
  return <hr className={cn("border-border", className)} />;
}

export function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn("w-full text-sm", className)} {...props} />
    </div>
  );
}

export function Th({ className, ...props }: React.ComponentProps<"th">) {
  return <th className={cn("whitespace-nowrap border-b border-border bg-surface/60 px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground", className)} {...props} />;
}

export function Td({ className, ...props }: React.ComponentProps<"td">) {
  return <td className={cn("border-b border-border px-4 py-3 align-middle", className)} {...props} />;
}

export function EmptyState({ icon, title, description, action, className }: { icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      {icon && <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground [&_svg]:size-5">{icon}</div>}
      <p className="font-medium text-foreground">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />;
}

export function DescriptionList({ items, className }: { items: [React.ReactNode, React.ReactNode][]; className?: string }) {
  return (
    <dl className={cn("divide-y divide-border text-sm", className)}>
      {items.map(([k, v], i) => (
        <div key={i} className="flex items-start justify-between gap-4 py-2.5">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="text-right font-medium text-foreground">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
