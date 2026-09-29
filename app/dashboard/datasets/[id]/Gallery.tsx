"use client";

import { useMemo, useState } from "react";
import Chart from "@/components/Chart";
import { CHART_TYPES, type ChartRecord, type ColumnProfile, type Row } from "@/lib/charts/types";

const TYPE_LABELS: Record<string, string> = {
  ranked_bar: "Ranked bars", bar: "Columns", line: "Line", donut: "Donut",
};
const FILTERS = ["all", "draft", "approved", "published", "rejected"] as const;

async function patch(id: string, body: object) {
  const res = await fetch(`/api/charts/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Update failed");
  return json as ChartRecord;
}

function svgString(id: string) {
  const el = document.getElementById(id);
  if (!el) return null;
  const clone = el.cloneNode(true) as SVGSVGElement;
  clone.removeAttribute("width");
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  return new XMLSerializer().serializeToString(clone);
}

function download(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href; a.download = filename; a.click();
}

function downloadSvg(domId: string, name: string) {
  const s = svgString(domId);
  if (!s) return;
  const url = URL.createObjectURL(new Blob([s], { type: "image/svg+xml" }));
  download(url, `${name}.svg`);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadPng(domId: string, name: string) {
  const el = document.getElementById(domId) as SVGSVGElement | null;
  const s = svgString(domId);
  if (!el || !s) return;
  const vb = el.viewBox.baseVal;
  const scale = 2;
  const img = new Image();
  const url = URL.createObjectURL(new Blob([s], { type: "image/svg+xml" }));
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = vb.width * scale; canvas.height = vb.height * scale;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    download(canvas.toDataURL("image/png"), `${name}.png`);
    URL.revokeObjectURL(url);
  };
  img.src = url;
}

function slugName(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50);
}

export default function Gallery({ datasetId, columns, rows, initial }: {
  datasetId: string; columns: ColumnProfile[]; rows: Row[]; initial: ChartRecord[];
}) {
  const [charts, setCharts] = useState(initial);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const shown = useMemo(
    () => charts.filter((c) => filter === "all" ? c.status !== "rejected" : c.status === filter),
    [charts, filter]
  );

  async function update(id: string, body: object) {
    setErr(null);
    try {
      const next = await patch(id, body);
      setCharts((cs) => cs.map((c) => (c.id === id ? next : c)));
    } catch (e) { setErr((e as Error).message); }
  }

  async function remove(id: string) {
    if (!confirm("Delete this chart? This can't be undone.")) return;
    const res = await fetch(`/api/charts/${id}`, { method: "DELETE" });
    if (res.ok) setCharts((cs) => cs.filter((c) => c.id !== id));
  }

  async function suggestMore() {
    setBusy(true); setErr(null);
    const res = await fetch("/api/suggest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ datasetId, count: 4 }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      return setErr(j.error ?? "Suggestions failed.");
    }
    window.location.reload();
  }

  const counts = FILTERS.reduce<Record<string, number>>((acc, f) => {
    acc[f] = f === "all" ? charts.filter((c) => c.status !== "rejected").length : charts.filter((c) => c.status === f).length;
    return acc;
  }, {});

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div className="tabs" role="group" aria-label="Filter charts">
          {FILTERS.map((f) => (
            <button key={f} className="tab" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {f === "all" ? "All" : f[0].toUpperCase() + f.slice(1)} ({counts[f]})
            </button>
          ))}
        </div>
        <button className="btn primary" onClick={suggestMore} disabled={busy}>
          {busy ? "Suggesting charts…" : "Suggest more charts"}
        </button>
      </div>
      {err && <p className="error">{err}</p>}

      {!shown.length ? (
        <section className="panel">
          <p className="muted">
            {charts.length ? "No charts with this status." : "No charts yet. Select Suggest more charts to generate some."}
          </p>
        </section>
      ) : (
        <div className="grid">
          {shown.map((c) => {
            const domId = `chart-${c.id}`;
            return (
              <article key={c.id} className="card">
                <Chart id={domId} spec={c.spec} rows={rows} title={c.title} subtitle={c.subtitle} sourceNote={c.source_note} />

                {editing === c.id && (
                  <Editor chart={c} columns={columns} onSave={async (body) => { await update(c.id, body); setEditing(null); }}
                    onCancel={() => setEditing(null)} />
                )}

                <div className="card-actions">
                  <span className={`status ${c.status}`}>{c.status[0].toUpperCase() + c.status.slice(1)}</span>
                  {c.status === "draft" && (
                    <>
                      <button className="btn primary" onClick={() => update(c.id, { status: "approved" })}>Approve</button>
                      <button className="btn quiet" onClick={() => update(c.id, { status: "rejected" })}>Reject</button>
                    </>
                  )}
                  {c.status === "approved" && (
                    <button className="btn primary" onClick={() => update(c.id, { status: "published" })}>Publish</button>
                  )}
                  {c.status === "published" && (
                    <>
                      <a className="btn quiet" href={`/c/${c.slug}`} target="_blank" rel="noreferrer">View</a>
                      <button className="btn quiet" onClick={() => update(c.id, { status: "approved" })}>Unpublish</button>
                    </>
                  )}
                  {c.status === "rejected" && (
                    <button className="btn quiet" onClick={() => update(c.id, { status: "draft" })}>Restore</button>
                  )}
                  {editing !== c.id && <button className="btn quiet" onClick={() => setEditing(c.id)}>Edit</button>}
                  <button className="btn quiet" onClick={() => downloadPng(domId, slugName(c.title))}>PNG</button>
                  <button className="btn quiet" onClick={() => downloadSvg(domId, slugName(c.title))}>SVG</button>
                  <button className="btn danger" onClick={() => remove(c.id)} aria-label="Delete chart">Delete</button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}

function Editor({ chart, columns, onSave, onCancel }: {
  chart: ChartRecord; columns: ColumnProfile[];
  onSave: (body: object) => Promise<void>; onCancel: () => void;
}) {
  const [title, setTitle] = useState(chart.title);
  const [subtitle, setSubtitle] = useState(chart.subtitle ?? "");
  const [source, setSource] = useState(chart.source_note ?? "");
  const [spec, setSpec] = useState(chart.spec);
  const numeric = columns.filter((c) => c.type === "number");

  return (
    <div className="card-edit">
      <div><label>Headline</label><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
      <div><label>Subtitle</label><input className="input" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} /></div>
      <div><label>Source</label><input className="input" value={source} placeholder="e.g. U.S. Census Bureau, 2025" onChange={(e) => setSource(e.target.value)} /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label>Chart type</label>
          <select className="input" value={spec.chart_type} onChange={(e) => setSpec({ ...spec, chart_type: e.target.value as any })}>
            {CHART_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
          </select>
        </div>
        <div>
          <label>Group by</label>
          <select className="input" value={spec.x} onChange={(e) => setSpec({ ...spec, x: e.target.value })}>
            {columns.map((c) => <option key={c.name}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label>Value</label>
          <select className="input" value={spec.agg === "count" ? "__count" : spec.y}
            onChange={(e) => e.target.value === "__count"
              ? setSpec({ ...spec, agg: "count", y: undefined })
              : setSpec({ ...spec, y: e.target.value, agg: spec.agg === "count" ? "sum" : spec.agg })}>
            <option value="__count">Count of rows</option>
            {numeric.map((c) => <option key={c.name}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label>Combine values by</label>
          <select className="input" value={spec.agg} disabled={spec.agg === "count"}
            onChange={(e) => setSpec({ ...spec, agg: e.target.value as any })}>
            <option value="sum">Total</option>
            <option value="avg">Average</option>
            {spec.agg === "count" && <option value="count">Count</option>}
          </select>
        </div>
        <div>
          <label>Callout</label>
          <select className="input" value={spec.highlight} onChange={(e) => setSpec({ ...spec, highlight: e.target.value as any })}>
            <option value="max">Highest value</option>
            <option value="min">Lowest value</option>
            <option value="last">Latest value</option>
            <option value="none">No callout</option>
          </select>
        </div>
        <div>
          <label>Show top</label>
          <input className="input" type="number" min={3} max={25} value={spec.limit ?? ""}
            placeholder="Auto" onChange={(e) => setSpec({ ...spec, limit: e.target.value ? Number(e.target.value) : undefined })} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn primary" onClick={() => onSave({ title, subtitle: subtitle || null, source_note: source || null, spec })}>Save changes</button>
        <button className="btn quiet" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
