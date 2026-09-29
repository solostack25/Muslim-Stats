// Regenerates sample-content.json (fictional demo data). Run: npx tsx supabase/seed/generate-sample-content.ts
import { writeFileSync } from "fs";
import { profileColumns } from "../../lib/charts/profile";
import { computeData } from "../../lib/charts/compute";
import { summarize } from "../../lib/charts/summary";
import type { ChartSpec, Row } from "../../lib/charts/types";

let seed = 20260928;
const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const jitter = (v: number, p = 0.08) => Math.round(v * (1 - p + rnd() * 2 * p));

const cities = [["Houston","TX",1.0],["Chicago","IL",0.92],["New York","NY",1.1],["Dallas","TX",0.74],["Detroit","MI",0.81],["Los Angeles","CA",0.88],["Atlanta","GA",0.55],["Philadelphia","PA",0.5],["Minneapolis","MN",0.47],["Washington","DC",0.62],["Paterson","NJ",0.44],["Orlando","FL",0.36]] as const;
const years = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

interface Sample {
  name: string; rows: Row[]; spec: ChartSpec; title: string; subtitle: string;
  intro: string; why: string; method: string;
}

const S: Sample[] = [];

// 1 Ramadan food drive by city
S.push({
  name: "Ramadan food drive, 2026",
  rows: cities.map(([c, st, w]) => ({ City: c, State: st, "Meals Distributed": jitter(42000 * w), Volunteers: jitter(310 * w), "Families Served": jitter(5200 * w) })),
  spec: { chart_type: "ranked_bar", x: "City", y: "Meals Distributed", agg: "sum", sort: "desc", highlight: "max", value_format: "number" },
  title: "Which cities served the most iftar meals",
  subtitle: "Meals distributed during Ramadan food drives, by city",
  intro: "Every Ramadan, community organizations across the country run food drives that deliver iftar meals and grocery boxes to families in need. This chart compares how many meals were distributed in each city during the month.",
  why: "Meal counts show where demand is concentrated and where volunteer networks are strongest. Cities with large totals often have several organizations coordinating distribution, while smaller totals can point to places where more support is needed.",
  method: "Each row is one city. Meals distributed is the total across all participating sites in that city for the full month of Ramadan.",
});

// 2 Zakat & sadaqah by month (spike in Ramadan ~ Feb-Mar 2026)
{
  const months = ["2025-04","2025-05","2025-06","2025-07","2025-08","2025-09","2025-10","2025-11","2025-12","2026-01","2026-02","2026-03"];
  const base = [0.8,0.75,0.9,0.7,0.72,0.78,0.82,1.05,1.2,0.9,2.6,3.1];
  S.push({
    name: "Monthly zakat and sadaqah giving",
    rows: months.flatMap((m, i) => ["Zakat", "Sadaqah"].map((type) => ({ Month: m, Type: type, "Donations ($)": jitter((type === "Zakat" ? 410000 : 260000) * base[i]) }))),
    spec: { chart_type: "line", x: "Month", y: "Donations ($)", agg: "sum", sort: "none", highlight: "last", value_format: "currency" },
    title: "Giving surges during Ramadan",
    subtitle: "Combined zakat and sadaqah donations by month, April 2025 to March 2026",
    intro: "Many Muslims time their zakat, the obligatory annual charity, to fall in Ramadan, and voluntary sadaqah tends to rise in the same weeks. This chart tracks combined monthly giving over one year.",
    why: "The shape of the year matters for anyone planning a nonprofit budget. A small number of weeks can account for a large share of annual revenue, which affects staffing, campaign timing, and how much cash reserve an organization needs for the rest of the year.",
    method: "Donations are summed across zakat and sadaqah for each calendar month.",
  });
}

// 3 Halal restaurant openings by year
S.push({
  name: "Halal restaurant openings",
  rows: years(2016, 2025).flatMap((y, i) => cities.slice(0, 6).map(([c, , w]) => ({ Year: y, City: c, Openings: Math.max(0, jitter((14 + i * 2.6 - (y === 2020 ? 9 : 0)) * w, 0.2)), Closures: jitter((6 + i * 0.6) * w, 0.3) }))),
  spec: { chart_type: "bar", x: "Year", y: "Openings", agg: "sum", sort: "none", highlight: "max", value_format: "number" },
  title: "Halal restaurant openings keep climbing",
  subtitle: "New halal restaurants opened each year across six major metro areas",
  intro: "Halal food has moved from specialty grocers into mainstream dining, from fast-casual chains to fine dining. This chart counts new halal restaurant openings each year across six large metro areas.",
  why: "Openings are a useful signal of both consumer demand and investor confidence. A steady rise suggests halal dining is reaching customers well beyond the Muslim community, while dips tend to track wider shocks to the restaurant industry.",
  method: "Openings are counted in the year a restaurant first began serving customers, summed across Houston, Chicago, New York, Dallas, Detroit and Los Angeles.",
});

