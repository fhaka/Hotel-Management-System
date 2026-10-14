type DecimalLike = { toNumber(): number } | number | string | null | undefined;

export function toNumber(value: DecimalLike): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return value.toNumber();
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

const eur = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" });
const eurCompact = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export function formatMoney(value: DecimalLike, opts?: { compact?: boolean }): string {
  return (opts?.compact ? eurCompact : eur).format(toNumber(value));
}

export function formatPercent(value: number, digits = 0): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}
