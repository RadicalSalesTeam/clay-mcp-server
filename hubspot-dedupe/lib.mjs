// Wspólne funkcje: klient HubSpot API, normalizacja nazw/domen, grupowanie duplikatów.

const BASE = 'https://api.hubapi.com';

export function requireToken() {
  const token = process.env.HUBSPOT_TOKEN;
  if (!token) {
    console.error('Brak HUBSPOT_TOKEN. Utwórz private app w HubSpot (Settings → Integrations →');
    console.error('Private Apps) ze scope\'ami crm.objects.companies.read i crm.objects.companies.write,');
    console.error('a następnie: export HUBSPOT_TOKEN=pat-eu1-...');
    process.exit(1);
  }
  return token;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Wywołanie API z obsługą limitów (429) i błędów przejściowych (5xx).
export async function hs(path, { method = 'GET', body, token, retries = 5 } = {}) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.ok) return res.status === 204 ? null : res.json();

    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= retries) {
      const text = await res.text();
      const err = new Error(`HubSpot ${method} ${path} → ${res.status}: ${text}`);
      err.status = res.status;
      throw err;
    }
    await sleep(Math.min(2 ** attempt, 16) * 1000);
  }
}

// --- normalizacja -----------------------------------------------------------

// Domena rejestrowalna bez www i bez ścieżki; '' gdy brak.
export function normDomain(domain) {
  if (!domain) return '';
  return String(domain)
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '');
}

// Formy prawne i szum, które nie odróżniają dwóch rekordów tej samej firmy.
const LEGAL_FORMS = [
  'spolka z ograniczona odpowiedzialnoscia',
  'spolka komandytowo-akcyjna',
  'spolka komandytowa',
  'spolka jawna',
  'spolka akcyjna',
  'sp z o o sp k',
  'sp z o o',
  'sp j',
  'sp k',
  'sa',
  'gmbh',
  'ltd',
  'limited',
  'inc',
  'llc',
  'bv',
  'nv',
  'ag',
  'as',
  'oy',
  'ab',
  'srl',
  'spa',
];

export function normName(name) {
  if (!name) return '';
  let s = String(name)
    .toLowerCase()
    .replace(/ł/g, 'l') // ł nie rozkłada się przez NFD
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&amp;/g, '&')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  // Usuwaj formy prawne tylko z końca nazwy — "SA Group" to nie to samo co "Group".
  let changed = true;
  while (changed) {
    changed = false;
    for (const form of LEGAL_FORMS) {
      if (s.endsWith(' ' + form)) {
        s = s.slice(0, -(form.length + 1)).trim();
        changed = true;
      }
    }
  }
  return s.replace(/\s+/g, ' ').trim();
}

// --- grupowanie -------------------------------------------------------------

// Czy nazwy w grupie są na tyle zbieżne, by scalić bez ręcznej weryfikacji.
function namesCompatible(names) {
  const uniq = [...new Set(names.filter(Boolean))];
  if (uniq.length <= 1) return true;
  // Zgodne, gdy najkrótsza nazwa jest przedrostkiem (na granicy słowa) każdej pozostałej:
  // "Autenti" vs "Autenti Sp. z o.o." → tak; "Santander Bank" vs "Santander TFI" → nie.
  const shortest = uniq.reduce((a, b) => (a.length <= b.length ? a : b));
  return uniq.every((n) => n === shortest || n.startsWith(shortest + ' '));
}

function domainsCompatible(domains) {
  const uniq = [...new Set(domains.filter(Boolean))];
  return uniq.length <= 1;
}

/**
 * Buduje grupy duplikatów z listy firm.
 * Zwraca tablicę { key, kind, verdict, reason, records[] } — verdict: 'auto' | 'review'.
 */
export function buildGroups(companies) {
  const byDomain = new Map();
  const byName = new Map();

  for (const c of companies) {
    const d = normDomain(c.domain);
    const n = normName(c.name);
    if (d) {
      if (!byDomain.has(d)) byDomain.set(d, []);
      byDomain.get(d).push(c);
    }
    if (n) {
      if (!byName.has(n)) byName.set(n, []);
      byName.get(n).push(c);
    }
  }

  const groups = [];
  const seenPairs = new Set();

  const addGroup = (key, kind, records) => {
    if (records.length < 2) return;
    const ids = records.map((r) => r.id).sort().join(',');
    if (seenPairs.has(ids)) return;
    seenPairs.add(ids);

    const names = records.map((r) => normName(r.name));
    const domains = records.map((r) => normDomain(r.domain));

    let verdict = 'auto';
    const reasons = [];

    if (kind === 'domain' && !namesCompatible(names)) {
      verdict = 'review';
      reasons.push('ta sama domena, ale istotnie różne nazwy — mogą to być odrębne podmioty');
    }
    if (kind === 'name' && !domainsCompatible(domains)) {
      verdict = 'review';
      reasons.push('ta sama nazwa, ale różne domeny — może to być zła nazwa na rekordzie');
    }
    if (records.length > 3) {
      verdict = 'review';
      reasons.push(`${records.length} rekordów w grupie — zbyt duża, by scalać automatycznie`);
    }
    if (records.some((r) => Number(r.num_associated_deals || 0) > 0)) {
      reasons.push('w grupie są rekordy z dealami — sprawdź, który ma zostać masterem');
    }

    groups.push({ key, kind, verdict, reason: reasons.join('; '), records: pickMaster(records) });
  };

  for (const [d, recs] of byDomain) addGroup(d, 'domain', recs);
  for (const [n, recs] of byName) addGroup(n, 'name', recs);

  return groups.sort((a, b) => a.key.localeCompare(b.key));
}

// Master = najwięcej powiązań (kontakty, deale), przy remisie najstarszy rekord.
// HubSpot przenosi powiązania na master, ale właściwości mastera wygrywają — dlatego
// wybieramy rekord najbogatszy w dane.
function pickMaster(records) {
  const score = (r) => [
    Number(r.num_associated_contacts || 0) + Number(r.num_associated_deals || 0) * 10,
    -new Date(r.createdate).getTime(),
  ];
  const sorted = [...records].sort((a, b) => {
    const [sa, ta] = score(a);
    const [sb, tb] = score(b);
    return sb - sa || tb - ta;
  });
  return sorted.map((r, i) => ({ ...r, role: i === 0 ? 'master' : 'merge' }));
}

// --- CSV --------------------------------------------------------------------

export function toCsv(rows, columns) {
  const esc = (v) => {
    const s = v === undefined || v === null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.join(','), ...rows.map((r) => columns.map((c) => esc(r[c])).join(','))].join('\n') + '\n';
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (ch !== '\r') field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }

  const [header, ...body] = rows.filter((r) => r.length > 1 || r[0] !== '');
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}
