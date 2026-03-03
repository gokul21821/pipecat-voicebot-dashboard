"use client";

interface MetricsPanelProps {
  turnLatencies: number[];
  lastTurnLatencyMs: number | null;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = lo + 1;
  const frac = idx - lo;
  if (hi >= sorted.length) return sorted[lo];
  return sorted[lo] + frac * (sorted[hi] - sorted[lo]);
}

export function MetricsPanel({ turnLatencies, lastTurnLatencyMs }: MetricsPanelProps) {
  const sorted = [...turnLatencies].sort((a, b) => a - b);
  const p50 = turnLatencies.length > 0 ? Math.round(percentile(sorted, 50)) : null;
  const p95 = turnLatencies.length > 0 ? Math.round(percentile(sorted, 95)) : null;

  return (
    <div className="rounded-2xl border border-zinc-100 bg-zinc-50/50 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-3">
        Client-side latency (user stop → bot start)
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCell label="Last turn" value={lastTurnLatencyMs} unit="ms" />
        <MetricCell label="P50" value={p50} unit="ms" />
        <MetricCell label="P95" value={p95} unit="ms" />
        <MetricCell label="Turns" value={turnLatencies.length} />
      </div>
    </div>
  );
}

function MetricCell({
  label,
  value,
  unit,
}: {
  label: string;
  value: number | null;
  unit?: string;
}) {
  return (
    <div>
      <span className="text-[10px] font-medium text-zinc-500 block">{label}</span>
      <span className="text-sm font-bold text-zinc-800">
        {value !== null ? `${value}${unit ?? ""}` : "—"}
      </span>
    </div>
  );
}
