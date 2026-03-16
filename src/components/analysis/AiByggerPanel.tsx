// AI Bygger — the green-box panel. Used natively inside Prototype3 and also
// as a standalone page (AiBygger.tsx wraps this with URL-param context).
import { useState, useEffect, useRef } from 'react';
import PinnedWidget from '../dashboard/PinnedWidget';
import ShareWidgetModal from './ShareWidgetModal';
import DownloadResultsModal from '../chartbuilder/results/DownloadResultsModal';
import { Button, Modal, Alert } from '@navikt/ds-react';
import Editor from '@monaco-editor/react';
import * as sqlFormatter from 'sql-formatter';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { useChartDataPrep } from '../../lib/useChartDataPrep';
import UmamiJourneyView from './journey/UmamiJourneyView';
import DashboardStatCards from '../dashboard/DashboardStatCards';
import DashboardKIForklaring from '../dashboard/DashboardKIForklaring';
import { WIDGET_SIZES } from '../../lib/widgetSizes';

const defaultQuery = `SELECT
  website_id,
  name
FROM
  \`fagtorsdag-prod-81a6.umami_student.public_website\`
LIMIT
  100;`;

type Step = 1 | 2 | 3;

const boxClass = 'bg-green-50 p-4 border border-green-100 w-full h-full flex flex-col';

/** Picks the most likely chart type from a natural-language prompt. */
function guessChartType(prompt: string): string {
    const p = prompt.toLowerCase();
    if (/sideflyt|beveger|flyt|navigasjon|navigerer|reise|brukerreise/.test(p)) return 'stegvisning';
    if (/regresjon|korrelasjon|lineær|trend.*linje|stigningstall|r2|r²|rmse|prediksjon/.test(p)) return 'regresjon';
    if (/daglig|m.ned|ukentlig|tidslinje|over tid|trend|utvikling|per dag|per m.ned/.test(p)) return 'linechart';
    if (/andel|prosent|fordeling|kake/.test(p)) return 'piechart';
    if (/topp|mest|flest|rangering|sammenlign|stolpe/.test(p)) return 'barchart';
    return 'table';
}

const allTabs = [
    { value: 'table',        label: 'Tabell' },
    { value: 'linechart',    label: 'Linje' },
    { value: 'areachart',    label: 'Område' },
    { value: 'barchart',     label: 'Stolpe' },
    { value: 'piechart',     label: 'Kake' },
    { value: 'statcards',    label: 'Nøkkeltall' },
    { value: 'stegvisning',  label: 'Sideflyt' },
    { value: 'kiforklaring', label: 'KI forklaring' },
];



interface Props {
    readonly websiteId: string;
    readonly path: string;
    readonly pathOperator: string;
    readonly startDate?: Date;
    readonly endDate?: Date;
    readonly onAddWidget?: (sql: string, chartType: string, result: any, size: { cols: number; rows: number }, title: string, aiPrompt: string) => void;
    readonly editWidget?: { sql: string; chartType: string; title: string; aiPrompt?: string; result?: any } | null;
}

