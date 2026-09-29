import type { ChartSpec, ColumnProfile, Row } from "./types";
import { toNumber } from "./profile";

export interface Suggestion extends ChartSpec {
  title: string;
  subtitle?: string;
}

const CURRENCY = /\$|donation|revenue|price|cost|amount|sales|income|spend|budget|salary|funding|dollars/i;
const PERCENT = /%|percent|pct|rate|share|ratio/i;

/** "Donations ($)" -> "Donations" */
function clean(name: string) {
  return name.replace(/\s*\([^)]*\)\s*/g, " ").replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
}
/** Lowercase for use mid-sentence, keeping acronyms like "USA" or "GDP". */
function lower(name: string) {
  return clean(name)
    .split(" ")
    .map((w) => (w.length > 1 && w === w.toUpperCase() && /[A-Z]/.test(w) ? w : w.toLowerCase()))
    .join(" ");
}
function upper(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function measureFormat(col: ColumnProfile): ChartSpec["value_format"] {
  if (CURRENCY.test(col.name)) return "currency";
  if (PERCENT.test(col.name)) return "percent";
  return "number";
}

function dateRange(rows: Row[], col: string): string | null {
  const vals = rows.map((r) => r[col]).filter((v) => v !== null && v !== undefined && v !== "").map(String);
  if (!vals.length) return null;
  const key = (s: string) => (Number.isFinite(Number(s)) ? Number(s) : Date.parse(s));
  const sorted = [...new Set(vals)].sort((a, b) => key(a) - key(b));
  return sorted.length > 1 ? `${sorted[0]} to ${sorted[sorted.length - 1]}` : sorted[0];
}

export function signature(s: Pick<ChartSpec, "chart_type" | "x" | "y" | "agg" | "series">) {
  return [s.chart_type, s.x, s.y ?? "", s.agg, s.series ?? ""].join("|");
}

/**
 * Deterministic chart ideas from column types. No AI, no cost.
 * Returned in priority order; callers skip ones already created.
 */
export function suggestByRules(columns: ColumnProfile[], rows: Row[]): Suggestion[] {
  const n = rows.length;
  const nums = columns.filter((c) => c.type === "number" && (c.distinct ?? 0) > 1);
  const dates = columns.filter((c) => c.type === "date" && (c.distinct ?? 0) > 1);
  // Skip ID-like columns (almost every value unique)
  const cats = columns.filter(
    (c) => c.type === "category" && c.distinct >= 2 && !(c.distinct > 30 && c.distinct > n * 0.9)
  );

  const date = dates[0];
  const span = date ? dateRange(rows, date.name) : null;
  const spanNote = span && span.includes(" to ") ? `, ${span}` : "";

  // Measures where summing makes no sense get averaged instead
  const aggFor = (c: ColumnProfile): ChartSpec["agg"] => (PERCENT.test(c.name) ? "avg" : "sum");
  const aggWord = (c: ColumnProfile) => (aggFor(c) === "avg" ? "Average" : "Total");

  // Money columns tend to be the headline measure, so they go first.
  const measures = [...nums].sort(
    (a, b) => Number(measureFormat(b) === "currency") - Number(measureFormat(a) === "currency")
  );
  const primaryCat = [...cats].filter((c) => c.distinct >= 3).sort((a, b) => b.distinct - a.distinct)[0];
  const smallCat = cats.filter((c) => c.distinct >= 2 && c.distinct <= 6).sort((a, b) => a.distinct - b.distinct)[0];
  const otherCats = cats.filter((c) => c.distinct >= 3 && c !== primaryCat);

  const ranked = (m: ColumnProfile, c: ColumnProfile): Suggestion => ({
    chart_type: "ranked_bar", x: c.name, y: m.name, agg: aggFor(m), sort: "desc",
    limit: c.distinct > 15 ? 15 : undefined, highlight: "max", value_format: measureFormat(m),
    title: `${upper(lower(m.name))} by ${lower(c.name)}`,
    subtitle: `${aggWord(m)} ${lower(m.name)} by ${lower(c.name)}${spanNote}${c.distinct > 15 ? ", top 15" : ""}`,
  });

  // Each "kind" is one way of looking at the data, with one idea per measure.
  const kinds: Suggestion[][] = [];

  if (primaryCat) kinds.push(measures.map((m) => ranked(m, primaryCat)));
  if (date) {
    kinds.push(measures.map((m) => ({
      chart_type: "line", x: date.name, y: m.name, agg: aggFor(m), sort: "none", highlight: "last",
      value_format: measureFormat(m),
      title: `${upper(lower(m.name))} over time`,
      subtitle: `${aggWord(m)} ${lower(m.name)} by ${lower(date.name)}`,
    })));
  }
  if (smallCat) {
    kinds.push(measures.filter((m) => aggFor(m) === "sum").map((m) => ({
      chart_type: "donut", x: smallCat.name, y: m.name, agg: "sum", sort: "desc", highlight: "max",
      value_format: measureFormat(m),
      title: `Share of ${lower(m.name)} by ${lower(smallCat.name)}`,
      subtitle: `Each ${lower(smallCat.name)}'s share of total ${lower(m.name)}${spanNote}`,
    })));
  }
  if (date && date.distinct <= 12) {
    kinds.push(measures.map((m) => ({
      chart_type: "bar", x: date.name, y: m.name, agg: aggFor(m), sort: "none", highlight: "max",
      value_format: measureFormat(m),
      title: `${upper(lower(m.name))} by ${lower(date.name)}`,
      subtitle: `${aggWord(m)} ${lower(m.name)} each ${lower(date.name)}`,
    })));
  }
  if (date && smallCat && smallCat.distinct <= 5) {
    kinds.push(measures.filter((m) => aggFor(m) === "sum").map((m) => ({
      chart_type: "line", x: date.name, y: m.name, agg: "sum", series: smallCat.name, sort: "none",
      highlight: "none", value_format: measureFormat(m),
      title: `${upper(lower(m.name))} over time by ${lower(smallCat.name)}`,
      subtitle: `${aggWord(m)} ${lower(m.name)} by ${lower(date.name)}, one line per ${lower(smallCat.name)}`,
    })));
  }
  for (const c of otherCats) kinds.push(measures.map((m) => ranked(m, c)));

  // Row counts per category: the main idea when there are no numeric columns,
  // otherwise offered last since counts are usually the least interesting view.
  const counts: Suggestion[] = cats.filter((c) => c.distinct >= 3 && c.distinct <= 60).map((c) => ({
      chart_type: "ranked_bar", x: c.name, agg: "count", sort: "desc",
      limit: c.distinct > 15 ? 15 : undefined, highlight: "max", value_format: "number",
      title: `Records by ${lower(c.name)}`,
      subtitle: `Number of rows for each ${lower(c.name)}`,
    }));
  if (!measures.length) kinds.push(counts);

  // Rotate each kind so different kinds start on different measures,
  // then take one idea from each kind in turn. The first batch mixes
  // chart types and measures instead of repeating one pattern.
  const rotated = kinds
    .filter((k) => k.length)
    .map((k, i) => [...k.slice(i % k.length), ...k.slice(0, i % k.length)]);

  const out: Suggestion[] = [];
  const seen = new Set<string>();
  const maxLen = Math.max(0, ...rotated.map((k) => k.length));
  for (let i = 0; i < maxLen; i++) {
    for (const k of rotated) {
      const s = k[i];
      if (!s) continue;
      const sig = signature(s);
      if (!seen.has(sig)) {
        seen.add(sig);
        out.push(s);
      }
    }
  }
  if (measures.length) out.push(...counts.filter((s) => !seen.has(signature(s))));
  return out;
}

/** Guard against measures with no usable numbers in the data. */
export function hasValues(rows: Row[], col?: string) {
  if (!col) return true;
  return rows.some((r) => toNumber(r[col]) !== null);
}
