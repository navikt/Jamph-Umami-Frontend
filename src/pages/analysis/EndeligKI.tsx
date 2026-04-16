import { useEffect, useRef, useState } from 'react';
import { Heading, Tabs } from '@navikt/ds-react';
import InputPanel from '../../components/ki-bygger/InputPanel';
import GrafPanel from '../../components/ki-bygger/GrafPanel';
import DashboardTab from '../../components/ki-bygger/DashboardTab';

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_CHART_DATA = [
    { date: '2025-01-01', sidevisninger: 1240 },
    { date: '2025-01-02', sidevisninger: 980 },
    { date: '2025-01-03', sidevisninger: 1560 },
    { date: '2025-01-04', sidevisninger: 1320 },
    { date: '2025-01-05', sidevisninger: 1890 },
    { date: '2025-01-06', sidevisninger: 2100 },
    { date: '2025-01-07', sidevisninger: 1750 },
];

const MOCK_SQL = `SELECT DATE(created_at) AS dato, COUNT(*) AS sidevisninger
FROM pageview
WHERE website_id = 'example-website-id'
  AND created_at >= '2025-01-01'
  AND created_at < '2025-02-01'
GROUP BY DATE(created_at)
ORDER BY dato ASC;`;

const KI_SUGGESTION = 'Ditt spørsmål er veldig spennende! Hva med å legge til «i måneden»?';
const KI_SUGGESTION_ADDITION = ' i måneden';

type GrafTab = 'linechart' | 'barchart' | 'piechart' | 'table' | 'nokkeltall' | 'ki-forklaring';

interface DashboardGraph {
    title: string;
    data: unknown[];
    size: 'half' | 'full';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function EndeligKI() {
    const [activeTab, setActiveTab] = useState('grafbygger');

    // Input state
    const [url, setUrl] = useState('');
    const [kiPrompt, setKiPrompt] = useState('');
    const [kiSuggestion, setKiSuggestion] = useState<string | null>(null);

    // Graf state
    const [previewResult, setPreviewResult] = useState<unknown[] | null>(null);
    const [grafTitle, setGrafTitle] = useState('Sidevisninger per dag');
    const [grafTab, setGrafTab] = useState<GrafTab>('linechart');
    const [sqlValue, setSqlValue] = useState(MOCK_SQL);

    // Dashboard state
    const [dashboards, setDashboards] = useState<string[]>(() => {
        try {
            const s = localStorage.getItem('endeligki-dashboards');
            return s ? JSON.parse(s) : ['Mitt Dashboard', 'Prosjekt A'];
        } catch { return ['Mitt Dashboard', 'Prosjekt A']; }
    });
    const [selectedDashboard, setSelectedDashboard] = useState<string>(() => {
        try {
            return localStorage.getItem('endeligki-selected-dashboard') ?? 'Mitt Dashboard';
        } catch { return 'Mitt Dashboard'; }
    });
    const [dashboardGraphs, setDashboardGraphs] = useState<Record<string, DashboardGraph[]>>(() => {
        try {
            const s = localStorage.getItem('endeligki-dashboard-graphs');
            return s ? JSON.parse(s) : {};
        } catch { return {}; }
    });

    // Persist to localStorage
    useEffect(() => { localStorage.setItem('endeligki-dashboards', JSON.stringify(dashboards)); }, [dashboards]);
    useEffect(() => { localStorage.setItem('endeligki-selected-dashboard', selectedDashboard); }, [selectedDashboard]);
    useEffect(() => { localStorage.setItem('endeligki-dashboard-graphs', JSON.stringify(dashboardGraphs)); }, [dashboardGraphs]);

    // ── Handlers ──────────────────────────────────────────────────────────────

    const handleHentGraf = () => {
        setPreviewResult(MOCK_CHART_DATA);
        setSqlValue(MOCK_SQL);
        setKiSuggestion(KI_SUGGESTION);
        setGrafTitle(kiPrompt.trim() || 'Sidevisninger per dag');
    };

    const handleAddToDashboard = (dashboard: string, size: 'half' | 'full') => {
        if (!previewResult) return;
        setDashboardGraphs((prev) => ({
            ...prev,
            [dashboard]: [...(prev[dashboard] ?? []), { title: grafTitle, data: previewResult as unknown[], size }],
        }));
        setSelectedDashboard(dashboard);
        setActiveTab('dashboard');
    };

    const handleCreateNewDashboard = (name: string) => {
        setDashboards((prev) => [...prev, name]);
        setSelectedDashboard(name);
    };

    const handleOpenInGrafbygger = (graph: DashboardGraph) => {
        setPreviewResult(graph.data as unknown[]);
        setSqlValue(MOCK_SQL);
        setKiSuggestion(null);
        setActiveTab('grafbygger');
    };

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="py-8 max-w-[1400px] mx-auto px-4">
            <Tabs value={activeTab} onChange={setActiveTab}>
                <Tabs.List>
                    <Tabs.Tab value="grafbygger" label="Grafbygger" />
                    <Tabs.Tab value="dashboard" label="Dashboard" />
                </Tabs.List>

                <Tabs.Panel value="grafbygger">
                    <InputPanel
                        url={url}
                        onUrlChange={setUrl}
                        kiPrompt={kiPrompt}
                        onKiPromptChange={setKiPrompt}
                        kiSuggestion={kiSuggestion}
                        onHentGraf={handleHentGraf}
                    />
                    <GrafPanel
                        previewResult={previewResult}
                        grafTitle={grafTitle}
                        grafTab={grafTab}
                        onGrafTabChange={setGrafTab}
                        sqlValue={sqlValue}
                        onSqlChange={setSqlValue}
                        dashboards={dashboards}
                        onAddToDashboard={handleAddToDashboard}
                        onCreateNewDashboard={handleCreateNewDashboard}
                    />
                </Tabs.Panel>

                <Tabs.Panel value="dashboard">
                    <DashboardTab
                        dashboards={dashboards}
                        setDashboards={setDashboards}
                        selectedDashboard={selectedDashboard}
                        setSelectedDashboard={setSelectedDashboard}
                        dashboardGraphs={dashboardGraphs}
                        setDashboardGraphs={setDashboardGraphs}
                        onOpenInGrafbygger={handleOpenInGrafbygger}
                    />
                </Tabs.Panel>
            </Tabs>
        </div>
    );
}