// 4 New Islamic centers by state
{
  const states = [["Texas",1.0],["California",0.93],["New York",0.8],["Florida",0.62],["Illinois",0.58],["New Jersey",0.55],["Michigan",0.51],["Georgia",0.4],["Virginia",0.38],["Pennsylvania",0.33],["Ohio",0.3],["Minnesota",0.27]] as const;
  S.push({
    name: "New Islamic centers by state, 2015 to 2025",
    rows: states.map(([s, w]) => ({ State: s, "New Centers": jitter(96 * w, 0.1), "Expansion Projects": jitter(140 * w, 0.15) })),
    spec: { chart_type: "ranked_bar", x: "State", y: "New Centers", agg: "sum", sort: "desc", highlight: "max", value_format: "number" },
    title: "Where new Islamic centers are being built",
    subtitle: "New mosques and Islamic centers opened by state, 2015 to 2025",
    intro: "New mosques and Islamic centers tend to follow population growth, particularly in fast-growing suburbs. This chart ranks states by the number of new centers opened over a decade.",
    why: "Construction reflects where communities are putting down roots. Growth in suburban areas of large states often signals families moving out of city centers, and new centers typically bring schools, food pantries and youth programs with them.",
    method: "A new center is counted once, in the state where it opened. Expansions of existing buildings are tracked separately and not included in this chart.",
  });
}

// 5 Islamic school enrollment by level over time
S.push({
  name: "Full-time Islamic school enrollment",
  rows: years(2016, 2025).flatMap((y, i) => [["Elementary", 21000, 0.045], ["Middle", 9000, 0.05], ["High", 6200, 0.065]].map(([lvl, b, g]) => ({ Year: y, Level: lvl as string, Students: jitter((b as number) * Math.pow(1 + (g as number), i) * (y === 2020 ? 0.94 : 1), 0.03) }))),
  spec: { chart_type: "line", x: "Year", y: "Students", agg: "sum", series: "Level", sort: "none", highlight: "none", value_format: "number" },
  title: "Islamic school enrollment is growing at every level",
  subtitle: "Students enrolled in full-time Islamic schools, by school level",
  intro: "Full-time Islamic schools combine a standard academic curriculum with Quran, Arabic and Islamic studies. This chart follows enrollment at elementary, middle and high school levels over ten years.",
  why: "Enrollment trends shape decisions about new campuses, teacher hiring and tuition assistance. Faster growth at the high school level, in particular, suggests more families are staying with Islamic schools through graduation rather than transferring out.",
  method: "Students are counted once per school year by the level they were enrolled in at the start of the year.",
});

// 6 Muslim-owned businesses by sector (donut)
S.push({
  name: "Muslim-owned small businesses by sector",
  rows: [["Food and restaurants", 0.27], ["Retail", 0.21], ["Professional services", 0.18], ["Health care", 0.14], ["Transportation", 0.11], ["Construction", 0.09]].flatMap(([sec, w]) => cities.slice(0, 8).map(([c]) => ({ Sector: sec as string, City: c, Businesses: jitter(1800 * (w as number), 0.2) }))),
  spec: { chart_type: "donut", x: "Sector", y: "Businesses", agg: "sum", sort: "desc", highlight: "max", value_format: "number" },
  title: "Food leads Muslim-owned small businesses",
  subtitle: "Share of Muslim-owned small businesses by sector, eight metro areas",
  intro: "Small businesses are a major path to economic mobility for immigrant and second-generation families. This chart shows how Muslim-owned small businesses are spread across sectors in eight large metro areas.",
  why: "Sector mix affects everything from access to credit to how exposed businesses are to downturns. Heavy concentration in food and retail means many owners depend on foot traffic and thin margins, while growth in professional services and health care points to a rising share of licensed, higher-income firms.",
  method: "Businesses are grouped by their primary line of work and summed across the eight metro areas.",
});

// 7 Eid prayer attendance by city
S.push({
  name: "Eid al-Fitr prayer attendance, 2026",
  rows: cities.map(([c, st, w]) => ({ City: c, State: st, Attendance: jitter(58000 * w), "Prayer Sites": jitter(24 * w, 0.2) })),
  spec: { chart_type: "ranked_bar", x: "City", y: "Attendance", agg: "sum", sort: "desc", highlight: "max", value_format: "number" },
  title: "New York draws the largest Eid crowds",
  subtitle: "Estimated Eid al-Fitr prayer attendance by city, 2026",
  intro: "Eid al-Fitr marks the end of Ramadan and brings some of the largest gatherings of the year, often held in convention centers, parks and stadiums. This chart compares estimated attendance at Eid prayers across twelve cities.",
  why: "Attendance estimates help organizers plan venues, parking, security and accessibility. They also give a rough, once-a-year snapshot of the size of each city's active community.",
  method: "Attendance is the sum of estimates reported by each prayer site in the city.",
});