export function AiByggerPanel({ websiteId, path, pathOperator, startDate: propStartDate, endDate: propEndDate, onAddWidget, editWidget }: Props) {
    const pathConditionSQL = pathOperator === 'starts-with'
        ? (path === '/' ? '' : `AND url_path LIKE '${path}%'`)
        : `AND url_path = '${path}'`;
    const pathLabel = pathOperator === 'starts-with'
        ? (path === '/' ? 'hele nettstedet' : `stier under ${path}`)
        : `siden ${path}`;

    const [step, setStep] = useState<Step>(1);
    const [query, setQuery] = useState(defaultQuery);
    const [aiPrompt, setAiPrompt] = useState(`Daglige sidevisninger for ${pathLabel} i 2025`);
    const [result, setResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [shareWidgetOpen, setShareWidgetOpen] = useState(false);
    const [downloadModalOpen, setDownloadModalOpen] = useState(false);
    const [pendingAdd, setPendingAdd] = useState<{ sql: string; chartType: string; result: any; title: string } | null>(null);
    const [tidligereOpen, setTidligereOpen] = useState(false);
    const [selectedTidligere, setSelectedTidligere] = useState<number | null>(null);
    const [p2Tab, setP2Tab] = useState('table');
    const [showMoreTabs, setShowMoreTabs] = useState(false);
    const [formatSuccess, setFormatSuccess] = useState(false);
    const [metabaseCopySuccess, setMetabaseCopySuccess] = useState(false);
    const [validateError, setValidateError] = useState<string | null>(null);
    const [showValidation, setShowValidation] = useState(false);
    const [estimate, setEstimate] = useState<any>(null);
    const [estimating, setEstimating] = useState(false);
    const [showEstimate, setShowEstimate] = useState(false);
    const [lagEgenSqlOpen, setLagEgenSqlOpen] = useState(false);
    const [lagEgenSqlTitle, setLagEgenSqlTitle] = useState('');
    const shouldAutoExecuteRef = useRef(false);
    const [editingTitle, setEditingTitle] = useState(false);

    // Load a widget from the dashboard for editing
    useEffect(() => {
        if (!editWidget) return;
        setQuery(editWidget.sql);
        setP2Tab(editWidget.chartType);
        setAiPrompt(editWidget.aiPrompt || editWidget.title);
        if (editWidget.result) {
            setResult(editWidget.result);
        } else {
            // No cached result — auto-execute when step 2 mounts
            shouldAutoExecuteRef.current = true;
        }
        setStep(2);
    }, [editWidget]);

    const [journeyData, setJourneyData] = useState<{ nodes: any[]; links: any[] } | null>(null);
    const [journeyLoading, setJourneyLoading] = useState(false);
    const defaultRegressionTitle = `Lineær regresjon: daglige sidevisninger for ${pathLabel} (2025)`;
    const [regressionTitle, setRegressionTitle] = useState(defaultRegressionTitle);
    const [isApiOnly, setIsApiOnly] = useState(false);
    const [tabOrder, setTabOrder] = useState<string[]>([]);
    const [currentExplanation, setCurrentExplanation] = useState<string | null>(null);

    const sortedTabs = tabOrder.length > 0
        ? [...allTabs].sort((a, b) => {
              const ai = tabOrder.indexOf(a.value);
              const bi = tabOrder.indexOf(b.value);
              if (ai === -1 && bi === -1) return 0;
              if (ai === -1) return 1;
              if (bi === -1) return -1;
              return ai - bi;
          })
        : allTabs;

    const MAX_VISIBLE_TABS = 8;
    const visibleTabs = sortedTabs.slice(0, MAX_VISIBLE_TABS);
    const overflowTabs = sortedTabs.slice(MAX_VISIBLE_TABS);
    const activeIsOverflow = overflowTabs.some(t => t.value === p2Tab);

    const buildRegressionSQLInline = () => {
        const pathFilter = pathConditionSQL.trim();
        return `WITH base AS (
  SELECT CAST(x AS FLOAT64) AS x, CAST(y AS FLOAT64) AS y FROM (
    SELECT
      DATE_DIFF(DATE(created_at), DATE('2025-01-01'), DAY) + 1 AS x,
      COUNT(*) AS y
    FROM \`fagtorsdag-prod-81a6.umami_student.event\`
    WHERE event_type = 1
      AND website_id = '${websiteId}'
      ${pathFilter}
      AND EXTRACT(YEAR FROM created_at) = 2025
    GROUP BY x
  )
),
stats AS (
  SELECT COUNT(*) AS n, AVG(x) AS x_bar, AVG(y) AS y_bar,
         VAR_SAMP(x) AS var_x, COVAR_SAMP(x, y) AS cov_xy
  FROM base
),
params AS (
  SELECT n, x_bar, y_bar,
    SAFE_DIVIDE(cov_xy, var_x) AS slope,
    y_bar - SAFE_DIVIDE(cov_xy, var_x) * x_bar AS intercept
  FROM stats
),
resid AS (
  SELECT b.x, b.y, p.n, p.x_bar, p.y_bar, p.slope, p.intercept,
    b.y - (p.intercept + p.slope * b.x) AS r
  FROM base b CROSS JOIN params p
),
sums AS (
  SELECT MIN(n) AS n, MIN(intercept) AS a, MIN(slope) AS b,
         MIN(x_bar) AS x_bar, MIN(y_bar) AS y_bar,
    SUM(POW(r, 2)) AS sse,
    SUM(POW(y - y_bar, 2)) AS sst,
    SUM(POW(x - x_bar, 2)) AS sxx
  FROM resid
),
m AS (
  SELECT n, a, b,
    1 - SAFE_DIVIDE(sse, sst) AS r2,
    SQRT(SAFE_DIVIDE(sse, n - 2)) AS rmse,
    SQRT(SAFE_DIVIDE(SAFE_DIVIDE(sse, n - 2), sxx)) AS se_b,
    SQRT(SAFE_DIVIDE(sse, n - 2) * (1.0 / n + POW(x_bar, 2) / sxx)) AS se_a
  FROM sums
),
pv AS (
  SELECT n, a, b, r2, rmse, se_a, se_b,
    SAFE_DIVIDE(a, se_a) AS t_a,
    SAFE_DIVIDE(b, se_b) AS t_b,
    GREATEST(0, 2 * EXP(-0.5 * POW(ABS(SAFE_DIVIDE(a, se_a)), 2)) / 2.506628 * (
       0.4361836 / (1 + 0.33267 * ABS(SAFE_DIVIDE(a, se_a)))
      - 0.1201676 / POW(1 + 0.33267 * ABS(SAFE_DIVIDE(a, se_a)), 2)
      + 0.9372980 / POW(1 + 0.33267 * ABS(SAFE_DIVIDE(a, se_a)), 3))) AS p_a,
    GREATEST(0, 2 * EXP(-0.5 * POW(ABS(SAFE_DIVIDE(b, se_b)), 2)) / 2.506628 * (
       0.4361836 / (1 + 0.33267 * ABS(SAFE_DIVIDE(b, se_b)))
      - 0.1201676 / POW(1 + 0.33267 * ABS(SAFE_DIVIDE(b, se_b)), 2)
      + 0.9372980 / POW(1 + 0.33267 * ABS(SAFE_DIVIDE(b, se_b)), 3))) AS p_b
  FROM m
)
SELECT 'Skjæringspunkt (a)' AS term,
  ROUND(a, 4) AS estimat, ROUND(se_a, 4) AS std_feil,
  ROUND(t_a, 3) AS t_verdi, ROUND(p_a, 4) AS p_verdi,
  ROUND(r2, 4) AS r2, ROUND(rmse, 3) AS rmse, n
FROM pv
UNION ALL
SELECT 'Stigningstall (b)',
  ROUND(b, 4), ROUND(se_b, 4),
  ROUND(t_b, 3), ROUND(p_b, 4),
  ROUND(r2, 4), ROUND(rmse, 3), n
FROM pv
ORDER BY term`;
    };

    const examplesAiBuilder = [
        {
            prompt: `Daglige sidevisninger i 2025`,
            title: `Daglige sidevisninger for ${pathLabel} i 2025`,
            sql: `SELECT\n  FORMAT_TIMESTAMP('%Y-%m-%d', created_at) AS dato,\n  COUNT(*) AS sidevisninger\nFROM \`fagtorsdag-prod-81a6.umami_student.event\`\nWHERE\n  event_type = 1\n  AND website_id = '${websiteId}'\n  ${pathConditionSQL}\n  AND EXTRACT(YEAR FROM created_at) = 2025\nGROUP BY dato\nORDER BY dato ASC;`,
            tabOrder: ['linechart','areachart','barchart','table','piechart','stegvisning','kiforklaring'],
            explanation: `Gjennomsnittet ligger på rundt 165 sidevisninger per dag, men med et tydelig fall i helger. De mest besøkte dagene er mandag og tirsdag, noe som bekrefter at dette er et arbeidsverktøy brukt primært i arbeidstiden. En markant topp mot slutten av september kan tyde på en lansering eller større oppdatering i designsystemet som skapte ekstra oppmerksomhet.`,
        },
        {
            prompt: `Topp 12 mest besøkte undersider i 2025`,
            title: `Topp 12 sider under ${path}`,
            sql: `SELECT\n  url_path AS side,\n  COUNT(*) AS sidevisninger\nFROM \`fagtorsdag-prod-81a6.umami_student.event\`\nWHERE\n  event_type = 1\n  AND website_id = '${websiteId}'\n  ${pathConditionSQL}\n  AND EXTRACT(YEAR FROM created_at) = 2025\nGROUP BY side\nORDER BY sidevisninger DESC\nLIMIT 12;`,
            tabOrder: ['barchart','table','piechart','linechart','areachart','stegvisning','kiforklaring'],
            explanation: `Komponent-sidene dominerer klart, og Button er den mest besøkte enkelt-siden – et naturlig startpunkt for utviklere som utforsker designsystemet for første gang. /god-praksis og /komponenter utgjør til sammen 7 av topp-10. En overraskende lav trafikk under /mønstre tatt i betraktning innholdets relevans kan tyde på at seksjonen er vanskelig å oppdage.`,
        },
        {
            prompt: `Sidevisninger per måned i 2025`,
            title: `Sidevisninger per måned – ${pathLabel}`,
            sql: `SELECT\n  EXTRACT(MONTH FROM created_at) AS maaned,\n  COUNT(*) AS sidevisninger\nFROM \`fagtorsdag-prod-81a6.umami_student.event\`\nWHERE\n  event_type = 1\n  AND website_id = '${websiteId}'\n  ${pathConditionSQL}\n  AND EXTRACT(YEAR FROM created_at) = 2025\nGROUP BY maaned\nORDER BY maaned ASC;`,
            tabOrder: ['areachart','linechart','barchart','table','piechart','stegvisning','kiforklaring'],
            explanation: `Januar og februar er klart sterkest, noe som gjenspeiler oppstart av nye prosjekter etter nyttår. Sommermånedene juni–august viser et fall på rundt 35–40 %, typisk for et verktøy brukt primært i arbeidstiden. Høsten viser en fin oppgang igjen, men når aldri januar-nivå fullt ut – en sesongkurve som gjentar seg år etter år for verktøy i denne kategorien.`,
        },
        {
            prompt: `Hvordan beveger brukerne seg pa siden?`,
            title: `Sideflyt fra ${path}`,
            sql: '',
            tabOrder: ['stegvisning'],
            apiOnly: true,
        },
        {
            prompt: `Trafikkilder i november 2025`,
            title: `Trafikkilder – ${pathLabel}`,
            sql: `SELECT\n  COALESCE(NULLIF(referrer_domain, ''), '(direkte)') AS kilde,\n  COUNT(*) AS sidevisninger\nFROM \`fagtorsdag-prod-81a6.umami_student.event\`\nWHERE\n  event_type = 1\n  AND website_id = '${websiteId}'\n  ${pathConditionSQL}\n  AND EXTRACT(YEAR FROM created_at) = 2025\n  AND EXTRACT(MONTH FROM created_at) = 11\nGROUP BY kilde\nORDER BY sidevisninger DESC\nLIMIT 15;`,
            tabOrder: ['barchart','piechart','table','linechart','areachart','stegvisning','kiforklaring'],
            explanation: `Nesten halvparten av trafikken i november kom direkte – brukerne har bokmerket siden eller kjenner URLen godt. Google stod for rundt 31 %, mens intern trafikk fra nav.no bidro med 12 %. Sosiale medier og nyhetsbrev utgjorde tilnærmet null, noe som er forventet for et profesjonelt designverktøy som ikke er rettet mot allmennheten.`,
        },
        {
            prompt: `Eksterne nettsider besøkende kommer fra`,
            title: `Inngående trafikkilder – ${pathLabel}`,
            sql: `SELECT\n  COALESCE(NULLIF(referrer_domain, ''), '(direkte)') AS kilde,\n  COUNT(DISTINCT session_id) AS unike_besokende\nFROM \`fagtorsdag-prod-81a6.umami_student.event\`\nWHERE\n  event_type = 1\n  AND website_id = '${websiteId}'\n  ${pathConditionSQL}\n  AND EXTRACT(YEAR FROM created_at) = 2025\nGROUP BY kilde\nORDER BY unike_besokende DESC\nLIMIT 1000;`,
            tabOrder: ['barchart','piechart','table','linechart','areachart','stegvisning','kiforklaring'],
            explanation: `De aller fleste innkommende lenkene kommer fra interne NAV-systemer og GitHub. google.com og github.com er de to klart største eksterne kildene, noe som tyder på at dokumentasjonen brukes aktivt som referanse i utviklingsarbeid. Sporadisk trafikk fra dev.to og stackoverflow antyder at internasjonale fagmiljøer også har funnet veien hit.`,
        },
        {
            prompt: `Lineær regresjon: trend i daglige sidevisninger`,
            title: `Regresjon: daglige sidevisninger – ${pathLabel}`,
            sql: buildRegressionSQLInline(),
            tabOrder: ['kiforklaring','table','linechart','areachart','barchart','piechart','stegvisning'],
            explanation: `Et stigningstall på –0.83 tyder på at antall daglige sidevisninger avtar med nesten én visning per dag gjennom 2025. R² på 0.18 betyr at modellen forklarer rundt 18 % av variasjonen – resten er støy fra helger, helligdager og enkelttopper. RMSE på 42 sidevisninger tilsvarer omtrent ett standardavvik i normal daglig variasjon. Retningen er klar, men datagrunnlaget er for støyete til å trekke sterke konklusjoner om fremtidig utvikling.`,
        },
        {
            prompt: `Nøkkeltall: handlinger, navigering og frafall`,
            title: `Nøkkeltall – ${pathLabel}`,
            sql: `WITH sessions AS (
  SELECT
    session_id,
    COUNT(*) AS page_count,
    COUNTIF(event_type = 2) AS event_count
  FROM \`fagtorsdag-prod-81a6.umami_student.event\`
  WHERE
    event_type IN (1, 2)
    AND website_id = '${websiteId}'
    ${pathConditionSQL}
    AND EXTRACT(YEAR FROM created_at) = 2025
  GROUP BY session_id
)
SELECT 'Unike besøkende' AS kategori, COUNT(*) AS sesjoner FROM sessions
UNION ALL
SELECT 'Utførte handlinger', COUNTIF(event_count > 0) FROM sessions
UNION ALL
SELECT 'Navigering uten handling', COUNTIF(event_count = 0 AND page_count > 1) FROM sessions
UNION ALL
SELECT 'Forlot nettstedet', COUNTIF(page_count = 1 AND event_count = 0) FROM sessions;`,
            tabOrder: ['statcards', 'table', 'barchart', 'piechart', 'linechart', 'areachart', 'stegvisning', 'kiforklaring'],
            explanation: `Av de besøkende i 2025 utførte nesten to tredeler minst én aktiv handling – et tegn på høy intensjonalitet. At rundt én av tre navigerte videre uten å klikke på noe er normalt for dokumentasjon der man gjerne leser uten å interagere. Kun et mindretall forlot siden uten noen form for videre engasjement, noe som er bemerkelsesverdig lavt og tyder på at landingssidene treffer brukernes behov godt.`,
        },
        {
            prompt: `Hvilke handlinger gjør brukerne på siden?`,
            title: `Handlinger på ${pathLabel}`,
            sql: `WITH sessions_on_page AS (
  -- Sessions that had custom events fired on this exact page
  SELECT DISTINCT session_id
  FROM \`fagtorsdag-prod-81a6.umami_student.event\`
  WHERE event_type = 2
    AND website_id = '${websiteId}'
    AND url_path = '${path}'
    AND EXTRACT(YEAR FROM created_at) = 2025
),
events_labeled AS (
  SELECT
    e.session_id,
    e.event_id,
    e.created_at,
    CASE
      WHEN e.event_name = 'navigere' THEN
        CONCAT(
          COALESCE(MAX(CASE WHEN p.data_key = 'kilde' THEN p.string_value END), '?'),
          ' → ',
          COALESCE(MAX(CASE WHEN p.data_key = 'url' THEN p.string_value END), '?')
        )
      ELSE e.event_name
    END AS handling
  FROM sessions_on_page s
  JOIN \`fagtorsdag-prod-81a6.umami_student.event\` e
    ON s.session_id = e.session_id
    AND e.website_id = '${websiteId}'
    AND e.event_type = 2
    AND e.url_path = '${path}'
    AND EXTRACT(YEAR FROM e.created_at) = 2025
  LEFT JOIN \`fagtorsdag-prod-81a6.umami_student.event_data\` d
    ON e.event_id = d.website_event_id AND e.website_id = d.website_id AND e.created_at = d.created_at
  LEFT JOIN UNNEST(d.event_parameters) AS p
  GROUP BY e.session_id, e.event_id, e.event_name, e.created_at
),
events_numbered AS (
  SELECT session_id, handling,
    ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY created_at) AS steg_num
  FROM events_labeled
),
total AS (SELECT COUNT(*) AS n FROM sessions_on_page),
pivoted AS (
  SELECT session_id,
    MAX(CASE WHEN steg_num = 1  THEN handling END) AS steg_1,
    MAX(CASE WHEN steg_num = 2  THEN handling END) AS steg_2,
    MAX(CASE WHEN steg_num = 3  THEN handling END) AS steg_3,
    MAX(CASE WHEN steg_num = 4  THEN handling END) AS steg_4,
    MAX(CASE WHEN steg_num = 5  THEN handling END) AS steg_5,
    MAX(CASE WHEN steg_num = 6  THEN handling END) AS steg_6,
    MAX(CASE WHEN steg_num = 7  THEN handling END) AS steg_7,
    MAX(CASE WHEN steg_num = 8  THEN handling END) AS steg_8,
    MAX(CASE WHEN steg_num = 9  THEN handling END) AS steg_9,
    MAX(CASE WHEN steg_num = 10 THEN handling END) AS steg_10
  FROM events_numbered GROUP BY session_id
)
SELECT
  COUNT(*) AS antall,
  CONCAT(ROUND(COUNT(*) * 100.0 / MAX(total.n), 1), '%') AS andel,
  COALESCE(steg_1, '(ingen hendelser)') AS steg_1,
  COALESCE(steg_2, '-') AS steg_2,
  COALESCE(steg_3, '-') AS steg_3,
  COALESCE(steg_4, '-') AS steg_4,
  COALESCE(steg_5, '-') AS steg_5,
  COALESCE(steg_6, '-') AS steg_6,
  COALESCE(steg_7, '-') AS steg_7,
  COALESCE(steg_8, '-') AS steg_8,
  COALESCE(steg_9, '-') AS steg_9,
  COALESCE(steg_10, '-') AS steg_10
FROM pivoted, total
GROUP BY steg_1, steg_2, steg_3, steg_4, steg_5, steg_6, steg_7, steg_8, steg_9, steg_10
ORDER BY antall DESC
LIMIT 20;`,
            tabOrder: ['table', 'barchart', 'piechart', 'linechart', 'areachart', 'stegvisning', 'kiforklaring'],
            explanation: `Den klart vanligste brukersekvensen er å navigere via header-menyen til en annen hoveddel av nettstedet. Introkort-klikk er nest vanligst og tyder på at brukerne aktivt utforsker underkategorier. Svært få gjennomfører mer enn tre handlinger på én og samme side – besøkene er korte og målrettede, ikke utforskende.`,
        },
        {
            prompt: `Hvilket operativsystem bruker brukerne?`,
            title: `Operativsystem – ${pathLabel}`,
            sql: `SELECT\n  COALESCE(NULLIF(s.os, ''), '(ukjent)') AS operativsystem,\n  COUNT(DISTINCT e.session_id) AS unike_besokende\nFROM \`fagtorsdag-prod-81a6.umami_student.event\` e\nLEFT JOIN \`fagtorsdag-prod-81a6.umami_student.session\` s\n  ON e.session_id = s.session_id\nWHERE\n  e.event_type = 1\n  AND e.website_id = '${websiteId}'\n  ${pathConditionSQL}\n  AND EXTRACT(YEAR FROM e.created_at) = 2025\nGROUP BY operativsystem\nORDER BY unike_besokende DESC\nLIMIT 12;`,
            tabOrder: ['piechart','barchart','table','areachart','linechart','stegvisning','kiforklaring'],
            explanation: `Mac dominerer med over 58 % – ikke overraskende for en brukergruppe som i stor grad består av designere og frontend-utviklere. Windows 10 er nest størst, mens iOS og Android til sammen utgjør under 16 %. Dette bekrefter at designsystemet primært er et desktop-verktøy brukt i arbeidssituasjonen.`,
        },
        {
            prompt: `Hvor navigerer brukere etter å ha søkt på siden?`,
            title: `Navigering etter søk – ${pathLabel}`,
            sql: `WITH sok_events AS (
  SELECT session_id, created_at AS sok_tid
  FROM \`fagtorsdag-prod-81a6.umami_student.event\`
  WHERE event_type = 2
    AND event_name = 'sok'
    AND website_id = '${websiteId}'
    ${pathConditionSQL}
    AND EXTRACT(YEAR FROM created_at) = 2025
),
neste_sider AS (
  SELECT
    s.session_id,
    e.url_path AS side,
    ROW_NUMBER() OVER (PARTITION BY s.session_id, s.sok_tid ORDER BY e.created_at ASC) AS rn
  FROM sok_events s
  JOIN \`fagtorsdag-prod-81a6.umami_student.event\` e
    ON s.session_id = e.session_id
    AND e.event_type = 1
    AND e.created_at > s.sok_tid
    AND e.website_id = '${websiteId}'
    AND EXTRACT(YEAR FROM e.created_at) = 2025
)
SELECT
  side AS neste_side,
  COUNT(*) AS antall_sok
FROM neste_sider
WHERE rn = 1
GROUP BY side
ORDER BY antall_sok DESC
LIMIT 25;`,
            tabOrder: ['table', 'barchart', 'piechart', 'linechart', 'areachart', 'stegvisning', 'kiforklaring'],
            explanation: `Etter søk ender nesten halvparten av brukerne opp på en komponent-side, med Button og Input som klare favoritter. Rundt 20 % navigerer til god-praksis-seksjonen, noe som tyder på at søk brukes like mye for konseptuelle spørsmål som for å finne spesifikke komponenter. Andelen som endte tilbake på forsiden var svært lav, noe som tyder på at søkeresultatene sjelden skuffer.`,
        },
    ];

    const extractWebsiteId = (sql: string) => {
        const match = /website_id\s*=\s*['"]([0-9a-f-]{36})['"]/i.exec(sql);
        return match?.[1];
    };
    const sqlWebsiteId = extractWebsiteId(query);

    useEffect(() => {
        if (shouldAutoExecuteRef.current && step === 2) {
            shouldAutoExecuteRef.current = false;
            executeQuery();
        }
    }, [step, query]);

    const generateSqlFromAi = async () => {
        const basePrompt = aiPrompt.trim() || `Vis meg daglige sidevisninger for ${pathLabel} i 2025`;
        const pathDesc = pathOperator === 'starts-with' && path !== '/'
            ? ` (url_path LIKE '${path}%')`
            : pathOperator === 'equals' ? ` (url_path = '${path}')` : '';
        const contextPrefix = `BigQuery-tabell: \`fagtorsdag-prod-81a6.umami_student.event\`. website_id = '${websiteId}'${pathDesc}. Svar kun med SQL.\n\nSpørsmål: `;
        setError(null);
        try {
            const response = await fetch('http://localhost:8004/api/sql', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: contextPrefix + basePrompt, model: 'qwen2.5-coder:7b' }),
            });
            const data = await response.json();
            let sqlResponse = data?.sql
                ? (typeof data.sql === 'string' ? (() => { try { return JSON.parse(data.sql); } catch { return data; } })() : data.sql)
                : data;
            if (sqlResponse?.response) {
                let cleaned = sqlResponse.response;
                if (cleaned.includes('```')) {
                    cleaned = cleaned.replaceAll('```sql\n', '').replaceAll('```sql', '').replaceAll('```\n', '').replaceAll('```', '');
                }
                setQuery(cleaned.trim());
            } else {
                setQuery('-- Ingen SQL i svaret\n' + JSON.stringify(data, null, 2));
            }
        } catch {
            setQuery(`-- Feil: Kunne ikke koble til AI-serveren\n\n${defaultQuery}`);
        } finally {
            const guessed = guessChartType(basePrompt);
            setP2Tab(guessed);
            if (guessed === 'regresjon') setRegressionTitle(basePrompt || defaultRegressionTitle);
            shouldAutoExecuteRef.current = guessed !== 'stegvisning';
            setStep(2);
        }
    };

    const executeQuery = async () => {
        setLoading(true);
        setError(null);
        setResult(null);
        try {
            const response = await fetch('/api/bigquery', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query, analysisType: 'KI bygger' }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Query failed');
            setResult(data);
        } catch (err: any) {
            setError(err.message || 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    const validateSQL = () => {
        if (!query.trim()) {
            setValidateError('SQL kan ikke være tom.');
            setShowValidation(true);
            return;
        }
        const valid = /\b(SELECT|INSERT|UPDATE|DELETE|WITH|CREATE|DROP|ALTER)\b/i.test(query);
        if (!valid) {
            setValidateError('SQL må inneholde en gyldig kommando (f.eks. SELECT, WITH, ...).');
            setShowValidation(true);
            return;
        }
        try {
            sqlFormatter.format(query);
            setValidateError('SQL er gyldig!');
        } catch (e: any) {
            setValidateError('Ugyldig SQL: ' + (e.message || 'Syntaksfeil'));
        }
        setShowValidation(true);
    };

    const estimateCost = async () => {
        setEstimating(true);
        setEstimate(null);
        setShowEstimate(false);
        try {
            const response = await fetch('/api/bigquery/estimate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query, analysisType: 'Prototype3' }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Estimation failed');
            setEstimate(data);
            setShowEstimate(true);
        } catch (err: any) {
            setEstimate({ error: err.message || 'Kunne ikke estimere kostnad' });
            setShowEstimate(true);
        } finally {
            setEstimating(false);
        }
    };

    const formatSQL = () => {
        try {
            setQuery(sqlFormatter.format(query, { language: 'bigquery', tabWidth: 2, keywordCase: 'upper' }));
            setFormatSuccess(true);
            setTimeout(() => setFormatSuccess(false), 2000);
        } catch { /* ignore */ }
    };

    const [journeyError, setJourneyError] = useState<string | null>(null);

    const fetchJourneyData = async () => {
        setJourneyLoading(true);
        setJourneyData(null);
        setJourneyError(null);
        try {
            const now = new Date();
            const resolvedEnd = propEndDate ?? now;
            const resolvedStart = propStartDate ?? (() => { const d = new Date(resolvedEnd); d.setDate(d.getDate() - 30); return d; })();
            const startUrl = (path && path !== '') ? path : '/';
            const response = await fetch('/api/bigquery/journeys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    websiteId,
                    startUrl,
                    startDate: resolvedStart.toISOString(),
                    endDate: resolvedEnd.toISOString(),
                    steps: 3,
                    limit: 5,
                    direction: 'forward',
                }),
            });
            if (!response.ok) throw new Error(`Feil fra server: ${response.status}`);
            const data = await response.json();
            if (data.nodes?.length && data.links?.length) {
                setJourneyData({ nodes: data.nodes, links: data.links });
            } else {
                setJourneyError('Ingen sideflyt-data tilgjengelig for denne perioden og siden.');
            }
        } catch (e: any) {
            setJourneyError(e.message || 'Kunne ikke laste sideflyt');
        } finally {
            setJourneyLoading(false);
        }
    };

    useEffect(() => {
        if (step !== 2) return;
        if (p2Tab === 'stegvisning' && !journeyLoading) {
            fetchJourneyData();
        } else if (p2Tab === 'regresjon' && !result && !loading) {
            const sql = buildRegressionSQL();
            setQuery(sql);
            // Call the API directly with the built SQL — cannot rely on setQuery having
            // updated the `query` state yet (React state updates are asynchronous).
            setLoading(true);
            setError(null);
            setResult(null);
            fetch('/api/bigquery', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: sql, analysisType: 'KI bygger - regresjon' }),
            })
                .then(r => r.json().then(d => { if (!r.ok) throw new Error(d.error || 'Query failed'); setResult(d); }))
                .catch((err: any) => setError(err.message || 'An error occurred'))
                .finally(() => setLoading(false));
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [p2Tab, step]);

    const buildJourneySQL = () => {
        const now = new Date();
        const resolvedEnd = propEndDate ?? now;
        const resolvedStart = propStartDate ?? (() => { const d = new Date(resolvedEnd); d.setDate(d.getDate() - 30); return d; })();
        const startUrl = (path && path !== '') ? path : '/';
        const steps = 3;
        const limit = 5;
        const direction = 'forward';
        const windowFn = direction === 'backward' ? 'LAG' : 'LEAD';
        const nextCol = direction === 'backward' ? 'prev_url' : 'next_url';
        const timeOp = direction === 'backward' ? '<=' : '>=';
        const orderDir = direction === 'backward' ? 'DESC' : 'ASC';
        return `WITH session_events AS (
  SELECT
    session_id,
    CASE
      WHEN RTRIM(REGEXP_REPLACE(REGEXP_REPLACE(url_path, r'[?#].*', ''), r'//+', '/'), '/') = ''
      THEN '/'
      ELSE RTRIM(REGEXP_REPLACE(REGEXP_REPLACE(url_path, r'[?#].*', ''), r'//+', '/'), '/')
    END AS url_path,
    created_at,
    MIN(CASE
      WHEN RTRIM(REGEXP_REPLACE(REGEXP_REPLACE(url_path, r'[?#].*', ''), r'//+', '/'), '/') = '${startUrl}'
      THEN created_at
    END) OVER (PARTITION BY session_id) AS start_time
  FROM \`fagtorsdag-prod-81a6.umami_student.event\`
  WHERE website_id = '${websiteId}'
    AND created_at BETWEEN '${resolvedStart.toISOString()}' AND '${resolvedEnd.toISOString()}'
    AND event_type = 1
),
journey_steps AS (
  SELECT
    session_id,
    url_path,
    created_at,
    ${windowFn}(url_path) OVER (PARTITION BY session_id ORDER BY created_at) AS ${nextCol}
  FROM session_events
  WHERE start_time IS NOT NULL
    AND created_at ${timeOp} start_time
),
renumbered_steps AS (
  SELECT
    session_id,
    url_path,
    ${nextCol},
    ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY created_at ${orderDir}) - 1 AS step
  FROM journey_steps
),
raw_flows AS (
  SELECT
    step,
    url_path AS source,
    ${nextCol} AS target,
    COUNT(*) AS value
  FROM renumbered_steps
  WHERE step < ${steps}
    AND ${nextCol} IS NOT NULL
    AND url_path != ${nextCol}
    AND (step > 0 OR url_path = '${startUrl}')
    AND NOT (step > 0 AND url_path = '${startUrl}')
    AND NOT (step > 0 AND ${nextCol} = '${startUrl}')
  GROUP BY 1, 2, 3
),
ranked AS (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY step ORDER BY value DESC) AS rank_in_step
  FROM raw_flows
),
top_flows AS (
  SELECT step, source, target, value
  FROM ranked
  WHERE rank_in_step <= ${limit}
),
valid_pages_per_step AS (
  SELECT 0 AS step, '${startUrl}' AS page
  UNION ALL
  SELECT step + 1 AS step, target AS page FROM top_flows
)
SELECT t.step, t.source, t.target, t.value
FROM top_flows t
INNER JOIN valid_pages_per_step v
  ON v.step = t.step AND v.page = t.source
ORDER BY step, value DESC`;
    };

    const buildRegressionSQL = () => {
        const pathFilter = pathConditionSQL.trim();
        return `WITH base AS (
  SELECT CAST(x AS FLOAT64) AS x, CAST(y AS FLOAT64) AS y FROM (
    SELECT
      DATE_DIFF(DATE(created_at), DATE('2025-01-01'), DAY) + 1 AS x,
      COUNT(*) AS y
    FROM \`fagtorsdag-prod-81a6.umami_student.event\`
    WHERE event_type = 1
      AND website_id = '${websiteId}'
      ${pathFilter}
      AND EXTRACT(YEAR FROM created_at) = 2025
    GROUP BY x
  )
),
stats AS (
  SELECT COUNT(*) AS n, AVG(x) AS x_bar, AVG(y) AS y_bar,
         VAR_SAMP(x) AS var_x, COVAR_SAMP(x, y) AS cov_xy
  FROM base
),
params AS (
  SELECT n, x_bar, y_bar,
    SAFE_DIVIDE(cov_xy, var_x) AS slope,
    y_bar - SAFE_DIVIDE(cov_xy, var_x) * x_bar AS intercept
  FROM stats
),
resid AS (
  SELECT b.x, b.y, p.n, p.x_bar, p.y_bar, p.slope, p.intercept,
    b.y - (p.intercept + p.slope * b.x) AS r
  FROM base b CROSS JOIN params p
),
sums AS (
  SELECT MIN(n) AS n, MIN(intercept) AS a, MIN(slope) AS b,
         MIN(x_bar) AS x_bar, MIN(y_bar) AS y_bar,
    SUM(POW(r, 2)) AS sse,
    SUM(POW(y - y_bar, 2)) AS sst,
    SUM(POW(x - x_bar, 2)) AS sxx
  FROM resid
),
m AS (
  SELECT n, a, b,
    1 - SAFE_DIVIDE(sse, sst) AS r2,
    SQRT(SAFE_DIVIDE(sse, n - 2)) AS rmse,
    SQRT(SAFE_DIVIDE(SAFE_DIVIDE(sse, n - 2), sxx)) AS se_b,
    SQRT(SAFE_DIVIDE(sse, n - 2) * (1.0 / n + POW(x_bar, 2) / sxx)) AS se_a
  FROM sums
),
pv AS (
  SELECT n, a, b, r2, rmse, se_a, se_b,
    SAFE_DIVIDE(a, se_a) AS t_a,
    SAFE_DIVIDE(b, se_b) AS t_b,
    -- Two-tailed p-value via Abramowitz & Stegun normal approximation
    GREATEST(0, 2 * EXP(-0.5 * POW(ABS(SAFE_DIVIDE(a, se_a)), 2)) / 2.506628 * (
       0.4361836 / (1 + 0.33267 * ABS(SAFE_DIVIDE(a, se_a)))
      - 0.1201676 / POW(1 + 0.33267 * ABS(SAFE_DIVIDE(a, se_a)), 2)
      + 0.9372980 / POW(1 + 0.33267 * ABS(SAFE_DIVIDE(a, se_a)), 3))) AS p_a,
    GREATEST(0, 2 * EXP(-0.5 * POW(ABS(SAFE_DIVIDE(b, se_b)), 2)) / 2.506628 * (
       0.4361836 / (1 + 0.33267 * ABS(SAFE_DIVIDE(b, se_b)))
      - 0.1201676 / POW(1 + 0.33267 * ABS(SAFE_DIVIDE(b, se_b)), 2)
      + 0.9372980 / POW(1 + 0.33267 * ABS(SAFE_DIVIDE(b, se_b)), 3))) AS p_b
  FROM m
)
SELECT 'Skjæringspunkt (a)' AS term,
  ROUND(a, 4) AS estimat, ROUND(se_a, 4) AS std_feil,
  ROUND(t_a, 3) AS t_verdi, ROUND(p_a, 4) AS p_verdi,
  ROUND(r2, 4) AS r2, ROUND(rmse, 3) AS rmse, n
FROM pv
UNION ALL
SELECT 'Stigningstall (b)',
  ROUND(b, 4), ROUND(se_b, 4),
  ROUND(t_b, 3), ROUND(p_b, 4),
  ROUND(r2, 4), ROUND(rmse, 3), n
FROM pv
ORDER BY term`;
    };

    const { prepareLineChartData, prepareBarChartData, preparePieChartData } = useChartDataPrep(result);

    return (
        <div className="w-full h-full overflow-hidden">
            {/* ── STEP 1 ── */}
            {step === 1 && (
                <div className={boxClass}>
                    <div style={{ height: '10%', display: 'flex', alignItems: 'center' }}>
                        <h2 className="text-lg font-semibold text-gray-800">KI bygger — hvilken graf?</h2>
                    </div>
                    <div style={{ height: '80%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '10px', width: '100%' }}>
                        <p style={{ fontSize: '1rem', color: '#1a1a1a', lineHeight: '1.5', margin: 0, marginBottom: '16px' }}>
                            Skriv det du ønsker å se i chat-boksen under. Du kan ekskludere ting. Foreløpig sendes alt du skriver i denne prototypen og resultatet du får inn til lagring i Nettskjema for å samle brukerinformasjon. Nettskjema er sikker lagring med tofaktor som følger GDPR, men vennligst unngå å skrive personopplysninger om deg selv eller andre. Chatten bruker innstillingene fra filteret på toppen. Får du ikke grafen du ønsker deg, trykk tilbake og rediger teksten. Du kan også trykke videre på Avansert og redigere koden. Send oss gjerne JSON-filer med dashboard dere har laget og tilbakemeldinger.
                        </p>
                        <textarea
                            value={aiPrompt}
                            onChange={(e) => setAiPrompt(e.target.value)}
                            placeholder={`Eksempel: Daglige sidevisninger for ${pathLabel} i 2025`}
                            rows={5}
                            className="navds-textarea__input w-full"
                            style={{ width: '100%', resize: 'none', padding: '8px 12px', borderRadius: '4px', border: '1px solid #6a6a6a', fontSize: '1rem', fontFamily: 'inherit', lineHeight: '1.5', backgroundColor: '#fff', outline: 'none', boxShadow: 'none' }}
                            onFocus={e => e.currentTarget.style.boxShadow = '0 0 0 3px #0067C5'}
                            onBlur={e => e.currentTarget.style.boxShadow = 'none'}
                        />
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginTop: '6px' }}>
                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#0067C5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <span style={{ color: '#fff', fontSize: '13px', fontWeight: 700 }}>AI</span>
                            </div>
                            <div style={{ background: '#f0f4ff', border: '1px solid #c8d9f5', borderRadius: '0 8px 8px 8px', padding: '10px 14px', fontSize: '0.95rem', color: '#1a1a1a', lineHeight: '1.5' }}>
                                Ditt spørsmål er veldig spennende! Hva med å legge til «i måneden» og «jeg ønsker ikke treff fra admin-sider»?
                            </div>
                        </div>
                    </div>
                    <div style={{ height: '10%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Button variant="secondary" size="small" onClick={() => { setSelectedTidligere(null); setTidligereOpen(true); }}>
                            Eksempler
                        </Button>
                        <Button variant="secondary" size="small" onClick={() => { setLagEgenSqlTitle(''); setLagEgenSqlOpen(true); }}>
                            Lag egen SQL
                        </Button>
                        <Button variant="secondary" size="small" iconPosition="right" icon={<ChevronRight size={16} />}
                            onClick={() => { shouldAutoExecuteRef.current = true; generateSqlFromAi(); }}>
                            Lag graf
                        </Button>
                    </div>
                </div>
            )}

            {/* ── STEP 2 ── */}
            {step === 2 && (
                <div className="w-full h-full">
                    <div className={boxClass}>
                        <div style={{ height: '10%', display: 'flex', alignItems: 'center', position: 'relative' }}>
                            {visibleTabs.map((tab) => (
                                <button
                                    key={tab.value} type="button" onClick={() => setP2Tab(tab.value)}
                                    className={`px-4 py-1 text-sm font-medium border-b-2 mr-1 shrink-0 ${p2Tab === tab.value ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900'}`}>
                                    {tab.label}
                                </button>
                            ))}
                            {overflowTabs.length > 0 && (
                                <div className="relative ml-1">
                                    <button type="button" onClick={() => setShowMoreTabs(v => !v)}
                                        className={`px-3 py-1 text-sm font-medium border-b-2 shrink-0 ${activeIsOverflow ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900'}`}>
                                        {activeIsOverflow ? allTabs.find(t => t.value === p2Tab)?.label + ' ▾' : 'Mer ▾'}
                                    </button>
                                    {showMoreTabs && (
                                        <div className="absolute top-full left-0 z-10 bg-white border border-gray-200 rounded shadow-md min-w-[120px]">
                                            {overflowTabs.map(tab => (
                                                <button key={tab.value} type="button"
                                                    onClick={() => { setP2Tab(tab.value); setShowMoreTabs(false); }}
                                                    className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${p2Tab === tab.value ? 'text-blue-600 font-medium' : 'text-gray-700'}`}>
                                                    {tab.label}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <div
                            style={{ height: '80%', overflow: 'hidden', cursor: onAddWidget ? 'grab' : undefined, position: 'relative' }}
                            draggable={!!onAddWidget}
                            onDragStart={onAddWidget ? (e) => {
                                const widgetResult = p2Tab === 'stegvisning' ? journeyData
                                    : p2Tab === 'kiforklaring' ? { text: currentExplanation ?? '' }
                                    : p2Tab === 'regresjon' ? { rows: result?.data, r2: result?.data?.[0]?.r2, rmse: result?.data?.[0]?.rmse, n: result?.data?.[0]?.n, title: regressionTitle }
                                    : result;
                                const sizes = WIDGET_SIZES[p2Tab] ?? [{ cols: 1, rows: 1, name: 'Standard' }];
                                const defaultSize = sizes.find(s => s.cols === 2 && s.rows === 1) ?? sizes[0];
                                e.dataTransfer.setData('application/aibygger', JSON.stringify({ chartType: p2Tab, sql: query, result: widgetResult, title: aiPrompt, aiPrompt, size: defaultSize }));
                                e.dataTransfer.effectAllowed = 'copy';
                            } : undefined}
                        >
                            {editingTitle ? (
                                <input
                                    autoFocus
                                    value={aiPrompt}
                                    onChange={(e) => setAiPrompt(e.target.value)}
                                    onBlur={() => setEditingTitle(false)}
                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') { e.currentTarget.blur(); } }}
                                    style={{ position: 'absolute', top: 10, left: 'calc(5% + 12px)', width: 'calc(90% - 24px)', height: 22, fontSize: 13, fontWeight: 600, padding: 0, border: 'none', outline: 'none', boxShadow: 'none', background: '#f9fafb', color: '#111827', zIndex: 10, cursor: 'text' }}
                                />
                            ) : (
                                <div
                                    onDoubleClick={() => setEditingTitle(true)}
                                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 35, zIndex: 10, cursor: 'text' }}
                                />
                            )}
                            <div style={{ width: '90%', height: '100%', overflow: 'auto', margin: '0 auto' }}>
                                {p2Tab === 'stegvisning' ? (
                                    journeyLoading
                                        ? <div className="flex items-center justify-center h-full text-gray-500">Laster sideflyt...</div>
                                        : journeyData
                                            ? <UmamiJourneyView nodes={journeyData.nodes} links={journeyData.links} journeyDirection="forward" websiteId={websiteId} />
                                            : <div className="flex flex-col items-center justify-center h-full gap-3">
                                                <p className="text-gray-500 text-sm text-center">{journeyError ?? 'Ingen navigasjonsdata for valgt side og periode.'}</p>
                                                <button type="button" className="text-sm text-blue-600 underline" onClick={fetchJourneyData}>Last inn på nytt</button>
                                              </div>
                                ) : p2Tab === 'statcards' ? (
                                    result
                                        ? <DashboardStatCards result={result} title={aiPrompt} />
                                        : <div className="flex items-center justify-center h-full text-gray-500 text-sm">Kjør spørringen for å se nøkkeltall</div>
                                ) : p2Tab === 'kiforklaring' ? (
                                    <DashboardKIForklaring result={{ text: currentExplanation ?? '' }} title={aiPrompt} />
                                ) : loading ? (
                                    <div className="flex items-center justify-center h-full text-gray-500">Laster...</div>
                                ) : error ? (
                                    <div className="flex items-center justify-center h-full text-red-500 text-sm">{error}</div>
                                ) : result ? (
                                    <PinnedWidget result={result} chartType={p2Tab} title={aiPrompt} colSpan={p2Tab === 'piechart' ? 2 : 1} />
                                ) : (
                                    <div className="flex items-center justify-center h-full text-gray-500 text-sm">Kjør spørringen for å se resultater</div>
                                )}
                            </div>
                        </div>
                        <div style={{ height: '10%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Button variant="secondary" size="small" icon={<ChevronLeft size={16} />} onClick={() => setStep(1)}>Til KI bygger</Button>
                            <Button variant="secondary" size="small" onClick={() => setDownloadModalOpen(true)}>Last ned</Button>
                            {onAddWidget && (
                                <Button
                                    variant="primary" size="small"
                                    disabled={p2Tab === 'stegvisning' ? !journeyData : p2Tab === 'kiforklaring' ? !currentExplanation : !result?.data?.length}
                                    onClick={() => {
                                        const sizes = WIDGET_SIZES[p2Tab] ?? [{ cols: 1, rows: 1, name: 'Standard' }];
                                        const widgetResult = p2Tab === 'stegvisning' ? journeyData
                                            : p2Tab === 'kiforklaring' ? { text: currentExplanation ?? '' }
                                            : p2Tab === 'regresjon' ? { rows: result?.data, r2: result?.data?.[0]?.r2, rmse: result?.data?.[0]?.rmse, n: result?.data?.[0]?.n, title: regressionTitle }
                                            : result;
                                        if (sizes.length === 1) {
                                            onAddWidget(query, p2Tab, widgetResult, sizes[0], aiPrompt, aiPrompt);
                                        } else {
                                            setPendingAdd({ sql: query, chartType: p2Tab, result: widgetResult, title: aiPrompt });
                                        }
                                    }}
                                >
                                    + Legg til på dashboard
                                </Button>
                            )}
                            <Button variant="secondary" size="small" onClick={() => setShareWidgetOpen(true)}>Del</Button>
                            <Button variant="secondary" size="small" iconPosition="right" icon={<ChevronRight size={16} />} onClick={() => setStep(3)}>Avansert</Button>
                        </div>
                    </div>
                    {shareWidgetOpen && <ShareWidgetModal
                        open={shareWidgetOpen}
                        onClose={() => setShareWidgetOpen(false)}
                        sql={query}
                        chartType={p2Tab}
                        defaultTitle={aiPrompt}
                        sizes={WIDGET_SIZES[p2Tab] ?? [{ cols: 1, rows: 1, name: 'Standard' }]}
                        result={
                            p2Tab === 'stegvisning' ? journeyData
                            : p2Tab === 'kiforklaring' ? { text: currentExplanation ?? '' }
                            : p2Tab === 'regresjon' ? { rows: result?.data, r2: result?.data?.[0]?.r2, rmse: result?.data?.[0]?.rmse, n: result?.data?.[0]?.n, title: regressionTitle }
                            : result
                        }
                    />}
                    <DownloadResultsModal
                        result={result}
                        open={downloadModalOpen}
                        onClose={() => setDownloadModalOpen(false)}
                        chartType={p2Tab}
                        title={aiPrompt}
                        pngSizes={['linechart','areachart','barchart','piechart'].includes(p2Tab) ? (WIDGET_SIZES[p2Tab] ?? [{ cols: 1, rows: 1, name: 'Standard' }]) : undefined}
                        prepareLineChartData={prepareLineChartData}
                        prepareBarChartData={prepareBarChartData}
                        preparePieChartData={preparePieChartData}
                    />
                    {pendingAdd && onAddWidget && (
                        <Modal open onClose={() => setPendingAdd(null)} header={{ heading: 'Velg storrelse' }}>
                            <Modal.Body>
                                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                                    {(WIDGET_SIZES[pendingAdd.chartType] ?? [{ cols: 1, rows: 1, name: 'Standard' }]).map(size => (
                                        <Button
                                            key={size.name}
                                            variant="secondary"
                                            onClick={() => {
                                                onAddWidget(pendingAdd.sql, pendingAdd.chartType, pendingAdd.result, size, pendingAdd.title, pendingAdd.title);
                                                setPendingAdd(null);
                                            }}
                                        >
                                            {size.name}
                                        </Button>
                                    ))}
                                </div>
                            </Modal.Body>
                        </Modal>
                    )}
                </div>
            )}

            {/* ── STEP 3 ── */}
            {step === 3 && (
                <div className={boxClass}>
                    <div style={{ height: '10%', display: 'flex', alignItems: 'center' }}>
                        <h2 className="text-lg font-semibold text-gray-800">Avansert spørring</h2>
                    </div>
                    <div style={{ height: '80%', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
                        {isApiOnly ? (
                            <div style={{ padding: '16px' }}>
                                <div className="navds-alert navds-alert--info navds-alert--medium" role="alert">
                                    Dette elementet henter data via API og har ingen SQL-kode.
                                </div>
                            </div>
                        ) : (
                        <div className="border rounded overflow-hidden" style={{ flex: 1, minHeight: 0 }}>
                            <Editor
                                height="100%" defaultLanguage="sql"
                                value={p2Tab === 'stegvisning' ? buildJourneySQL() : p2Tab === 'regresjon' ? buildRegressionSQL() : query}
                                onChange={(v) => { if (p2Tab !== 'stegvisning' && p2Tab !== 'regresjon') { setQuery(v || ''); setFormatSuccess(false); } }}
                                theme="vs-dark"
                                options={{ minimap: { enabled: false }, fontSize: 14, lineNumbers: 'on', scrollBeyondLastLine: false, automaticLayout: true, tabSize: 2, wordWrap: 'on', fixedOverflowWidgets: true, stickyScroll: { enabled: false }, lineNumbersMinChars: 4, glyphMargin: false }}
                            />
                        </div>
                        )}
                        {showValidation && validateError && (
                            <div className={`relative rounded px-3 py-2 mt-1 text-sm flex-shrink-0 ${validateError === 'SQL er gyldig!' ? 'bg-green-100 border border-green-400 text-green-800' : 'bg-red-100 border border-red-400 text-red-800'}`}>
                                <span>{validateError}</span>
                                <button type="button" aria-label="Lukk" onClick={() => setShowValidation(false)} className="absolute right-2 top-2 font-bold cursor-pointer">&times;</button>
                            </div>
                        )}
                        {showEstimate && estimate && (
                            <div className="flex-shrink-0 mt-1">
                                {estimate.error ? (
                                    <Alert variant="error" size="small">{estimate.error}</Alert>
                                ) : (
                                    <Alert variant={Number.parseFloat(estimate.totalBytesProcessedGB) >= 100 ? 'warning' : 'info'} size="small" className="relative">
                                        <button type="button" aria-label="Lukk" onClick={() => setShowEstimate(false)} className="absolute right-2 top-2 font-bold cursor-pointer">&times;</button>
                                        <div className="text-sm space-y-1">
                                            <div><strong>Data:</strong> {estimate.totalBytesProcessedGB} GB</div>
                                            {Number.parseFloat(estimate.estimatedCostUSD) > 0 && <div><strong>Kostnad:</strong> ${estimate.estimatedCostUSD} USD</div>}
                                            {estimate.cacheHit && <div className="text-green-700">✓ Cached (no cost)</div>}
                                        </div>
                                    </Alert>
                                )}
                            </div>
                        )}
                    </div>
                    <div style={{ height: '10%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Button variant="secondary" size="small" icon={<ChevronLeft size={16} />} onClick={() => { shouldAutoExecuteRef.current = true; setStep(2); }}>Til resultater</Button>
                        <Button size="small" variant="secondary" onClick={formatSQL}>{formatSuccess ? '✓ Formatert' : 'Formater'}</Button>
                        <Button size="small" variant="secondary" onClick={validateSQL}>Valider</Button>
                        <Button size="small" variant="secondary" loading={estimating} onClick={estimateCost}>Kostnad</Button>
                        <Button size="small" variant="secondary">Forklar</Button>
                        <Button
                            size="small"
                            variant="secondary"
                            icon={metabaseCopySuccess ? <Check size={16} /> : undefined}
                            onClick={async () => {
                                try {
                                    await navigator.clipboard.writeText(query);
                                    setMetabaseCopySuccess(true);
                                    setTimeout(() => setMetabaseCopySuccess(false), 2000);
                                } catch { /* ignore */ }
                            }}
                        >
                            {metabaseCopySuccess ? 'Kopiert!' : 'Kopier for Metabase'}
                        </Button>
                    </div>
                </div>
            )}

            <Modal open={lagEgenSqlOpen} onClose={() => setLagEgenSqlOpen(false)} header={{ heading: 'Lag egen SQL' }}>
                <Modal.Body>
                    <div className="flex flex-col gap-2">
                        <label className="aksel-label aksel-label--small" htmlFor="lag-sql-title">Tittel</label>
                        <input
                            id="lag-sql-title"
                            type="text"
                            value={lagEgenSqlTitle}
                            onChange={(e) => setLagEgenSqlTitle(e.target.value)}
                            placeholder="Eks: Mine egne sidevisninger"
                            style={{ padding: '8px 12px', borderRadius: '4px', border: '1px solid #6a6a6a', fontSize: '1rem', fontFamily: 'inherit', width: '100%' }}
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && lagEgenSqlTitle.trim()) {
                                    setAiPrompt(lagEgenSqlTitle.trim());
                                    setQuery(`SELECT\n  website_id,\n  name\nFROM\n  \`fagtorsdag-prod-81a6.umami_student.public_website\`\nLIMIT\n  100;`);
                                    setResult(null);
                                    setLagEgenSqlOpen(false);
                                    setStep(3);
                                }
                            }}
                        />
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="primary" disabled={!lagEgenSqlTitle.trim()} onClick={() => {
                        setAiPrompt(lagEgenSqlTitle.trim());
                        setQuery(`SELECT\n  website_id,\n  name\nFROM\n  \`fagtorsdag-prod-81a6.umami_student.public_website\`\nLIMIT\n  100;`);
                        setResult(null);
                        setLagEgenSqlOpen(false);
                        setStep(3);
                    }}>Gå til SQL</Button>
                    <Button variant="tertiary" onClick={() => setLagEgenSqlOpen(false)}>Avbryt</Button>
                </Modal.Footer>
            </Modal>

            <Modal open={tidligereOpen} onClose={() => setTidligereOpen(false)} header={{ heading: 'Eksempelspørringer' }}>
                <Modal.Body>
                    <div className="flex flex-col gap-2" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                        {examplesAiBuilder.map((item) => (
                            <button
                                key={item.prompt} type="button"
                                className={`text-left border rounded-md px-4 py-3 cursor-pointer w-full ${selectedTidligere === examplesAiBuilder.indexOf(item) ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'}`}
                                onClick={() => setSelectedTidligere(examplesAiBuilder.indexOf(item))}>
                                {item.prompt}
                            </button>
                        ))}
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="primary" disabled={selectedTidligere === null} onClick={() => {
                        if (selectedTidligere !== null) {
                            const item = examplesAiBuilder[selectedTidligere];
                            const order = item.tabOrder ?? [];
                            setTabOrder(order);
                            setIsApiOnly(!!(item as any).apiOnly);
                            setAiPrompt(item.prompt);
                            setCurrentExplanation((item as any).explanation ?? null);
                            if ((item as any).apiOnly) {
                                setP2Tab(order[0] ?? 'stegvisning');
                                setStep(2);
                            } else {
                                setQuery(item.sql);
                                setResult(null);
                                setP2Tab(order[0] ?? 'table');
                                shouldAutoExecuteRef.current = true;
                                setStep(2);
                            }
                            setTidligereOpen(false);
                        }
                    }}>Kjør</Button>
                    <Button variant="tertiary" onClick={() => setTidligereOpen(false)}>Avbryt</Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
}
