import type { ColumnProfile, ColumnType, Row } from "./types";

export function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const cleaned = String(v).replace(/[,$%\s]/g, "").replace(/^\((.*)\)$/, "-$1");
  if (cleaned === "" || cleaned === "-") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function looksLikeDate(v: unknown): boolean {
  if (v instanceof Date) return true;
  if (typeof v !== "string") return false;
  if (!/[-/]/.test(v) && !/^\d{4}$/.test(v)) return false;
  return !Number.isNaN(Date.parse(v));
}

/** Detect column types and basic stats from parsed rows. */
export function profileColumns(rows: Row[]): ColumnProfile[] {
  const names = Array.from(
    rows.slice(0, 200).reduce((set, r) => {
      Object.keys(r).forEach((k) => set.add(k));
      return set;
    }, new Set<string>())
  );

  return names.map((name) => {
    const values = rows.map((r) => r[name]);
    const filled = values.filter((v) => v !== null && v !== undefined && v !== "");
    const nums = filled.map(toNumber).filter((n): n is number => n !== null);
    const dates = filled.filter(looksLikeDate);

    let type: ColumnType = "category";
    const isYearLike = /year|yr/i.test(name) && nums.every((n) => n >= 1800 && n <= 2200);
    if (filled.length && (dates.length / filled.length >= 0.8 || isYearLike)) type = "date";
    else if (filled.length && nums.length / filled.length >= 0.8) type = "number";

    const profile: ColumnProfile = {
      name,
      type,
      distinct: new Set(filled.map((v) => String(v))).size,
      empty: values.length - filled.length,
      sample: filled.slice(0, 5).map((v) => (typeof v === "number" ? v : String(v))),
    };
    if (type === "number" && nums.length) {
      profile.min = Math.min(...nums);
      profile.max = Math.max(...nums);
    }
    return profile;
  });
}
