import {
  Accordion,
  AutoGrid,
  CrmContext,
  Divider,
  ExtensionPointApiActions,
  Flex,
  Heading,
  List,
  LoadingSpinner,
  ProgressBar,
  ScoreCircle,
  Stack,
  StatusTag,
  StepIndicator,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  Tag,
  Text,
  Tile,
} from '@hubspot/ui-extensions';
import { hubspot } from '@hubspot/ui-extensions';
import { useCrmProperties } from '@hubspot/ui-extensions/crm';
import type { ReactNode } from 'react';
import {
  AI_DIMENSION_LABELS,
  firstLevel,
  fmtMln,
  fmtPLN,
  parseAdChannels,
  parseAdSignal,
  parseAiAssessment,
  parseAiRecommendation,
  parseFinancials,
  parseGtmModel,
  parsePostsSignal,
  parseProblemsAndValue,
  parseTeam,
  ROLES,
  seniorityRank,
  SENIORITY_LABEL,
  stripPIndex,
} from './parsers.js';

interface CrmExtensionProps {
  context: CrmContext;
  actions: ExtensionPointApiActions<'crm.record.tab'>;
}

const PROPERTY_NAMES = [
  'name',
  'gtm_model',
  'sales_team_composition',
  'sales_team_summary',
  'our_value_hypothesis_statement',
  'three_problems_we_solve_for_them',
  'hs_ideal_customer_profile',
  'hs_lastmodifieddate',
  'ai_primary_level',
  'ai_self_assessment',
  'ai_transformation_recommendation',
];

const LEVELS = ['L1', 'L2', 'L3', 'L4', 'L5'];

hubspot.extend<'crm.record.tab'>(({ context, actions }: CrmExtensionProps) => (
  <GtmRadarCard context={context} actions={actions} />
));

// Stack defaults to width "auto" (shrink to content), which collapsed the
// tile grids to one column and made charts size to their own content.
// Every layout column is forced to full width.
function Col({
  children,
  gap = 'sm',
}: {
  children: ReactNode;
  gap?: 'xs' | 'sm' | 'md' | 'lg';
}) {
  return (
    <Stack direction="column" distance={gap} width="100%" align="stretch">
      {children}
    </Stack>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Col gap="sm">
      <Heading>{title}</Heading>
      {children}
    </Col>
  );
}

function Label({ children }: { children: ReactNode }) {
  return (
    <Text
      variant="microcopy"
      format={{ fontWeight: 'demibold', textTransform: 'uppercase' }}
    >
      {children}
    </Text>
  );
}

function TileGrid({
  children,
  min = 170,
}: {
  children: ReactNode;
  min?: number;
}) {
  return (
    <AutoGrid columnWidth={min} gap="sm" flexible>
      {children}
    </AutoGrid>
  );
}

function TextBlock({
  text,
  variant,
}: {
  text: string;
  variant?: 'bodytext' | 'microcopy';
}) {
  const lines = text.split('\n').filter((line) => line.trim().length > 0);
  return (
    <Col gap="xs">
      {lines.map((line, i) => (
        <Text key={i} variant={variant}>
          {line}
        </Text>
      ))}
    </Col>
  );
}

function Placeholder({ text }: { text: string }) {
  return <Text variant="microcopy">{text}</Text>;
}

type Tone = 'success' | 'danger' | 'warning' | 'info' | 'default';

function StatTile({
  label,
  value,
  badge,
  badgeTone = 'default',
  caption,
}: {
  label: string;
  value: string;
  badge?: string;
  badgeTone?: Tone;
  caption?: string | null;
}) {
  return (
    <Tile compact>
      <Col gap="xs">
        <Label>{label}</Label>
        <Heading>{value}</Heading>
        {badge && <StatusTag variant={badgeTone}>{badge}</StatusTag>}
        {caption && <Text variant="microcopy">{caption}</Text>}
      </Col>
    </Tile>
  );
}

function trendTone(pct: string | null): Tone {
  if (!pct) return 'default';
  return pct.trim().startsWith('-') ? 'danger' : 'success';
}

function trendBadge(pct: string | null): string | undefined {
  if (!pct) return undefined;
  return `${pct.trim().startsWith('-') ? '▼' : '▲'} ${pct} r/r`;
}

function levelTone(level: number): 'success' | 'warning' | 'danger' {
  if (level <= 1) return 'danger';
  if (level <= 3) return 'warning';
  return 'success';
}

