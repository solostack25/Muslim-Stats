import type { ChartSpec, Row } from "./types";
import { toNumber } from "./profile";

export interface Datum {
  label: string;
  value: number;
  series?: string;
}

function reduce(values: number[], agg: ChartSpec["agg"]): number {
  if (agg === "count") return values.length;
  if (!values.length) return 0;
  const sum = values.reduce((a, b) => a + b, 0);
  if (agg === "avg") return sum / values.length;
  return sum; // "sum" and "none" (none + duplicate labels = sum)
}

function dateKey(label: string): number {
  const n = Number(label);
  if (Number.isFinite(n)) return n;
  const t = Date.parse(label);
  return Number.isNaN(t) ? 0 : t;
}

/**
 * All numbers shown in a chart come from here — never from the AI.
 */
export function computeData(rows: Row[], spec: ChartSpec): Datum[] {
  const groups = new Map<string, { label: string; series?: string; values: number[] }>();

  for (const r of rows) {
    const rawLabel = r[spec.x];
    if (rawLabel === null || rawLabel === undefined || rawLabel === "") continue;
    const label = String(rawLabel);
    const series = spec.series ? String(r[spec.series] ?? "Other") : undefined;
    const key = series ? `${series}\u0000${label}` : label;

    let g = groups.get(key);
    if (!g) {
      g = { label, series, values: [] };
      groups.set(key, g);
    }
    if (spec.agg === "count") g.values.push(1);
    else {
      const n = toNumber(spec.y ? r[spec.y] : null);
      if (n !== null) g.values.push(n);
    }
  }

  let data: Datum[] = Array.from(groups.values()).map((g) => ({
    label: g.label,
    series: g.series,
    value: reduce(g.values, spec.agg),
  }));

  if (spec.chart_type === "line") {
    data.sort((a, b) => dateKey(a.label) - dateKey(b.label));
    // Keep at most 5 series (largest totals)
    if (spec.series) {
      const totals = new Map<string, number>();
      data.forEach((d) => totals.set(d.series!, (totals.get(d.series!) ?? 0) + d.value));
      const keep = new Set(
        [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([s]) => s)
      );
      data = data.filter((d) => keep.has(d.series!));
    }
    return data;
  }

  if (spec.sort === "desc") data.sort((a, b) => b.value - a.value);
  if (spec.sort === "asc") data.sort((a, b) => a.value - b.value);

  const defaultLimit = spec.chart_type === "donut" ? 6 : spec.chart_type === "bar" ? 12 : 15;
  const limit = Math.min(spec.limit ?? defaultLimit, 25);

  if (spec.chart_type === "donut" && data.length > limit) {
    const sorted = [...data].sort((a, b) => b.value - a.value);
    const head = sorted.slice(0, limit - 1);
    const rest = sorted.slice(limit - 1).reduce((s, d) => s + d.value, 0);
    return [...head, { label: "All others", value: rest }];
  }
  return data.slice(0, limit);
}

export function formatValue(v: number, fmt: ChartSpec["value_format"] = "number"): string {
  if (fmt === "percent") return `${(Math.abs(v) <= 1 ? v * 100 : v).toFixed(1)}%`;
  const compact = new Intl.NumberFormat("en-US", {
    notation: Math.abs(v) >= 10000 ? "compact" : "standard",
    maximumFractionDigits: Math.abs(v) >= 100 ? 0 : 1,
  }).format(v);
  return fmt === "currency" ? `$${compact}` : compact;
}

/** Callout sentence built from computed data. */
export function calloutText(data: Datum[], spec: ChartSpec): string | null {
  if (!data.length || spec.highlight === "none") return null;
  const f = (v: number) => formatValue(v, spec.value_format);

  if (spec.chart_type === "donut") {
    const total = data.reduce((s, d) => s + d.value, 0);
    const top = [...data].sort((a, b) => b.value - a.value)[0];
    return total ? `${top.label} makes up ${((top.value / total) * 100).toFixed(0)}% of the total` : null;
  }
  if (spec.chart_type === "line") {
    if (spec.series) return null;
    const first = data[0];
    const last = data[data.length - 1];
    if (spec.highlight === "last" && first.value !== 0) {
      const change = ((last.value - first.value) / Math.abs(first.value)) * 100;
      return `${change >= 0 ? "Up" : "Down"} ${Math.abs(change).toFixed(0)}% from ${first.label} to ${last.label}`;
    }
  }
  const pick =
    spec.highlight === "min"
      ? data.reduce((a, b) => (b.value < a.value ? b : a))
      : spec.highlight === "last"
        ? data[data.length - 1]
        : data.reduce((a, b) => (b.value > a.value ? b : a));
  if (/^\d{4}$/.test(pick.label) || !Number.isNaN(Date.parse(pick.label)) && /[-/]/.test(pick.label)) {
    const word = spec.highlight === "min" ? "Lowest" : spec.highlight === "last" ? "Latest" : "Peaks";
    return spec.highlight === "last"
      ? `${word}: ${f(pick.value)} in ${pick.label}`
      : `${word} in ${pick.label} at ${f(pick.value)}`;
  }
  const verb = spec.highlight === "min" ? "is lowest at" : spec.highlight === "last" ? "ends at" : "leads with";
  return `${pick.label} ${verb} ${f(pick.value)}`;
}
