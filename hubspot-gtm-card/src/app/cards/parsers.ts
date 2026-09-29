// Parsers for the GTM Radar card's Company custom properties.
// Ported 1:1 from the validated prototype (tested against Marco sp. z o.o.,
// Reventon Group Ltd., PROMOTECH) — same regexes, same section markers.
// Every function is defensive against null/empty/partial source text, since
// the enrichment pipeline does not guarantee any field is populated.

export const ROLES = [
  'Sales Management',
  'Account Executive',
  'Sales Associate',
  'Inside Sales',
  'Other Sales',
  'Sales Operations',
  'Business Development',
  'Channel Sales',
  'Key Account Manager',
  'Marketing',
] as const;

export type Role = (typeof ROLES)[number];

function pl(s: string | null | undefined): number | null {
  return s == null ? null : parseFloat(String(s).replace(',', '.'));
}

function num(s: string | null | undefined): number | null {
  return s == null ? null : parseInt(String(s).replace(/[\s\u00A0]/g, ''), 10);
}

export interface RevenueTrend {
  fromYear: number;
  toYear: number;
  values: [number | null, number | null, number | null];
}

export interface FinancialsData {
  revenue: number | null;
  revYear: string | null;
  revDir: 'up' | 'down' | null;
  revYoyPct: string | null;
  netProfit: number | null;
  ebit: number | null;
  ebitda: number | null;
  ebitdaYoy: string | null;
  trend: RevenueTrend | null;
  rating: string | null;
  ratingLabel: string | null;
  insolvencyRisk: string | null;
  tradeCreditSafe: number | null;
  tradeCreditMax: number | null;
  valuation: number | null;
  employees: number | null;
  city: string | null;
  industry: string | null;
  margin: number | null;
}

// Source property in HubSpot is labeled "Financial Highlights" but its
// internal name is sales_team_summary — it holds financial data, NOT team
// data. NIP/KRS live in this same text and must never be extracted/shown.
export function parseFinancials(
  rawText: string | null | undefined,
): FinancialsData {
  const text = rawText ?? '';
  const g = (re: RegExp): string | null => {
    const m = text.match(re);
    return m ? m[1] : null;
  };

  const revenue = num(g(/Przychód:\s*([\d\s\u00A0]+)\s*zł/));
  const revYear = g(/Przychód:.*?\(dane z (\d{4})\)/);
  const revDir: 'up' | 'down' | null = /r\/r:\s*rośnie/.test(text)
    ? 'up'
    : /r\/r:\s*spada/.test(text)
      ? 'down'
      : null;
  const revYoyPct = g(/r\/r:\s*(?:rośnie|spada)\s*\(([+\-\d,]+%)\)/);
  const netProfit = num(g(/Zysk netto:\s*([\d\s\u00A0]+)\s*zł/));
  const ebit = num(g(/\bEBIT:\s*([\d\s\u00A0]+)\s*zł/));
  const ebitda = num(g(/EBITDA:\s*([\d\s\u00A0]+)\s*zł\./));
  const ebitdaYoy = g(/EBITDA r\/r\s*([+\-\d,]+%)/);

  const trendMatch = text.match(
    /przychód (\d{4})→(\d{4}):\s*([\d,]+)\s*mln\s*→\s*([\d,]+)\s*mln\s*→\s*([\d,]+)\s*mln\s*zł/,
  );
  const trend: RevenueTrend | null = trendMatch
    ? {
        fromYear: parseInt(trendMatch[1], 10),
        toYear: parseInt(trendMatch[2], 10),
        values: [pl(trendMatch[3]), pl(trendMatch[4]), pl(trendMatch[5])],
      }
    : null;

  const rating = g(/rating\s*([A-D])\b/);
  const ratingLabel = g(/rating\s*[A-D]\s*\(([^)]+)\)/);
  const insolvencyRisk = g(/ryzyko niewypłacalności\s*([\d,]+%)/);
  const tradeCreditSafe = num(
    g(/Kredyt kupiecki bezpieczny\s*([\d\s\u00A0]+)\s*zł/),
  );
  const tradeCreditMax = num(g(/\(maks\.\s*([\d\s\u00A0]+)\s*zł\)/));
  const valuation = num(g(/Wycena \(model\):\s*([\d\s\u00A0]+)\s*zł/));
  const employees = num(g(/Zatrudnienie:\s*([\d\s\u00A0]+)\s*osób/));
  const city = g(/Siedziba:\s*([^.]+)\./);
  const industry = g(/Branża:\s*([^.\n]+)\./);
  const margin = ebitda != null && revenue ? (ebitda / revenue) * 100 : null;

  return {
    revenue,
    revYear,
    revDir,
    revYoyPct,
    netProfit,
    ebit,
    ebitda,
    ebitdaYoy,
    trend,
    rating,
    ratingLabel,
    insolvencyRisk,
    tradeCreditSafe,
    tradeCreditMax,
    valuation,
    employees,
    city,
    industry,
    margin,
  };
}

