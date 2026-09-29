import { scaleBand, scaleLinear, scalePoint } from "d3-scale";
import { arc, line, pie } from "d3-shape";
import { max, min } from "d3-array";
import type { ChartSpec, Row } from "@/lib/charts/types";
import { calloutText, computeData, formatValue, type Datum } from "@/lib/charts/compute";
import { theme as t } from "@/lib/charts/theme";

const W = 1000;
const PAD = 56;

function wrap(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > maxChars && cur) {
      lines.push(cur);
      cur = w;
    } else cur = (cur + " " + w).trim();
  }
  if (cur) lines.push(cur);
  return lines;
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

interface Props {
  spec: ChartSpec;
  rows?: Row[];
  data?: Datum[];     // precomputed (published charts)
  title: string;
  subtitle?: string | null;
  sourceNote?: string | null;
  id?: string;
}

export default function Chart({ spec, rows, data: pre, title, subtitle, sourceNote, id }: Props) {
  const data = pre ?? computeData(rows ?? [], spec);
  const callout = calloutText(data, spec);

  const titleLines = wrap(title, 42);
  const subLines = subtitle ? wrap(subtitle, 90) : [];
  let y = PAD + 8;
  const header: React.ReactNode[] = [];

  header.push(<rect key="bar" x={PAD} y={PAD - 24} width={64} height={8} fill={t.accent} />);
  titleLines.forEach((l, i) => {
    y += 44;
    header.push(
      <text key={`t${i}`} x={PAD} y={y} fontFamily={t.display} fontSize={40} fontWeight={700}
        letterSpacing={-0.8} fill={t.ink}>{l}</text>
    );
  });
  subLines.forEach((l, i) => {
    y += i === 0 ? 36 : 26;
    header.push(
      <text key={`s${i}`} x={PAD} y={y} fontFamily={t.body} fontSize={19} fill={t.muted}>{l}</text>
    );
  });
  if (callout) {
    y += 44;
    header.push(
      <g key="callout">
        <rect x={PAD} y={y - 24} width={6} height={32} fill={t.palette[1]} />
        <text x={PAD + 18} y={y} fontFamily={t.body} fontSize={20} fontWeight={600} fill={t.ink}>
          {callout}
        </text>
      </g>
    );
  }
  const plotTop = y + 36;

  let body: React.ReactNode = null;
  let plotHeight = 0;

  if (!data.length) {
    plotHeight = 120;
    body = (
      <text x={PAD} y={plotTop + 40} fontFamily={t.body} fontSize={18} fill={t.muted}>
        No values to chart for these columns.
      </text>
    );
  } else if (spec.chart_type === "ranked_bar") {
    ({ body, plotHeight } = rankedBar(data, spec, plotTop));
  } else if (spec.chart_type === "bar") {
    ({ body, plotHeight } = columns(data, spec, plotTop));
  } else if (spec.chart_type === "line") {
    ({ body, plotHeight } = lines(data, spec, plotTop));
  } else {
    ({ body, plotHeight } = donut(data, spec, plotTop));
  }

  const footerY = plotTop + plotHeight + 48;
  const H = footerY + PAD - 16;

  return (
    <svg id={id} viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={title}
      xmlns="http://www.w3.org/2000/svg" style={{ display: "block", background: t.paper }}>
      <rect width={W} height={H} fill={t.paper} />
      {header}
      {body}
      <line x1={PAD} x2={W - PAD} y1={footerY - 28} y2={footerY - 28} stroke={t.grid} />
      <text x={PAD} y={footerY} fontFamily={t.body} fontSize={15} fill={t.muted}>
        {sourceNote ? `Source: ${truncate(sourceNote, 90)}` : ""}
      </text>
      <text x={W - PAD} y={footerY} textAnchor="end" fontFamily={t.display} fontSize={20}
        fontWeight={800} letterSpacing={-0.5} fill={t.ink}>txbyt</text>
    </svg>
  );
}

