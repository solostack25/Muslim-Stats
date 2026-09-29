import { NextResponse } from "next/server";
import { getStaff } from "@/lib/supabase/server";

const MAX_ROWS = 5000;

export async function POST(req: Request) {
  const { supabase, user, isStaff } = await getStaff();
  if (!user || !isStaff) return NextResponse.json({ error: "You don't have access to upload data." }, { status: 403 });

  const body = await req.json();
  const rows = Array.isArray(body.rows) ? body.rows.slice(0, MAX_ROWS) : [];
  if (!rows.length) return NextResponse.json({ error: "The sheet has no rows." }, { status: 400 });

  const { data, error } = await supabase
    .from("datasets")
    .insert({
      owner_id: user.id,
      name: String(body.name || body.file_name || "Untitled dataset").slice(0, 200),
      file_name: body.file_name ?? null,
      columns: body.columns ?? [],
      rows,
      row_count: rows.length,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}
