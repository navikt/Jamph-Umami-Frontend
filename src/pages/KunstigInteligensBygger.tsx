import { useMemo, useState } from 'react';
import { Alert, BodyShort, Button, Tabs, Textarea } from '@navikt/ds-react';
import DashboardLayout from '../components/dashboard/DashboardLayout';
import PinnedGrid, { type PinnedItem } from '../client/shared/ui/tables/layout/PinnedGrid';
import PinnedWidget from '../client/shared/ui/tables/layout/PinnedWidget';
import { SqlCodeEditor } from '../client/shared/ui/sql';
import { executeBigQueryQuery, generateSqlFromPrompt } from '../components/dashboardjson/api';
import { useDashboardWidgetResolver } from '../components/dashboardjson/hooks';
import type { DashboardWidgetDefinition, DashboardWidgetType } from '../components/dashboardjson/model';
import UrlSearchFormPrototype from '../components/dashboard/UrlSearchFormPrototype';
import defaultWidgetsData from '../data/dashboard/defaultWidgets.json';
import mockupResults from '../data/dashboard/mockupResults.json';

const initialWidgets = (defaultWidgetsData.widgets as DashboardWidgetDefinition[]).map((widget) => ({
    ...widget,
    size: {
        cols: widget.size?.cols ?? 1,
        rows: widget.size?.rows ?? 1,
    },
}));

const DEFAULT_PROMPT = 'Vis daglige sidevisninger for siste 30 dager';

const QUICK_SUGGESTIONS = [
    '«i måneden»',
    '«jeg ønsker ikke treff fra admin-sider»',
    '«kun unike brukere»',
];

const widgetSizeByChartType: Record<DashboardWidgetType, { cols: number; rows: number }> = {
    table: { cols: 2, rows: 1 },
    regresjon: { cols: 2, rows: 1 },
    linechart: { cols: 2, rows: 1 },
    areachart: { cols: 2, rows: 1 },
    barchart: { cols: 2, rows: 1 },
    piechart: { cols: 1, rows: 2 },
    statcards: { cols: 2, rows: 1 },
    stegvisning: { cols: 2, rows: 1 },
    kiforklaring: { cols: 2, rows: 1 },
};

