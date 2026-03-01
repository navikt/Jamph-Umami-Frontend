// AI Bygger — the green-box panel. Used natively inside Prototype3 and also
// as a standalone page (AiBygger.tsx wraps this with URL-param context).
import { useState, useEffect, useRef } from 'react';
import ResultsPanel from '../chartbuilder/results/ResultsPanel';
import ShareResultsModal from '../chartbuilder/results/ShareResultsModal';
import DownloadResultsModal from '../chartbuilder/results/DownloadResultsModal';
import { Button, Modal } from '@navikt/ds-react';
import Editor from '@monaco-editor/react';
import * as sqlFormatter from 'sql-formatter';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { useChartDataPrep } from '../../lib/useChartDataPrep';
import UmamiJourneyView from './journey/UmamiJourneyView';

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
    { value: 'table',     label: 'Tabell' },
    { value: 'linechart', label: 'Linje' },
    { value: 'areachart', label: 'Område' },
    { value: 'barchart',  label: 'Stolpe' },
    { value: 'piechart',  label: 'Kake' },
    { value: 'stegvisning', label: 'Sideflyt' },
];

type WidgetSize = { cols: number; rows: number; name: string };

const WIDGET_SIZES: Record<string, WidgetSize[]> = {
    table:       [{ cols: 1, rows: 1, name: 'Standard' }],
    linechart:   [{ cols: 1, rows: 1, name: 'Standard' }],
    areachart:   [{ cols: 1, rows: 1, name: 'Standard' }],
    barchart:    [{ cols: 1, rows: 1, name: 'Standard' }],
    piechart:    [{ cols: 1, rows: 2, name: '1×2' }, { cols: 2, rows: 1, name: '2×1' }],
    stegvisning: [{ cols: 2, rows: 1, name: 'Standard' }],
    regresjon:   [{ cols: 1, rows: 1, name: 'Standard' }],
};

interface Props {
    readonly websiteId: string;
    readonly path: string;
    readonly pathOperator: string;
    readonly startDate?: Date;
    readonly endDate?: Date;
    readonly onAddWidget?: (sql: string, chartType: string, result: any, size: { cols: number; rows: number }, title: string) => void;
}

