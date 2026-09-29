import { createClient as createSb } from "@supabase/supabase-js";

/** Anonymous client for public pages: RLS only exposes published charts. */
export function publicClient() {
  return createSb(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
}

export async function getPublishedChart(slug: string) {
  const { data } = await publicClient()
    .from("charts")
    .select("id, title, subtitle, source_note, spec, slug, published_at, published_data")
    .eq("slug", slug)
    .eq("status", "published")
    .single();
  return data;
}