export default function KunstigInteligensBygger() {
    const [widgets, setWidgets] = useState<DashboardWidgetDefinition[]>(initialWidgets);
    const [widgetOrder, setWidgetOrder] = useState<string[]>(() => initialWidgets.map((widget) => widget.id));
    const [runtimeResults, setRuntimeResults] = useState<Record<string, unknown>>({});

    const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
    const [query, setQuery] = useState('');
    const chartType: DashboardWidgetType = 'table';
    const [previewResult, setPreviewResult] = useState<unknown[] | null>(null);
    const [previewTitle, setPreviewTitle] = useState('Grafvindu');
    const [urlContext, setUrlContext] = useState<{
        websiteId: string;
        domain: string;
        name: string;
        path: string;
        pathOperator: string;
    } | null>(null);

    const [isExecuting, setIsExecuting] = useState(false);
    const [apiError, setApiError] = useState<string | null>(null);

    const combinedResults = useMemo<Record<string, unknown>>(() => {
        return {
            ...(mockupResults as Record<string, unknown>),
            ...runtimeResults,
        };
    }, [runtimeResults]);

    const { pinnedItems } = useDashboardWidgetResolver(widgets, combinedResults);

    const orderedPinnedItems = useMemo<PinnedItem[]>(() => {
        const pinnedById = new Map(pinnedItems.map((item) => [item.id, item]));
        return widgetOrder.map((id) => pinnedById.get(id)).filter((item): item is PinnedItem => Boolean(item));
    }, [pinnedItems, widgetOrder]);

    const handleReorder = (fromId: string, toId: string) => {
        setWidgetOrder((prev) => {
            const next = [...prev];
            const fromIndex = next.indexOf(fromId);
            const toIndex = next.indexOf(toId);

            if (fromIndex === -1 || toIndex === -1) {
                return prev;
            }

            [next[fromIndex], next[toIndex]] = [next[toIndex], next[fromIndex]];
            return next;
        });
    };

    const handleDelete = (id: string) => {
        setWidgets((prev) => prev.filter((widget) => widget.id !== id));
        setWidgetOrder((prev) => prev.filter((widgetId) => widgetId !== id));
        setRuntimeResults((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
        });
    };

    const handleResize = (id: string, size: { cols: number; rows: number }) => {
        setWidgets((prev) => prev.map((widget) => widget.id === id ? { ...widget, size } : widget));
    };

    const handleReset = () => {
        setWidgets(initialWidgets);
        setWidgetOrder(initialWidgets.map((widget) => widget.id));
        setRuntimeResults({});
        setPrompt(DEFAULT_PROMPT);
        setQuery('');
        setPreviewResult(null);
        setPreviewTitle('Grafvindu');
        setApiError(null);
    };

    const buildPromptWithContext = () => {
        const trimmedPrompt = prompt.trim();
        if (!urlContext) {
            return trimmedPrompt;
        }

        return [
            trimmedPrompt,
            '',
            `WebsiteId: ${urlContext.websiteId}`,
            `Domain: ${urlContext.domain}`,
            `Path: ${urlContext.path}`,
            `PathOperator: ${urlContext.pathOperator}`,
        ].join('\n');
    };

    const handleRunAndAddWidget = async () => {
        const trimmedPrompt = buildPromptWithContext().trim();
        if (!trimmedPrompt) {
            setApiError('Prompt kan ikke være tom.');
            return;
        }

        setIsExecuting(true);
        setApiError(null);

        try {
            const sql = await generateSqlFromPrompt(trimmedPrompt);
            setQuery(sql);
            const response = await executeBigQueryQuery(sql, 'Kunstig intelligens bygger');
            setPreviewResult(response.data);
            setPreviewTitle(prompt.trim() || 'KI assistent graf');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Klarte ikke hente graf.';
            setApiError(message);
        } finally {
            setIsExecuting(false);
        }
    };

    const handleSaveToDashboard = () => {
        if (!previewResult || !query.trim()) {
            setApiError('Ingen graf å lagre ennå. Hent graf først.');
            return;
        }

        const widgetId = crypto.randomUUID();
        const size = widgetSizeByChartType[chartType];
        const newWidget: DashboardWidgetDefinition = {
            id: widgetId,
            title: previewTitle,
            aiPrompt: prompt.trim() || undefined,
            chartType,
            sql: query.trim(),
            size,
        };

        setWidgets((prev) => [newWidget, ...prev]);
        setWidgetOrder((prev) => [widgetId, ...prev]);
        setRuntimeResults((prev) => ({
            ...prev,
            [widgetId]: previewResult,
        }));
        setApiError(null);
    };

    return (
        <DashboardLayout
            title="KI assistent"
            hideHeader
        >
            <Tabs defaultValue="ki-assistent">
                <Tabs.List>
                    <Tabs.Tab value="ki-assistent" label="KI assistent" />
                    <Tabs.Tab value="dashboard" label="Dashboard" />
                </Tabs.List>

                <Tabs.Panel value="ki-assistent" className="pt-4 w-full">
                    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1rem' }}>
                        <div className="space-y-4">
                            <div className="rounded border border-gray-300 bg-white p-4">
                                <UrlSearchFormPrototype
                                    targetPath="/ki-assistent"
                                    onResolved={(websiteId, domain, name, path, pathOperator) => {
                                        setUrlContext({ websiteId, domain, name, path, pathOperator });
                                    }}
                                />
                            </div>

                            <div className="rounded border border-dashed border-gray-300 bg-white p-4 min-h-[120px]">
                                <BodyShort weight="semibold">Velg analysetype</BodyShort>
                            </div>

                            <div className="rounded border border-dashed border-gray-300 bg-white p-4 min-h-[120px]">
                                <BodyShort weight="semibold">Hurtigfiltere</BodyShort>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {apiError && (
                                <Alert variant="error" size="small">
                                    {apiError}
                                </Alert>
                            )}

                            <div className="rounded border border-gray-300 bg-white p-4 space-y-3">
                                <BodyShort weight="semibold">KI assistent</BodyShort>

                                <Textarea
                                    label="Chatboks"
                                    value={prompt}
                                    onChange={(event) => setPrompt(event.target.value)}
                                    minRows={4}
                                />

                                <Button size="small" loading={isExecuting} onClick={handleRunAndAddWidget}>
                                    Hent graf
                                </Button>

                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#0067C5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <span style={{ color: '#fff', fontSize: '13px', fontWeight: 700 }}>AI</span>
                                    </div>
                                    <div style={{ background: '#f0f4ff', border: '1px solid #c8d9f5', borderRadius: '0 8px 8px 8px', padding: '10px 14px', fontSize: '0.95rem', color: '#1a1a1a', lineHeight: '1.5' }}>
                                        <p style={{ margin: '0 0 8px 0' }}>Prøv å legge til:</p>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            {QUICK_SUGGESTIONS.map((suggestion) => (
                                                <button
                                                    key={suggestion}
                                                    type="button"
                                                    onClick={() => setPrompt(prev => prev ? `${prev} ${suggestion}` : suggestion)}
                                                    style={{ textAlign: 'left', background: 'none', border: 'none', padding: 0, color: '#0067C5', cursor: 'pointer', fontSize: '0.95rem', textDecoration: 'underline' }}
                                                >
                                                    {suggestion}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded border border-gray-300 bg-white p-4 space-y-3">
                                <BodyShort weight="semibold">Grafvindu</BodyShort>
                                <div className="min-h-[340px] border border-gray-200 rounded p-2 bg-white">
                                    {previewResult ? (
                                        <PinnedWidget
                                            result={{ data: previewResult }}
                                            chartType={chartType}
                                            title={previewTitle}
                                        />
                                    ) : (
                                        <div className="h-full min-h-[300px] flex items-center justify-center text-gray-500 text-sm">
                                            Grafen vises her etter at du trykker Hent graf.
                                        </div>
                                    )}
                                </div>

                                <Button size="small" variant="secondary" onClick={handleSaveToDashboard}>
                                    Lagre til dashboard
                                </Button>
                            </div>

                            <details className="rounded border border-gray-200 bg-white">
                                <summary className="cursor-pointer px-4 py-3 text-sm font-medium select-none">SQL</summary>
                                <div className="p-4">
                                    <SqlCodeEditor
                                        value={query}
                                        onChange={setQuery}
                                        height={320}
                                    />
                                </div>
                            </details>

                            <Button size="small" variant="secondary" onClick={handleReset}>
                                Nullstill KI assistent
                            </Button>
                        </div>
                    </div>
                </Tabs.Panel>

                <Tabs.Panel value="dashboard" className="pt-4">
                    <div className="space-y-4">
                        <PinnedGrid
                            widgets={orderedPinnedItems}
                            onReorder={handleReorder}
                            onDelete={handleDelete}
                            onResize={handleResize}
                        />
                    </div>
                </Tabs.Panel>
            </Tabs>
        </DashboardLayout>
    );
}
