import { brand } from "@/config/brand";

/** Dollars (number or "1,234.56" string) -> integer cents. Returns null for blank/invalid input. */
export function toCents(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? Math.round(value * 100) : null;
  const cleaned = value.replace(/[$,\s]/g, "");
  if (cleaned === "" || cleaned === "-") return null;
  const negative = /^\(.*\)$/.test(cleaned); // accounting style (12.00)
  const n = Number(cleaned.replace(/[()]/g, ""));
  if (!Number.isFinite(n)) return null;
  return Math.round((negative ? -n : n) * 100);
}

const fmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: brand.currency,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Integer cents -> "$1,234.56" */
export function formatMoney(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "-";
  return fmt.format(cents / 100);
}

/** Short form for charts and tiles: $12k, $1.2M */
export function formatMoneyShort(cents: number): string {
  const d = cents / 100;
  const abs = Math.abs(d);
  const sign = d < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `${sign}$${Math.round(abs / 1000)}k`;
  if (abs >= 1_000) return `${sign}$${(abs / 1000).toFixed(1)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

/** Cents -> "1234.56" for form inputs */
export function centsToInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  return (cents / 100).toFixed(2);
}
