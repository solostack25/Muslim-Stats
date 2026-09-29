import { NextResponse } from "next/server";
import { getStaff } from "@/lib/supabase/server";
import { computeData } from "@/lib/charts/compute";
import type { ChartSpec, Row } from "@/lib/charts/types";

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

const EDITABLE = ["title", "subtitle", "source_note", "chart_type", "spec", "status"] as const;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user, isStaff } = await getStaff();
  if (!user || !isStaff) return NextResponse.json({ error: "You don't have access." }, { status: 403 });

  const body = await req.json();
  const update: Record<string, unknown> = {};
  for (const k of EDITABLE) if (k in body) update[k] = body[k];
  if (update.spec && typeof update.spec === "object" && "chart_type" in (update.spec as object)) {
    update.chart_type = (update.spec as { chart_type: string }).chart_type;
  }

  if (update.status === "published") {
    const { data: current } = await supabase.from("charts").select("title, slug, status").eq("id", id).single();
    if (!current) return NextResponse.json({ error: "Chart not found." }, { status: 404 });
    if (current.status !== "approved" && current.status !== "published") {
      return NextResponse.json({ error: "Approve the chart before publishing it." }, { status: 400 });
    }
    update.slug = current.slug ?? `${slugify(String(update.title ?? current.title))}-${id.slice(0, 6)}`;
    update.published_at = new Date().toISOString();
  }
  if (update.status === "draft" || update.status === "approved" || update.status === "rejected") {
    update.published_at = null;
  }

  if (update.status && update.status !== "published") update.published_data = null;

  const { data, error } = await supabase.from("charts").update(update).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Published charts get a frozen copy of their computed values for the public site.
  if (data.status === "published") {
    const { data: ds } = await supabase.from("datasets").select("rows").eq("id", data.dataset_id).single();
    const snapshot = computeData((ds?.rows ?? []) as Row[], data.spec as ChartSpec);
    const { data: withSnap, error: snapErr } = await supabase
      .from("charts").update({ published_data: snapshot }).eq("id", id).select("*").single();
    if (snapErr) return NextResponse.json({ error: snapErr.message }, { status: 500 });
    return NextResponse.json(withSnap);
  }
  return NextResponse.json(data);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user, isStaff } = await getStaff();
  if (!user || !isStaff) return NextResponse.json({ error: "You don't have access." }, { status: 403 });
  const { error } = await supabase.from("charts").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
