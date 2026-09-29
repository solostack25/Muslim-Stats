import type { ChartSpec } from "./types";
import { formatValue, type Datum } from "./compute";

function pct(part: number, whole: number) {
  return whole ? `${((part / whole) * 100).toFixed(0)}%` : "–";
}
function isTime(label: string) {
  return /^\d{4}$/.test(label) || (/[-/]/.test(label) && !Number.isNaN(Date.parse(label)));
}
function measure(spec: ChartSpec) {
  if (spec.agg === "count" || !spec.y) return "the number of records";
  const name = spec.y.replace(/\s*\([^)]*\)\s*/g, " ").replace(/_+/g, " ").trim().toLowerCase();
  return spec.agg === "avg" ? `average ${name}` : `total ${name}`;
}
function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function list(items: string[]) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/**
 * Factual sentences built from the chart's computed values.
 * The author adds the context; every number here matches the chart exactly.
 */
export function summarize(data: Datum[], spec: ChartSpec): { takeaways: string[]; paragraph: string } {
  const f = (v: number) => formatValue(v, spec.value_format);
  if (!data.length) return { takeaways: [], paragraph: "" };

  const total = data.reduce((s, d) => s + d.value, 0);
  const additive = spec.agg === "sum" || spec.agg === "count";

  // Multi-series trend
  if (spec.chart_type === "line" && spec.series) {
    const series = [...new Set(data.map((d) => d.series!))];
    const labels = [...new Set(data.map((d) => d.label))];
    const first = labels[0];
    const last = labels[labels.length - 1];
    const stats = series.map((s) => {
      const pts = data.filter((d) => d.series === s);
      const a = pts.find((p) => p.label === first)?.value ?? pts[0].value;
      const b = pts.find((p) => p.label === last)?.value ?? pts[pts.length - 1].value;
      return { s, a, b, change: a ? (b - a) / Math.abs(a) : 0 };
    });
    const leader = [...stats].sort((x, y) => y.b - x.b)[0];
    const fastest = [...stats].sort((x, y) => y.change - x.change)[0];
    const t = [
      `${leader.s} was highest in ${last} at ${f(leader.b)}.`,
      `${fastest.s} grew fastest, ${fastest.change >= 0 ? "up" : "down"} ${Math.abs(fastest.change * 100).toFixed(0)}% from ${first} to ${last}.`,
      `The chart compares ${series.length} groups from ${first} to ${last}.`,
    ];
    return { takeaways: t, paragraph: t.slice(0, 2).join(" ") };
  }

  // Single-series trend (line, or columns by year)
  if ((spec.chart_type === "line" || spec.chart_type === "bar") && data.every((d) => isTime(d.label))) {
    const first = data[0];
    const last = data[data.length - 1];
    const peak = data.reduce((a, b) => (b.value > a.value ? b : a));
    const low = data.reduce((a, b) => (b.value < a.value ? b : a));
    const change = first.value ? (last.value - first.value) / Math.abs(first.value) : 0;
    const m = measure(spec);
    const t = [
      `${cap(m)} ${change >= 0 ? "rose" : "fell"} ${Math.abs(change * 100).toFixed(0)}%, from ${f(first.value)} in ${first.label} to ${f(last.value)} in ${last.label}.`,
      peak.label === last.label
        ? `${last.label} was the highest point in the period.`
        : `The peak came in ${peak.label} at ${f(peak.value)}.`,
    ];
    if (low.label !== first.label && low.label !== last.label) {
      t.push(`The lowest point was ${low.label} at ${f(low.value)}.`);
    }
    return { takeaways: t, paragraph: t.join(" ") };
  }

  // Parts of a whole
  if (spec.chart_type === "donut") {
    const sorted = [...data].sort((a, b) => b.value - a.value);
    const [a, b] = sorted;
    const small = sorted[sorted.length - 1];
    const t = [
      `${a.label} makes up ${pct(a.value, total)} of the total (${f(a.value)}).`,
      b ? `${a.label} and ${b.label} together account for ${pct(a.value + b.value, total)}.` : "",
      `${small.label} is the smallest share at ${pct(small.value, total)}.`,
    ].filter(Boolean);
    return { takeaways: t, paragraph: `Across ${data.length} groups totaling ${f(total)}: ${t.join(" ")}` };
  }

  // Rankings
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const top = sorted.slice(0, 3);
  const bottom = sorted[sorted.length - 1];
  const t = [
    `${top[0].label} ranks first in ${measure(spec)} at ${f(top[0].value)}${top[1] ? `, followed by ${list(top.slice(1).map((d) => `${d.label} (${f(d.value)})`))}` : ""}.`,
  ];
  if (additive && top.length >= 3 && total > 0 && sorted.every((d) => d.value >= 0)) {
    t.push(`The top three account for ${pct(top.reduce((s, d) => s + d.value, 0), total)} of the ${f(total)} total shown.`);
  }
  if (sorted.length > 1) {
    t.push(
      bottom.value > 0 && top[0].value / bottom.value >= 1.5
        ? `${bottom.label} ranks last at ${f(bottom.value)}; ${top[0].label}'s figure is about ${(top[0].value / bottom.value).toFixed(1).replace(/\.0$/, "")} times as large.`
        : `${bottom.label} ranks last at ${f(bottom.value)}.`
    );
  }
  return { takeaways: t, paragraph: t.join(" ") };
}
