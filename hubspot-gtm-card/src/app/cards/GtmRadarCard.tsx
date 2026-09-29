import {
  Accordion,
  BarChart,
  CrmContext,
  Divider,
  EmptyState,
  ExtensionPointApiActions,
  Flex,
  Heading,
  LoadingSpinner,
  ProgressBar,
  Stack,
  Statistics,
  StatisticsItem,
  StatisticsTrend,
  StatusTag,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
  Text,
  Tile,
} from '@hubspot/ui-extensions';
import { hubspot } from '@hubspot/ui-extensions';
import { useCrmProperties } from '@hubspot/ui-extensions/crm';
import {
  fmtMln,
  fmtPLN,
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
  actions: ExtensionPointApiActions<'crm.record.sidebar'>;
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
];

hubspot.extend<'crm.record.sidebar'>(
  ({ context, actions }: CrmExtensionProps) => (
    <GtmRadarCard context={context} actions={actions} />
  ),
);

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
      <EmptyState
        title="Nie udało się wczytać danych"
        layout="vertical"
        imageName="api"
      >
        <Text>
          Spróbuj odświeżyć stronę. Jeśli problem się powtarza, sprawdź czy
          aplikacja ma uprawnienie do odczytu właściwości firmy.
        </Text>
      </EmptyState>
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

  const hasAnyFinancials =
    fin.revenue != null ||
    fin.ebitda != null ||
    fin.margin != null ||
    fin.employees != null ||
    fin.rating != null;
  const roleRows = ROLES.filter((r) => (team.counts[r] ?? 0) > 0).sort(
    (a, b) => (team.counts[b] ?? 0) - (team.counts[a] ?? 0),
  );
  const sortedRoster = [...team.roster].sort(
    (a, b) =>
      seniorityRank(b.seniority) - seniorityRank(a.seniority) ||
      (b.tenureFirm ?? 0) - (a.tenureFirm ?? 0),
  );

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
            {fin.revenue != null && (
              <StatisticsItem
                label={`Przychód (${fin.revYear || 'ostatni rok'})`}
                number={
                  fmtMln(fin.trend ? fin.trend.values[2] : fin.revenue / 1e6) ||
                  String(fin.revenue)
                }
              >
                {fin.revYoyPct && (
                  <StatisticsTrend
                    value={`${fin.revYoyPct} r/r`}
                    direction={fin.revDir === 'down' ? 'decrease' : 'increase'}
                    color={fin.revDir === 'down' ? 'red' : 'green'}
                  />
                )}
              </StatisticsItem>
            )}
            {fin.ebitda != null && (
              <StatisticsItem
                label="EBITDA"
                number={fmtMln(fin.ebitda / 1e6) || String(fin.ebitda)}
              >
                {fin.ebitdaYoy && (
                  <StatisticsTrend
                    value={`${fin.ebitdaYoy} r/r`}
                    direction={
                      fin.ebitdaYoy.startsWith('-') ? 'decrease' : 'increase'
                    }
                    color={fin.ebitdaYoy.startsWith('-') ? 'red' : 'green'}
                  />
                )}
              </StatisticsItem>
            )}
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
          </Statistics>
        ) : (
          <EmptyState
            title="Brak danych finansowych"
            layout="vertical"
            imageName="emptyStateCharts"
            flush
          >
            <Text variant="microcopy">
              Pole sales_team_summary jest puste dla tej firmy.
            </Text>
          </EmptyState>
        )}

        {fin.tradeCreditSafe != null && fin.tradeCreditMax != null && (
          <ProgressBar
            title="Kredyt kupiecki (bezpieczny)"
            value={fin.tradeCreditSafe}
            maxValue={fin.tradeCreditMax}
            valueDescription={`${fmtPLN(fin.tradeCreditSafe)} z rekomendowanych maks. ${fmtPLN(fin.tradeCreditMax)}`}
            variant="success"
          />
        )}

        {fin.trend ? (
          <BarChart
            data={[
              {
                rok: String(fin.trend.fromYear),
                przychod: fin.trend.values[0] ?? 0,
              },
              {
                rok: String(fin.trend.fromYear + 1),
                przychod: fin.trend.values[1] ?? 0,
              },
              {
                rok: String(fin.trend.toYear),
                przychod: fin.trend.values[2] ?? 0,
              },
            ]}
            axes={{
              x: { field: 'rok', fieldType: 'category', label: 'Rok' },
              y: {
                field: 'przychod',
                fieldType: 'linear',
                label: 'Przychód, mln zł',
              },
            }}
            options={{ showDataLabels: true, showTooltips: true }}
          />
        ) : (
          <EmptyState
            title="Brak trendu 3-letniego w źródle"
            layout="vertical"
            imageName="emptyStateCharts"
            flush
          >
            <Text variant="microcopy">
              Pole sales_team_summary nie zawiera segmentu trendu.
            </Text>
          </EmptyState>
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
            options={{ showDataLabels: true }}
          />
        ) : (
          <EmptyState
            title="Brak rozbicia wg ról"
            layout="vertical"
            imageName="contacts"
            flush
          >
            <Text variant="microcopy">
              Pole sales_team_composition jest puste dla tej firmy.
            </Text>
          </EmptyState>
        )}

        {sortedRoster.length > 0 && (
          <Table bordered density="condensed">
            <TableHead>
              <TableRow>
                <TableHeader>Osoba</TableHeader>
                <TableHeader>Rola</TableHeader>
                <TableHeader align="right">Staż w firmie</TableHeader>
                <TableHeader align="right">Staż w sprzedaży</TableHeader>
                <TableHeader>Poziom</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedRoster.map((p, i) => (
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
                      variant={p.seniority === 'director' ? 'info' : 'default'}
                    >
                      {SENIORITY_LABEL[p.seniority] || p.seniority}
                    </StatusTag>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Stack>

      <Divider />

      {/* GTM Rumsfeld matrix */}
      <Stack direction="column" distance="sm">
        <Heading>Model GTM — macierz Rumsfelda</Heading>
        {gtm.length > 0 ? (
          <Stack direction="column" distance="xs">
            {gtm.map((s) => (
              <Accordion key={s.marker} title={s.title}>
                <TextBlock text={s.body} />
              </Accordion>
            ))}
          </Stack>
        ) : (
          <EmptyState
            title="Pole gtm_model puste"
            layout="vertical"
            imageName="idea"
            flush
          >
            <Text variant="microcopy">
              Model GTM nie został jeszcze wygenerowany dla tej firmy.
            </Text>
          </EmptyState>
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
          <EmptyState
            title="Brak danych"
            layout="vertical"
            imageName="idea"
            flush
          >
            <Text variant="microcopy">
              Diagnoza i teza wartości nie zostały jeszcze wygenerowane dla tej
              firmy.
            </Text>
          </EmptyState>
        )}
      </Stack>

      <Divider />

      <Text variant="microcopy">
        Źródła: gtm_model, sales_team_composition, sales_team_summary,
        our_value_hypothesis_statement, three_problems_we_solve_for_them,
        hs_ideal_customer_profile
        {properties.hs_lastmodifieddate
          ? ` · ostatnia aktualizacja: ${new Date(properties.hs_lastmodifieddate).toLocaleDateString('pl-PL', { year: 'numeric', month: 'long', day: 'numeric' })}`
          : ''}
      </Text>
    </Stack>
  );
};
