import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
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

/** Refresh cached public pages so publish/unpublish/edits show up immediately. */
function refreshPublic(slug?: string | null) {
  revalidatePath("/");
  if (slug) {
    revalidatePath(`/c/${slug}`);
    revalidatePath(`/embed/${slug}`);
  }
}

const EDITABLE = ["title", "subtitle", "source_note", "chart_type", "spec", "status", "body_md", "takeaways", "source_url"] as const;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user, isStaff } = await getStaff();
  if (!user || !isStaff) return NextResponse.json({ error: "You don't have access." }, { status: 403 });

  const body = await req.json();
  const update: Record<string, unknown> = {};
  for (const k of EDITABLE) if (k in body) update[k] = body[k];

  if ("takeaways" in update) {
    const list = Array.isArray(update.takeaways) ? update.takeaways : [];
    update.takeaways = list.map((t) => String(t).trim()).filter(Boolean).slice(0, 8).map((t) => t.slice(0, 300));
  }
  if ("body_md" in update) {
    update.body_md = update.body_md ? String(update.body_md).slice(0, 50000) : null;
  }
  if ("source_url" in update) {
    const url = update.source_url ? String(update.source_url).trim() : "";
    if (url && !/^https?:\/\//i.test(url)) {
      return NextResponse.json({ error: "The source link must start with http:// or https://" }, { status: 400 });
    }
    update.source_url = url || null;
  }
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
    refreshPublic(withSnap.slug);
    return NextResponse.json(withSnap);
  }
  refreshPublic(data.slug);
  return NextResponse.json(data);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user, isStaff } = await getStaff();
  if (!user || !isStaff) return NextResponse.json({ error: "You don't have access." }, { status: 403 });
  const { data: gone, error } = await supabase.from("charts").delete().eq("id", id).select("slug").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  refreshPublic(gone?.slug);
  return NextResponse.json({ ok: true });
}
