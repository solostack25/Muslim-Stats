import Link from "next/link";
import Masthead from "@/components/Masthead";
import { getStaff } from "@/lib/supabase/server";
import Uploader from "./Uploader";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const { supabase, user, isStaff } = await getStaff();

  if (!isStaff) {
    return (
      <>
        <Masthead dashboard />
        <main className="wrap dash">
          <h2>Your account is waiting for access</h2>
          <p className="muted">
            Signed in as {user?.email}. An admin needs to give this account editor access before you can upload data.
          </p>
        </main>
      </>
    );
  }

  const { data: datasets } = await supabase
    .from("datasets")
    .select("id, name, row_count, created_at, charts(count)")
    .order("created_at", { ascending: false });

  return (
    <>
      <Masthead dashboard />
      <main className="wrap dash">
        <div className="dash-head">
          <div>
            <h1>Datasets</h1>
            <p className="muted">Upload a spreadsheet, review the suggested charts, and publish the ones you approve.</p>
          </div>
        </div>

        <Uploader />

        <section className="panel">
          <h3>Your datasets</h3>
          {!datasets?.length ? (
            <p className="muted">Nothing here yet. Upload an Excel or CSV file above to get started.</p>
          ) : (
            <ul className="list">
              {datasets.map((d: any) => (
                <li key={d.id}>
                  <Link href={`/dashboard/datasets/${d.id}`}>{d.name}</Link>
                  <span className="muted">
                    {d.row_count.toLocaleString()} rows, {d.charts?.[0]?.count ?? 0} charts
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
