import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

/** "62% of $185,000.00" with a bar. Red when over budget. */
export function BudgetBar({ spent, budget }: { spent: number; budget: number }) {
  if (budget <= 0) return <span className="text-xs text-muted">No budget set</span>;
  const pct = Math.round((spent / budget) * 100);
  const over = spent > budget;
  return (
    <div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
        <div
          className={cn("h-full rounded-full", over ? "bg-danger" : pct > 85 ? "bg-accent" : "bg-success")}
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
      <p className={cn("mt-1 text-xs tabular", over ? "font-medium text-danger" : "text-muted")}>
        {pct}% of {formatMoney(budget)}
        {over && ` · over by ${formatMoney(spent - budget)}`}
      </p>
    </div>
  );
}
