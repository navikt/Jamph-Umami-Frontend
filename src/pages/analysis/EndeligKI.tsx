import { useEffect, useState } from 'react';
import { Tabs } from '@navikt/ds-react';
import DashboardLayout from '../../components/dashboard/DashboardLayout';
import InputPanel from '../../components/ki-bygger/InputPanel';
import GrafPanel from '../../components/ki-bygger/GrafPanel';
import DashboardTab from '../../components/ki-bygger/DashboardTab';

// ─── Mock data ────────────────────────────────────────────────────────────────
/*
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

*/
interface DashboardGraph {
    title: string;
    data: unknown[];
    size: 'half' | 'full';
    sql?: string;
    grafTab?: GrafTab;
}
   const KI_SUGGESTION = 'Ditt spørsmål er veldig spennende! Hva med å legge til «i måneden»?';
   const KI_SUGGESTION_ADDITION = ' i måneden';

   type GrafTab = 'linechart' | 'barchart' | 'piechart' | 'table' | 'nokkeltall' | 'ki-forklaring';
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
    const [sqlValue, setSqlValue] = useState('');
    
    // Loading & error states
    const [ragLoading, setRagLoading] = useState(false);
    const [queryLoading, setQueryLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

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

    const handleHentGraf = async () => {
        const trimmedUrl = url.trim();
        const trimmedPrompt = kiPrompt.trim();
        
        if (!trimmedUrl || !trimmedPrompt) {
            setError('Både URL og spørsmål må fylles ut');
            return;
        }

        setError(null);
        setRagLoading(true);
        setPreviewResult(null);
        
        try {
            // Generate SQL from RAG API
            const ragApiBase = import.meta.env.VITE_RAG_API_URL ?? '';
            const response = await fetch(`${ragApiBase}/api/sql`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: trimmedPrompt, url: trimmedUrl }),
            });
            
            if (!response.ok) {
                const errData = await response.json().catch(() => null);
                throw new Error(errData?.error || `RAG API feilet (${response.status})`);
            }
            
            const data = await response.json();
            const rawSql = typeof data?.sql === 'string' ? data.sql : data?.sql?.response;
            if (!rawSql) throw new Error('RAG returnerte ingen SQL');

            const cleanSql = rawSql.replace(/```sql\n?|```\n?|```/g, '').trim();
            const prefix = data.debugInfo?.queryType ? `-- Query Type: ${data.debugInfo.queryType}\n\n` : '';
            const finalSql = prefix + cleanSql;
            setSqlValue(finalSql);
            setGrafTitle(trimmedPrompt);
            
            // Execute the query
            setQueryLoading(true);
            const queryResponse = await fetch('/api/bigquery', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: finalSql, analysisType: 'EndeligKI' }),
            });
            
            const queryData = await queryResponse.json();
            if (!queryResponse.ok) throw new Error(queryData.error || 'Query failed');
            
            setPreviewResult(queryData.data || []);
            setKiSuggestion(null); // Could add actual suggestions from RAG later
            
        } catch (err: any) {
            const msg = err.message === 'Failed to fetch'
                ? 'Kunne ikke koble til RAG-tjenesten'
                : err.message;
            setError(msg);
        } finally {
            setRagLoading(false);
            setQueryLoading(false);
        }
    };

    const handleAddToDashboard = (dashboard: string, size: 'half' | 'full') => {
        if (!previewResult) return;
        setDashboardGraphs((prev) => ({
            ...prev,
            [dashboard]: [...(prev[dashboard] ?? []), { title: grafTitle, data: previewResult as unknown[], size, sql: sqlValue, grafTab }],
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
        setGrafTitle(graph.title);
        setSqlValue(graph.sql || '');
        setGrafTab(graph.grafTab || 'linechart');
        setKiSuggestion(null);
        setActiveTab('grafbygger');
    };

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <DashboardLayout title="KI-grafbygger" hideHeader>
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
                        loading={ragLoading || queryLoading}
                        error={error}
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
        </DashboardLayout>
    );
}
