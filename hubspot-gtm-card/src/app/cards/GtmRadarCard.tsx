import {
  Accordion,
  BarChart,
  CrmContext,
  Divider,
  ExtensionPointApiActions,
  Flex,
  Heading,
  LoadingSpinner,
  ScoreCircle,
  Stack,
  Statistics,
  StatisticsItem,
  StatisticsTrend,
  StatusTag,
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
import {
  fmtPLN,
  parseAdSignal,
  parseFinancials,
  parseGtmModel,
  parseProblemsAndValue,
  parseTeam,
  ROLES,
  seniorityRank,
  SENIORITY_LABEL,
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

hubspot.extend<'crm.record.tab'>(({ context, actions }: CrmExtensionProps) => (
  <GtmRadarCard context={context} actions={actions} />
));

function TextBlock({
  text,
  variant,
}: {
  text: string;
  variant?: 'bodytext' | 'microcopy';
}) {
  const lines = text.split('\n').filter((line) => line.trim().length > 0);
  return (
    <Stack direction="column" distance="xs">
      {lines.map((line, i) => (
        <Text key={i} variant={variant}>
          {line}
        </Text>
      ))}
    </Stack>
  );
}

function Placeholder({ text }: { text: string }) {
  return <Text variant="microcopy">{text}</Text>;
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

  const hasAnyFinancials =
    fin.revenue != null ||
    fin.ebitda != null ||
    fin.margin != null ||
    fin.employees != null ||
    fin.rating != null;

  // One combined chart for revenue + EBITDA: both are already in the same
  // unit (mln zł), so grouping by color on one linear axis is the correct
  // way to compare them — the chart API has no true dual-axis mode, and
  // none is needed here since nothing needs a second scale.
  const financeChartData: { rok: string; metryka: string; mlnZl: number }[] =
    [];
  if (fin.trend) {
    const years = [
      fin.trend.fromYear,
      fin.trend.fromYear + 1,
      fin.trend.toYear,
    ];
    fin.trend.values.forEach((v, i) => {
      if (v != null) {
        financeChartData.push({ rok: String(years[i]), metryka: 'Przychód', mlnZl: v });
      }
    });
    if (fin.ebitda != null) {
      financeChartData.push({
        rok: String(fin.trend.toYear),
        metryka: 'EBITDA',
        mlnZl: fin.ebitda / 1e6,
      });
    }
  } else {
    const rok = fin.revYear || 'ostatni rok';
    if (fin.revenue != null) {
      financeChartData.push({ rok, metryka: 'Przychód', mlnZl: fin.revenue / 1e6 });
    }
    if (fin.ebitda != null) {
      financeChartData.push({ rok, metryka: 'EBITDA', mlnZl: fin.ebitda / 1e6 });
    }
  }

  const roleRows = ROLES.filter((r) => (team.counts[r] ?? 0) > 0).sort(
    (a, b) => (team.counts[b] ?? 0) - (team.counts[a] ?? 0),
  );
  const sortedRoster = [...team.roster].sort(
    (a, b) =>
      seniorityRank(b.seniority) - seniorityRank(a.seniority) ||
      (b.tenureFirm ?? 0) - (a.tenureFirm ?? 0),
  );
  const rosterCategories = Array.from(
    new Set(sortedRoster.map((p) => p.category)),
  );

  const hasAnyAi =
    !!properties.ai_primary_level ||
    !!properties.ai_self_assessment ||
    !!properties.ai_transformation_recommendation;

  return (
    <Stack direction="column" distance="md">
      {/* Header */}
      <Stack direction="column" distance="xs">
        <Heading>{companyName}</Heading>
        <Flex direction="row" gap="xs" wrap="wrap">
          {fin.industry && <Tag>{fin.industry}</Tag>}
          {fin.city && <Tag>{fin.city}</Tag>}
          {properties.hs_ideal_customer_profile && (
            <Tag variant="info">{properties.hs_ideal_customer_profile}</Tag>
          )}
          {team.total != null && <Tag>Zespół sprzedaży: {team.total}</Tag>}
        </Flex>
      </Stack>

      <Divider />

      {/* Financials */}
      <Stack direction="column" distance="sm">
        <Heading>Kondycja finansowa</Heading>
        {hasAnyFinancials ? (
          <Statistics>
            {fin.margin != null && (
              <StatisticsItem
                label="Marża EBITDA (wyliczona)"
                number={`${fin.margin.toLocaleString('pl-PL', { maximumFractionDigits: 1 })}%`}
              />
            )}
            {fin.employees != null && (
              <StatisticsItem
                label="Zatrudnienie"
                number={`${fin.employees} osób`}
              />
            )}
            {fin.rating && (
              <StatisticsItem label="Rating wiarygodności" number={fin.rating}>
                {fin.ratingLabel && (
                  <Text variant="microcopy">{fin.ratingLabel}</Text>
                )}
              </StatisticsItem>
            )}
            {fin.revYoyPct && (
              <StatisticsItem label="Przychód r/r" number={fin.revYoyPct}>
                <StatisticsTrend
                  value={fin.revYoyPct}
                  direction={fin.revDir === 'down' ? 'decrease' : 'increase'}
                  color={fin.revDir === 'down' ? 'red' : 'green'}
                />
              </StatisticsItem>
            )}
          </Statistics>
        ) : (
          <Placeholder text="Pole sales_team_summary jest puste dla tej firmy." />
        )}

        {fin.tradeCreditSafe != null && fin.tradeCreditMax != null && (
          <Flex direction="row" gap="sm" align="center">
            <ScoreCircle
              score={Math.round(
                (fin.tradeCreditSafe / fin.tradeCreditMax) * 100,
              )}
            />
            <Stack direction="column" distance="xs">
              <Text format={{ fontWeight: 'demibold' }}>
                Kredyt kupiecki (bezpieczny udział maks. limitu)
              </Text>
              <Text variant="microcopy">
                {fmtPLN(fin.tradeCreditSafe)} bezpiecznie z rekomendowanych
                maks. {fmtPLN(fin.tradeCreditMax)}
              </Text>
            </Stack>
          </Flex>
        )}

        {financeChartData.length > 0 ? (
          <BarChart
            data={financeChartData}
            axes={{
              x: { field: 'rok', fieldType: 'category', label: 'Rok' },
              y: { field: 'mlnZl', fieldType: 'linear', label: 'mln zł' },
              options: { groupFieldByColor: 'metryka' },
            }}
            options={{
              title: 'Przychód i EBITDA, mln zł',
              showLegend: true,
              showDataLabels: true,
              showTooltips: true,
            }}
          />
        ) : (
          <Placeholder text="Pole sales_team_summary nie zawiera przychodu ani EBITDA." />
        )}
      </Stack>

      <Divider />

      {/* Sales team */}
      <Stack direction="column" distance="sm">
        <Heading>Struktura zespołu sprzedaży</Heading>
        {roleRows.length > 0 ? (
          <BarChart
            data={roleRows.map((r) => ({
              rola: r,
              liczba: team.counts[r] ?? 0,
            }))}
            axes={{
              x: { field: 'rola', fieldType: 'category', label: 'Rola' },
              y: { field: 'liczba', fieldType: 'linear', label: 'Liczba osób' },
            }}
            options={{ title: 'Headcount wg roli', showDataLabels: true }}
          />
        ) : (
          <Placeholder text="Pole sales_team_composition jest puste dla tej firmy." />
        )}

        {rosterCategories.length > 0 && (
          <Tabs fill>
            {rosterCategories.map((cat) => {
              const people = sortedRoster.filter((p) => p.category === cat);
              return (
                <Tab key={cat} tabId={cat} title={`${cat} (${people.length})`}>
                  <Table bordered density="condensed">
                    <TableHead>
                      <TableRow>
                        <TableHeader>Osoba</TableHeader>
                        <TableHeader>Rola</TableHeader>
                        <TableHeader align="right">Staż w firmie</TableHeader>
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
                                p.seniority === 'director' ? 'info' : 'default'
                              }
                            >
                              {SENIORITY_LABEL[p.seniority] || p.seniority}
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
        )}
      </Stack>

      <Divider />

      {/* GTM Rumsfeld matrix */}
      <Stack direction="column" distance="sm">
        <Heading>Model GTM — macierz Rumsfelda</Heading>
        {adSignal && (
          <Tile compact>
            <Stack direction="column" distance="xs">
              <Text
                variant="microcopy"
                format={{ fontWeight: 'demibold', textTransform: 'uppercase' }}
              >
                Sygnał: aktywność reklamowa (inbound/outbound)
              </Text>
              <Text>{adSignal}</Text>
            </Stack>
          </Tile>
        )}
        {gtm.length > 0 ? (
          <Stack direction="column" distance="xs">
            {gtm.map((s) => (
              <Accordion key={s.marker} title={s.title}>
                <TextBlock text={s.body} />
              </Accordion>
            ))}
          </Stack>
        ) : (
          <Placeholder text="Model GTM (gtm_model) nie został jeszcze wygenerowany dla tej firmy." />
        )}
      </Stack>

      <Divider />

      {/* Diagnosis + value thesis */}
      <Stack direction="column" distance="sm">
        <Heading>
          Diagnoza i teza wartości
          {pv.maturity ? ` · dojrzałość sprzedaży: ${pv.maturity}` : ''}
        </Heading>
        {pv.combined.length > 0 ? (
          <Stack direction="column" distance="sm">
            {pv.combined.map((p) => (
              <Tile key={p.idx}>
                <Stack direction="column" distance="xs">
                  <Text format={{ fontWeight: 'bold' }}>
                    {`P${p.idx} ${p.problemTitle || p.valueTitle}`}
                  </Text>
                  {p.problemBody && (
                    <Stack direction="column" distance="xs">
                      <Text
                        variant="microcopy"
                        format={{
                          fontWeight: 'demibold',
                          textTransform: 'uppercase',
                        }}
                      >
                        Diagnoza
                      </Text>
                      <TextBlock text={p.problemBody} />
                    </Stack>
                  )}
                  {p.valueBody && (
                    <Stack direction="column" distance="xs">
                      <Text
                        variant="microcopy"
                        format={{
                          fontWeight: 'demibold',
                          textTransform: 'uppercase',
                        }}
                      >
                        Teza wartości
                      </Text>
                      <TextBlock text={p.valueBody} />
                    </Stack>
                  )}
                </Stack>
              </Tile>
            ))}
            {pv.closing && (
              <Tile compact>
                <TextBlock text={pv.closing} variant="microcopy" />
              </Tile>
            )}
          </Stack>
        ) : (
          <Placeholder text="Diagnoza i teza wartości nie zostały jeszcze wygenerowane dla tej firmy." />
        )}
      </Stack>

      <Divider />

      {/* AI diagnosis */}
      <Stack direction="column" distance="sm">
        <Heading>Diagnoza AI</Heading>
        {hasAnyAi ? (
          <Stack direction="column" distance="sm">
            {properties.ai_primary_level && (
              <Statistics>
                <StatisticsItem
                  label="Poziom AI (primary)"
                  number={properties.ai_primary_level}
                />
              </Statistics>
            )}
            {properties.ai_self_assessment && (
              <Stack direction="column" distance="xs">
                <Text
                  variant="microcopy"
                  format={{ fontWeight: 'demibold', textTransform: 'uppercase' }}
                >
                  Samoocena firmy
                </Text>
                <TextBlock text={properties.ai_self_assessment} />
              </Stack>
            )}
            {properties.ai_transformation_recommendation && (
              <Stack direction="column" distance="xs">
                <Text
                  variant="microcopy"
                  format={{ fontWeight: 'demibold', textTransform: 'uppercase' }}
                >
                  Rekomendacja transformacji
                </Text>
                <TextBlock text={properties.ai_transformation_recommendation} />
              </Stack>
            )}
          </Stack>
        ) : (
          <Placeholder text="Pola ai_self_assessment / ai_transformation_recommendation / ai_primary_level są jeszcze puste dla tej firmy." />
        )}
      </Stack>

      <Divider />

      <Text variant="microcopy">
        Źródła: gtm_model, sales_team_composition, sales_team_summary,
        our_value_hypothesis_statement, three_problems_we_solve_for_them,
        hs_ideal_customer_profile, ai_primary_level, ai_self_assessment,
        ai_transformation_recommendation
        {properties.hs_lastmodifieddate
          ? ` · ostatnia aktualizacja: ${new Date(properties.hs_lastmodifieddate).toLocaleDateString('pl-PL', { year: 'numeric', month: 'long', day: 'numeric' })}`
          : ''}
      </Text>
    </Stack>
  );
};
