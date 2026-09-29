import { NextResponse } from "next/server";
import { getStaff } from "@/lib/supabase/server";
import { CHART_TYPES, type ChartSpec, type ColumnProfile, type Row } from "@/lib/charts/types";
import { hasValues, signature, suggestByRules } from "@/lib/charts/rules";

export const maxDuration = 60;

const SYSTEM = `You are a data editor at a publication that makes clean, shareable infographics.
Given a dataset summary, propose charts that tell clear, interesting stories.

Respond with ONLY a JSON array, no prose, no code fences. Each item:
{
  "chart_type": "ranked_bar" | "bar" | "line" | "donut",
  "x": "<column name: category or date>",
  "y": "<numeric column name, omit if agg is count>",
  "agg": "sum" | "avg" | "count" | "none",
  "series": "<optional category column, line charts only, <=5 values>",
  "sort": "desc" | "asc" | "none",
  "limit": <optional integer 3-20>,
  "highlight": "max" | "min" | "last" | "none",
  "value_format": "number" | "percent" | "currency",
  "title": "<headline, max 70 chars, states the takeaway>",
  "subtitle": "<one sentence of context, max 120 chars>"
}

Rules:
- Use exact column names from the summary.
- NEVER put specific numbers, totals or percentages in titles or subtitles; the software computes and displays all values.
- ranked_bar for comparing many categories; bar for <=12 categories or years; line only when x is a date/year column; donut only for parts of a whole with <=6 meaningful groups.
- Use "last" highlight for line charts showing change over time.
- Prefer variety: different angles and chart types.`;

function validate(raw: any, cols: ColumnProfile[]): (ChartSpec & { title: string; subtitle?: string }) | null {
  const byName = new Map(cols.map((c) => [c.name, c]));
  if (!raw || !CHART_TYPES.includes(raw.chart_type)) return null;
  const x = byName.get(raw.x);
  if (!x) return null;
  const agg = ["sum", "avg", "count", "none"].includes(raw.agg) ? raw.agg : "sum";
  if (agg !== "count") {
    const y = byName.get(raw.y);
    if (!y || y.type !== "number") return null;
  }
  if (raw.chart_type === "line" && x.type !== "date") return null;
  const series = raw.chart_type === "line" && byName.has(raw.series) ? raw.series : undefined;
  if (typeof raw.title !== "string" || !raw.title.trim()) return null;

  return {
    chart_type: raw.chart_type,
    x: raw.x,
    y: agg === "count" ? undefined : raw.y,
    agg,
    series,
    sort: ["desc", "asc", "none"].includes(raw.sort) ? raw.sort : "desc",
    limit: Number.isInteger(raw.limit) ? Math.min(Math.max(raw.limit, 3), 20) : undefined,
    highlight: ["max", "min", "last", "none"].includes(raw.highlight) ? raw.highlight : "max",
    value_format: ["number", "percent", "currency"].includes(raw.value_format) ? raw.value_format : "number",
    title: raw.title.trim().slice(0, 90),
    subtitle: typeof raw.subtitle === "string" ? raw.subtitle.trim().slice(0, 160) : undefined,
  };
}

export async function POST(req: Request) {
  const { supabase, user, isStaff } = await getStaff();
  if (!user || !isStaff) return NextResponse.json({ error: "You don't have access." }, { status: 403 });

  const { datasetId, count = 6 } = await req.json();
  const { data: ds, error } = await supabase
    .from("datasets")
    .select("id, name, columns, rows, row_count")
    .eq("id", datasetId)
    .single();
  if (error || !ds) return NextResponse.json({ error: "Dataset not found." }, { status: 404 });

  const columns = ds.columns as ColumnProfile[];
  const rows = ds.rows as Row[];
  const wanted = Math.min(Math.max(Number(count) || 6, 2), 12);

  // Skip ideas that already exist for this dataset (any status)
  const { data: existing } = await supabase.from("charts").select("spec").eq("dataset_id", ds.id);
  const taken = new Set((existing ?? []).map((c: { spec: ChartSpec }) => signature(c.spec)));

  let valid: (ChartSpec & { title: string; subtitle?: string })[] = [];

  if (process.env.ANTHROPIC_API_KEY) {
    const ai = await suggestWithAI(ds, columns, wanted);
    if ("error" in ai) return NextResponse.json({ error: ai.error }, { status: 502 });
    valid = ai.proposals.map((p) => validate(p, columns)).filter(Boolean) as typeof valid;
  }

  // Rules: the default when there is no API key, and a top-up if AI returns too few
  if (valid.length < wanted) {
    const fromRules = suggestByRules(columns, rows).filter((s) => hasValues(rows, s.y));
    const have = new Set([...taken, ...valid.map(signature)]);
    for (const s of fromRules) {
      if (valid.length >= wanted) break;
      if (!have.has(signature(s))) {
        valid.push(s);
        have.add(signature(s));
      }
    }
  }

  valid = valid.filter((v) => !taken.has(signature(v)));
  if (!valid.length) {
    return NextResponse.json(
      { error: "There are no new chart ideas for this dataset. Edit an existing chart to try other columns." },
      { status: 422 }
    );
  }
  const inserts = valid.map((v) => {
    const { title, subtitle, ...spec } = v;
    return {
      dataset_id: ds.id,
      owner_id: user.id,
      status: "draft",
      chart_type: spec.chart_type,
      spec,
      title,
      subtitle: subtitle ?? null,
    };
  });

  const { error: insErr } = await supabase.from("charts").insert(inserts);
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  return NextResponse.json({ created: inserts.length });
}

async function suggestWithAI(
  ds: { name: string; rows: unknown; row_count: number },
  columns: ColumnProfile[],
  count: number
): Promise<{ proposals: unknown[] } | { error: string }> {
  const summary = {
    dataset: ds.name,
    row_count: ds.row_count,
    columns: columns.map((c) => ({
      name: c.name, type: c.type, distinct: c.distinct, sample: c.sample, min: c.min, max: c.max,
    })),
    sample_rows: (ds.rows as unknown[]).slice(0, 12),
  };

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5",
      max_tokens: 3000,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Propose ${count} charts for this dataset:\n${JSON.stringify(summary)}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    return { error: `Chart suggestions failed: ${detail.slice(0, 300)}` };
  }

  const json = await res.json();
  const text: string = (json.content ?? [])
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("\n")
    .replace(/```json|```/g, "")
    .trim();

  let proposals: unknown[] = [];
  try {
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    proposals = JSON.parse(text.slice(start, end + 1));
  } catch {
    return { error: "The suggestions came back in an unexpected format. Try again." };
  }

  return { proposals };
}