// 8 Islamic finance app users by age group (bar by category)
S.push({
  name: "Islamic finance app users by age",
  rows: [["18-24", 0.19], ["25-34", 0.36], ["35-44", 0.24], ["45-54", 0.13], ["55+", 0.08]].map(([a, w]) => ({ "Age Group": a as string, Users: jitter(640000 * (w as number), 0.05) })),
  spec: { chart_type: "bar", x: "Age Group", y: "Users", agg: "sum", sort: "none", highlight: "max", value_format: "number" },
  title: "Islamic finance apps skew young",
  subtitle: "Active users of Islamic banking and investing apps, by age group",
  intro: "A new wave of apps offers interest-free banking, halal investing and zakat calculators. This chart shows who is using them, by age group.",
  why: "Younger users are building savings and investment habits early, and their choices will shape which Islamic finance providers grow over the next two decades. Lower adoption among older users suggests room for products designed around retirement and estate planning.",
  method: "Each user is counted once in the age group they reported when signing up.",
});

// 9 Free clinic visits by year
S.push({
  name: "Community clinic patient visits",
  rows: years(2015, 2025).map((y, i) => ({ Year: y, Visits: jitter(38000 * Math.pow(1.11, i) * (y === 2020 ? 0.78 : 1), 0.03), "Uninsured Patients (%)": Math.round((64 - i * 0.8) * 10) / 10 })),
  spec: { chart_type: "line", x: "Year", y: "Visits", agg: "sum", sort: "none", highlight: "last", value_format: "number" },
  title: "Free clinic visits have nearly tripled in a decade",
  subtitle: "Patient visits at Muslim-run free community clinics, 2015 to 2025",
  intro: "Muslim-run free clinics provide primary care, screenings and prescriptions to patients regardless of faith or insurance status. This chart tracks total patient visits across a network of community clinics.",
  why: "Rising visit counts reflect both growing capacity and persistent gaps in access to care. Because most patients are uninsured, clinic volume is also a rough indicator of how many people are falling outside the formal health system in the cities these clinics serve.",
  method: "A visit is one in-person appointment. Patients with several appointments in a year are counted once per appointment.",
});

// 10 Volunteer hours by program
S.push({
  name: "Volunteer hours by program area",
  rows: [["Food pantry", 1.0], ["Youth mentoring", 0.72], ["Disaster relief", 0.64], ["Tutoring", 0.58], ["Refugee resettlement", 0.51], ["Health fairs", 0.37], ["Prison outreach", 0.22], ["Elder care visits", 0.2]].flatMap(([p, w]) => ["Q1", "Q2", "Q3", "Q4"].map((q) => ({ Program: p as string, Quarter: q, "Volunteer Hours": jitter(9500 * (w as number), 0.15) }))),
  spec: { chart_type: "ranked_bar", x: "Program", y: "Volunteer Hours", agg: "sum", sort: "desc", highlight: "max", value_format: "number" },
  title: "Food pantries get the most volunteer time",
  subtitle: "Total volunteer hours by program area over one year",
  intro: "Volunteers are the backbone of most community organizations. This chart shows how volunteer time was divided across program areas over a full year.",
  why: "Volunteer hours reveal which programs depend most on unpaid help and where a drop in volunteers would hurt most. Programs lower on the list, such as elder care and prison outreach, often need specialized training, which limits how many people can take part.",
  method: "Hours are logged by volunteers after each shift and summed across all four quarters.",
});

const fmtDate = (d: Date) => d.toISOString();
const now = new Date("2026-09-28T15:00:00Z").getTime();

const out = S.map((s, i) => {
  const columns = profileColumns(s.rows);
  const data = computeData(s.rows, s.spec);
  const { takeaways, paragraph } = summarize(data, s.spec);
  const body = [
    "*This is sample content. The data is fictional and was created to demonstrate how charts and articles look on this site.*",
    s.intro,
    "## What the data shows",
    paragraph,
    "## Why it matters",
    s.why,
    "## About this data",
    `${s.method} All figures are invented for demonstration purposes.`,
  ].join("\n\n");
  return {
    dataset: { name: `${s.name} (sample)`, file_name: `${s.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.xlsx`, columns, rows: s.rows, row_count: s.rows.length },
    chart: {
      chart_type: s.spec.chart_type, spec: s.spec, title: s.title, subtitle: s.subtitle,
      source_note: "Sample data (fictional), for demonstration only",
      published_data: data, takeaways, body_md: body,
      slug: `${s.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60)}-s${String(i + 1).padStart(2, "0")}`,
      published_at: fmtDate(new Date(now - (S.length - i) * 2.5 * 86400000)),
    },
  };
});
writeFileSync(__dirname + "/sample-content.json", JSON.stringify(out));
for (const o of out) console.log(`${o.chart.chart_type.padEnd(10)} ${o.chart.title}\n   ${o.chart.takeaways[0]}`);
