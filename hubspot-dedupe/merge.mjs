#!/usr/bin/env node
// Scala firmy według zatwierdzonego CSV ze skanu. Domyślnie działa na sucho.
//
//   node hubspot-dedupe/merge.mjs raport.csv           # tylko pokazuje, co zrobi
//   node hubspot-dedupe/merge.mjs raport.csv --apply    # wykonuje scalenia
//
// Scalane są WYŁĄCZNIE grupy z decyzja=scal. Wiersze z decyzja=weryfikuj są pomijane —
// żeby je scalić, zmień wartość w CSV ręcznie po sprawdzeniu rekordów.
//
// UWAGA: scalenia w HubSpot są nieodwracalne. Rekord "scal-do-mastera" znika,
// a jego powiązania i aktywności trafiają na MASTER-a.

import { readFileSync, writeFileSync } from 'node:fs';
import { requireToken, hs, parseCsv, toCsv } from './lib.mjs';

const [, , csvPath, ...flags] = process.argv;
if (!csvPath) {
  console.error('Użycie: node hubspot-dedupe/merge.mjs <raport.csv> [--apply]');
  process.exit(1);
}
const apply = flags.includes('--apply');
const token = requireToken();

const rows = parseCsv(readFileSync(csvPath, 'utf8'));
const groups = new Map();
for (const r of rows) {
  if (!groups.has(r.grupa)) groups.set(r.grupa, []);
  groups.get(r.grupa).push(r);
}

const plan = [];
const skipped = [];

for (const [id, recs] of groups) {
  const decision = recs[0].decyzja;
  if (decision !== 'scal') {
    skipped.push({ grupa: id, klucz: recs[0].klucz, powod: recs[0].powod || 'oznaczone jako "weryfikuj"' });
    continue;
  }
  const masters = recs.filter((r) => r.rola === 'MASTER');
  const losers = recs.filter((r) => r.rola !== 'MASTER');
  if (masters.length !== 1 || losers.length === 0) {
    skipped.push({ grupa: id, klucz: recs[0].klucz, powod: `oczekiwano 1 MASTER-a i >=1 rekordu do scalenia, jest ${masters.length}/${losers.length}` });
    continue;
  }
  for (const loser of losers) {
    plan.push({
      grupa: id,
      klucz: recs[0].klucz,
      master: masters[0].id,
      masterNazwa: masters[0].nazwa,
      scalany: loser.id,
      scalanaNazwa: loser.nazwa,
    });
  }
}

console.log(`Grup w CSV:          ${groups.size}`);
console.log(`Grup pominiętych:    ${skipped.length}`);
console.log(`Scaleń do wykonania: ${plan.length}`);
console.log('');

for (const p of plan) {
  console.log(`[${p.klucz}] ${p.scalany} "${p.scalanaNazwa}"  →  ${p.master} "${p.masterNazwa}"`);
}

if (!apply) {
  console.log('\nPróba na sucho — nic nie zostało zmienione. Dodaj --apply, żeby wykonać.');
  process.exit(0);
}

const results = [];
let ok = 0;
let failed = 0;

for (const [i, p] of plan.entries()) {
  try {
    await hs('/crm/v3/objects/companies/merge', {
      method: 'POST',
      token,
      body: { primaryObjectId: p.master, objectIdToMerge: p.scalany },
    });
    ok++;
    results.push({ ...p, status: 'ok', blad: '' });
  } catch (err) {
    failed++;
    results.push({ ...p, status: 'blad', blad: err.message.replace(/\s+/g, ' ').slice(0, 300) });
    console.error(`  BŁĄD dla ${p.scalany} → ${p.master}: ${err.message}`);
  }
  process.stderr.write(`\rWykonano ${i + 1}/${plan.length} (ok: ${ok}, błędy: ${failed})`);
}
process.stderr.write('\n');

const logPath = csvPath.replace(/\.csv$/, '') + '-wynik.csv';
writeFileSync(logPath, toCsv(results, ['grupa', 'klucz', 'master', 'masterNazwa', 'scalany', 'scalanaNazwa', 'status', 'blad']), 'utf8');
console.log(`\nScalone: ${ok}, błędy: ${failed}. Log: ${logPath}`);