export function AiByggerPanel({ websiteId, path, pathOperator, startDate: propStartDate, endDate: propEndDate, onAddWidget }: Props) {
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
    const [shareModalOpen, setShareModalOpen] = useState(false);
    const [downloadModalOpen, setDownloadModalOpen] = useState(false);
    const [pendingAdd, setPendingAdd] = useState<{ sql: string; chartType: string; result: any; title: string } | null>(null);
    const [tidligereOpen, setTidligereOpen] = useState(false);
    const [selectedTidligere, setSelectedTidligere] = useState<number | null>(null);
    const [metabaseCopySuccess, setMetabaseCopySuccess] = useState(false);
    const [p2Tab, setP2Tab] = useState('table');
    const [showMoreTabs, setShowMoreTabs] = useState(false);
    const [shareSuccess, setShareSuccess] = useState(false);
    const [formatSuccess, setFormatSuccess] = useState(false);
    const shouldAutoExecuteRef = useRef(false);
    const [journeyData, setJourneyData] = useState<{ nodes: any[]; links: any[] } | null>(null);
    const [journeyLoading, setJourneyLoading] = useState(false);
    const defaultRegressionTitle = `Lineær regresjon: daglige sidevisninger for ${pathLabel} (2025)`;
    const [regressionTitle, setRegressionTitle] = useState(defaultRegressionTitle);
    const [isApiOnly, setIsApiOnly] = useState(false);
    const [tabOrder, setTabOrder] = useState<string[]>([]);

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

    const MAX_VISIBLE_TABS = 5;
    const visibleTabs = sortedTabs.slice(0, MAX_VISIBLE_TABS);
    const overflowTabs = sortedTabs.slice(MAX_VISIBLE_TABS);
    const activeIsOverflow = overflowTabs.some(t => t.value === p2Tab);

    const buildRegressionSQLInline = () => {
        const pathFilter = pathConditionSQL.trim();
        return `WITH base AS (\n  SELECT CAST(x AS FLOAT64) AS x, CAST(y AS FLOAT64) AS y FROM (\n    SELECT\n      DATE_DIFF(DATE(created_at), DATE('2025-01-01'), DAY) + 1 AS x,\n      COUNT(*) AS y\n    FROM \`fagtorsdag-prod-81a6.umami_student.event\`\n    WHERE event_type = 1\n      AND website_id = '${websiteId}'\n      ${pathFilter}\n      AND EXTRACT(YEAR FROM created_at) = 2025\n    GROUP BY x\n  )\n),\nstats AS (\n  SELECT COUNT(*) AS n, AVG(x) AS x_bar, AVG(y) AS y_bar,\n         VAR_SAMP(x) AS var_x, COVAR_SAMP(x, y) AS cov_xy\n  FROM base\n),\nparams AS (\n  SELECT n, x_bar, y_bar,\n    SAFE_DIVIDE(cov_xy, var_x) AS slope,\n    y_bar - SAFE_DIVIDE(cov_xy, var_x) * x_bar AS intercept\n  FROM stats\n)\nSELECT 'Skjæringspunkt (a)' AS term, ROUND(intercept, 4) AS estimat, n FROM params\nUNION ALL\nSELECT 'Stigningstall (b)', ROUND(slope, 4), n FROM params\nORDER BY term`;
    };

    const examplesAiBuilder = [
        {
            prompt: `Daglige sidevisninger for ${pathLabel} i 2025`,
            title: `Daglige sidevisninger for ${pathLabel} i 2025`,
            sql: `SELECT\n  FORMAT_TIMESTAMP('%Y-%m-%d', created_at) AS dato,\n  COUNT(*) AS sidevisninger\nFROM \`fagtorsdag-prod-81a6.umami_student.event\`\nWHERE\n  event_type = 1\n  AND website_id = '${websiteId}'\n  ${pathConditionSQL}\n  AND EXTRACT(YEAR FROM created_at) = 2025\nGROUP BY dato\nORDER BY dato ASC;`,
            tabOrder: ['linechart','areachart','barchart','table','piechart','stegvisning'],
        },
        {
            prompt: `Topp 12 mest besøkte undersider under ${path} i 2025`,
            title: `Topp 12 sider under ${path}`,
            sql: `SELECT\n  url_path AS side,\n  COUNT(*) AS sidevisninger\nFROM \`fagtorsdag-prod-81a6.umami_student.event\`\nWHERE\n  event_type = 1\n  AND website_id = '${websiteId}'\n  ${pathConditionSQL}\n  AND EXTRACT(YEAR FROM created_at) = 2025\nGROUP BY side\nORDER BY sidevisninger DESC\nLIMIT 12;`,
            tabOrder: ['barchart','table','piechart','linechart','areachart','stegvisning'],
        },
        {
            prompt: `Sidevisninger per måned for ${pathLabel} i 2025`,
            title: `Sidevisninger per måned – ${pathLabel}`,
            sql: `SELECT\n  EXTRACT(MONTH FROM created_at) AS maaned,\n  COUNT(*) AS sidevisninger\nFROM \`fagtorsdag-prod-81a6.umami_student.event\`\nWHERE\n  event_type = 1\n  AND website_id = '${websiteId}'\n  ${pathConditionSQL}\n  AND EXTRACT(YEAR FROM created_at) = 2025\nGROUP BY maaned\nORDER BY maaned ASC;`,
            tabOrder: ['areachart','linechart','barchart','table','piechart','stegvisning'],
        },
        {
            prompt: `Hvordan beveger brukerne seg pa siden?`,
            title: `Sideflyt fra ${path}`,
            sql: '',
            tabOrder: ['stegvisning'],
            apiOnly: true,
        },
        {
            prompt: `Trafikkilder for ${pathLabel} i november 2025`,
            title: `Trafikkilder – ${pathLabel}`,
            sql: `SELECT\n  COALESCE(NULLIF(referrer_domain, ''), '(direkte)') AS kilde,\n  COUNT(*) AS sidevisninger\nFROM \`fagtorsdag-prod-81a6.umami_student.event\`\nWHERE\n  event_type = 1\n  AND website_id = '${websiteId}'\n  ${pathConditionSQL}\n  AND EXTRACT(YEAR FROM created_at) = 2025\n  AND EXTRACT(MONTH FROM created_at) = 11\nGROUP BY kilde\nORDER BY sidevisninger DESC\nLIMIT 15;`,
            tabOrder: ['barchart','piechart','table','linechart','areachart','stegvisning'],
        },
        {
            prompt: `Eksterne nettsider besøkende kommer fra`,
            title: `Inngående trafikkilder – ${pathLabel}`,
            sql: `SELECT\n  COALESCE(NULLIF(referrer_domain, ''), '(direkte)') AS kilde,\n  COUNT(DISTINCT session_id) AS unike_besokende\nFROM \`fagtorsdag-prod-81a6.umami_student.event\`\nWHERE\n  event_type = 1\n  AND website_id = '${websiteId}'\n  ${pathConditionSQL}\n  AND EXTRACT(YEAR FROM created_at) = 2025\nGROUP BY kilde\nORDER BY unike_besokende DESC\nLIMIT 1000;`,
            tabOrder: ['barchart','piechart','table','linechart','areachart','stegvisning'],
        },
        {
            prompt: `Lineær regresjon: trend i daglige sidevisninger for ${pathLabel}`,
            title: `Regresjon: daglige sidevisninger – ${pathLabel}`,
            sql: buildRegressionSQLInline(),
            tabOrder: ['table','linechart','areachart','barchart','piechart','stegvisning'],
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
    }, [step]);

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
                body: JSON.stringify({ query, analysisType: 'AI bygger' }),
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

    const formatSQL = () => {
        try {
            setQuery(sqlFormatter.format(query, { language: 'bigquery', tabWidth: 2, keywordCase: 'upper' }));
            setFormatSuccess(true);
            setTimeout(() => setFormatSuccess(false), 2000);
        } catch { /* ignore */ }
    };

    const shareQuery = () => {
        navigator.clipboard.writeText(`${globalThis.location.origin}/ai-bygger?sql=${encodeURIComponent(query)}`);
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 2000);
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
                body: JSON.stringify({ query: sql, analysisType: 'AI bygger - regresjon' }),
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

    const copyForMetabase = async () => {
        try {
            await navigator.clipboard.writeText(query);
            setMetabaseCopySuccess(true);
            setTimeout(() => setMetabaseCopySuccess(false), 2000);
        } catch { /* ignore */ }
    };

    const { prepareLineChartData, prepareBarChartData, preparePieChartData } = useChartDataPrep(result);

    return (
        <div className="w-full h-full overflow-hidden">
            {/* ── STEP 1 ── */}
            {step === 1 && (
                <div className={boxClass}>
                    <div style={{ height: '10%', display: 'flex', alignItems: 'center' }}>
                        <h2 className="text-lg font-semibold text-gray-800">AI bygger — hvilken graf?</h2>
                    </div>
                    <div style={{ height: '80%', display: 'flex', alignItems: 'center', width: '100%' }}>
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
                    </div>
                    <div style={{ height: '10%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Button variant="secondary" size="small" onClick={() => { setSelectedTidligere(null); setTidligereOpen(true); }}>
                            Eksempler
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
                        <div style={{ height: '80%', overflow: 'hidden' }}>
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
                                ) : <ResultsPanel
                                    result={result} loading={loading} error={error}
                                    queryStats={result?.queryStats} lastAction={null}
                                    showLoadingMessage={loading} executeQuery={executeQuery} handleRetry={executeQuery}
                                    prepareLineChartData={prepareLineChartData}
                                    prepareBarChartData={prepareBarChartData}
                                    preparePieChartData={preparePieChartData}
                                    sql={query} websiteId={sqlWebsiteId}
                                    containerStyle="none" hideHeading hideInternalShareButton hideInternalDownloadButton
                                    fixedAspect hideTabsList externalTab={p2Tab} onExternalTabChange={setP2Tab}
                                />}
                            </div>
                        </div>
                        <div style={{ height: '10%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Button variant="secondary" size="small" icon={<ChevronLeft size={16} />} onClick={() => setStep(1)}>Tilbake</Button>
                            <Button variant="secondary" size="small" onClick={() => setDownloadModalOpen(true)}>Last ned</Button>
                            <Button variant="secondary" size="small" onClick={() => setShareModalOpen(true)}>Del</Button>
                            {onAddWidget && (
                                <Button
                                    variant="primary" size="small"
                                    disabled={p2Tab === 'stegvisning' ? !journeyData : !result?.data?.length}
                                    onClick={() => {
                                        const sizes = WIDGET_SIZES[p2Tab] ?? [{ cols: 1, rows: 1, name: 'Standard' }];
                                        const widgetResult = p2Tab === 'stegvisning' ? journeyData
                                            : p2Tab === 'regresjon' ? { rows: result?.data, r2: result?.data?.[0]?.r2, rmse: result?.data?.[0]?.rmse, n: result?.data?.[0]?.n, title: regressionTitle }
                                            : result;
                                        if (sizes.length === 1) {
                                            onAddWidget(query, p2Tab, widgetResult, sizes[0], aiPrompt);
                                        } else {
                                            setPendingAdd({ sql: query, chartType: p2Tab, result: widgetResult, title: aiPrompt });
                                        }
                                    }}
                                >
                                    + Legg til
                                </Button>
                            )}
                            <Button variant="secondary" size="small" iconPosition="right" icon={<ChevronRight size={16} />} onClick={() => setStep(3)}>Avansert</Button>
                        </div>
                    </div>
                    {query && <ShareResultsModal sql={query} open={shareModalOpen} onClose={() => setShareModalOpen(false)} />}
                    <DownloadResultsModal result={result} open={downloadModalOpen} onClose={() => setDownloadModalOpen(false)} />
                    {pendingAdd && onAddWidget && (
                        <Modal open onClose={() => setPendingAdd(null)} header={{ heading: 'Velg storrelse' }}>
                            <Modal.Body>
                                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                                    {(WIDGET_SIZES[pendingAdd.chartType] ?? [{ cols: 1, rows: 1, name: 'Standard' }]).map(size => (
                                        <Button
                                            key={size.name}
                                            variant="secondary"
                                            onClick={() => {
                                                onAddWidget(pendingAdd.sql, pendingAdd.chartType, pendingAdd.result, size, pendingAdd.title);
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
                    <div style={{ height: '80%', overflow: 'auto' }}>
                        {isApiOnly ? (
                            <div style={{ padding: '16px' }}>
                                <div className="navds-alert navds-alert--info navds-alert--medium" role="alert">
                                    Dette elementet henter data via API og har ingen SQL-kode.
                                </div>
                            </div>
                        ) : (
                        <div className="border rounded overflow-hidden" style={{ height: '100%' }}>
                            <Editor
                                height="100%" defaultLanguage="sql"
                                value={p2Tab === 'stegvisning' ? buildJourneySQL() : p2Tab === 'regresjon' ? buildRegressionSQL() : query}
                                onChange={(v) => { if (p2Tab !== 'stegvisning' && p2Tab !== 'regresjon') { setQuery(v || ''); setFormatSuccess(false); } }}
                                theme="vs-dark"
                                options={{ minimap: { enabled: false }, fontSize: 14, lineNumbers: 'on', scrollBeyondLastLine: false, automaticLayout: true, tabSize: 2, wordWrap: 'on', fixedOverflowWidgets: true, stickyScroll: { enabled: false }, lineNumbersMinChars: 4, glyphMargin: false }}
                            />
                        </div>
                        )}
                    </div>
                    <div style={{ height: '10%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Button variant="secondary" size="small" icon={<ChevronLeft size={16} />} onClick={() => { shouldAutoExecuteRef.current = true; setStep(2); }}>Til resultater</Button>
                        <Button size="small" variant="secondary" onClick={formatSQL}>{formatSuccess ? '✓ Formatert' : 'Formater'}</Button>
                        <Button size="small" variant="secondary" onClick={shareQuery}>{shareSuccess ? '✓ Kopiert' : 'Del kode'}</Button>
                        <Button variant="secondary" size="small" icon={metabaseCopySuccess ? <Check size={16} /> : undefined} onClick={copyForMetabase}>
                            {metabaseCopySuccess ? 'Kopiert!' : 'Kopier for Metabase'}
                        </Button>
                    </div>
                </div>
            )}

            <Modal open={tidligereOpen} onClose={() => setTidligereOpen(false)} header={{ heading: 'Eksempelspørringer' }}>
                <Modal.Body>
                    <div className="flex flex-col gap-2">
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
                            const itemTitle = (item as any).title || item.prompt;
                            setAiPrompt(itemTitle);
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
