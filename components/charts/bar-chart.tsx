"use client";

import { cn, formatCurrency } from "@/lib/utils";

export interface BarSeries {
  key: string;
  label: string;
  color: string;
}

/** Gráfico de barras agrupadas leve (CSS puro), com tooltip nativo. */
export function GroupedBarChart({
  data,
  series,
  height = 200,
  format = formatCurrency,
}: {
  data: { label: string; values: Record<string, number> }[];
  series: BarSeries[];
  height?: number;
  format?: (v: number) => string;
}) {
  const max = Math.max(1, ...data.flatMap((d) => series.map((s) => d.values[s.key] ?? 0)));
  return (
    <div>
      <div className="flex items-end gap-2 sm:gap-4" style={{ height }}>
        {data.map((d) => (
          <div key={d.label} className="flex h-full flex-1 flex-col justify-end">
            <div className="flex h-full items-end justify-center gap-1">
              {series.map((s) => {
                const v = d.values[s.key] ?? 0;
                return (
                  <div
                    key={s.key}
                    title={`${s.label}: ${format(v)}`}
                    className={cn("w-full max-w-7 rounded-t-md transition-all hover:opacity-80", s.color)}
                    style={{ height: `${(v / max) * 100}%`, minHeight: v > 0 ? 3 : 0 }}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2 border-t border-slate-100 pt-2 sm:gap-4">
        {data.map((d) => (
          <p key={d.label} className="flex-1 text-center text-[11px] font-medium capitalize text-slate-500">
            {d.label}
          </p>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-4">
        {series.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className={cn("size-2.5 rounded-sm", s.color)} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Barras horizontais com rótulo e valor */
export function HorizontalBars({
  items,
  format = (v: number) => String(v),
  color = "bg-ocean-500",
}: {
  items: { label: string; value: number; hint?: string }[];
  format?: (v: number) => string;
  color?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="space-y-3">
      {items.map((i) => (
        <div key={i.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-slate-700">{i.label}</span>
            <span className="shrink-0 font-semibold tabular-nums text-slate-900">
              {format(i.value)}
              {i.hint && <span className="ml-1 text-xs font-normal text-slate-400">{i.hint}</span>}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className={cn("h-full rounded-full", color)} style={{ width: `${(i.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
