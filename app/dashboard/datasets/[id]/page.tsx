import { notFound } from "next/navigation";
import Link from "next/link";
import Masthead from "@/components/Masthead";
import { getStaff } from "@/lib/supabase/server";
import Gallery from "./Gallery";

export const dynamic = "force-dynamic";

export default async function DatasetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, isStaff } = await getStaff();
  if (!isStaff) notFound();

  const { data: ds } = await supabase
    .from("datasets")
    .select("id, name, columns, rows, row_count")
    .eq("id", id)
    .single();
  if (!ds) notFound();

  const { data: charts } = await supabase
    .from("charts")
    .select("*")
    .eq("dataset_id", id)
    .order("created_at", { ascending: true });

  return (
    <>
      <Masthead dashboard />
      <main className="wrap dash">
        <p><Link href="/dashboard">All datasets</Link></p>
        <div className="dash-head">
          <div>
            <h1>{ds.name}</h1>
            <p className="muted">{ds.row_count.toLocaleString()} rows. Approve the charts worth keeping, then publish them.</p>
          </div>
        </div>
        <Gallery datasetId={ds.id} columns={ds.columns} rows={ds.rows} initial={charts ?? []} />
      </main>
    </>
  );
}
