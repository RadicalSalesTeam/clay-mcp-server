# GTM Radar — HubSpot Company CRM card

HubSpot Developer Project (UI Extension, not a legacy CRM card) that renders a
sidebar card on the Company record showing GTM model, financial highlights and
sales team structure — built exclusively from real values in Company custom
properties. No invented content; every section renders an explicit empty
state when its source property is unset.

Deployed to portal 26782316 (Radical Sales Team) as project `gtm-radar`.

## Source properties

- `gtm_model` — Rumsfeld matrix (4 sections, rendered as accordions)
- `sales_team_composition` — role counts, names, and the extended roster
  (rendered as a bar chart + table)
- `sales_team_summary` — labeled "Financial Highlights" in HubSpot; holds
  revenue/EBITDA/rating/trade-credit/valuation data. Also contains NIP/KRS,
  which are deliberately never parsed or rendered.
- `our_value_hypothesis_statement` + `three_problems_we_solve_for_them` —
  paired P1/P2/P3 diagnosis + value thesis blocks
- `hs_ideal_customer_profile` — tier tag in the header

## Structure

```
hsproject.json
src/app/app-hsmeta.json           # private static app, crm.objects.companies.read
src/app/cards/gtm-radar-card-hsmeta.json   # card config (crm.record.sidebar, companies)
src/app/cards/GtmRadarCard.tsx    # card component (@hubspot/ui-extensions)
src/app/cards/parsers.ts          # regex parsers for the four source properties
```

`parsers.ts` ports the parsing logic 1:1 from the validated prototype
(tested against Marco sp. z o.o., Reventon Group Ltd., PROMOTECH), with
added guards so a missing/empty property returns an empty result instead of
throwing.

## Local development

```
cd src/app/cards
npm install
npx tsc --noEmit
npx eslint .
```

## Deploy

```
hs auth --personal-access-key <key> --default
hs project upload
```

## Enabling the card

A freshly uploaded UI Extension card is not attached to any view
automatically — this is standard HubSpot behavior, not a deploy step that
was skipped. On a Company record: **Customize** → pick a tab → **+** → filter
the card library by **App** → select **GTM Radar** → **Save**. Once added to
one view it appears on that view for all Company records that have data in
the properties above.