function rankedBar(data: Datum[], spec: ChartSpec, top: number) {
  const rowH = 38;
  const labelW = 230;
  const valueW = 90;
  const h = data.length * rowH;
  const x = scaleLinear()
    .domain([0, Math.max(0, max(data, (d) => d.value) ?? 0)])
    .range([0, W - PAD * 2 - labelW - valueW]);
  const topValue = max(data, (d) => d.value);

  const body = (
    <g>
      {data.map((d, i) => {
        const yy = top + i * rowH;
        const isTop = d.value === topValue;
        return (
          <g key={d.label + i}>
            <text x={PAD + labelW - 14} y={yy + rowH / 2 + 6} textAnchor="end" fontFamily={t.body}
              fontSize={17} fill={t.ink}>{truncate(d.label, 26)}</text>
            <rect x={PAD + labelW} y={yy + 6} width={Math.max(2, x(Math.max(0, d.value)))}
              height={rowH - 12} fill={isTop ? t.accent : "#9DB1F2"} />
            <text x={PAD + labelW + Math.max(2, x(Math.max(0, d.value))) + 10} y={yy + rowH / 2 + 6}
              fontFamily={t.body} fontSize={16} fontWeight={600} fill={t.ink}>
              {formatValue(d.value, spec.value_format)}
            </text>
          </g>
        );
      })}
    </g>
  );
  return { body, plotHeight: h };
}

function columns(data: Datum[], spec: ChartSpec, top: number) {
  const h = 380;
  const bottomLabels = 60;
  const x = scaleBand<string>()
    .domain(data.map((d) => d.label))
    .range([PAD, W - PAD])
    .padding(0.28);
  const lo = Math.min(0, min(data, (d) => d.value) ?? 0);
  const y = scaleLinear().domain([lo, max(data, (d) => d.value) ?? 1]).nice().range([top + h - bottomLabels, top]);
  const ticks = y.ticks(5);
  const topValue = max(data, (d) => d.value);
  const rotate = data.length > 7;

  const body = (
    <g>
      {ticks.map((tk) => (
        <g key={tk}>
          <line x1={PAD} x2={W - PAD} y1={y(tk)} y2={y(tk)} stroke={t.grid} />
          <text x={PAD} y={y(tk) - 6} fontFamily={t.body} fontSize={13} fill={t.muted}>
            {formatValue(tk, spec.value_format)}
          </text>
        </g>
      ))}
      {data.map((d) => {
        const bx = x(d.label)!;
        const by = y(Math.max(0, d.value));
        const bh = Math.abs(y(d.value) - y(0));
        return (
          <g key={d.label}>
            <rect x={bx} y={by} width={x.bandwidth()} height={Math.max(1, bh)}
              fill={d.value === topValue ? t.accent : "#9DB1F2"} />
            {!rotate && (
              <text x={bx + x.bandwidth() / 2} y={by - 8} textAnchor="middle" fontFamily={t.body}
                fontSize={14} fontWeight={600} fill={t.ink}>{formatValue(d.value, spec.value_format)}</text>
            )}
            <text
              x={bx + x.bandwidth() / 2}
              y={top + h - bottomLabels + 22}
              textAnchor={rotate ? "end" : "middle"}
              transform={rotate ? `rotate(-35 ${bx + x.bandwidth() / 2} ${top + h - bottomLabels + 22})` : undefined}
              fontFamily={t.body} fontSize={14} fill={t.ink}>
              {truncate(d.label, rotate ? 18 : 14)}
            </text>
          </g>
        );
      })}
    </g>
  );
  return { body, plotHeight: h + (rotate ? 40 : 0) };
}

