# HubSpot — deduplikacja firm

Narzędzie do znalezienia i scalenia zduplikowanych rekordów firm w HubSpot.
Bez zależności — wymaga tylko Node 18+.

## Dlaczego skrypt, a nie po prostu scalenie z czatu

Konektor HubSpot MCP udostępnia odczyt CRM oraz tworzenie/aktualizację rekordów,
ale **nie ma operacji scalania** — merge to osobny endpoint
(`POST /crm/v3/objects/companies/merge`), którego przez MCP nie da się wywołać.
Dlatego scalanie wymaga tokenu private appa i uruchomienia tych skryptów.

## Konfiguracja

W HubSpot: **Settings → Integrations → Private Apps → Create private app**,
zakres uprawnień: `crm.objects.companies.read` oraz `crm.objects.companies.write`.

```bash
export HUBSPOT_TOKEN=pat-eu1-...
export HUBSPOT_PORTAL_ID=26782316   # opcjonalnie, do linków w raporcie
```

## Użycie

```bash
# 1. Skan: pobiera wszystkie firmy i wypisuje grupy duplikatów
node hubspot-dedupe/scan.mjs

# 2. Przejrzyj wygenerowany CSV — w szczególności wiersze z decyzja=weryfikuj

# 3. Próba na sucho: pokazuje, co zostanie z czym scalone
node hubspot-dedupe/merge.mjs hubspot-dedupe/reports/skan-RRRR-MM-DD.csv

# 4. Wykonanie
node hubspot-dedupe/merge.mjs hubspot-dedupe/reports/skan-RRRR-MM-DD.csv --apply
```

## Jak wykrywane są duplikaty

Grupowanie po dwóch kluczach:

- **domena** — znormalizowana (bez `www.`, bez protokołu, lowercase),
- **nazwa** — znormalizowana (lowercase, bez diakrytyków i interpunkcji,
  bez form prawnych na końcu: `sp. z o.o.`, `S.A.`, `GmbH`, `Ltd`…).

Każda grupa dostaje decyzję:

| decyzja | kiedy | co robi `merge.mjs` |
|---|---|---|
| `scal` | nazwy w grupie są zgodne (jedna jest przedrostkiem drugiej) i domeny się nie kłócą | scala |
| `weryfikuj` | ta sama domena, ale wyraźnie różne nazwy; albo ta sama nazwa, ale różne domeny; albo grupa > 3 rekordów | **pomija** |

`weryfikuj` chroni przed realnymi pułapkami w tym portalu, m.in.:

- **wspólna domena, różne podmioty** — `koszalin.pl` to trzy niezależne
  organizacje (MPS International, AZS Koszalin, ZETO Koszalin);
  `santander.pl` to Santander Bank Polska i Santander TFI;
  `grupaazoty.com` to spółka matka i Grupa Azoty Polyolefins.
- **wspólna nazwa, różne firmy** — 10 rekordów nazwanych „Radical Sales Team"
  ma różne domeny (`monday.com`, `allegro.pl`, `hubspot.com`, `asseco.com`…).
  To nie duplikaty, tylko nadpisana nazwa — scalenie skasowałoby 9 osobnych firm.

Żeby scalić grupę oznaczoną jako `weryfikuj`, zmień w CSV `weryfikuj` na `scal`
(i w razie potrzeby przestaw, który rekord jest `MASTER`-em).

## Wybór MASTER-a

MASTER to rekord z największą liczbą powiązań (deale ważone ×10, potem kontakty),
przy remisie — najstarszy. Ma to znaczenie, bo HubSpot przy scalaniu **zachowuje
właściwości MASTER-a**, a z rekordu scalanego przenosi tylko powiązania i aktywności.

## Nieodwracalność

Scalenie firm w HubSpot jest trwałe — rekordu scalanego nie da się odzyskać.
Zawsze uruchom najpierw próbę na sucho i przejrzyj listę.

## Raporty

- `reports/2026-08-01-duplikaty-po-domenie.csv` — skan z 2026-08-01 ograniczony
  do duplikatów o identycznej domenie (57 grup / 116 rekordów), zrobiony przez
  konektor MCP. Pełny skan (również po nazwie) daje `scan.mjs`.
