"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { profileColumns } from "@/lib/charts/profile";
import type { ColumnProfile, ColumnType, Row } from "@/lib/charts/types";

function normalize(rows: Row[]): Row[] {
  return rows.map((r) => {
    const out: Row = {};
    for (const [k, v] of Object.entries(r)) {
      const key = String(k).trim();
      if (!key || key.startsWith("__EMPTY")) continue;
      out[key] = v instanceof Date ? v.toISOString().slice(0, 10) : typeof v === "string" ? v.trim() : v;
    }
    return out;
  });
}

export default function Uploader() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [fileName, setFileName] = useState("");
  const [sheet, setSheet] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [columns, setColumns] = useState<ColumnProfile[]>([]);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function loadSheet(wb: XLSX.WorkBook, sheetName: string) {
    const ws = wb.Sheets[sheetName];
    const parsed = normalize(XLSX.utils.sheet_to_json<Row>(ws, { defval: null, raw: true }));
    setSheet(sheetName);
    setRows(parsed);
    setColumns(profileColumns(parsed));
  }

  async function handleFile(file: File) {
    setErr(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { cellDates: true });
      setWorkbook(wb);
      setFileName(file.name);
      setName(file.name.replace(/\.(xlsx|xls|csv)$/i, "").replace(/[_-]+/g, " "));
      loadSheet(wb, wb.SheetNames[0]);
    } catch {
      setErr("That file couldn't be read. Upload an .xlsx, .xls, or .csv file.");
    }
  }

  function setType(colName: string, type: ColumnType) {
    setColumns((cs) => cs.map((c) => (c.name === colName ? { ...c, type } : c)));
  }

  async function save() {
    setErr(null);
    setStatus("Saving dataset…");
    const res = await fetch("/api/datasets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, file_name: fileName, columns, rows }),
    });
    const json = await res.json();
    if (!res.ok) { setStatus(null); return setErr(json.error); }

    setStatus("Suggesting charts… this takes about 20 seconds.");
    const sug = await fetch("/api/suggest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ datasetId: json.id, count: 6 }),
    });
    if (!sug.ok) {
      const s = await sug.json().catch(() => ({}));
      setErr(`Dataset saved, but suggestions failed: ${s.error ?? "unknown error"}. You can retry from the dataset page.`);
    }
    router.push(`/dashboard/datasets/${json.id}`);
  }

  function reset() {
    setWorkbook(null); setRows([]); setColumns([]); setFileName(""); setStatus(null); setErr(null);
    if (input.current) input.current.value = "";
  }

  if (!workbook) {
    return (
      <section className="panel">
        <div
          className={`dropzone${drag ? " active" : ""}`}
          role="button"
          tabIndex={0}
          onClick={() => input.current?.click()}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault(); setDrag(false);
            const f = e.dataTransfer.files?.[0];
            if (f) handleFile(f);
          }}
        >
          <h3>Drop a spreadsheet here</h3>
          <p className="muted" style={{ margin: "6px 0 0" }}>or click to choose an Excel or CSV file. The first row should be column headers.</p>
          <input ref={input} type="file" accept=".xlsx,.xls,.csv" hidden
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
        </div>
        {err && <p className="error">{err}</p>}
      </section>
    );
  }

  return (
    <section className="panel">
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        <div>
          <label htmlFor="dsname">Dataset name</label>
          <input id="dsname" className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        {workbook.SheetNames.length > 1 && (
          <div>
            <label htmlFor="sheet">Sheet</label>
            <select id="sheet" className="input" value={sheet} onChange={(e) => loadSheet(workbook, e.target.value)}>
              {workbook.SheetNames.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
        )}
      </div>

      <p className="muted" style={{ marginTop: 16 }}>
        {rows.length.toLocaleString()} rows from {fileName}. Check each column type; charts depend on them.
        {rows.length > 5000 && " Only the first 5,000 rows will be saved."}
      </p>

      <div className="table-wrap" style={{ maxHeight: 360 }}>
        <table>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.name}>
                  {c.name}
                  <br />
                  <select value={c.type} aria-label={`Type for ${c.name}`}
                    onChange={(e) => setType(c.name, e.target.value as ColumnType)}>
                    <option value="category">Category</option>
                    <option value="number">Number</option>
                    <option value="date">Date / year</option>
                  </select>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 15).map((r, i) => (
              <tr key={i}>
                {columns.map((c) => <td key={c.name}>{r[c.name] == null ? "" : String(r[c.name])}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 20, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn primary" onClick={save} disabled={!!status || !rows.length}>
          Save and suggest charts
        </button>
        <button className="btn quiet" onClick={reset} disabled={!!status}>Choose a different file</button>
        {status && <span className="muted">{status}</span>}
      </div>
      {err && <p className="error">{err}</p>}
    </section>
  );
}