function lines(data: Datum[], spec: ChartSpec, top: number) {
  const h = 380;
  const legendH = spec.series ? 36 : 0;
  const labels = Array.from(new Set(data.map((d) => d.label)));
  const x = scalePoint<string>().domain(labels).range([PAD + 10, W - PAD - 110]);
  const lo = Math.min(0, min(data, (d) => d.value) ?? 0);
  const y = scaleLinear().domain([lo, max(data, (d) => d.value) ?? 1]).nice().range([top + legendH + h - 40, top + legendH]);
  const seriesNames = Array.from(new Set(data.map((d) => d.series ?? "")));
  const every = Math.ceil(labels.length / 8);
  const gen = line<Datum>().x((d) => x(d.label)!).y((d) => y(d.value));

  const body = (
    <g>
      {y.ticks(5).map((tk) => (
        <g key={tk}>
          <line x1={PAD} x2={W - PAD} y1={y(tk)} y2={y(tk)} stroke={t.grid} />
          <text x={PAD} y={y(tk) - 6} fontFamily={t.body} fontSize={13} fill={t.muted}>
            {formatValue(tk, spec.value_format)}
          </text>
        </g>
      ))}
      {labels.map((l, i) =>
        i % every === 0 || i === labels.length - 1 ? (
          <text key={l} x={x(l)} y={top + legendH + h - 12} textAnchor="middle" fontFamily={t.body}
            fontSize={14} fill={t.ink}>{truncate(l, 12)}</text>
        ) : null
      )}
      {seriesNames.map((s, i) => {
        const pts = data.filter((d) => (d.series ?? "") === s);
        const color = t.palette[i % t.palette.length];
        const last = pts[pts.length - 1];
        return (
          <g key={s || "single"}>
            <path d={gen(pts) ?? ""} fill="none" stroke={color} strokeWidth={4} strokeLinejoin="round" />
            {last && (
              <>
                <circle cx={x(last.label)} cy={y(last.value)} r={6} fill={color} />
                <text x={x(last.label)! + 12} y={y(last.value) + 5} fontFamily={t.body} fontSize={15}
                  fontWeight={600} fill={t.ink}>{formatValue(last.value, spec.value_format)}</text>
              </>
            )}
          </g>
        );
      })}
      {spec.series &&
        seriesNames.map((s, i) => (
          <g key={`lg-${s}`} transform={`translate(${PAD + i * 170}, ${top})`}>
            <rect width={14} height={14} y={-12} fill={t.palette[i % t.palette.length]} />
            <text x={22} fontFamily={t.body} fontSize={15} fill={t.ink}>{truncate(s, 16)}</text>
          </g>
        ))}
    </g>
  );
  return { body, plotHeight: h + legendH };
}

function donut(data: Datum[], spec: ChartSpec, top: number) {
  const size = 340;
  const r = size / 2;
  const cx = PAD + r;
  const cy = top + r;
  const total = data.reduce((s, d) => s + d.value, 0);
  const arcs = pie<Datum>().value((d) => Math.max(0, d.value)).sort(null)(data);
  const gen = arc<(typeof arcs)[number]>().innerRadius(r * 0.58).outerRadius(r);

  const body = (
    <g>
      <g transform={`translate(${cx}, ${cy})`}>
        {arcs.map((a, i) => (
          <path key={i} d={gen(a) ?? ""} fill={t.palette[i % t.palette.length]} stroke={t.paper} strokeWidth={3} />
        ))}
        <text textAnchor="middle" y={4} fontFamily={t.display} fontSize={30} fontWeight={700} fill={t.ink}>
          {formatValue(total, spec.value_format)}
        </text>
        <text textAnchor="middle" y={30} fontFamily={t.body} fontSize={15} fill={t.muted}>total</text>
      </g>
      {data.map((d, i) => (
        <g key={d.label} transform={`translate(${PAD + size + 60}, ${top + 40 + i * 44})`}>
          <rect width={18} height={18} y={-14} fill={t.palette[i % t.palette.length]} />
          <text x={30} fontFamily={t.body} fontSize={18} fill={t.ink}>{truncate(d.label, 28)}</text>
          <text x={W - PAD * 2 - size - 60} textAnchor="end" fontFamily={t.body} fontSize={18}
            fontWeight={600} fill={t.ink}>
            {total ? `${((d.value / total) * 100).toFixed(1)}%` : "–"}
          </text>
        </g>
      ))}
    </g>
  );
  return { body, plotHeight: Math.max(size, data.length * 44 + 20) };
}
