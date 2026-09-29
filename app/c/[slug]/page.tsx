import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Masthead from "@/components/Masthead";
import Chart from "@/components/Chart";
import { getPublishedChart } from "@/lib/published";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const c = await getPublishedChart(slug);
  if (!c) return {};
  return { title: c.title, description: c.subtitle ?? undefined };
}

export default async function ChartPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = await getPublishedChart(slug);
  if (!c) notFound();

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const embed = `<iframe src="${site}/embed/${c.slug}" width="100%" height="640" style="border:0" title="${c.title.replace(/"/g, "&quot;")}"></iframe>`;

  return (
    <>
      <Masthead />
      <main className="chart-page">
        <div className="frame">
          <Chart spec={c.spec} data={c.published_data ?? []} title={c.title} subtitle={c.subtitle} sourceNote={c.source_note} />
        </div>
        {c.published_at && (
          <p className="muted">Published {new Date(c.published_at).toLocaleDateString("en-US", { dateStyle: "long" })}</p>
        )}
        <div className="embed-box">
          <label htmlFor="embed">Embed this chart</label>
          <textarea id="embed" className="input" readOnly defaultValue={embed} />
        </div>
      </main>
    </>
  );
}
