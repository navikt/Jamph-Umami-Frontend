import { useState, useEffect, useRef } from 'react';
import ResultsPanel from '../../components/chartbuilder/results/ResultsPanel';
import ShareResultsModal from '../../components/chartbuilder/results/ShareResultsModal';
import DownloadResultsModal from '../../components/chartbuilder/results/DownloadResultsModal';
import { Button, Alert, Textarea, Page, Modal } from '@navikt/ds-react';
import Editor from '@monaco-editor/react';
import * as sqlFormatter from 'sql-formatter';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { translateValue } from '../../lib/translations';

const defaultQuery = `SELECT 
  website_id,
  name
FROM 
  \`fagtorsdag-prod-81a6.umami_student.public_website\`
LIMIT 
  100;`;

type Step = 1 | 2 | 3;

export default function Prototype2() {
    const [step, setStep] = useState<Step>(1);
    const [editorHeight] = useState(400);
    const [query, setQuery] = useState(defaultQuery);
    const [aiPrompt, setAiPrompt] = useState('');
    const [validateError, setValidateError] = useState<string | null>(null);
    const [showValidation, setShowValidation] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [generatingAI, setGeneratingAI] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [shareModalOpen, setShareModalOpen] = useState(false);
    const [downloadModalOpen, setDownloadModalOpen] = useState(false);
    const [tidligereOpen, setTidligereOpen] = useState(false);
    const [selectedTidligere, setSelectedTidligere] = useState<number | null>(null);
    const [metabaseCopySuccess, setMetabaseCopySuccess] = useState(false);
    const [p2Tab, setP2Tab] = useState('table');
    const [showMoreTabs, setShowMoreTabs] = useState(false);
    const MAX_VISIBLE_TABS = 5;

    const allTabs = [
        { value: 'table', label: 'Tabell' },
        { value: 'linechart', label: 'Linje' },
        { value: 'areachart', label: 'Område' },
        { value: 'barchart', label: 'Stolpe' },
        { value: 'piechart', label: 'Kake' },
    ];
    const visibleTabs = allTabs.slice(0, MAX_VISIBLE_TABS);
    const overflowTabs = allTabs.slice(MAX_VISIBLE_TABS);
    const activeIsOverflow = overflowTabs.some(t => t.value === p2Tab);

    const embedded = new URLSearchParams(window.location.search).get('embedded') === 'true';
    const boxClass = `bg-green-50 p-4 rounded-md border border-green-100 w-full ${embedded ? 'h-full' : 'aspect-[5/4]'} flex flex-col`;

    const tidligereSpørringer = [
        {
            prompt: 'Vis meg daglige unike besøkende på Aksel i september 2025',
            sql: `SELECT FORMAT_TIMESTAMP('%Y-%m-%d', created_at) AS dato, COUNT(DISTINCT session_id) AS unike_besokende FROM \`fagtorsdag-prod-81a6.umami_student.event\` WHERE event_type = 1 AND website_id = 'fb69e1e9-1bd3-4fd9-b700-9d035cbf44e1' AND EXTRACT(YEAR FROM created_at) = 2025 AND EXTRACT(MONTH FROM created_at) = 9 GROUP BY dato ORDER BY dato ASC;`,
        },
        {
            prompt: 'Hvilke seksjoner på Aksel hadde flest unike besøkende i september 2025?',
            sql: `SELECT seksjon, unike_besokende FROM (SELECT CONCAT('/', SPLIT(TRIM(url_path, '/'), '/')[SAFE_OFFSET(0)]) AS seksjon, COUNT(DISTINCT session_id) AS unike_besokende FROM \`fagtorsdag-prod-81a6.umami_student.event\` WHERE event_type = 1 AND website_id = 'fb69e1e9-1bd3-4fd9-b700-9d035cbf44e1' AND EXTRACT(YEAR FROM created_at) = 2025 AND EXTRACT(MONTH FROM created_at) = 9 GROUP BY seksjon) WHERE seksjon NOT LIKE '/admin%' AND seksjon NOT LIKE '%#%' AND seksjon NOT LIKE '% %' AND seksjon NOT LIKE '%:%' AND unike_besokende > 5 ORDER BY unike_besokende DESC;`,
        },
        {
            prompt: 'Hvilke hendelser ble utløst flest ganger på Aksel i september 2025?',
            sql: `SELECT event_name, COUNT(*) AS antall FROM \`fagtorsdag-prod-81a6.umami_student.event\` WHERE event_type = 2 AND website_id = 'fb69e1e9-1bd3-4fd9-b700-9d035cbf44e1' AND EXTRACT(YEAR FROM created_at) = 2025 AND EXTRACT(MONTH FROM created_at) = 9 GROUP BY event_name ORDER BY antall DESC LIMIT 10;`,
        },
    ];
    const [shareSuccess, setShareSuccess] = useState(false);
    const [formatSuccess, setFormatSuccess] = useState(false);
    const shouldAutoExecuteRef = useRef(false);

    const extractWebsiteId = (sql: string): string | undefined => {
        const match = sql.match(/website_id\s*=\s*['"]([0-9a-f-]{36})['"]/i);
        return match?.[1];
    };
    const websiteId = extractWebsiteId(query);

    // Auto-execute query when navigating to step 2 after AI generation
    useEffect(() => {
        if (shouldAutoExecuteRef.current && step === 2) {
            shouldAutoExecuteRef.current = false;
            executeQuery();
        }
    }, [step]);

    const generateSqlFromAi = async () => {
        const promptToUse = aiPrompt.trim() || 'Vis meg sidevisninger per dag for siste 30 dager';
        setGeneratingAI(true);
        setError(null);

        try {
            const response = await fetch('http://localhost:8004/api/sql', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: promptToUse, model: 'qwen2.5-coder:7b' })
            });

            const data = await response.json();

            let sqlResponse;
            if (data?.sql) {
                try { sqlResponse = typeof data.sql === 'string' ? JSON.parse(data.sql) : data.sql; }
                catch { sqlResponse = data; }
            } else {
                sqlResponse = data;
            }

            if (sqlResponse?.response) {
                let cleanedSql = sqlResponse.response;
                if (cleanedSql.includes('```')) {
                    cleanedSql = cleanedSql
                        .replace(/```sql\n/g, '').replace(/```sql/g, '')
                        .replace(/```\n/g, '').replace(/```/g, '');
                }
                setQuery(cleanedSql.trim());
            } else {
                setQuery('-- API-svar mottatt men ingen SQL-respons funnet\n-- Debug:\n' + JSON.stringify(data, null, 2));
            }
        } catch {
            setQuery(`-- Feil: Kunne ikke koble til AI-serveren\n-- Sjekk at serveren kjører på http://localhost:8004\n\n${defaultQuery}`);
        } finally {
            setGeneratingAI(false);
            // Auto-advance to results step and execute query
            shouldAutoExecuteRef.current = true;
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
                body: JSON.stringify({ query, analysisType: 'Prototype 2' }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Query failed');
            }

            setResult(data);
        } catch (err: any) {
            setError(err.message || 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    const formatSQL = () => {
        try {
            const formatted = sqlFormatter.format(query, {
                language: 'bigquery',
                tabWidth: 2,
                keywordCase: 'upper',
            });
            setQuery(formatted);
            setFormatSuccess(true);

            // Reset success state after 2 seconds
            setTimeout(() => setFormatSuccess(false), 2000);

        } catch (error) {
            console.error('SQL formatting error:', error);
        }
    };

    const validateSQL = async () => {
        try {
            const response = await fetch('/api/bigquery/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query }),
            });

            const data = await response.json();

            if (!response.ok) {
                setValidateError(data.error || 'Validation failed');
            } else if (data.valid) {
                setValidateError('SQL er gyldig!');
            } else {
                setValidateError(data.error || 'SQL er ikke gyldig');
            }

            setShowValidation(true);

        } catch (error) {
            setValidateError('Kunne ikke validere SQL');
            setShowValidation(true);
        }
    };

    const shareQuery = () => {        const encodedSql = encodeURIComponent(query);
        const url = `${window.location.origin}/prototype2?sql=${encodedSql}`;
        navigator.clipboard.writeText(url);
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 2000);
    };

    const copyForMetabase = async () => {
        try {
            await navigator.clipboard.writeText(query);
            setMetabaseCopySuccess(true);
            setTimeout(() => setMetabaseCopySuccess(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    // Chart data preparation functions
    const prepareLineChartData = (includeAverage: boolean = false) => {
        if (!result || !result.data || result.data.length === 0) return null;

        const data = result.data;
        const keys = Object.keys(data[0]);

        // Need at least 2 columns (x-axis and y-axis)
        if (keys.length < 2) return null;

        console.log('Preparing LineChart with keys:', keys);
        console.log('Sample row:', data[0]);

        // Check if we have 3 columns - likely x-axis, series grouping, and y-axis
        if (keys.length === 3) {
            const xKey = keys[0];
            const seriesKey = keys[1]; // e.g., 'browser'
            const yKey = keys[2]; // e.g., 'Unike_besokende'

            // Group data by series
            const seriesMap = new Map<string, any[]>();

            data.forEach((row: any) => {
                const rawSeriesValue = row[seriesKey];
                const translatedSeriesValue = translateValue(seriesKey, rawSeriesValue);
                const seriesValue = String(translatedSeriesValue || 'Ukjent');
                if (!seriesMap.has(seriesValue)) {
                    seriesMap.set(seriesValue, []);
                }

                const xValue = row[xKey];
                const yValue = typeof row[yKey] === 'number' ? row[yKey] : parseFloat(row[yKey]) || 0;

                let x: number | Date;
                if (typeof xValue === 'string' && xValue.match(/^\d{4}-\d{2}-\d{2}/)) {
                    x = new Date(xValue);
                } else if (typeof xValue === 'number') {
                    x = xValue;
                } else {
                    x = new Date(xValue).getTime() || 0;
                }

                seriesMap.get(seriesValue)!.push({
                    x,
                    y: yValue,
                    xAxisCalloutData: typeof x === 'number' ? new Date(x).toLocaleDateString('no') : xValue,
                    yAxisCalloutData: yValue.toString(),
                });
            });

            const lineChartData = Array.from(seriesMap.entries()).map(([seriesName, points]) => ({
                legend: seriesName,
                data: points,
                color: '#0067C5',
            }));

            return {
                data: {
                    lineChartData,
                },
                enabledLegendsWrapLines: true,
            };
        }

        // Standard 2-column chart (x-axis, y-axis)
        const xKey = keys[0];
        const yKey = keys[1];

        const chartPoints = data.map((row: any) => {
            const xValue = row[xKey];
            const yValue = typeof row[yKey] === 'number' ? row[yKey] : parseFloat(row[yKey]) || 0;

            let x: number | Date;
            if (typeof xValue === 'string' && xValue.match(/^\d{4}-\d{2}-\d{2}/)) {
                x = new Date(xValue);
            } else if (typeof xValue === 'number') {
                x = xValue;
            } else {
                x = new Date(xValue).getTime() || 0;
            }

            return {
                x,
                y: yValue,
                xAxisCalloutData: typeof x === 'number' ? new Date(x).toLocaleDateString('no') : xValue,
                yAxisCalloutData: yValue.toString(),
            };
        });

        console.log('LineChart data points:', chartPoints.slice(0, 3));

        const lineChartData = [
            {
                legend: yKey,
                data: chartPoints,
                color: '#0067C5',
            },
        ];

        if (includeAverage && chartPoints.length > 0) {
            // Calculate average y value for horizontal average line
            const avgY = chartPoints.reduce((sum: number, point: any) => sum + point.y, 0) / chartPoints.length;

            // Create average line points (horizontal line across all x values)
            const averageLinePoints = chartPoints.map((point: any) => ({
                x: point.x,
                y: avgY,
                xAxisCalloutData: point.xAxisCalloutData,
                yAxisCalloutData: avgY.toFixed(2),
            }));

            lineChartData.push({
                legend: 'Gjennomsnitt',
                data: averageLinePoints,
                color: '#262626',
                lineOptions: {
                    lineBorderWidth: '2',
                    strokeDasharray: '5 5',
                } as any,
            });
        }

        return {
            data: {
                lineChartData,
            },
            enabledLegendsWrapLines: true,
        };
    };

    const prepareBarChartData = () => {
        if (!result || !result.data || result.data.length === 0) return null;

        const data = result.data;

        // Only show bar chart if 12 or fewer items
        if (data.length > 12) return null;

        const keys = Object.keys(data[0]);

        // Need at least 2 columns (label and value)
        if (keys.length < 2) return null;

        // Assume first column is label and second is value
        const labelKey = keys[0];
        const valueKey = keys[1];

        console.log('Preparing VerticalBarChart with keys:', { labelKey, valueKey });
        console.log('Sample row:', data[0]);

        // Calculate total for percentages
        const total = data.reduce((sum: number, row: any) => {
            const value = typeof row[valueKey] === 'number' ? row[valueKey] : parseFloat(row[valueKey]) || 0;
            return sum + value;
        }, 0);

        console.log('Total value for bar chart:', total);

        const barChartData = data.map((row: any) => {
            const value = typeof row[valueKey] === 'number' ? row[valueKey] : parseFloat(row[valueKey]) || 0;
            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0';

            // Use label for x-axis, with translation
            const rawLabel = row[labelKey];
            const translatedLabel = translateValue(labelKey, rawLabel);
            const label = String(translatedLabel || 'Ukjent');

            return {
                x: label,
                y: value,
                xAxisCalloutData: label,
                yAxisCalloutData: `${value} (${percentage}%)`,
                color: '#0067C5', // NAV blue color
                legend: label,
            };
        });

        console.log('VerticalBarChart data points:', barChartData.slice(0, 3));

        return {
            data: barChartData,
            barWidth: 'auto' as 'auto',
            yAxisTickCount: 5,
            enableReflow: true,
            legendProps: {
                allowFocusOnLegends: true,
                canSelectMultipleLegends: false,
                styles: {
                    root: {
                        display: 'flex',
                        flexWrap: 'wrap',
                        rowGap: '8px',
                        columnGap: '16px',
                        maxWidth: '100%',
                    },
                    legend: {
                        marginRight: 0,
                    },
                },
            },
        };
    };

    const preparePieChartData = () => {
        if (!result || !result.data || result.data.length === 0) return null;

        const data = result.data;

        // Only show pie chart if 12 or fewer items
        if (data.length > 12) return null;

        const keys = Object.keys(data[0]);

        // Need at least 2 columns (label and value)
        if (keys.length < 2) return null;

        // Assume first column is label and second is value
        const labelKey = keys[0];
        const valueKey = keys[1];

        console.log('Preparing PieChart with keys:', { labelKey, valueKey });
        console.log('Sample row:', data[0]);

        // Calculate total for percentages
        const total = data.reduce((sum: number, row: any) => {
            const value = typeof row[valueKey] === 'number' ? row[valueKey] : parseFloat(row[valueKey]) || 0;
            return sum + value;
        }, 0);

        console.log('Total value for pie chart:', total);

        const pieChartData = data.map((row: any) => {
            const value = typeof row[valueKey] === 'number' ? row[valueKey] : parseFloat(row[valueKey]) || 0;
            const rawLabel = row[labelKey];
            const translatedLabel = translateValue(labelKey, rawLabel);
            const label = String(translatedLabel || 'Ukjent');

            return {
                y: value,
                x: label,
            };
        });

        console.log('PieChart data points:', pieChartData.slice(0, 3));

        return {
            data: pieChartData,
            total,
        };
    };

    const pageContent = (
        <>

                {/* ── STEP 1: Beskriv ──────────────────────────────────────── */}
                {step === 1 && (
                    <div className={boxClass}>
                        <div style={{ height: '10%', display: 'flex', alignItems: 'center' }}>
                            <h2 className="text-lg font-semibold text-gray-800">Hvilken graf vil du lage?</h2>
                        </div>
                        <div style={{ height: '80%' }}>
                            <Textarea
                                label=""
                                hideLabel
                                value={aiPrompt}
                                onChange={(e) => setAiPrompt(e.target.value)}
                                placeholder="Eksempel: Vis meg sidevisninger per dag for siste 30 dager"
                                style={{ width: '100%', height: '100%', resize: 'none' }}
                            />
                        </div>
                        <div style={{ height: '10%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Button variant="secondary" size="small" onClick={() => {}}>
                                Lagrede grafer
                            </Button>
                            <Button variant="secondary" size="small" onClick={() => { setSelectedTidligere(null); setTidligereOpen(true); }}>
                                Tidligere spørringer
                            </Button>
                            <Button variant="secondary" size="small" iconPosition="right" icon={<ChevronRight size={16} />} onClick={() => { shouldAutoExecuteRef.current = true; setStep(2); }}>
                                Lag graf
                            </Button>
                        </div>
                    </div>
                )}

                {/* ── STEP 2: Resultater ───────────────────────────────────── */}
                {step === 2 && (
                    <div>
                        {error && (
                            <Alert variant="error" className="mb-4">
                                {error}
                            </Alert>
                        )}

                        <div className={boxClass}>
                            <div style={{ height: '10%', display: 'flex', alignItems: 'center', position: 'relative' }}>
                                {visibleTabs.map((tab) => (
                                    <button key={tab.value} type="button" onClick={() => setP2Tab(tab.value)}
                                        className={`px-4 py-1 text-sm font-medium border-b-2 mr-1 shrink-0 ${ p2Tab === tab.value ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900' }`}
                                    >{tab.label}</button>
                                ))}
                                {overflowTabs.length > 0 && (
                                    <div className="relative ml-1">
                                        <button type="button"
                                            onClick={() => setShowMoreTabs(v => !v)}
                                            className={`px-3 py-1 text-sm font-medium border-b-2 shrink-0 ${ activeIsOverflow ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900' }`}
                                        >{activeIsOverflow ? allTabs.find(t => t.value === p2Tab)?.label + ' ▾' : 'Mer ▾'}</button>
                                        {showMoreTabs && (
                                            <div className="absolute top-full left-0 z-10 bg-white border border-gray-200 rounded shadow-md min-w-[120px]">
                                                {overflowTabs.map(tab => (
                                                    <button key={tab.value} type="button"
                                                        onClick={() => { setP2Tab(tab.value); setShowMoreTabs(false); }}
                                                        className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${ p2Tab === tab.value ? 'text-blue-600 font-medium' : 'text-gray-700' }`}
                                                    >{tab.label}</button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div style={{ height: '80%', overflow: 'hidden' }}>
                                <div style={{ width: '80%', height: '100%', overflow: 'auto', margin: '0 auto' }}>
                                    <ResultsPanel
                                        result={result}
                                        loading={loading}
                                        error={error}
                                        queryStats={result?.queryStats}
                                        lastAction={null}
                                        showLoadingMessage={loading}
                                        executeQuery={executeQuery}
                                        handleRetry={executeQuery}
                                        prepareLineChartData={prepareLineChartData}
                                        prepareBarChartData={prepareBarChartData}
                                        preparePieChartData={preparePieChartData}
                                        sql={query}
                                        websiteId={websiteId}
                                        containerStyle="none"
                                        hideHeading
                                        hideInternalShareButton
                                        hideInternalDownloadButton
                                        fixedAspect
                                        hideTabsList
                                        externalTab={p2Tab}
                                        onExternalTabChange={setP2Tab}
                                    />
                                </div>
                            </div>
                            <div style={{ height: '10%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Button variant="secondary" size="small" icon={<ChevronLeft size={16} />} onClick={() => setStep(1)}>
                                    Tilbake
                                </Button>
                                <Button variant="secondary" size="small" onClick={() => setDownloadModalOpen(true)}>
                                    Last ned resultater
                                </Button>
                                <Button variant="secondary" size="small" onClick={() => setShareModalOpen(true)}>
                                    Del tabell &amp; graf
                                </Button>
                                <Button variant="secondary" size="small" iconPosition="right" icon={<ChevronRight size={16} />} onClick={() => setStep(3)}>
                                    Avansert
                                </Button>
                            </div>
                        </div>
                        {query && <ShareResultsModal sql={query} open={shareModalOpen} onClose={() => setShareModalOpen(false)} />}
                        <DownloadResultsModal result={result} open={downloadModalOpen} onClose={() => setDownloadModalOpen(false)} />
                    </div>
                )}

                <Modal open={tidligereOpen} onClose={() => setTidligereOpen(false)} header={{ heading: 'Tidligere spørringer' }}>
                    <Modal.Body>
                        <div className="flex flex-col gap-2">
                            {tidligereSpørringer.map((item, i) => (
                                <button
                                    key={i}
                                    type="button"
                                    className={`text-left border rounded-md px-4 py-3 cursor-pointer w-full ${ selectedTidligere === i ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50' }`}
                                    onClick={() => setSelectedTidligere(i)}
                                >
                                    {item.prompt}
                                </button>
                            ))}
                        </div>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button
                            variant="primary"
                            disabled={selectedTidligere === null}
                            onClick={() => {
                                if (selectedTidligere !== null) {
                                    setAiPrompt(tidligereSpørringer[selectedTidligere].prompt);
                                    setQuery(tidligereSpørringer[selectedTidligere].sql);
                                    setTidligereOpen(false);
                                }
                            }}
                        >
                            Bruk
                        </Button>
                        <Button variant="tertiary" onClick={() => setTidligereOpen(false)}>Avbryt</Button>
                    </Modal.Footer>
                </Modal>

                {/* ── STEP 3: Avansert SQL ─────────────────────────────────── */}
                {step === 3 && (
                    <div>
                        <div className={boxClass}>
                            <div style={{ height: '10%', display: 'flex', alignItems: 'center' }}>
                                <h2 className="text-lg font-semibold text-gray-800">Avansert spørring</h2>
                            </div>
                            <div style={{ height: '80%', overflow: 'auto' }}>
                                <div className="border rounded overflow-hidden" style={{ height: '100%' }}>
                                <Editor
                                    height="100%"
                                    defaultLanguage="sql"
                                    value={query}
                                    onChange={(v) => { setQuery(v || ''); setFormatSuccess(false); }}
                                    theme="vs-dark"
                                    options={{
                                        minimap: { enabled: false },
                                        fontSize: 14,
                                        lineNumbers: 'on',
                                        scrollBeyondLastLine: false,
                                        automaticLayout: true,
                                        tabSize: 2,
                                        wordWrap: 'on',
                                        fixedOverflowWidgets: true,
                                        stickyScroll: { enabled: false },
                                        lineNumbersMinChars: 4,
                                        glyphMargin: false,
                                    }}
                                />
                                </div>
                            </div>
                            <div style={{ height: '10%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Button variant="secondary" size="small" icon={<ChevronLeft size={16} />} onClick={() => { shouldAutoExecuteRef.current = true; setStep(2); }}>
                                    Til resultater
                                </Button>
                                <Button size="small" variant="secondary" onClick={formatSQL}>
                                    {formatSuccess ? '✓ Formatert' : 'Formater'}
                                </Button>
                                <Button size="small" variant="secondary" onClick={validateSQL}>
                                    Valider
                                </Button>
                                <Button size="small" variant="secondary" onClick={shareQuery}>
                                    {shareSuccess ? '✓ Kopiert' : 'Del kode'}
                                </Button>
                                <Button variant="secondary" size="small" icon={metabaseCopySuccess ? <Check size={16} /> : undefined} onClick={copyForMetabase}>
                                    {metabaseCopySuccess ? 'Kopiert!' : 'Kopier for Metabase'}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
        </>
    );

    if (embedded) {
        return <div className="w-full h-full overflow-hidden">{pageContent}</div>;
    }
    return (
        <Page>
            <Page.Block width="xl" gutters className="py-10">
                {pageContent}
            </Page.Block>
        </Page>
    );
}