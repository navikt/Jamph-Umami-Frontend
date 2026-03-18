import { useState, useEffect } from 'react';
import ResultsPanel from '../../components/chartbuilder/results/ResultsPanel';
import AiBuilderLayout from '../../components/analysis/AiBuilderLayout';
import { Button, Alert, Heading, BodyLong, Textarea } from '@navikt/ds-react';
import Editor from '@monaco-editor/react';
import * as sqlFormatter from 'sql-formatter';
import { PlayIcon, Sparkles } from 'lucide-react';
import { ReadMore } from '@navikt/ds-react';
import { translateValue } from '../../lib/translations';

const defaultQuery = `SELECT 
  website_id,
  name
FROM 
  \`fagtorsdag-prod-81a6.umami_student.public_website\`
LIMIT 
  100;`;

// Helper function to truncate JSON to prevent browser crashes
const truncateJSON = (obj: any, maxChars: number = 50000): string => {
    const fullJSON = JSON.stringify(obj, null, 2);

    if (fullJSON.length <= maxChars) {
        return fullJSON;
    }

    // Truncate and add notice
    const truncated = fullJSON.substring(0, maxChars - 500);
    const omittedChars = fullJSON.length - truncated.length;
    const omittedKB = (omittedChars / 1024).toFixed(1);

    return truncated + `\n\n... (${omittedKB} KB omitted - total size: ${(fullJSON.length / 1024).toFixed(1)} KB)\n\nJSON-utdata er begrenset til ${(maxChars / 1000).toFixed(0)}k tegn for å unngå at nettleseren krasjer.\nBruk tabellvisningen for å se alle resultater.`;
};

