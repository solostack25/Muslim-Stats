export type ColumnType = "number" | "date" | "category";

export interface ColumnProfile {
  name: string;
  type: ColumnType;
  distinct: number;
  empty: number;
  sample: (string | number | null)[];
  min?: number;
  max?: number;
}

export type ChartType = "ranked_bar" | "bar" | "line" | "donut";
export type Agg = "sum" | "avg" | "count" | "none";
export type Highlight = "max" | "min" | "last" | "none";

export interface ChartSpec {
  chart_type: ChartType;
  x: string;              // category or date column
  y?: string;             // numeric column (omit when agg = count)
  agg: Agg;
  series?: string;        // optional grouping column (line only)
  sort: "desc" | "asc" | "none";
  limit?: number;
  highlight: Highlight;
  value_format?: "number" | "percent" | "currency";
}

export interface ChartRecord {
  id: string;
  dataset_id: string;
  status: "draft" | "approved" | "rejected" | "published";
  chart_type: ChartType;
  spec: ChartSpec;
  title: string;
  subtitle: string | null;
  source_note: string | null;
  slug: string | null;
  published_at: string | null;
  body_md: string | null;
  takeaways: string[];
  source_url: string | null;
}

export type Row = Record<string, unknown>;

export const CHART_TYPES: ChartType[] = ["ranked_bar", "bar", "line", "donut"];