export interface RosterPerson {
  category: string;
  name: string;
  title: string;
  since: string;
  tenureFirm: number | null;
  tenureSales: number | null;
  seniority: string;
}

export interface TeamData {
  total: number | null;
  counts: Partial<Record<Role, number>>;
  names: Partial<Record<Role, string[]>>;
  roster: RosterPerson[];
}

const EMPTY_TEAM: TeamData = { total: null, counts: {}, names: {}, roster: [] };

export function parseTeam(rawText: string | null | undefined): TeamData {
  const text = rawText ?? '';
  if (!text.trim()) return EMPTY_TEAM;

  const totalMatch = text.match(/Total Sales Team:\s*(\d+)\s*osób/);
  const total = totalMatch ? parseInt(totalMatch[1], 10) : null;

  const countsBlockEnd = text.indexOf('(poza sumą zespołu sprzedaży)');
  const countsBlock =
    countsBlockEnd >= 0 ? text.slice(0, countsBlockEnd) : text;
  const counts: Partial<Record<Role, number>> = {};
  ROLES.forEach((role) => {
    const re = new RegExp(role.replace(/[()]/g, '\\$&') + ':\\s*(\\d+)');
    const m = countsBlock.match(re);
    if (m) counts[role] = parseInt(m[1], 10);
  });

  const namesBlockEnd = text.indexOf('=== ANALIZA');
  const namesBlock =
    countsBlockEnd >= 0
      ? text.slice(
          countsBlockEnd,
          namesBlockEnd >= 0 ? namesBlockEnd : undefined,
        )
      : '';
  const names: Partial<Record<Role, string[]>> = {};
  ROLES.forEach((role) => {
    const re = new RegExp(role.replace(/[()]/g, '\\$&') + ':[ \\t]*([^\\n]*)');
    const m = namesBlock.match(re);
    if (m && m[1].trim()) {
      names[role] = m[1]
        .trim()
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
  });

  const rosterBlock = namesBlockEnd >= 0 ? text.slice(namesBlockEnd) : '';
  const roster: RosterPerson[] = [];
  const personRe =
    /\[([^\]]+)\]\s+([^—]+?)\s+—\s+([^(]+?)\s*\(od\s+([^,]+),\s*([\d.,]+)\s*rok\w*\s*w firmie\),\s*([\d.,]+)\s*rok\w*\s*w sprzedaży[^,]*,[^,]*,\s*seniority\s+(\w+)\./g;
  let m: RegExpExecArray | null;
  while ((m = personRe.exec(rosterBlock)) !== null) {
    roster.push({
      category: m[1],
      name: m[2].trim(),
      title: m[3].trim(),
      since: m[4].trim(),
      tenureFirm: pl(m[5]),
      tenureSales: pl(m[6]),
      seniority: m[7],
    });
  }

  return { total, counts, names, roster };
}

export interface GtmSection {
  marker: string;
  title: string;
  body: string;
}

function splitByMarkers(
  text: string,
  markers: string[],
): { marker: string; body: string }[] {
  const idx = markers.map((m) => text.indexOf(m));
  const out: { marker: string; body: string }[] = [];
  for (let i = 0; i < markers.length; i++) {
    if (idx[i] === -1) continue;
    const end =
      i + 1 < markers.length && idx[i + 1] !== -1 ? idx[i + 1] : text.length;
    out.push({ marker: markers[i], body: text.slice(idx[i], end).trim() });
  }
  return out;
}

const GTM_LABELS: Record<string, string> = {
  'ZNANE ZNANE': 'Znane znane — fakty',
  'NIEZNANE ZNANE': 'Nieznane znane — hipotezy',
  'ZNANE NIEZNANE': 'Znane nieznane — pytania do discovery',
  'NIEZNANE NIEZNANE': 'Nieznane nieznane — ślepe pola',
};

export function parseGtmModel(
  rawText: string | null | undefined,
): GtmSection[] {
  const text = rawText ?? '';
  if (!text.trim()) return [];
  const sections = splitByMarkers(text, [
    'ZNANE ZNANE',
    'NIEZNANE ZNANE',
    'ZNANE NIEZNANE',
    'NIEZNANE NIEZNANE',
  ]);
  return sections.map((s) => ({
    marker: s.marker,
    title: GTM_LABELS[s.marker] || s.marker,
    body: s.body,
  }));
}

// Pulls the "Co komunikują reklamą" sentence out of ZNANE ZNANE so it can be
// surfaced as its own callout — paid-media activity (or its absence) is a
// direct signal of whether the company leans on inbound/outbound, and it's
// easy to miss buried inside the full fact paragraph.
export function parseAdSignal(
  rawText: string | null | undefined,
): string | null {
  const text = rawText ?? '';
  const m = text.match(/Co komunikują reklamą[^:]*:\s*([^\n]+)/);
  return m ? m[1].trim() : null;
}

export function parsePostsSignal(
  rawText: string | null | undefined,
): string | null {
  const text = rawText ?? '';
  const m = text.match(/Co mówią posty[^:]*:\s*([^\n]+)/);
  return m ? m[1].trim() : null;
}

export interface AdChannels {
  google: number | null;
  linkedin: number | null;
  meta: number | null;
  creatives: string[];
}

// null = channel not established in the source ("nieustalone", or the hits
// belonged to a different company) — distinct from an explicit 0.
export function parseAdChannels(adSignal: string | null): AdChannels {
  const text = adSignal ?? '';
  const n = (re: RegExp): number | null => {
    const m = text.match(re);
    return m ? parseInt(m[1], 10) : null;
  };
  const creatives = Array.from(text.matchAll(/„([^"”„]{8,})["”]/g)).map((m) =>
    m[1].trim(),
  );
  return {
    google: n(/Google\s+(\d+)/),
    linkedin: n(/LinkedIn\s+(\d+)/),
    meta: n(/Meta\s+(\d+)/),
    creatives,
  };
}

// Maturity level shared by RST and AI diagnoses: "1–2" -> 1, "L3" -> 3.
export function firstLevel(s: string | null | undefined): number | null {
  const m = (s ?? '').match(/(\d)/);
  if (!m) return null;
  const v = parseInt(m[1], 10);
  return v >= 1 && v <= 5 ? v : null;
}

export const AI_DIMENSION_LABELS: Record<string, string> = {
  lead_generation: 'Generowanie leadów',
  crm_intelligence: 'Wiedza o kliencie w CRM',
  deal_progression: 'Postęp szans sprzedaży',
  tool_utilization: 'Wykorzystanie narzędzi',
  process_consistency: 'Powtarzalność (zależność od lidera)',
  founder_dependency: 'Powtarzalność (zależność od lidera)',
};

export interface AiDimension {
  key: string;
  level: number;
  note: string | null;
  detail: string | null;
}

export interface AiAssessment {
  overall: string | null;
  dimensions: AiDimension[];
  gaps: AiDimension[];
}

function dimKey(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, '_');
}

// ai_self_assessment comes in two generations of the survey output:
// new ("- lead_generation: L2 / Mixed approach\n<detail>") with all five
// dimensions, and old ("Overall Level: L2 ... Gaps: x at L3 - ...") with
// gaps only. Both carry a gaps list, so that is parsed for either format.
export function parseAiAssessment(
  rawText: string | null | undefined,
): AiAssessment {
  const text = rawText ?? '';
  const overall =
    (text.match(/Overall (?:score|Level)[:\s]*L?([\d.]+)/i) || [])[1] ?? null;

  const dimensions: AiDimension[] = [];
  const dimRe =
    /^-\s*([a-z_]+):\s*L(\d)\s*\/\s*([^\n]+)(?:\n(?!\s*-|\s*$)([^\n]+))?/gm;
  let m: RegExpExecArray | null;
  while ((m = dimRe.exec(text)) !== null) {
    dimensions.push({
      key: m[1],
      level: parseInt(m[2], 10),
      note: m[3].trim(),
      detail: m[4] ? m[4].trim() : null,
    });
  }

  const gaps: AiDimension[] = [];
  const gapsSection = text.match(/gaps:\s*([\s\S]*)$/i);
  if (gapsSection) {
    const body = gapsSection[1];
    const hits = Array.from(
      body.matchAll(/([A-Za-z_]+(?:[ _][A-Za-z]+)?) at L(\d)/g),
    );
    hits.forEach((h, i) => {
      const start = (h.index ?? 0) + h[0].length;
      const end =
        i + 1 < hits.length ? (hits[i + 1].index ?? body.length) : body.length;
      const note = body
        .slice(start, end)
        .replace(/^\s*-\s*/, '')
        .replace(/[\s,-]+$/, '')
        .trim();
      gaps.push({
        key: dimKey(h[1]),
        level: parseInt(h[2], 10),
        note: note || null,
        detail: null,
      });
    });
  }

  return { overall, dimensions, gaps };
}

export interface AiRecommendation {
  headline: string | null;
  horizon: string | null;
  currentState: string | null;
  constraints: string | null;
  foundation: string[];
}

export function parseAiRecommendation(
  rawText: string | null | undefined,
): AiRecommendation {
  const text = (rawText ?? '').trim();
  const first = text.split('\n')[0]?.trim() ?? '';
  const headline =
    first && !/^current state/i.test(first)
      ? first.replace(/\s*\([^)]*\)\s*$/, '')
      : null;
  const horizon = (first.match(/\(([^()]*\d\s*mo)\)/) || [])[1] ?? null;
  const currentState =
    (text.match(/current state:\s*\n?([^\n]+)/i) || [])[1]?.trim() ?? null;
  const constraints =
    (text.match(/constraints:\s*\n?([^\n]+)/i) || [])[1]?.trim() ?? null;
  const fw = (text.match(/foundation work:\s*([\s\S]+)$/i) || [])[1] ?? '';
  const foundation = fw
    .split(/\n\s*-\s+|\s+-\s+(?=[A-Z])|\.,\s*(?=[A-Z])/)
    .map((s) => s.replace(/^\s*-\s*/, '').trim())
    .filter((s) => s.length > 3);
  return { headline, horizon, currentState, constraints, foundation };
}

