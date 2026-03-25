import { useMemo, useState, useRef, useEffect } from 'react';
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

const DEFAULT_PROMPT = 'Her kan du f.eks skrive inn: Vis daglige sidevisninger for siste 30 dager';

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
    pageflow: { cols: 2, rows: 1 },
    metrics: { cols: 2, rows: 1 },
};

export default function KunstigInteligensBygger() {
    const [widgets, setWidgets] = useState<DashboardWidgetDefinition[]>(initialWidgets);
    const [widgetOrder, setWidgetOrder] = useState<string[]>(() => initialWidgets.map((widget) => widget.id));
    const [runtimeResults, setRuntimeResults] = useState<Record<string, unknown>>({});

    const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
    const [query, setQuery] = useState('');
    const [chartType, setChartType] = useState<DashboardWidgetType>('linechart');
    const [previewResult, setPreviewResult] = useState<unknown[] | null>(() => {
        const mockData = mockupResults as Record<string, unknown>;
        return (mockData['default-2'] as unknown[]) || null;
    });
    const [previewTitle, setPreviewTitle] = useState('Daglige sidevisninger - siste 10 dager');
    const [urlContext, setUrlContext] = useState<{
        websiteId: string;
        domain: string;
        name: string;
        path: string;
        pathOperator: string;
    } | null>(null);

    const [isExecuting, setIsExecuting] = useState(false);
    const [apiError, setApiError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState('ki-assistent');
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [showSaveDashboardMenu, setShowSaveDashboardMenu] = useState(false);
    const [newDashboardName, setNewDashboardName] = useState('');
    const dashboardMenuRef = useRef<HTMLDivElement>(null);
    const andreAnalyseDropdownRef = useRef<HTMLDivElement>(null);
    
    const [showKITips, setShowKITips] = useState(false);
    const [showAnalysisDropdown, setShowAnalysisDropdown] = useState(false);
    const [showAnalysisSettings, setShowAnalysisSettings] = useState(false);
    const [showDropdownOptions, setShowDropdownOptions] = useState(false);
    const [hoveredDropdownOption, setHoveredDropdownOption] = useState<string | null>(null);
    const [hoveredInfoButton, setHoveredInfoButton] = useState<string | null>(null);
    const [analysisTypes, setAnalysisTypes] = useState<string[]>(['Trafikk & Hendelser', 'Brukerlojalitet']);
    const [selectedAnalysisType, setSelectedAnalysisType] = useState<string | null>(null);
    const [dashboards, setDashboards] = useState<string[]>(['Mitt dashboard', 'Prosjekt A']);
    const [selectedDashboard, setSelectedDashboard] = useState('Mitt dashboard');
    const [showNewDashboardModal, setShowNewDashboardModal] = useState(false);
    const [newDashboardInputName, setNewDashboardInputName] = useState('');
    const [dashboardToDelete, setDashboardToDelete] = useState<string | null>(null);
    const [selectedAndreAnalyse, setSelectedAndreAnalyse] = useState<string | null>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dashboardMenuRef.current && !dashboardMenuRef.current.contains(event.target as Node)) {
                setShowSaveDashboardMenu(false);
            }
        };

        if (showSaveDashboardMenu) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => {
                document.removeEventListener('mousedown', handleClickOutside);
            };
        }
    }, [showSaveDashboardMenu]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (andreAnalyseDropdownRef.current && !andreAnalyseDropdownRef.current.contains(event.target as Node)) {
                setShowDropdownOptions(false);
                setSelectedAndreAnalyse(null);
            }
        };

        if (showDropdownOptions) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => {
                document.removeEventListener('mousedown', handleClickOutside);
            };
        }
    }, [showDropdownOptions]);


    const dropdownOptions = ['Sideflyt', 'Hendelsesflyt', 'Traktanalyse', 'Brukersammensetning', 'Brukerprofil', 'Tilpasset analyse', 'Diagnoseverktøy', 'Personverksjekk'];

    const analysisDescriptions: Record<string, string> = {
        'Trafikk & Hendelser': 'Analyser trafikkmønstre, besøker, sidevisninger og brukeradferd over tid. Idelal for å forstå trender og mønstre i besøkerne dine.',
        'Brukerlojalitet': 'Undersøk hvor lojale dine brukere er. Se hvor ofte de returnerer og hvor lenge de blir på siden din.',
        'Tilpasset verktøy': 'Lag egendefinerte analyser basert på dine spesifikke behov og dataene dine.',
        'Markedsanalyse': 'Analyser markedsdata og konkurrentinformasjon for å forbedre din strategi.',
        'Sideflyt': 'Visualiser brukerens navigasjonsvei gjennom ditt nettsted og identifiser populære destinasjoner.',
        'Hendelsesflyt': 'Spor og analyser hendelsessekvenser for å forstå brukerintensjonene.',
        'Traktanalyse': 'Spor brukerens reise gjennom funnelen din. Identifiser hvor brukerne forlater prosessen din.',
        'Brukersammensetning': 'Analyser demografiske og tekniske characteristics av dine brukere.',
        'Brukerprofil': 'Opprett detaljerte profiler av brukersegmenter basert på atferd og demografi.',
        'Tilpasset analyse': 'Lag egendefinerte analyser basert på dine spesifikke behov og KPIer.',
        'Diagnoseverktøy': 'Diagnostiser problemer og ineffektiviteter i brukeropplevelsen.',
        'Personverksjekk': 'Sikre at ditt nettsted oppfyller GDPR og personvernkrav.',
    };

    const chartTypeDescriptions: Record<string, string> = {
        'linechart': 'Linjediagram viser trender og endringer over tid. Perfekt for å visualisere hvordan data utvikler seg.',
        'barchart': 'Stolpediagram sammenlignet verdier på tvers av kategorier. Godt for å se relative størrelser og sammenligning.',
        'piechart': 'Kakediagram viser hvordan deler utgjør en helhet. Brukes for å visualisere prosentandeler.',
        'areachart': 'Områdediagram kombinerer linjediagrammet med fargede områder under. Godt for å se totale mengder.',
        'table': 'Tabell viser data i strukturert format med rader og kolonner. Idealt for detaljert inspeksjon og eksport.',
        'pageflow': 'Sideflytdiagram visualiserer brukerens navigasjonsvei gjennom ditt nettsted.',
        'metrics': 'Nøkkeltall viser viktige KPIer og metrikker på ett øyeblikk.',
    };

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

    const saveWidgetToDashboard = (dashboardName?: string) => {
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
        setShowSaveDashboardMenu(false);
        if (dashboardName) {
            setNewDashboardName('');
        }
    };

    const handleSaveToDashboard = () => {
        setShowSaveDashboardMenu(!showSaveDashboardMenu);
    };

    const handleSaveToMittDashboard = () => {
        saveWidgetToDashboard('mitt dashboard');
        setSuccessMessage('Visualiseringen har blitt lagt til i ditt dashboard!');
        setShowSaveDashboardMenu(false);
        setActiveTab('dashboard');
        setTimeout(() => {
            window.scrollTo(0, 0);
        }, 0);
        setTimeout(() => setSuccessMessage(null), 8000);
    };

    const handleSaveToDashboardName = (dashboardName: string) => {
        saveWidgetToDashboard(dashboardName);
        setSuccessMessage(`Visualiseringen har blitt lagt til i ${dashboardName}!`);
        setShowSaveDashboardMenu(false);
        setActiveTab('dashboard');
        setTimeout(() => {
            window.scrollTo(0, 0);
        }, 0);
        setTimeout(() => setSuccessMessage(null), 8000);
    };

    const handleCreateNewDashboard = () => {
        if (!newDashboardName.trim()) {
            setApiError('Dashbordet må ha et navn.');
            return;
        }
        saveWidgetToDashboard(newDashboardName);
    };

    const handleExport = (format: 'json' | 'csv' | 'pdf') => {
        if (!previewResult) {
            setApiError('Ingen graf å eksportere ennå. Hent graf først.');
            setShowExportMenu(false);
            return;
        }

        let content = '';
        let filename = `${previewTitle || 'graf'}`;
        let mimeType = 'text/plain';

        if (format === 'json') {
            content = JSON.stringify(previewResult, null, 2);
            filename += '.json';
            mimeType = 'application/json';
        } else if (format === 'csv') {
            if (Array.isArray(previewResult) && previewResult.length > 0) {
                const headers = Object.keys(previewResult[0] as Record<string, unknown>);
                content = headers.join(',') + '\n';
                content += previewResult.map((row) => {
                    const record = row as Record<string, unknown>;
                    return headers.map((h) => {
                        const val = record[h];
                        return typeof val === 'string' && val.includes(',') ? `"${val}"` : val;
                    }).join(',');
                }).join('\n');
            }
            filename += '.csv';
            mimeType = 'text/csv';
        } else if (format === 'pdf') {
            content = JSON.stringify(previewResult, null, 2);
            filename += '.pdf';
            mimeType = 'application/pdf';
        }

        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setShowExportMenu(false);
    };

    return (
        <DashboardLayout
            title="KI assistent"
            hideHeader
        >
            <Tabs value={activeTab} onChange={setActiveTab}>
                <Tabs.List>
                    <Tabs.Tab value="ki-assistent" label="KI assistent" />
                    <Tabs.Tab value="dashboard" label="Dashboard" />
                </Tabs.List>

                <Tabs.Panel value="ki-assistent" className="pt-4 w-full">
                    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1rem', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div className="rounded border border-gray-300 bg-white p-4">
                                <UrlSearchFormPrototype
                                    targetPath="/ki-assistent"
                                    onResolved={(websiteId, domain, name, path, pathOperator) => {
                                        setUrlContext({ websiteId, domain, name, path, pathOperator });
                                    }}
                                />
                            </div>

                            {/* Velg analysetype*/}

                            <div className="rounded border border-gray-300 bg-white p-3 min-h-[100px]">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <BodyShort weight="semibold">2. Velg analysetype</BodyShort>
                                    <button
                                        onClick={() => setShowAnalysisSettings(!showAnalysisSettings)}
                                        style={{
                                            border: 'none',
                                            background: 'transparent',
                                            color: '#0067C5',
                                            fontSize: 24,
                                            cursor: 'pointer',
                                            padding: '6px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            width: '36px',
                                            height: '36px',
                                            borderRadius: '6px',
                                            transition: 'all 0.2s',
                                            fontWeight: 'bold',
                                        }}
                                        onMouseOver={e => {
                                            e.currentTarget.style.color = '#0050a0';
                                            e.currentTarget.style.transform = 'scale(1.1)';
                                        }}
                                        onMouseOut={e => {
                                            e.currentTarget.style.color = '#0067C5';
                                            e.currentTarget.style.transform = 'scale(1)';
                                        }}
                                    >
                                        ⚙
                                    </button>
                                </div>
                                <p style={{ margin: '0.5rem 0 1rem 0', fontSize: '0.875rem', color: '#666666', fontWeight: 300 }}>Dine mest brukte analysetyper <span style={{ fontStyle: 'italic' }}>(kan endres i innstillinger)</span>:</p>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem', position: 'relative' }}>
                                    {analysisTypes.map((type) => (
                                        <div
                                            key={type}
                                            onClick={() => setSelectedAnalysisType(type)}
                                            style={{
                                                border: selectedAnalysisType === type ? 'none' : '1px solid #a0a0a0',
                                                borderRadius: 8,
                                                padding: 4,
                                                background: selectedAnalysisType === type ? '#0067C5' : '#ffffff',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                height: 36,
                                                cursor: 'pointer',
                                                boxShadow: selectedAnalysisType === type ? '0 2px 8px rgba(0,103,197,0.3)' : '0 1px 2px rgba(0,0,0,0.1)',
                                                transition: 'all 0.2s',
                                                position: 'relative',
                                            }}
                                            onMouseOver={e => {
                                                if (selectedAnalysisType !== type) {
                                                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
                                                    e.currentTarget.style.borderColor = '#0067c5';
                                                    e.currentTarget.style.background = '#f5f5f5';
                                                }
                                            }}
                                            onMouseOut={e => {
                                                if (selectedAnalysisType !== type) {
                                                    e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.1)';
                                                    e.currentTarget.style.borderColor = '#a0a0a0';
                                                    e.currentTarget.style.background = '#ffffff';
                                                }
                                            }}
                                        >
                                            <span style={{ fontWeight: 600, fontSize: 14, color: selectedAnalysisType === type ? '#ffffff' : '#0067C5' }}>{type}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* Andre analyser dropdown */}
                                <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', alignItems: 'stretch', position: 'relative' }} ref={andreAnalyseDropdownRef}>
                                    <button
                                        onClick={() => setShowDropdownOptions(!showDropdownOptions)}
                                        style={{ 
                                            width: '100%',
                                            padding: '8px', 
                                            borderRadius: '6px', 
                                            border: selectedAndreAnalyse ? 'none' : '1px solid #a0a0a0', 
                                            fontSize: '0.9rem', 
                                            backgroundColor: selectedAndreAnalyse ? '#0067C5' : '#ffffff', 
                                            color: selectedAndreAnalyse ? '#ffffff' : '#666666',
                                            cursor: 'pointer',
                                            fontWeight: 400,
                                            textAlign: 'left',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                        }}
                                    >
                                        {selectedAndreAnalyse || 'Andre analyser'}
                                        {selectedAndreAnalyse ? (
                                            <span 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedAndreAnalyse(null);
                                                }}
                                                style={{ color: '#ffffff', fontWeight: 'normal', fontSize: '18px', marginLeft: '4px', cursor: 'pointer', lineHeight: '1' }}>
                                                ×
                                            </span>
                                        ) : (
                                            <span style={{ color: '#000000', fontWeight: 'normal', fontSize: '12px', marginLeft: '4px' }}>▼</span>
                                        )}
                                    </button>
                                    {showDropdownOptions && (
                                        <div style={{
                                            position: 'absolute',
                                            top: '100%',
                                            left: 0,
                                            right: 0,
                                            backgroundColor: '#ffffff',
                                            border: '1px solid #0067C5',
                                            borderRadius: '6px',
                                            marginTop: '0.25rem',
                                            zIndex: 20,
                                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                        }}>
                                            {dropdownOptions.map((option) => (
                                                <div
                                                    key={option}
                                                    onMouseLeave={() => setHoveredDropdownOption(null)}
                                                    style={{
                                                        padding: '0.75rem',
                                                        cursor: 'pointer',
                                                        backgroundColor: hoveredDropdownOption === option ? '#f0f4ff' : '#ffffff',
                                                        borderBottom: option !== dropdownOptions[dropdownOptions.length - 1] ? '1px solid #e0e0e0' : 'none',
                                                        borderRadius: option === dropdownOptions[0] ? '6px 6px 0 0' : option === dropdownOptions[dropdownOptions.length - 1] ? '0 0 6px 6px' : '0',
                                                        transition: 'background-color 0.2s',
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center',
                                                        position: 'relative',
                                                    }}>
                                                    <div
                                                        onMouseEnter={() => setHoveredDropdownOption(option)}
                                                        onClick={() => {
                                                            setSelectedAndreAnalyse(option);
                                                            setShowDropdownOptions(false);
                                                        }}
                                                        style={{
                                                            flex: 1,
                                                            cursor: 'pointer',
                                                        }}>
                                                        <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 500, color: '#0067C5' }}>{option}</p>
                                                    </div>
                                                    
                                                    <div
                                                        style={{
                                                            position: 'relative',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                        }}
                                                        onMouseEnter={() => setHoveredInfoButton(option)}
                                                        onMouseLeave={() => setHoveredInfoButton(null)}>
                                                        <span
                                                            style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                width: '20px',
                                                                height: '20px',
                                                                borderRadius: '50%',
                                                                backgroundColor: hoveredInfoButton === option ? '#0067C5' : '#e0e0e0',
                                                                color: hoveredInfoButton === option ? '#ffffff' : '#666666',
                                                                fontSize: '0.75rem',
                                                                fontWeight: 'bold',
                                                                cursor: 'pointer',
                                                                transition: 'background-color 0.2s, color 0.2s',
                                                                marginLeft: '0.5rem',
                                                            }}>
                                                            ℹ
                                                        </span>
                                                        {hoveredInfoButton === option && (
                                                            <div
                                                                style={{
                                                                    position: 'absolute',
                                                                    right: '30px',
                                                                    top: '-5px',
                                                                    backgroundColor: '#333333',
                                                                    color: '#ffffff',
                                                                    padding: '0.5rem 0.75rem',
                                                                    borderRadius: '4px',
                                                                    fontSize: '0.75rem',
                                                                    whiteSpace: 'normal',
                                                                    maxWidth: '220px',
                                                                    wordWrap: 'break-word',
                                                                    zIndex: 30,
                                                                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                                                                    pointerEvents: 'none',
                                                                }}>
                                                                {analysisDescriptions[option]}
                                                            </div>
                                                        )}
                                                    </div>
                                                    
                                                    {hoveredDropdownOption === option && hoveredInfoButton !== option && (
                                                        <p style={{ 
                                                            margin: '0.25rem 0 0 0', 
                                                            fontSize: '0.75rem', 
                                                            color: '#666666',
                                                            position: 'absolute',
                                                            top: '2.5rem',
                                                            left: '0.75rem',
                                                            right: '0.75rem',
                                                            width: 'calc(100% - 1.5rem)'
                                                        }}>
                                                            {analysisDescriptions[option]}
                                                        </p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Analysis Settings Modal */}
                            {showAnalysisSettings && (
                                <div className="rounded border border-gray-300 bg-white p-4" style={{ backgroundColor: '#f0f4ff', borderColor: '#0067C5', borderWidth: 2 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                        <BodyShort weight="semibold">Velg analysetyper</BodyShort>
                                        <button
                                            onClick={() => setShowAnalysisSettings(false)}
                                            style={{
                                                border: 'none',
                                                background: 'transparent',
                                                color: '#333333',
                                                fontSize: 20,
                                                cursor: 'pointer',
                                                padding: 0,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                width: '24px',
                                                height: '24px',
                                            }}
                                        >
                                            ✕
                                        </button>
                                    </div>
                                    <p style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', color: '#666666' }}>Velg analysetyper som skal vises som snarvei:</p>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        {['Trafikk & Hendelser', 'Brukerlojalitet', 'Sideflyt', 'Hendelsesflyt', 'Traktanalyse', 'Brukersammensetning', 'Brukerprofil', 'Tilpasset analyse', 'Diagnoseverktøy', 'Personverksjekk'].map((type) => (
                                            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', position: 'relative' }}>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', flex: 1 }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={analysisTypes.includes(type)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setAnalysisTypes([...analysisTypes, type]);
                                                            } else {
                                                                setAnalysisTypes(analysisTypes.filter(t => t !== type));
                                                            }
                                                        }}
                                                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                                    />
                                                    <span style={{ fontSize: '0.9rem', color: '#333333' }}>{type}</span>
                                                </label>
                                                <div
                                                    style={{
                                                        position: 'relative',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                    }}
                                                    onMouseEnter={() => setHoveredInfoButton(type)}
                                                    onMouseLeave={() => setHoveredInfoButton(null)}>
                                                    <span
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            width: '20px',
                                                            height: '20px',
                                                            borderRadius: '50%',
                                                            backgroundColor: hoveredInfoButton === type ? '#0067C5' : '#e0e0e0',
                                                            color: hoveredInfoButton === type ? '#ffffff' : '#666666',
                                                            fontSize: '0.75rem',
                                                            fontWeight: 'bold',
                                                            cursor: 'pointer',
                                                            transition: 'background-color 0.2s, color 0.2s',
                                                        }}>
                                                        ℹ
                                                    </span>
                                                    {hoveredInfoButton === type && (
                                                        <div
                                                            style={{
                                                                position: 'absolute',
                                                                right: '30px',
                                                                top: '-5px',
                                                                backgroundColor: '#333333',
                                                                color: '#ffffff',
                                                                padding: '0.5rem 0.75rem',
                                                                borderRadius: '4px',
                                                                fontSize: '0.75rem',
                                                                whiteSpace: 'normal',
                                                                maxWidth: '220px',
                                                                wordWrap: 'break-word',
                                                                zIndex: 30,
                                                                lineHeight: '1.4',
                                                            }}>
                                                            {analysisDescriptions[type]}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Hurtigfiltere*/}

                            <div className="rounded border border-gray-300 bg-white p-3 min-h-[90px]" style={{ backgroundColor: '#f9fbff' }}>
                                <BodyShort weight="semibold">3. Hurtigfiltere</BodyShort>
                                <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
                                        <label htmlFor="tidsperiode" style={{ fontWeight: 500, marginBottom: 4, fontSize: 14, color: '#0067C5' }}>Tidsperiode</label>
                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                            <input 
                                                type="date" 
                                                id="tidsperiode-fra" 
                                                placeholder="Fra dato"
                                                style={{ 
                                                    flex: 1,
                                                    padding: '6px', 
                                                    borderRadius: '6px', 
                                                    border: '1px solid #a0a0a0', 
                                                    fontSize: '12px', 
                                                    backgroundColor: '#ffffff', 
                                                    color: '#000',
                                                    cursor: 'pointer'
                                                }} 
                                            />
                                            <span style={{ color: '#999999', fontSize: '12px', fontWeight: 500 }}>til</span>
                                            <input 
                                                type="date" 
                                                id="tidsperiode-til" 
                                                placeholder="Til dato"
                                                style={{ 
                                                    flex: 1,
                                                    padding: '6px', 
                                                    borderRadius: '6px', 
                                                    border: '1px solid #a0a0a0', 
                                                    fontSize: '12px', 
                                                    backgroundColor: '#ffffff', 
                                                    color: '#000',
                                                    cursor: 'pointer'
                                                }} 
                                            />
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
                                        <label htmlFor="visning" style={{ fontWeight: 500, marginBottom: 4, fontSize: 14, color: '#0067C5' }}>Visning</label>
                                        <select id="visning" style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #a0a0a0', fontSize: 14, backgroundColor: '#ffffff', color: '#000' }}>
                                            <option value="">Velg alternativ</option>
                                            <option value="alternativ1">Unike besøkende</option>
                                            <option value="alternativ2">Sidevisninger</option>
                                            <option value="alternativ3">Andel(%)</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Kjør analyse button */}
                            <button
                                style={{
                                    width: '100%',
                                    padding: '0.75rem 1rem',
                                    backgroundColor: '#0067C5',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '0.95rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                }}
                                onMouseOver={e => {
                                    e.currentTarget.style.backgroundColor = '#0050a0';
                                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,103,197,0.3)';
                                }}
                                onMouseOut={e => {
                                    e.currentTarget.style.backgroundColor = '#0067C5';
                                    e.currentTarget.style.boxShadow = 'none';
                                }}
                            >
                                Kjør analyse
                            </button>

                        
                        {/* Lagrede analyser/historikk*/}

                        <div className="rounded border border-gray-300 bg-white p-3 min-h-[90px]">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                            <BodyShort weight="semibold">Historikk</BodyShort>
                            <button
                                style={{
                                    border: 'none',
                                    background: 'transparent',
                                    color: '#2563eb',
                                    fontSize: 14,
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    padding: 0,
                                }}
                                >
                                 Se alle (8)
                            </button>
                        </div>
                        <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '0px' }}>
        
                             <div
                                style={{
                                    marginTop: '0rem',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '0.75rem 0rem',
                                    borderBottom: '1px solid #e5e7eb',
                                    background: '#ffffff',
                                    cursor: 'pointer',
                                    transition: 'background-color 0.2s ease',
                                 }}
                                onMouseOver={e => {
                                    e.currentTarget.style.background = '#f9fbff';
                                }}
                                onMouseOut={e => {
                                    e.currentTarget.style.background = '#ffffff';
                                 }}
                               
                                >
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                    <span style={{ fontSize: '0.95rem', fontWeight: 400, color: '#1c1d1f' }}>
                                        Hva er brukerlojalitet...
                                    </span>
                                    <span style={{ fontSize: '0.8rem', color: '#999999', fontStyle: 'italic', fontWeight: 400 }}>
                                        For 2 timer siden
                                    </span>
                                </div>
                                {/* Pil */}
                                <span style={{ fontSize: 20, color: '#1c1d1f' }}>›</span>
                            </div>

                            <div
                                style={{
                                    marginTop: '0rem',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '0.75rem 0rem',
                                    borderBottom: '1px solid #e5e7eb',
                                    background: '#ffffff',
                                    cursor: 'pointer',
                                    transition: 'background-color 0.2s ease',
                                 }}
                                onMouseOver={e => {
                                    e.currentTarget.style.background = '#f9fbff';
                                }}
                                onMouseOut={e => {
                                    e.currentTarget.style.background = '#ffffff';
                                 }}
                               
                                >
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                    <span style={{ fontSize: '0.95rem', fontWeight: 400, color: '#1c1d1f' }}>
                                        Antall klikk nav.ikt.no...
                                    </span>
                                    <span style={{ fontSize: '0.8rem', color: '#999999', fontStyle: 'italic', fontWeight: 400 }}>
                                        I dag
                                    </span>
                                </div>
                                {/* Pil */}
                                <span style={{ fontSize: 20, color: '#1c1d1f' }}>›</span>
                            </div>
                      </div>
                 </div>
                        </div>


                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.4rem' }}>
                            {apiError && (
                                <Alert variant="error" size="small">
                                    {apiError}
                                </Alert>
                            )}

                            <div className="rounded border border-gray-300 bg-white p-3 space-y-2">
                                <div style={{ marginBottom: '0.75rem' }}>
                                    <BodyShort weight="semibold" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem', marginBottom: '0.5rem', position: 'relative' }}>
                                        ✨ KI-assistenten
                                        <div
                                            onMouseEnter={() => setHoveredInfoButton('ki-assistent')}
                                            onMouseLeave={() => setHoveredInfoButton(null)}
                                            style={{ position: 'relative' }}
                                        >
                                            <span
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    width: '18px',
                                                    height: '18px',
                                                    borderRadius: '50%',
                                                    backgroundColor: hoveredInfoButton === 'ki-assistent' ? '#0067C5' : '#e0e0e0',
                                                    color: hoveredInfoButton === 'ki-assistent' ? '#ffffff' : '#666666',
                                                    fontSize: '0.7rem',
                                                    fontWeight: 'bold',
                                                    cursor: 'pointer',
                                                    transition: 'background-color 0.2s, color 0.2s',
                                                }}>
                                                ℹ
                                            </span>
                                            {hoveredInfoButton === 'ki-assistent' && (
                                                <div
                                                    style={{
                                                        position: 'absolute',
                                                        right: '25px',
                                                        top: '-10px',
                                                        backgroundColor: '#333333',
                                                        color: '#ffffff',
                                                        padding: '0.5rem 0.75rem',
                                                        borderRadius: '4px',
                                                        fontSize: '0.82rem',
                                                        whiteSpace: 'normal',
                                                        maxWidth: '180px',
                                                        wordWrap: 'break-word',
                                                        zIndex: 30,
                                                        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                                                        pointerEvents: 'none',
                                                        lineHeight: '1.5',
                                                    }}>
                                                    Lim inn URL for siden du ønsker å analysere til venstre, og spør KI-assistenten noe du lurer på
                                                </div>
                                            )}
                                        </div>
                                    </BodyShort>
                                    <p style={{ margin: '0.5rem 0 1.2rem 0', fontWeight: 500, fontSize: '0.85rem', color: '#333333' }}><span style={{ textDecoration: 'underline' }}>Unngå å skrive inn personopplysninger</span></p>
                                </div>
                                <Textarea
                                    label="KI assistent spørsmål"
                                    placeholder='Her kan du for eksempel skrive "Vis daglige sidevisninger for siste 30 dager"'
                                    value={prompt}
                                    onChange={(event) => setPrompt(event.target.value)}
                                    minRows={25}
                                    style={{ 
                                        height: 40,
                                        color: '#797878',                                        
                                        fontStyle: 'italic',
                                        fontSize: '0.9rem',
                                        overflow: 'hidden',
                                     }}
                                    className="no-scrollbar"
                                    hideLabel
                                />
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', justifyContent: 'space-between', marginTop: '1.2rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', flex: 1 }}>
                                        <span style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            width: '22px',
                                            height: '22px',
                                            borderRadius: '50%',
                                            backgroundColor: '#0067C5',
                                            color: 'white',
                                            fontSize: '0.8rem',
                                            fontWeight: 600,
                                            flexShrink: 0
                                        }}>
                                            KI
                                        </span>
                                        <p style={{ margin: 0, fontWeight: 300, fontSize:'0.9rem', marginLeft: '4px' }}>Prøv også:</p>

                                        {QUICK_SUGGESTIONS.map((suggestion) => (
                                     <button
                                            key={suggestion}
                                            type="button"
                                            onClick={() => setPrompt(prev => prev ? `${prev} ${suggestion}` : suggestion)}
                                        style={{
                                            background: '#e6efff',
                                            border: '1px solid #c8d9f5',
                                            borderRadius: 999,
                                            padding: '3px 8px',
                                            color: '#0067C5',
                                            cursor: 'pointer',
                                            fontSize: '0.9rem',
                                         }}
                >
                                        {suggestion}
                                    </button>
                                    ))}
                                    </div>
                                    <Button size="small" variant="primary" loading={isExecuting} onClick={handleRunAndAddWidget} style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                                        Hent graf
                                    </Button>
                        </div>


                            </div>

                            <div className="rounded border border-gray-300 bg-white p-3 space-y-2">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <BodyShort weight="semibold">Grafvindu</BodyShort>
                                </div>
                                <div style={{ 
                                    display: 'flex', 
                                    gap: '1.5rem', 
                                    marginBottom: '1rem', 
                                    alignItems: 'center'
                                }}>
                                    <span
                                        onClick={() => setChartType('linechart')}
                                        style={{
                                            cursor: 'pointer',
                                            textDecoration: chartType === 'linechart' ? 'underline' : 'none',
                                            color: chartType === 'linechart' ? '#0067C5' : '#666666',
                                            fontWeight: chartType === 'linechart' ? 600 : 500,
                                            fontSize: '0.95rem',
                                            transition: 'all 0.2s ease',
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.textDecoration = 'underline';
                                            e.currentTarget.style.color = '#0067C5';
                                        }}
                                        onMouseLeave={(e) => {
                                            if (chartType !== 'linechart') {
                                                e.currentTarget.style.textDecoration = 'none';
                                                e.currentTarget.style.color = '#666666';
                                            }
                                        }}
                                    >
                                        Linje
                                    </span>
                                    <span
                                        onClick={() => setChartType('piechart')}
                                        style={{
                                            cursor: 'pointer',
                                            textDecoration: chartType === 'piechart' ? 'underline' : 'none',
                                            color: chartType === 'piechart' ? '#0067C5' : '#666666',
                                            fontWeight: chartType === 'piechart' ? 600 : 500,
                                            fontSize: '0.95rem',
                                            transition: 'all 0.2s ease',
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.textDecoration = 'underline';
                                            e.currentTarget.style.color = '#0067C5';
                                        }}
                                        onMouseLeave={(e) => {
                                            if (chartType !== 'piechart') {
                                                e.currentTarget.style.textDecoration = 'none';
                                                e.currentTarget.style.color = '#666666';
                                            }
                                        }}
                                    >
                                        Kake
                                    </span>
                                    <span
                                        onClick={() => setChartType('barchart')}
                                        style={{
                                            cursor: 'pointer',
                                            textDecoration: chartType === 'barchart' ? 'underline' : 'none',
                                            color: chartType === 'barchart' ? '#0067C5' : '#666666',
                                            fontWeight: chartType === 'barchart' ? 600 : 500,
                                            fontSize: '0.95rem',
                                            transition: 'all 0.2s ease',
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.textDecoration = 'underline';
                                            e.currentTarget.style.color = '#0067C5';
                                        }}
                                        onMouseLeave={(e) => {
                                            if (chartType !== 'barchart') {
                                                e.currentTarget.style.textDecoration = 'none';
                                                e.currentTarget.style.color = '#666666';
                                            }
                                        }}
                                    >
                                        Stolpe
                                    </span>
                                    <span
                                        onClick={() => setChartType('table')}
                                        style={{
                                            cursor: 'pointer',
                                            textDecoration: chartType === 'table' ? 'underline' : 'none',
                                            color: chartType === 'table' ? '#0067C5' : '#666666',
                                            fontWeight: chartType === 'table' ? 600 : 500,
                                            fontSize: '0.95rem',
                                            transition: 'all 0.2s ease',
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.textDecoration = 'underline';
                                            e.currentTarget.style.color = '#0067C5';
                                        }}
                                        onMouseLeave={(e) => {
                                            if (chartType !== 'table') {
                                                e.currentTarget.style.textDecoration = 'none';
                                                e.currentTarget.style.color = '#666666';
                                            }
                                        }}
                                    >
                                        Tabell
                                    </span>
                                    <span
                                        onClick={() => setChartType('pageflow')}
                                        style={{
                                            cursor: 'pointer',
                                            textDecoration: chartType === 'pageflow' ? 'underline' : 'none',
                                            color: chartType === 'pageflow' ? '#0067C5' : '#666666',
                                            fontWeight: chartType === 'pageflow' ? 600 : 500,
                                            fontSize: '0.95rem',
                                            transition: 'all 0.2s ease',
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.textDecoration = 'underline';
                                            e.currentTarget.style.color = '#0067C5';
                                        }}
                                        onMouseLeave={(e) => {
                                            if (chartType !== 'pageflow') {
                                                e.currentTarget.style.textDecoration = 'none';
                                                e.currentTarget.style.color = '#666666';
                                            }
                                        }}
                                    >
                                        Sideflyt
                                    </span>
                                    <span
                                        onClick={() => setChartType('metrics')}
                                        style={{
                                            cursor: 'pointer',
                                            textDecoration: chartType === 'metrics' ? 'underline' : 'none',
                                            color: chartType === 'metrics' ? '#0067C5' : '#666666',
                                            fontWeight: chartType === 'metrics' ? 600 : 500,
                                            fontSize: '0.95rem',
                                            transition: 'all 0.2s ease',
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.textDecoration = 'underline';
                                            e.currentTarget.style.color = '#0067C5';
                                        }}
                                        onMouseLeave={(e) => {
                                            if (chartType !== 'metrics') {
                                                e.currentTarget.style.textDecoration = 'none';
                                                e.currentTarget.style.color = '#666666';
                                            }
                                        }}
                                    >
                                        Nøkkeltall
                                    </span>
                                </div>
                                <p style={{ margin: '0.75rem 0 0.5rem 0', fontSize: '0.875rem', color: '#666666', fontStyle: 'italic' }}>
                                    {chartTypeDescriptions[chartType] || 'Velg en diagramtype.'}
                                </p>
                                <div className="min-h-[340px] border border-gray-200 rounded p-2 bg-white">
                                    {previewResult && chartType !== 'barchart' && chartType !== 'piechart' && chartType !== 'table' && chartType !== 'pageflow' && chartType !== 'metrics' ? (
                                        <PinnedWidget
                                            result={{ data: previewResult }}
                                            chartType={chartType}
                                            title={previewTitle}
                                        />
                                    ) : !previewResult || chartType === 'barchart' || chartType === 'piechart' || chartType === 'table' || chartType === 'pageflow' || chartType === 'metrics' ? (
                                        <div className="h-full min-h-[300px] flex items-center justify-center text-gray-500 text-sm">
                                            {chartType === 'barchart' ? 'Stolpediagram er ikke tilgjengelig.' : chartType === 'piechart' ? 'Kakediagram er ikke tilgjengelig.' : chartType === 'table' ? 'Tabell er ikke tilgjengelig.' : chartType === 'pageflow' ? 'Sideflyt er ikke tilgjengelig.' : chartType === 'metrics' ? 'Nøkkeltall er ikke tilgjengelig.' : 'Grafen vises her etter at du trykker "Hent graf".'}
                                        </div>
                                    ) : null}
                                </div>
                                {previewResult && (
                                    <div style={{
                                        backgroundColor: '#f0f4ff',
                                        border: '1px solid #d5e3ff',
                                        borderRadius: '4px',
                                        marginTop: '1rem',
                                        marginBottom: '1rem',
                                    }}>
                                        <div 
                                            onClick={() => setShowKITips(!showKITips)}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.5rem',
                                                cursor: 'pointer',
                                                padding: '1rem',
                                                userSelect: 'none',
                                            }}
                                        >
                                            <span
                                                style={{
                                                    transition: 'transform 0.2s ease',
                                                    transform: showKITips ? 'rotate(90deg)' : 'rotate(0deg)',
                                                    display: 'inline-block',
                                                    color: '#000000',
                                                    fontSize: '0.8rem',
                                                }}
                                            >
                                                ▶
                                            </span>
                                            <BodyShort size="small" style={{ color: '#0067C5', fontWeight: 500 }}>
                                                💡 KI-tips om visualiseringene
                                            </BodyShort>
                                        </div>
                                        {showKITips && (
                                            <div style={{ padding: '1rem', borderTop: '1px solid #d5e3ff' }}>
                                                {chartType === 'linechart' && (
                                                    <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#333333' }}>
                                                        <li style={{ marginBottom: '0.5rem', fontSize: '0.95rem', lineHeight: '1.6' }}>Sidevisninger har økt med omtrent 45% fra start til slutt av perioden</li>
                                                        <li style={{ marginBottom: '0.5rem', fontSize: '0.95rem', lineHeight: '1.6' }}>Det finnes to tydelige topper som antyder sesongvariasjon eller kampanjeeffekter</li>
                                                        <li style={{ fontSize: '0.95rem', lineHeight: '1.6', fontWeight: 500 }}>💡 Forslag: Undersøk hva som skjedde under toppene for å replikere suksessen</li>
                                                    </ul>
                                                )}
                                                {chartType === 'piechart' && (
                                                    <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#333333' }}>
                                                        <li style={{ marginBottom: '0.5rem', fontSize: '0.95rem', lineHeight: '1.6' }}>Største kategori utgjør ca. 60% av total trafikk</li>
                                                        <li style={{ marginBottom: '0.5rem', fontSize: '0.95rem', lineHeight: '1.6' }}>De tre minste kategoriene utgjør kun 15% samlet</li>
                                                        <li style={{ fontSize: '0.95rem', lineHeight: '1.6', fontWeight: 500 }}>💡 Forslag: Vurder å konsolidere eller eliminere kategorier med under 5% trafikk</li>
                                                    </ul>
                                                )}
                                                {chartType === 'barchart' && (
                                                    <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#333333' }}>
                                                        <li style={{ marginBottom: '0.5rem', fontSize: '0.95rem', lineHeight: '1.6' }}>Topp-kategorien presterer 3x bedre enn gjennomsnittet</li>
                                                        <li style={{ marginBottom: '0.5rem', fontSize: '0.95rem', lineHeight: '1.6' }}>Fem kategorier ligger betydelig under det forventet gjennomsnitt</li>
                                                        <li style={{ fontSize: '0.95rem', lineHeight: '1.6', fontWeight: 500 }}>💡 Forslag: Analyser hva som gjør topp-kategorien vellykket og anvend strategien på andre</li>
                                                    </ul>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                                <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', gap: '1rem', alignItems: 'center' }}>
                                    <div ref={dashboardMenuRef} style={{ position: 'relative', display: 'inline-block' }}>
                                        <Button 
                                            size="small" 
                                            variant="primary"
                                            onClick={() => setShowSaveDashboardMenu(!showSaveDashboardMenu)}
                                            style={{ minWidth: '180px' }}
                                        >
                                            + Legg til dashboard
                                        </Button>
                                        {showSaveDashboardMenu && (
                                            <div style={{
                                                position: 'absolute',
                                                top: '100%',
                                                right: 0,
                                                marginTop: '0',
                                                backgroundColor: '#ffffff',
                                                border: '1px solid #a0a0a0',
                                                borderRadius: '4px',
                                                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                                                zIndex: 10,
                                                minWidth: '220px',
                                                padding: '0.75rem 0',
                                                overflow: 'visible',
                                            }}>
                                                {/* Arrow pointing to button */}
                                                <div style={{
                                                    position: 'absolute',
                                                    top: '-8px',
                                                    right: '12px',
                                                    width: '0',
                                                    height: '0',
                                                    borderLeft: '8px solid transparent',
                                                    borderRight: '8px solid transparent',
                                                    borderBottom: '8px solid #ffffff',
                                                    zIndex: 11,
                                                }} />
                                                {/* Save to mitt dashboard option */}
                                                <div style={{
                                                    padding: '0.5rem 0.75rem',
                                                    cursor: 'pointer',
                                                    borderBottom: '1px solid #e5e5e5',
                                                    color: '#0067C5',
                                                    fontWeight: 500,
                                                    fontSize: '0.9rem',
                                                    transition: 'background-color 0.2s',
                                                    textDecoration: 'underline',
                                                }}
                                                    onClick={handleSaveToMittDashboard}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.backgroundColor = '#f5f5f5';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.backgroundColor = 'transparent';
                                                    }}
                                                >
                                                    Mitt dashboard
                                                </div>

                                                {/* Save to Prosjekt A option */}
                                                <div style={{
                                                    padding: '0.5rem 0.75rem',
                                                    cursor: 'pointer',
                                                    borderBottom: '1px solid #e5e5e5',
                                                    color: '#0067C5',
                                                    fontWeight: 500,
                                                    fontSize: '0.9rem',
                                                    transition: 'background-color 0.2s',
                                                    textDecoration: 'underline',
                                                }}
                                                    onClick={() => handleSaveToDashboardName('Prosjekt A')}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.backgroundColor = '#f5f5f5';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.backgroundColor = 'transparent';
                                                    }}
                                                >
                                                    Prosjekt A
                                                </div>

                                                {/* Create new dashboard option */}
                                                <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e5e5e5' }}>
                                                    <div style={{ color: '#0067C5', fontWeight: 500, fontSize: '0.9rem', marginBottom: '0.4rem' }}>+Opprett nytt dashboard</div>
                                                    <input
                                                        type="text"
                                                        placeholder="Dashbord navn..."
                                                        value={newDashboardName}
                                                        onChange={(e) => setNewDashboardName(e.target.value)}
                                                        onKeyPress={(e) => {
                                                            if (e.key === 'Enter') {
                                                                handleCreateNewDashboard();
                                                            }
                                                        }}
                                                        style={{
                                                            width: '100%',
                                                            padding: '0.375rem 0.5rem',
                                                            border: '1px solid #a0a0a0',
                                                            borderRadius: '4px',
                                                            fontSize: '0.85rem',
                                                            boxSizing: 'border-box',
                                                            marginBottom: '0.5rem',
                                                        }}
                                                    />
                                                    <Button
                                                        size="small"
                                                        variant="primary"
                                                        onClick={handleCreateNewDashboard}
                                                        style={{ width: '100%' }}
                                                    >
                                                        Opprett
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ position: 'relative', display: 'inline-block' }}>
                                        <Button 
                                            size="small" 
                                            variant="secondary"
                                            onClick={() => setShowExportMenu(!showExportMenu)}
                                        >
                                            Eksporter
                                        </Button>
                                    {showExportMenu && (
                                        <div style={{
                                            position: 'absolute',
                                            top: '100%',
                                            right: 0,
                                            marginTop: '0.5rem',
                                            backgroundColor: '#ffffff',
                                            border: '1px solid #a0a0a0',
                                            borderRadius: '4px',
                                            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                                            zIndex: 10,
                                            minWidth: '120px',
                                        }}>
                                            {['json', 'csv', 'pdf'].map((format) => (
                                                <div
                                                    key={format}
                                                    onClick={() => handleExport(format as 'json' | 'csv' | 'pdf')}
                                                    style={{
                                                        padding: '0.5rem 1rem',
                                                        cursor: 'pointer',
                                                        borderBottom: format !== 'pdf' ? '1px solid #e5e5e5' : 'none',
                                                        color: '#0067C5',
                                                        fontWeight: 500,
                                                        fontSize: '0.9rem',
                                                        transition: 'background-color 0.2s',
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.backgroundColor = '#f5f5f5';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.backgroundColor = 'transparent';
                                                    }}
                                                >
                                                    {format.toUpperCase()}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    </div>
                                </div>
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
                    {successMessage && (
                        <div style={{
                            backgroundColor: '#d4edda',
                            border: '1px solid #c3e6cb',
                            color: '#155724',
                            padding: '0.75rem 1rem',
                            borderRadius: '4px',
                            fontSize: '0.9rem',
                            marginBottom: '1.4rem',
                        }}>
                            {successMessage}
                            {' '}
                            <button
                                onClick={() => setActiveTab('ki-assistent')}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#155724',
                                    textDecoration: 'underline',
                                    cursor: 'pointer',
                                    padding: 0,
                                    fontSize: '0.9rem',
                                    fontWeight: 500,
                                }}
                            >
                                Gå tilbake til KI-assistenten
                            </button>
                        </div>
                    )}

                    <div style={{ marginBottom: '2rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                            <BodyShort weight="semibold" style={{ fontSize: '1rem' }}>Mapper</BodyShort>
                            <button
                                onClick={() => setShowNewDashboardModal(true)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: '1.5rem',
                                    color: '#0067C5',
                                    padding: 0,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '28px',
                                    height: '28px',
                                }}
                                title="Legg til nytt dashboard"
                            >
                                +
                            </button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1.2rem' }}>
                            {dashboards.map((dashboard) => (
                                <div
                                    key={dashboard}
                                    onClick={() => setSelectedDashboard(dashboard)}
                                    style={{
                                        padding: '1.5rem 1rem',
                                        border: selectedDashboard === dashboard ? '2px solid #0067C5' : '1px solid #e0e0e0',
                                        borderRadius: '12px',
                                        backgroundColor: selectedDashboard === dashboard ? '#f0f4ff' : '#ffffff',
                                        cursor: 'pointer',
                                        textAlign: 'center',
                                        transition: 'all 0.3s ease',
                                        position: 'relative',
                                        boxShadow: selectedDashboard === dashboard ? '0 4px 12px rgba(0, 103, 197, 0.15)' : '0 2px 6px rgba(0, 0, 0, 0.07)',
                                    }}
                                    onMouseOver={(e) => {
                                        if (selectedDashboard !== dashboard) {
                                            e.currentTarget.style.borderColor = '#c0d4ff';
                                            e.currentTarget.style.backgroundColor = '#fafcff';
                                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 103, 197, 0.1)';
                                            e.currentTarget.style.transform = 'translateY(-2px)';
                                        }
                                    }}
                                    onMouseOut={(e) => {
                                        if (selectedDashboard !== dashboard) {
                                            e.currentTarget.style.borderColor = '#e0e0e0';
                                            e.currentTarget.style.backgroundColor = '#ffffff';
                                            e.currentTarget.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.07)';
                                            e.currentTarget.style.transform = 'translateY(0)';
                                        }
                                    }}
                                >
                                    <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📁</div>
                                    <div style={{ fontSize: '0.95rem', fontWeight: 500, color: '#333333', wordBreak: 'break-word' }}>{dashboard}</div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setDashboardToDelete(dashboard);
                                        }}
                                        style={{
                                            position: 'absolute',
                                            top: '10px',
                                            right: '10px',
                                            background: 'none',
                                            border: 'none',
                                            color: '#d0d0d0',
                                            fontSize: '1.4rem',
                                            cursor: 'pointer',
                                            padding: 0,
                                            width: '28px',
                                            height: '28px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            borderRadius: '6px',
                                            transition: 'all 0.2s',
                                        }}
                                        onMouseOver={(e) => {
                                            e.currentTarget.style.color = '#ff5555';
                                            e.currentTarget.style.backgroundColor = '#ffe6e6';
                                        }}
                                        onMouseOut={(e) => {
                                            e.currentTarget.style.color = '#d0d0d0';
                                            e.currentTarget.style.backgroundColor = 'transparent';
                                        }}
                                        title="Slett dashboard"
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {showNewDashboardModal && (
                        <div style={{
                            position: 'fixed',
                            inset: 0,
                            backgroundColor: 'rgba(0, 0, 0, 0.5)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 1000,
                        }}>
                            <div style={{
                                backgroundColor: '#ffffff',
                                borderRadius: '8px',
                                padding: '2rem',
                                minWidth: '400px',
                                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                            }}>
                                <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.2rem', color: '#333333' }}>Opprett nytt dashboard</h2>
                                <input
                                    type="text"
                                    placeholder="Navn på dashboard"
                                    value={newDashboardInputName}
                                    onChange={(e) => setNewDashboardInputName(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        borderRadius: '6px',
                                        border: '1px solid #d0d0d0',
                                        fontSize: '0.9rem',
                                        marginBottom: '1rem',
                                        boxSizing: 'border-box',
                                    }}
                                />
                                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                                    <button
                                        onClick={() => {
                                            setShowNewDashboardModal(false);
                                            setNewDashboardInputName('');
                                        }}
                                        style={{
                                            padding: '0.5rem 1.5rem',
                                            borderRadius: '6px',
                                            border: '1px solid #d0d0d0',
                                            backgroundColor: '#ffffff',
                                            color: '#333333',
                                            cursor: 'pointer',
                                            fontSize: '0.9rem',
                                            fontWeight: 500,
                                        }}
                                    >
                                        Avbryt
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (newDashboardInputName.trim()) {
                                                setDashboards([...dashboards, newDashboardInputName.trim()]);
                                                setSelectedDashboard(newDashboardInputName.trim());
                                                setNewDashboardInputName('');
                                                setShowNewDashboardModal(false);
                                            }
                                        }}
                                        style={{
                                            padding: '0.5rem 1.5rem',
                                            borderRadius: '6px',
                                            border: 'none',
                                            backgroundColor: '#0067C5',
                                            color: '#ffffff',
                                            cursor: 'pointer',
                                            fontSize: '0.9rem',
                                            fontWeight: 500,
                                        }}
                                    >
                                        Opprett
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {dashboardToDelete && (
                        <div style={{
                            position: 'fixed',
                            inset: 0,
                            backgroundColor: 'rgba(0, 0, 0, 0.5)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 1000,
                        }}>
                            <div style={{
                                backgroundColor: '#ffffff',
                                borderRadius: '8px',
                                padding: '2rem',
                                minWidth: '400px',
                                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                            }}>
                                <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: '#333333' }}>Er du sikker?</h2>
                                <p style={{ margin: '0 0 2rem 0', fontSize: '0.9rem', color: '#666666' }}>Vil du slette dashboardet "{dashboardToDelete}"? Denne handlingen kan ikke angres.</p>
                                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                                    <button
                                        onClick={() => setDashboardToDelete(null)}
                                        style={{
                                            padding: '0.5rem 1.5rem',
                                            borderRadius: '6px',
                                            border: '1px solid #d0d0d0',
                                            backgroundColor: '#ffffff',
                                            color: '#333333',
                                            cursor: 'pointer',
                                            fontSize: '0.9rem',
                                            fontWeight: 500,
                                        }}
                                    >
                                        Avbryt
                                    </button>
                                    <button
                                        onClick={() => {
                                            setDashboards(dashboards.filter(d => d !== dashboardToDelete));
                                            if (selectedDashboard === dashboardToDelete) {
                                                const remainingDashboards = dashboards.filter(d => d !== dashboardToDelete);
                                                setSelectedDashboard(remainingDashboards[0]);
                                            }
                                            setDashboardToDelete(null);
                                        }}
                                        style={{
                                            padding: '0.5rem 1.5rem',
                                            borderRadius: '6px',
                                            border: 'none',
                                            backgroundColor: '#ff4444',
                                            color: '#ffffff',
                                            cursor: 'pointer',
                                            fontSize: '0.9rem',
                                            fontWeight: 500,
                                        }}
                                    >
                                        Ja, slett
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {selectedDashboard && (
                        <div>
                            <BodyShort weight="semibold" style={{ marginBottom: '1rem', fontSize: '1.3rem', textAlign: 'center' }}>Innhold i {selectedDashboard}</BodyShort>
                            <div className="space-y-4">
                                <PinnedGrid
                                    widgets={orderedPinnedItems}
                                    onReorder={handleReorder}
                                    onDelete={handleDelete}
                                    onResize={handleResize}
                                />
                            </div>
                        </div>
                    )}
                </Tabs.Panel>
            </Tabs>
        </DashboardLayout>
    );
}