export default function AiChartBuilder() {
    // State for editor height (for resizable editor)
    const [editorHeight, setEditorHeight] = useState(400);
    // Initialize state with empty string to avoid showing default until we check URL
    const [query, setQuery] = useState('');
    const [aiPrompt, setAiPrompt] = useState('');
    const [validateError, setValidateError] = useState<string | null>(null);
    const [showValidation, setShowValidation] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [estimate, setEstimate] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [estimating, setEstimating] = useState(false);
    const [generatingAI, setGeneratingAI] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showEstimate, setShowEstimate] = useState(true);
    const [shareSuccess, setShareSuccess] = useState(false);
    const [formatSuccess, setFormatSuccess] = useState(false);

    // Extract websiteId from SQL query for AnalysisActionModal
    const extractWebsiteId = (sql: string): string | undefined => {
        // Match patterns like: website_id = 'uuid' or website_id='uuid'
        const match = sql.match(/website_id\s*=\s*['"]([0-9a-f-]{36})['"]/i);
        return match?.[1];
    };

    const websiteId = extractWebsiteId(query);
    
    // Check for SQL in URL params on mount
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const sqlParam = urlParams.get('sql');

        console.log('URL search params:', window.location.search);
        console.log('SQL param:', sqlParam);

        if (sqlParam) {
            try {
                // URL params are already decoded by URLSearchParams
                console.log('Setting query to:', sqlParam);
                setQuery(sqlParam);
            } catch (e) {
                console.error('Failed to set SQL parameter:', e);
                setQuery(defaultQuery);
            }
        } else {
            // No SQL param, use default
            setQuery(defaultQuery);
        }
    }, []);

    const generateSqlFromAi = async () => {
        const promptToUse = aiPrompt.trim() || 'Vis meg sidevisninger per dag for siste 30 dager';
        setGeneratingAI(true);

        try {
            const response = await fetch(`${import.meta.env.VITE_RAG_API_URL}/api/sql`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    query: promptToUse,
                    model: 'qwen2.5-coder:7b'
                })
            });

            const data = await response.json();
            
            // Check if response is in data.sql (wrapped JSON string)
            let sqlResponse;
            if (data?.sql) {
                try {
                    sqlResponse = typeof data.sql === 'string' ? JSON.parse(data.sql) : data.sql;
                } catch {
                    sqlResponse = data;
                }
            } else {
                sqlResponse = data;
            }
            
            if (sqlResponse?.response) {
                // Remove markdown code blocks if present
                let cleanedSql = sqlResponse.response;
                if (cleanedSql.includes('```')) {
                    cleanedSql = cleanedSql
                        .replace(/```sql\n/g, '')
                        .replace(/```sql/g, '')
                        .replace(/```\n/g, '')
                        .replace(/```/g, '');
                }
                cleanedSql = cleanedSql.trim();
                setQuery(cleanedSql);
            } else {
                setQuery('-- API-svar mottatt men ingen SQL-respons funnet\n-- Debug:\n' + JSON.stringify(data, null, 2));
            }
        } catch (err) {
            setQuery(`-- Feil: Kunne ikke koble til AI-serveren\n-- Sjekk at serveren kjører på ${import.meta.env.VITE_RAG_API_URL}\n\n${defaultQuery}`);
        } finally {
            setGeneratingAI(false);
        }
    };

    const estimateCost = async () => {
        setEstimating(true);
        setError(null);

        // Update URL with current query
        const encodedSql = encodeURIComponent(query);
        window.history.replaceState({}, '', `/ai-builder?sql=${encodedSql}`);

        try {
            const response = await fetch('/api/bigquery/estimate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query, analysisType: 'AI Builder' }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to estimate cost');
            }

            // Store the estimate
            setEstimate(data);
            setShowEstimate(true);

        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setEstimating(false);
        }
    };

    const executeQuery = async () => {
        setLoading(true);
        setError(null);
        setResult(null);

        // Update URL with current query
        const encodedSql = encodeURIComponent(query);
        window.history.replaceState({}, '', `/ai-builder?sql=${encodedSql}`);

        try {
            const response = await fetch('/api/bigquery', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query, analysisType: 'AI Builder' }),
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

    const handleQueryChange = (value: string) => {
        setQuery(value);
        setFormatSuccess(false); // Reset format success state when query changes
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

    const shareQuery = () => {
        const encodedSql = encodeURIComponent(query);
        const url = `${window.location.origin}/ai-builder?sql=${encodedSql}`;
        navigator.clipboard.writeText(url);
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 2000);
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
                },
            } as any);
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

    return (
        <AiBuilderLayout
            title="KI Grafbygger"
            description="La kunstig intelligens generere SQL-spørringer for deg."
            wideSidebar={true}
            filters={
                <>
                    {/* AI Prompt Input */}
                    <div>
                        <Textarea
                            label="Hvilken graf vil du KI skal lage?"
                            description="Beskriv grafen du ønsker i vanlig språk"
                            value={aiPrompt}
                            onChange={(e) => setAiPrompt(e.target.value)}
                            rows={4}
                            placeholder="Eksempel: Vis meg sidevisninger per dag for siste 30 dager"
                        />
                        <Button
                            className="mt-3"
                            onClick={generateSqlFromAi}
                            loading={generatingAI}
                            icon={<Sparkles size={18} />}
                            variant="primary"
                        >
                            {generatingAI ? 'Genererer SQL...' : 'Generer SQL med KI'}
                        </Button>
                    </div>

                    {/* Query Input */}
                    <div>
                        <label className="block font-medium mb-2" htmlFor="sql-editor">SQL-spørring</label>
                        <div
                            className="border rounded resize-y overflow-auto"
                            style={{ position: 'relative', isolation: 'isolate', minHeight: 100, maxHeight: 600, height: editorHeight }}
                            onMouseUp={e => {
                                const target = e.currentTarget as HTMLDivElement;
                                setEditorHeight(target.offsetHeight);
                            }}
                        >
                            <Editor
                                height={editorHeight}
                                defaultLanguage="sql"
                                value={query}
                                onChange={(value) => handleQueryChange(value || '')}
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
                        <div className="flex flex-wrap gap-2 mt-2">
                            <Button size="small" variant="secondary" type="button" onClick={formatSQL}>
                                {formatSuccess ? '✓ Formatert' : 'Formater'}
                            </Button>
                            <Button size="small" variant="secondary" type="button" onClick={validateSQL}>Valider</Button>
                            <Button
                                size="small"
                                variant="secondary"
                                type="button"
                                onClick={shareQuery}
                            >
                                {shareSuccess ? '✓ Kopiert' : 'Del'}
                            </Button>
                        </div>
                        {showValidation && validateError && (
                            <div
                                className={`relative rounded px-3 py-2 mt-2 text-sm ${validateError === 'SQL er gyldig!' ? 'bg-green-100 border border-green-400 text-green-800' : 'bg-red-100 border border-red-400 text-red-800'}`}
                            >
                                <span>{validateError}</span>
                                <button
                                    type="button"
                                    aria-label="Lukk"
                                    onClick={() => setShowValidation(false)}
                                    className="absolute right-2 top-2 font-bold cursor-pointer"
                                >
                                    ×
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Submit Buttons */}
                    <div className="flex flex-wrap gap-2">
                        <Button
                            onClick={executeQuery}
                            loading={loading}
                            icon={<PlayIcon size={18} />}
                            variant="primary"
                        >
                            Vis resultater
                        </Button>
                        <Button
                            onClick={estimateCost}
                            loading={estimating}
                            variant="secondary"
                        >
                            Estimer kostnad
                        </Button>
                    </div>

                    {/* Cost Estimate Display */}
                    {estimate && showEstimate && (
                        <Alert variant="info" className="relative" size="small">
                            <button
                                type="button"
                                aria-label="Lukk"
                                onClick={() => setShowEstimate(false)}
                                className="absolute right-2 top-2 font-bold cursor-pointer"
                            >
                                ×
                            </button>
                            <div className="space-y-1 text-sm">
                                <div>
                                    <strong>Data:</strong>
                                    {parseFloat(estimate.totalBytesProcessedGB) >= 0.01 && ` ${estimate.totalBytesProcessedGB} GB`}
                                </div>
                                {parseFloat(estimate.estimatedCostUSD) > 0 && (
                                    <div>
                                        <strong>Kostnad:</strong> ${estimate.estimatedCostUSD} USD
                                    </div>
                                )}
                                {estimate.cacheHit && (
                                    <div className="text-green-700">
                                        ✓ Cached (no cost)
                                    </div>
                                )}
                            </div>
                        </Alert>
                    )}
                </>
            }
        >
            {/* Error Display */}
            {error && (
                <Alert variant="error" className="mb-4">
                    <Heading level="3" size="small" spacing>
                        Feil
                    </Heading>
                    <BodyLong>{error}</BodyLong>
                </Alert>
            )}

            {/* Results Display Area */}
            <ResultsPanel
                result={result}
                loading={loading}
                error={error}
                queryStats={result?.queryStats || estimate}
                lastAction={null}
                showLoadingMessage={estimating || loading}
                executeQuery={executeQuery}
                handleRetry={executeQuery}
                prepareLineChartData={prepareLineChartData}
                prepareBarChartData={prepareBarChartData}
                preparePieChartData={preparePieChartData}
                sql={query}
                websiteId={websiteId}
            />

            {/* JSON Output - below results */}
            {result && (
                <ReadMore header="JSON" size="small" className="mt-6">
                    <pre className="bg-gray-100 border border-gray-300 rounded p-3 text-xs font-mono whitespace-pre-wrap" style={{ margin: 0 }}>{truncateJSON(result)}</pre>
                </ReadMore>
            )}
        </AiBuilderLayout>
    );
}