// Source titles already carry their own "P1." / "P1 " prefix; the card adds
// its own P-badge, so strip it to avoid "P1 P1. ..."
export function stripPIndex(title: string | null): string | null {
  return title ? title.replace(/^P\d\.?\s*/, '') : null;
}

function firstLine(s: string): string {
  const i = s.indexOf('\n');
  return i === -1 ? s : s.slice(0, i);
}

function restLines(s: string): string {
  const i = s.indexOf('\n');
  return i === -1 ? '' : s.slice(i + 1).trim();
}

export interface ProblemValuePair {
  idx: number;
  problemTitle: string | null;
  problemBody: string | null;
  valueTitle: string | null;
  valueBody: string | null;
}

export interface ProblemsAndValue {
  maturity: string | null;
  combined: ProblemValuePair[];
  closing: string | null;
}

const EMPTY_PROBLEMS_AND_VALUE: ProblemsAndValue = {
  maturity: null,
  combined: [],
  closing: null,
};

export function parseProblemsAndValue(
  rawProblemsText: string | null | undefined,
  rawValueText: string | null | undefined,
): ProblemsAndValue {
  const problemsText = rawProblemsText ?? '';
  const valueText = rawValueText ?? '';
  if (!problemsText.trim() && !valueText.trim())
    return EMPTY_PROBLEMS_AND_VALUE;

  const maturity =
    (problemsText.match(/Poziom dojrzałości \(szacunek\):\s*([^.]+)\./) ||
      [])[1] || null;

  const pSections = splitByMarkers(problemsText, [
    'P1.',
    'P2.',
    'P3.',
    '\n\nRole:',
  ]);
  const vSections = splitByMarkers(valueText, [
    'P1 ',
    'P2 ',
    'P3 ',
    'Czego nie robimy',
  ]);
  const closing = vSections.find((s) => s.marker === 'Czego nie robimy');

  const combined: ProblemValuePair[] = [1, 2, 3].map((n) => {
    const p = pSections.find((s) => s.marker === 'P' + n + '.');
    const v = vSections.find((s) => s.marker === 'P' + n + ' ');
    return {
      idx: n,
      problemTitle: p ? firstLine(p.body) : null,
      problemBody: p ? restLines(p.body) : null,
      valueTitle: v ? firstLine(v.body) : null,
      valueBody: v ? restLines(v.body) : null,
    };
  });

  return {
    maturity,
    combined: combined.filter((p) => p.problemTitle || p.valueTitle),
    closing: closing ? closing.body : null,
  };
}

export const SENIORITY_LABEL: Record<string, string> = {
  director: 'Dyrektor',
  manager: 'Manager',
  entry: 'Junior/Entry',
};

export function seniorityRank(s: string): number {
  return s === 'director' ? 3 : s === 'manager' ? 2 : 1;
}

export function fmtPLN(n: number | null): string | null {
  if (n == null) return null;
  return n.toLocaleString('pl-PL') + ' zł';
}

export function fmtMln(n: number | null): string | null {
  if (n == null) return null;
  return (
    n.toLocaleString('pl-PL', {
      maximumFractionDigits: 1,
      minimumFractionDigits: 1,
    }) + ' mln zł'
  );
}
