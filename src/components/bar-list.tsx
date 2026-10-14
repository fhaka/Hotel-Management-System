/** Horizontal magnitude bars with labels and values — a single series, so no legend. */
export function BarList({ items, format = (n) => String(n) }: { items: { label: string; value: number; hint?: string }[]; format?: (n: number) => string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <li key={i.label} title={`${i.label}: ${format(i.value)}`}>
          <div className="mb-1 flex justify-between gap-3 text-sm">
            <span className="truncate text-foreground">{i.label}</span>
            <span className="shrink-0 font-medium tabular-nums">
              {format(i.value)}
              {i.hint && <span className="ml-1.5 font-normal text-muted-foreground">{i.hint}</span>}
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted">
            <div className="h-2 rounded-full bg-[#2a5aa0]" style={{ width: `${Math.max(2, (i.value / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
