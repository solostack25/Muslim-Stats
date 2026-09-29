import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Masthead from "@/components/Masthead";
import Chart from "@/components/Chart";
import { getPublishedChart } from "@/lib/published";
import { renderMarkdown } from "@/lib/markdown";
import { formatValue, type Datum } from "@/lib/charts/compute";
import type { ChartSpec } from "@/lib/charts/types";

export const revalidate = 300;

function plain(md: string) {
  return md.replace(/[#*_[\]()>-]/g, "").replace(/\s+/g, " ").trim();
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const c = await getPublishedChart(slug);
  if (!c) return {};
  const description = (c.takeaways?.[0] as string | undefined) ?? c.subtitle ?? (c.body_md ? plain(c.body_md).slice(0, 160) : undefined);
  return {
    title: c.title,
    description,
    openGraph: { title: c.title, description },
    // Sample content uses fictional data: keep it out of search results
    robots: c.is_sample ? { index: false, follow: false } : undefined,
  };
}

function DataTable({ data, spec }: { data: Datum[]; spec: ChartSpec }) {
  const hasSeries = data.some((d) => d.series);
  const valueHeader = spec.agg === "count" ? "Count" : spec.y ?? "Value";
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th scope="col">{spec.x}</th>
            {hasSeries && <th scope="col">{spec.series}</th>}
            <th scope="col" style={{ textAlign: "right" }}>
              {spec.agg === "avg" ? `Average ${valueHeader}` : valueHeader}
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((d, i) => (
            <tr key={i}>
              <td>{d.label}</td>
              {hasSeries && <td>{d.series}</td>}
              <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                {spec.value_format === "percent"
                  ? formatValue(d.value, "percent")
                  : spec.value_format === "currency"
                    ? `$${d.value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`
                    : d.value.toLocaleString("en-US", { maximumFractionDigits: 2 })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function ChartPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = await getPublishedChart(slug);
  if (!c) notFound();

  const data = (c.published_data ?? []) as Datum[];
  const takeaways = (c.takeaways ?? []) as string[];
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const embed = `<iframe src="${site}/embed/${c.slug}" width="100%" height="640" style="border:0" title="${c.title.replace(/"/g, "&quot;")}"></iframe>`;

  return (
    <>
      <Masthead />
      <main className="chart-page">
        {c.is_sample && (
          <p className="sample-banner" role="note">
            Sample content: the data in this chart and article is fictional and shown for demonstration only.
          </p>
        )}
        <div className="frame">
          <Chart spec={c.spec} data={data} title={c.title} subtitle={c.subtitle} sourceNote={c.source_note} />
        </div>
        {c.published_at && (
          <p className="muted byline">
            Published {new Date(c.published_at).toLocaleDateString("en-US", { dateStyle: "long" })}
          </p>
        )}

        {takeaways.length > 0 && (
          <section className="takeaways" aria-labelledby="kt">
            <h2 id="kt">Key takeaways</h2>
            <ul>{takeaways.map((t, i) => <li key={i}>{t}</li>)}</ul>
          </section>
        )}

        {c.body_md && <article className="article" dangerouslySetInnerHTML={{ __html: renderMarkdown(c.body_md) }} />}

        {data.length > 0 && (
          <details className="data-section">
            <summary>View the data</summary>
            <DataTable data={data} spec={c.spec} />
          </details>
        )}

        {(c.source_note || c.source_url) && (
          <section className="source">
            <h2>Source</h2>
            <p>
              {c.source_url ? (
                <a href={c.source_url} target="_blank" rel="noopener noreferrer">{c.source_note || c.source_url}</a>
              ) : (
                c.source_note
              )}
            </p>
          </section>
        )}

        <div className="embed-box">
          <label htmlFor="embed">Embed this chart</label>
          <textarea id="embed" className="input" readOnly defaultValue={embed} />
        </div>
      </main>
    </>
  );
}
