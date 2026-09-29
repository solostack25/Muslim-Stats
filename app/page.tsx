import Link from "next/link";
import Masthead from "@/components/Masthead";
import Chart from "@/components/Chart";
import { publicClient } from "@/lib/published";

export const revalidate = 60;

export default async function Home() {
  const { data: charts } = await publicClient()
    .from("charts")
    .select("id, title, subtitle, source_note, spec, slug, published_at, published_data, is_sample")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(60);

  return (
    <>
      <Masthead />
      <main className="wrap">
        <section className="hero">
          <h1>Data, charted clearly.</h1>
          <p>Short, sourced charts on the numbers that shape how we live and work.</p>
        </section>
        {!charts?.length ? (
          <p className="muted" style={{ paddingBottom: 80 }}>The first charts are on their way.</p>
        ) : (
          <div className="feed">
            {charts.map((c) => (
              <Link key={c.id} href={`/c/${c.slug}`}>
                <figure>
                  <Chart spec={c.spec} data={c.published_data ?? []} title={c.title} subtitle={c.subtitle} sourceNote={c.source_note} />
                  {c.is_sample && <figcaption className="sample-tag">Sample data</figcaption>}
                </figure>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
