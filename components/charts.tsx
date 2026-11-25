"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMonth, formatShortDate } from "@/lib/dates";
import { formatMoney, formatMoneyShort } from "@/lib/money";

const axis = { fontSize: 12, fill: "var(--muted)" };
const tooltipStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--text)",
  fontSize: 12,
};

export function MonthlyBarChart({
  data,
  height = 220,
}: {
  data: { month: string; cents: number }[];
  height?: number | `${number}%`;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="month" tickFormatter={formatMonth} tick={axis} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={(v) => formatMoneyShort(v)} tick={axis} axisLine={false} tickLine={false} width={52} />
        <Tooltip
          cursor={{ fill: "var(--surface-2)" }}
          contentStyle={tooltipStyle}
          labelFormatter={(m) => formatMonth(String(m))}
          formatter={(v) => [formatMoney(Number(v)), "Cost"]}
        />
        <Bar dataKey="cents" fill="var(--brand-primary)" radius={[4, 4, 0, 0]} maxBarSize={40} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CashLineChart({
  data,
  minCents,
  height = 260,
}: {
  data: { start: string; endingCents: number }[];
  minCents: number;
  height?: number | `${number}%`;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="start" tickFormatter={formatShortDate} tick={axis} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={(v) => formatMoneyShort(v)} tick={axis} axisLine={false} tickLine={false} width={52} />
        <Tooltip
          contentStyle={tooltipStyle}
          labelFormatter={(d) => `Week of ${formatShortDate(String(d))}`}
          formatter={(v) => [formatMoney(Number(v)), "Ending cash"]}
        />
        {minCents > 0 && (
          <ReferenceLine
            y={minCents}
            stroke="var(--brand-danger)"
            strokeDasharray="4 4"
            label={{ value: "Minimum", position: "insideTopLeft", fill: "var(--brand-danger)", fontSize: 11 }}
          />
        )}
        <Line
          type="monotone"
          dataKey="endingCents"
          stroke="var(--brand-primary)"
          strokeWidth={2.5}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
