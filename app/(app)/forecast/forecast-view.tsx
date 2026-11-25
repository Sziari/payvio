"use client";

import { useMemo, useState, useTransition } from "react";
import { GripVertical, RotateCcw, Save } from "lucide-react";
import { buildForecast, type ForecastItem } from "@/lib/forecast";
import { formatShortDate } from "@/lib/dates";
import { formatMoney, formatMoneyShort } from "@/lib/money";
import { Badge, Button, Card, CardHeader, Notice } from "@/components/ui";
import { CashLineChart } from "@/components/charts";
import { cn } from "@/lib/utils";
import type { ExpectedPayment, Invoice, RecurringCost } from "@/lib/types";
import { applyMoves } from "./actions";

export function ForecastView(props: {
  today: string;
  startingCashCents: number;
  cashSource: "bank" | "manual";
  minCashCents: number;
  payments: ExpectedPayment[];
  recurring: RecurringCost[];
  invoices: Invoice[];
}) {
  const [moves, setMoves] = useState<Record<string, number>>({});
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [saving, start] = useTransition();
  const weeks = useMemo(() => buildForecast({ ...props, moves }), [props, moves]);
  const lowWeeks = weeks.filter((w) => w.belowMin);
  const lowest = weeks.reduce((m, w) => (w.endingCents < m.endingCents ? w : m), weeks[0]);
  const moved = Object.keys(moves).length > 0;

  const move = (id: string, index: number) => setMoves((m) => ({ ...m, [id]: index }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label={props.cashSource === "bank" ? "Cash today (from bank)" : "Cash today (entered)"} value={formatMoney(props.startingCashCents)} />
        <Tile label="Lowest point" value={formatMoney(lowest.endingCents)} sub={`Week of ${formatShortDate(lowest.start)}`} danger={lowest.belowMin} />
        <Tile label="In 13 weeks" value={formatMoney(weeks[weeks.length - 1].endingCents)} />
        <Tile label="Minimum to keep" value={formatMoney(props.minCashCents)} sub="Set in Settings" />
      </div>

      {lowWeeks.length > 0 && (
        <Notice tone="danger" title={`Cash drops below your minimum in ${lowWeeks.length} week${lowWeeks.length > 1 ? "s" : ""}`}>
          First time: week of {formatShortDate(lowWeeks[0].start)} ({formatMoney(lowWeeks[0].endingCents)}). Try dragging a customer
          payment earlier to see if collecting sooner fixes it, or schedule supplier bills later.
        </Notice>
      )}

      <Card>
        <CardHeader title="Ending cash by week" />
        <div className="p-4">
          <CashLineChart data={weeks} minCents={props.minCashCents} />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Week by week"
          description="Drag a customer payment (green) to another week to see what happens. Nothing is saved until you press Save."
          action={
            moved ? (
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setMoves({})}>
                  <RotateCcw /> Undo moves
                </Button>
                <Button
                  size="sm"
                  disabled={saving}
                  onClick={() =>
                    start(async () => {
                      await applyMoves(Object.entries(moves).map(([id, i]) => ({ id, weekStart: weeks[i].start })));
                      setMoves({});
                    })
                  }
                >
                  <Save /> Save new dates
                </Button>
              </div>
            ) : null
          }
        />
        <div className="overflow-x-auto">
          <div className="flex min-w-max">
            {weeks.map((w) => (
              <div
                key={w.index}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(w.index);
                }}
                onDragLeave={() => setDragOver(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(null);
                  const id = e.dataTransfer.getData("text/payment");
                  if (id) move(id, w.index);
                }}
                className={cn(
                  "w-52 shrink-0 border-r border-border last:border-r-0",
                  w.belowMin && "bg-danger/5",
                  dragOver === w.index && "bg-accent/10",
                )}
              >
                <div className="border-b border-border px-3 py-2">
                  <p className="text-xs text-muted">Week {w.index + 1}</p>
                  <p className="text-sm font-semibold">{formatShortDate(w.start)}</p>
                </div>
                <dl className="tabular space-y-0.5 border-b border-border px-3 py-2 text-xs">
                  <Row label="In" value={formatMoney(w.inflowCents)} className="text-success" />
                  <Row label="Out" value={formatMoney(w.outflowCents)} className="text-danger" />
                  <Row label="Ending" value={formatMoney(w.endingCents)} className={cn("font-semibold", w.belowMin && "text-danger")} />
                </dl>
                <ul className="min-h-24 space-y-1.5 p-2">
                  {w.items.map((it, i) => (
                    <Chip key={`${it.kind}-${it.id}-${i}`} item={it} weeks={weeks.map((x) => x.start)} weekIndex={w.index} onMove={move} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

function Tile({ label, value, sub, danger }: { label: string; value: string; sub?: string; danger?: boolean }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={cn("tabular mt-1 text-xl font-semibold", danger && "text-danger")}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </Card>
  );
}

function Row({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted">{label}</dt>
      <dd className={className}>{value}</dd>
    </div>
  );
}

function Chip({
  item,
  weeks,
  weekIndex,
  onMove,
}: {
  item: ForecastItem;
  weeks: string[];
  weekIndex: number;
  onMove: (id: string, index: number) => void;
}) {
  const isPayment = item.kind === "payment";
  return (
    <li
      draggable={isPayment}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/payment", item.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className={cn(
        "rounded-md border px-2 py-1.5 text-xs",
        isPayment ? "cursor-grab border-success/40 bg-success/10 active:cursor-grabbing" : "border-border bg-surface-2",
      )}
      title={`${item.label} · ${formatShortDate(item.date)}`}
    >
      <div className="flex items-start gap-1">
        {isPayment && <GripVertical className="mt-0.5 size-3 shrink-0 text-muted" />}
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        <span className={cn("tabular shrink-0 font-medium", item.amountCents < 0 && "text-danger")}>
          {formatMoneyShort(item.amountCents)}
        </span>
      </div>
      {item.kind === "recurring" && <Badge className="mt-1">Recurring</Badge>}
      {isPayment && (
        // Phones can't drag well, so they get a picker too.
        <select
          aria-label="Move to week"
          className="mt-1 w-full rounded border border-border bg-surface px-1 py-0.5 text-[11px] text-muted lg:hidden"
          value={weekIndex}
          onChange={(e) => onMove(item.id, Number(e.target.value))}
        >
          {weeks.map((w, i) => (
            <option key={w} value={i}>
              Move to week of {formatShortDate(w)}
            </option>
          ))}
        </select>
      )}
    </li>
  );
}
