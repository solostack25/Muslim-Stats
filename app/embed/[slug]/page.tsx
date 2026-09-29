import { notFound } from "next/navigation";
import Chart from "@/components/Chart";
import { getPublishedChart } from "@/lib/published";

export const revalidate = 300;

export default async function Embed({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = await getPublishedChart(slug);
  if (!c) notFound();
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  return (
    <a href={`${site}/c/${c.slug}`} target="_blank" rel="noreferrer" style={{ display: "block" }}>
      <Chart spec={c.spec} data={c.published_data ?? []} title={c.title} subtitle={c.subtitle} sourceNote={c.source_note} />
    </a>
  );
}
