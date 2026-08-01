#!/usr/bin/env node
// Pobiera wszystkie firmy z HubSpot, grupuje duplikaty i zapisuje raport CSV + JSON.
//
//   HUBSPOT_TOKEN=pat-... node hubspot-dedupe/scan.mjs
//   HUBSPOT_TOKEN=pat-... node hubspot-dedupe/scan.mjs --out reports/2026-08-01

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { requireToken, hs, buildGroups, toCsv, normDomain, normName } from './lib.mjs';

const PROPERTIES = [
  'name',
  'domain',
  'website',
  'phone',
  'createdate',
  'hs_lastmodifieddate',
  'num_associated_contacts',
  'num_associated_deals',
  'hubspot_owner_id',
  'lifecyclestage',
];

function arg(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i === -1 ? fallback : process.argv[i + 1];
}

async function fetchAllCompanies(token) {
  const out = [];
  let after;
  do {
    const qs = new URLSearchParams({ limit: '100', properties: PROPERTIES.join(',') });
    if (after) qs.set('after', after);
    const page = await hs(`/crm/v3/objects/companies?${qs}`, { token });
    for (const r of page.results) out.push({ id: r.id, ...r.properties });
    after = page.paging?.next?.after;
    process.stderr.write(`\rPobrano firm: ${out.length}`);
  } while (after);
  process.stderr.write('\n');
  return out;
}

const token = requireToken();
const outBase = arg('--out', `hubspot-dedupe/reports/skan-${new Date().toISOString().slice(0, 10)}`);
mkdirSync(dirname(outBase), { recursive: true });

const companies = await fetchAllCompanies(token);
const groups = buildGroups(companies);

const auto = groups.filter((g) => g.verdict === 'auto');
const review = groups.filter((g) => g.verdict === 'review');
const surplus = groups.reduce((n, g) => n + g.records.length - 1, 0);

const rows = [];
for (const [i, g] of groups.entries()) {
  for (const r of g.records) {
    rows.push({
      grupa: i + 1,
      klucz: g.key,
      kryterium: g.kind === 'domain' ? 'domena' : 'nazwa',
      decyzja: g.verdict === 'auto' ? 'scal' : 'weryfikuj',
      powod: g.reason,
      rola: r.role === 'master' ? 'MASTER' : 'scal-do-mastera',
      id: r.id,
      nazwa: r.name || '',
      domena: normDomain(r.domain),
      nazwa_znormalizowana: normName(r.name),
      utworzono: (r.createdate || '').slice(0, 10),
      kontakty: r.num_associated_contacts || '0',
      deale: r.num_associated_deals || '0',
      url: `https://app.hubspot.com/contacts/${process.env.HUBSPOT_PORTAL_ID || '26782316'}/record/0-2/${r.id}`,
    });
  }
}

const columns = Object.keys(rows[0] ?? { grupa: '' });
writeFileSync(`${outBase}.csv`, toCsv(rows, columns), 'utf8');
writeFileSync(`${outBase}.json`, JSON.stringify({ scannedAt: new Date().toISOString(), total: companies.length, groups }, null, 2), 'utf8');

console.log(`Firm w portalu:        ${companies.length}`);
console.log(`Grup duplikatów:       ${groups.length}  (do scalenia: ${auto.length}, do weryfikacji: ${review.length})`);
console.log(`Rekordów do usunięcia: ${surplus}`);
console.log(`\nRaport: ${outBase}.csv  /  ${outBase}.json`);
console.log('\nPrzejrzyj CSV, popraw kolumny "decyzja" i "rola" tam, gdzie trzeba, a potem:');
console.log(`  node hubspot-dedupe/merge.mjs ${outBase}.csv          # próba na sucho`);
console.log(`  node hubspot-dedupe/merge.mjs ${outBase}.csv --apply  # faktyczne scalanie`);