function adChannelTile(label: string, count: number | null) {
  if (count == null) {
    return (
      <StatTile
        key={label}
        label={label}
        value="—"
        badge="nie ustalono"
        badgeTone="warning"
      />
    );
  }
  return (
    <StatTile
      key={label}
      label={label}
      value={String(count)}
      badge={count > 0 ? 'reklamy aktywne' : 'brak reklam'}
      badgeTone={count > 0 ? 'success' : 'default'}
      caption={count === 1 ? 'kreacja' : 'kreacji'}
    />
  );
}

const GtmRadarCard = (_props: CrmExtensionProps) => {
  const { properties, isLoading, error } = useCrmProperties(PROPERTY_NAMES);

  if (isLoading) {
    return (
      <Flex justify="center">
        <LoadingSpinner label="Ładowanie danych GTM…" />
      </Flex>
    );
  }

  if (error) {
    return (
      <Text>
        Nie udało się wczytać danych. Spróbuj odświeżyć stronę. Jeśli problem
        się powtarza, sprawdź czy aplikacja ma uprawnienie do odczytu
        właściwości firmy.
      </Text>
    );
  }

  const companyName = properties.name || 'Firma bez nazwy';
  const fin = parseFinancials(properties.sales_team_summary);
  const team = parseTeam(properties.sales_team_composition);
  const gtm = parseGtmModel(properties.gtm_model);
  const pv = parseProblemsAndValue(
    properties.three_problems_we_solve_for_them,
    properties.our_value_hypothesis_statement,
  );
  const adSignal = parseAdSignal(properties.gtm_model);
  const ads = parseAdChannels(adSignal);
  const posts = parsePostsSignal(properties.gtm_model);
  const aiLevel = firstLevel(properties.ai_primary_level);
  const aiAssess = parseAiAssessment(properties.ai_self_assessment);
  const aiRec = parseAiRecommendation(
    properties.ai_transformation_recommendation,
  );

  const salesMaturity = pv.maturity;
  const marketingCount = team.counts['Marketing'] ?? null;
  const activeAdChannels = [ads.google, ads.linkedin, ads.meta].filter(
    (c) => c != null && c > 0,
  ).length;
  const knownAdChannels = [ads.google, ads.linkedin, ads.meta].filter(
    (c) => c != null,
  ).length;
  const totalCreatives = [ads.google, ads.linkedin, ads.meta].reduce<number>(
    (sum, c) => sum + (c ?? 0),
    0,
  );

  // ---------- Executive summary ----------
  const summaryTiles: ReactNode[] = [];
  if (fin.revenue != null) {
    summaryTiles.push(
      <StatTile
        key="rev"
        label={`Przychód ${fin.revYear ?? ''}`.trim()}
        value={
          fmtMln(fin.trend ? fin.trend.values[2] : fin.revenue / 1e6) ??
          String(fin.revenue)
        }
        badge={trendBadge(fin.revYoyPct)}
        badgeTone={trendTone(fin.revYoyPct)}
      />,
    );
  }
  if (fin.margin != null) {
    summaryTiles.push(
      <StatTile
        key="margin"
        label="Marża EBITDA"
        value={`${fin.margin.toLocaleString('pl-PL', { maximumFractionDigits: 1 })}%`}
      />,
    );
  }
  if (team.total != null) {
    summaryTiles.push(
      <StatTile
        key="team"
        label="Zespół sprzedaży"
        value={`${team.total} os.`}
        caption={
          marketingCount != null ? `+ marketing: ${marketingCount} os.` : null
        }
      />,
    );
  }
  if (salesMaturity) {
    summaryTiles.push(
      <StatTile
        key="maturity"
        label="Dojrzałość sprzedaży"
        value={salesMaturity}
        caption="szacunek RST"
      />,
    );
  }
  if (aiLevel != null) {
    summaryTiles.push(
      <StatTile
        key="ai"
        label="Poziom AI sprzedaży"
        value={`L${aiLevel} / L5`}
        badgeTone={levelTone(aiLevel)}
        badge={aiRec.horizon ? `plan: ${aiRec.horizon}` : undefined}
      />,
    );
  }
  if (knownAdChannels > 0) {
    summaryTiles.push(
      <StatTile
        key="ads"
        label="Płatna reklama"
        value={
          activeAdChannels > 0 ? `${totalCreatives} kreacji` : 'brak reklam'
        }
        badge={`${activeAdChannels}/3 kanałów aktywnych`}
        badgeTone={activeAdChannels > 0 ? 'success' : 'default'}
      />,
    );
  }

  // ---------- Financials ----------
  const finTiles: ReactNode[] = [];
  if (fin.revenue != null) {
    finTiles.push(
      <StatTile
        key="revenue"
        label="Przychód"
        value={
          fmtMln(fin.trend ? fin.trend.values[2] : fin.revenue / 1e6) ??
          String(fin.revenue)
        }
        badge={trendBadge(fin.revYoyPct)}
        badgeTone={trendTone(fin.revYoyPct)}
        caption={
          fin.trend
            ? `${fin.trend.fromYear}→${fin.trend.toYear}: ${fin.trend.values
                .map((v) =>
                  v == null
                    ? '?'
                    : v.toLocaleString('pl-PL', { maximumFractionDigits: 1 }),
                )
                .join(' → ')} mln zł`
            : null
        }
      />,
    );
  }
  if (fin.ebitda != null) {
    finTiles.push(
      <StatTile
        key="ebitda"
        label="EBITDA"
        value={fmtMln(fin.ebitda / 1e6) ?? String(fin.ebitda)}
        badge={trendBadge(fin.ebitdaYoy)}
        badgeTone={trendTone(fin.ebitdaYoy)}
      />,
    );
  }
  if (fin.margin != null) {
    finTiles.push(
      <StatTile
        key="margin"
        label="Marża EBITDA"
        value={`${fin.margin.toLocaleString('pl-PL', { maximumFractionDigits: 1 })}%`}
        caption="wyliczona: EBITDA / przychód"
      />,
    );
  }
  if (fin.netProfit != null) {
    finTiles.push(
      <StatTile
        key="net"
        label="Zysk netto"
        value={fmtMln(fin.netProfit / 1e6) ?? String(fin.netProfit)}
      />,
    );
  }
  if (fin.valuation != null) {
    finTiles.push(
      <StatTile
        key="val"
        label="Wycena (model)"
        value={fmtMln(fin.valuation / 1e6) ?? String(fin.valuation)}
      />,
    );
  }
  if (fin.employees != null) {
    finTiles.push(
      <StatTile
        key="emp"
        label="Zatrudnienie"
        value={`${fin.employees} osób`}
      />,
    );
  }
  if (fin.rating) {
    finTiles.push(
      <StatTile
        key="rating"
        label="Rating wiarygodności"
        value={fin.rating}
        badge={fin.ratingLabel ?? undefined}
        badgeTone={
          fin.rating === 'A'
            ? 'success'
            : fin.rating === 'B'
              ? 'warning'
              : 'danger'
        }
        caption={
          fin.insolvencyRisk
            ? `ryzyko niewypłacalności ${fin.insolvencyRisk}`
            : null
        }
      />,
    );
  }

  // ---------- Team ----------
  const roleRows = ROLES.filter(
    (r) => r !== 'Marketing' && (team.counts[r] ?? 0) > 0,
  ).sort((a, b) => (team.counts[b] ?? 0) - (team.counts[a] ?? 0));
  const roleMax = Math.max(1, ...roleRows.map((r) => team.counts[r] ?? 0));
  const sortedRoster = [...team.roster].sort(
    (a, b) =>
      seniorityRank(b.seniority) - seniorityRank(a.seniority) ||
      (b.tenureFirm ?? 0) - (a.tenureFirm ?? 0),
  );
  const rosterCategories = Array.from(
    new Set(sortedRoster.map((p) => p.category)),
  );
  const seniorityCount = (s: string) =>
    team.roster.filter((p) => p.seniority === s).length;
  const tenures = team.roster
    .map((p) => p.tenureFirm)
    .filter((t): t is number => t != null);
  const avgTenure =
    tenures.length > 0
      ? tenures.reduce((a, b) => a + b, 0) / tenures.length
      : null;

  const aiDims =
    aiAssess.dimensions.length > 0 ? aiAssess.dimensions : aiAssess.gaps;
  const hasAnyAi =
    !!properties.ai_primary_level ||
    !!properties.ai_self_assessment ||
    !!properties.ai_transformation_recommendation;

  return (
    <Col gap="md">
      {/* Header */}
      <Col gap="xs">
        <Heading>{companyName}</Heading>
        <Flex direction="row" gap="xs" wrap="wrap">
          {fin.industry && <Tag>{fin.industry}</Tag>}
          {fin.city && <Tag>{fin.city}</Tag>}
          {properties.hs_ideal_customer_profile && (
            <Tag variant="info">{properties.hs_ideal_customer_profile}</Tag>
          )}
        </Flex>
      </Col>

      {summaryTiles.length > 0 && <TileGrid min={160}>{summaryTiles}</TileGrid>}

      <Divider />

      {/* Financials */}
      <Section
        title={`Kondycja finansowa${fin.revYear ? ` (dane za ${fin.revYear})` : ''}`}
      >
        {finTiles.length > 0 ? (
          <TileGrid>{finTiles}</TileGrid>
        ) : (
          <Placeholder text="Pole sales_team_summary jest puste dla tej firmy." />
        )}
        {fin.tradeCreditSafe != null && fin.tradeCreditMax != null && (
          <Tile compact>
            <Flex direction="row" gap="md" align="center">
              <ScoreCircle
                score={Math.round(
                  (fin.tradeCreditSafe / fin.tradeCreditMax) * 100,
                )}
              />
              <Col gap="xs">
                <Label>Kredyt kupiecki</Label>
                <Text format={{ fontWeight: 'bold' }}>
                  {fmtPLN(fin.tradeCreditSafe)} bezpiecznie
                </Text>
                <Text variant="microcopy">
                  z rekomendowanego maksimum {fmtPLN(fin.tradeCreditMax)} —
                  wskaźnik pokazuje, jaki % maksimum jest bezpieczny
                </Text>
              </Col>
            </Flex>
          </Tile>
        )}
      </Section>

      <Divider />

      {/* Sales team */}
      <Section title="Zespół sprzedaży">
        {team.total != null || team.roster.length > 0 ? (
          <>
            <TileGrid>
              {team.total != null && (
                <StatTile
                  label="Handlowcy łącznie"
                  value={`${team.total} os.`}
                />
              )}
              <StatTile
                label="Dyrektor / Manager / Junior"
                value={`${seniorityCount('director')} / ${seniorityCount('manager')} / ${seniorityCount('entry')}`}
                caption="wg seniority z analizy osób"
              />
              {avgTenure != null && (
                <StatTile
                  label="Średni staż w firmie"
                  value={`${avgTenure.toLocaleString('pl-PL', { maximumFractionDigits: 1 })} lat`}
                />
              )}
              {marketingCount != null && (
                <StatTile
                  label="Marketing"
                  value={`${marketingCount} os.`}
                  caption="poza sumą zespołu sprzedaży"
                />
              )}
            </TileGrid>

            {roleRows.length > 0 && (
              <Col gap="xs">
                <Label>Headcount wg roli</Label>
                {roleRows.map((r) => (
                  <ProgressBar
                    key={r}
                    title={r}
                    value={team.counts[r] ?? 0}
                    maxValue={roleMax}
                    valueDescription={`${team.counts[r]} os.`}
                    variant="success"
                  />
                ))}
              </Col>
            )}

            {rosterCategories.length > 0 && (
              <Col gap="xs">
                <Label>Osoby wg roli</Label>
                <Tabs variant="enclosed">
                  {rosterCategories.map((cat) => {
                    const people = sortedRoster.filter(
                      (p) => p.category === cat,
                    );
                    return (
                      <Tab
                        key={cat}
                        tabId={cat}
                        title={`${cat} (${people.length})`}
                      >
                        <Table bordered density="condensed">
                          <TableHead>
                            <TableRow>
                              <TableHeader>Osoba</TableHeader>
                              <TableHeader>Stanowisko</TableHeader>
                              <TableHeader align="right">
                                Staż w firmie
                              </TableHeader>
                              <TableHeader align="right">
                                Staż w sprzedaży
                              </TableHeader>
                              <TableHeader>Poziom</TableHeader>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {people.map((p, i) => (
                              <TableRow key={i}>
                                <TableCell>{p.name}</TableCell>
                                <TableCell>{p.title}</TableCell>
                                <TableCell align="right">
                                  {p.tenureFirm != null
                                    ? `${p.tenureFirm.toLocaleString('pl-PL', { maximumFractionDigits: 1 })} lat`
                                    : '—'}
                                </TableCell>
                                <TableCell align="right">
                                  {p.tenureSales != null
                                    ? `${p.tenureSales.toLocaleString('pl-PL', { maximumFractionDigits: 1 })} lat`
                                    : '—'}
                                </TableCell>
                                <TableCell>
                                  <StatusTag
                                    variant={
                                      p.seniority === 'director'
                                        ? 'info'
                                        : 'default'
                                    }
                                  >
                                    {SENIORITY_LABEL[p.seniority] ||
                                      p.seniority}
                                  </StatusTag>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </Tab>
                    );
                  })}
                </Tabs>
              </Col>
            )}
          </>
        ) : (
          <Placeholder text="Pole sales_team_composition jest puste dla tej firmy." />
        )}
      </Section>

      <Divider />

      {/* Marketing & inbound */}
      <Section title="Marketing i inbound (reklama płatna)">
        {adSignal ? (
          <>
            <TileGrid>
              {adChannelTile('Google Ads', ads.google)}
              {adChannelTile('LinkedIn Ads', ads.linkedin)}
              {adChannelTile('Meta Ads', ads.meta)}
              {marketingCount != null && (
                <StatTile
                  label="Zespół marketingu"
                  value={`${marketingCount} os.`}
                />
              )}
            </TileGrid>
            {activeAdChannels > 0 && ads.creatives.length > 0 && (
              <Tile compact>
                <Col gap="xs">
                  <Label>Z czym wychodzą w reklamach</Label>
                  <List variant="unordered-styled">
                    {ads.creatives.map((c, i) => (
                      <Text key={i}>{`„${c}”`}</Text>
                    ))}
                  </List>
                </Col>
              </Tile>
            )}
            {posts && (
              <Tile compact>
                <Col gap="xs">
                  <Label>Content i social — o czym piszą</Label>
                  <Text>{posts}</Text>
                </Col>
              </Tile>
            )}
            <Accordion title="Pełny opis aktywności reklamowej (źródło)">
              <Text>{adSignal}</Text>
            </Accordion>
          </>
        ) : (
          <Placeholder text="Model GTM nie zawiera jeszcze danych o reklamach." />
        )}
      </Section>

      <Divider />

      {/* GTM Rumsfeld matrix */}
      <Section title="Model GTM — macierz Rumsfelda">
        {gtm.length > 0 ? (
          <Col gap="xs">
            {gtm.map((s) => (
              <Accordion key={s.marker} title={s.title}>
                <TextBlock text={s.body} />
              </Accordion>
            ))}
          </Col>
        ) : (
          <Placeholder text="Model GTM (gtm_model) nie został jeszcze wygenerowany dla tej firmy." />
        )}
      </Section>

      <Divider />

      {/* Diagnosis + value thesis */}
      <Section
        title={`Diagnoza i teza wartości${salesMaturity ? ` · dojrzałość sprzedaży: ${salesMaturity}` : ''}`}
      >
        {pv.combined.length > 0 ? (
          <Col gap="sm">
            {pv.combined.map((p) => (
              <Tile key={p.idx}>
                <Col gap="sm">
                  <Flex direction="row" gap="xs" align="center">
                    <Tag variant="info">{`P${p.idx}`}</Tag>
                    <Text format={{ fontWeight: 'bold' }}>
                      {stripPIndex(p.problemTitle) ?? stripPIndex(p.valueTitle)}
                    </Text>
                  </Flex>
                  <AutoGrid columnWidth={320} gap="md" flexible>
                    {p.problemBody && (
                      <Col gap="xs">
                        <Label>Diagnoza</Label>
                        <TextBlock text={p.problemBody} />
                      </Col>
                    )}
                    {p.valueBody && (
                      <Col gap="xs">
                        <Label>
                          Teza wartości
                          {p.valueTitle
                            ? ` — ${stripPIndex(p.valueTitle)}`
                            : ''}
                        </Label>
                        <TextBlock text={p.valueBody} />
                      </Col>
                    )}
                  </AutoGrid>
                </Col>
              </Tile>
            ))}
            {pv.closing && (
              <Tile compact>
                <TextBlock text={pv.closing} variant="microcopy" />
              </Tile>
            )}
          </Col>
        ) : (
          <Placeholder text="Diagnoza i teza wartości nie zostały jeszcze wygenerowane dla tej firmy." />
        )}
      </Section>

      <Divider />

      {/* AI diagnosis */}
      <Section title="Diagnoza AI — dojrzałość sprzedaży (L1–L5)">
        {hasAnyAi ? (
          <Col gap="sm">
            {aiLevel != null && (
              <Tile compact>
                <Col gap="xs">
                  <Label>
                    Poziom ogólny
                    {aiAssess.overall
                      ? ` · wynik ankiety ${aiAssess.overall}`
                      : ''}
                  </Label>
                  <StepIndicator
                    stepNames={LEVELS}
                    currentStep={aiLevel - 1}
                    circleSize="md"
                  />
                </Col>
              </Tile>
            )}

            {aiDims.length > 0 && (
              <Tile compact>
                <Col gap="xs">
                  <Label>
                    {aiAssess.dimensions.length > 0
                      ? 'Profil dojrzałości — 5 wymiarów'
                      : 'Luki wskazane w diagnozie'}
                  </Label>
                  {aiDims.map((d, i) => (
                    <ProgressBar
                      key={`${d.key}-${i}`}
                      title={AI_DIMENSION_LABELS[d.key] ?? d.key}
                      value={d.level}
                      maxValue={5}
                      valueDescription={`L${d.level}${d.note ? ` · ${d.note}` : ''}${d.detail ? ` — ${d.detail}` : ''}`}
                      variant={levelTone(d.level)}
                    />
                  ))}
                </Col>
              </Tile>
            )}

            {(aiRec.currentState ||
              aiRec.constraints ||
              aiRec.foundation.length > 0) && (
              <AutoGrid columnWidth={320} gap="sm" flexible>
                <Tile>
                  <Col gap="xs">
                    <Label>Gdzie są dziś</Label>
                    {aiRec.currentState && <Text>{aiRec.currentState}</Text>}
                    {aiRec.constraints && (
                      <>
                        <Label>Główne ograniczenie</Label>
                        <Text format={{ fontWeight: 'demibold' }}>
                          {aiRec.constraints}
                        </Text>
                      </>
                    )}
                  </Col>
                </Tile>
                <Tile>
                  <Col gap="xs">
                    <Label>
                      Plan transformacji
                      {aiRec.horizon ? ` · ${aiRec.horizon}` : ''}
                    </Label>
                    {aiRec.headline && (
                      <Text format={{ fontWeight: 'bold' }}>
                        {aiRec.headline}
                      </Text>
                    )}
                    {aiRec.foundation.length > 0 && (
                      <List variant="ordered-styled">
                        {aiRec.foundation.map((f, i) => (
                          <Text key={i}>{f}</Text>
                        ))}
                      </List>
                    )}
                  </Col>
                </Tile>
              </AutoGrid>
            )}

            <Accordion title="Pełny tekst diagnozy AI (źródło)">
              <Col gap="sm">
                {properties.ai_self_assessment && (
                  <Col gap="xs">
                    <Label>Samoocena (ai_self_assessment)</Label>
                    <TextBlock text={properties.ai_self_assessment} />
                  </Col>
                )}
                {properties.ai_transformation_recommendation && (
                  <Col gap="xs">
                    <Label>
                      Rekomendacja (ai_transformation_recommendation)
                    </Label>
                    <TextBlock
                      text={properties.ai_transformation_recommendation}
                    />
                  </Col>
                )}
              </Col>
            </Accordion>
          </Col>
        ) : (
          <Placeholder text="Brak diagnozy AI dla tej firmy — pola ai_primary_level, ai_self_assessment i ai_transformation_recommendation są puste (uzupełnią się po wypełnieniu ankiety dojrzałości)." />
        )}
      </Section>

      <Divider />

      <Text variant="microcopy">
        Źródła: pola firmy w HubSpot (gtm_model, sales_team_composition,
        sales_team_summary, our_value_hypothesis_statement,
        three_problems_we_solve_for_them, hs_ideal_customer_profile,
        ai_primary_level, ai_self_assessment, ai_transformation_recommendation)
        {properties.hs_lastmodifieddate
          ? ` · ostatnia aktualizacja: ${new Date(properties.hs_lastmodifieddate).toLocaleDateString('pl-PL', { year: 'numeric', month: 'long', day: 'numeric' })}`
          : ''}
      </Text>
    </Col>
  );
};
