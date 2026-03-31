import { useEffect, useRef, useState } from 'react';
import { BodyShort, Button, Tabs, Textarea } from '@navikt/ds-react';
import DashboardLayout from '../../components/dashboard/DashboardLayout';
import PinnedWidget from '../../components/dashboard/PinnedWidget';
import { SqlCodeEditor } from '../../client/shared/ui/sql';
import UrlSearchFormPrototype from '../../components/dashboard/UrlSearchFormPrototype';

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

const MOCK_SQL = `SELECT
  DATE(created_at) AS dato,
  COUNT(*) AS sidevisninger
FROM pageview
WHERE website_id = 'example-website-id'
  AND created_at >= '2025-01-01'
  AND created_at < '2025-02-01'
GROUP BY DATE(created_at)
ORDER BY dato ASC;`;

const KI_SUGGESTION = 'Ditt spørsmål er veldig spennende! Hva med å legge til «i måneden»?';
const KI_SUGGESTION_ADDITION = ' i måneden';

const ANDRE_ANALYSER_OPTIONS = [
    'Markedsanalyse',
    'Egendefinerte hendelser',
    'Sideflyt',
    'Hendelsesflyt',
    'Traktanalyse',
    'Brukerprofiler',
    'Brukersammensetning',
    'Tilpasset analyse',
    'Diagnoseverktøy',
    'Personvernssjekk',
];

const ANDRE_ANALYSER_DESCRIPTIONS: Record<string, string> = {
    Markedsanalyse: 'Analyser trafikkkilder og kampanjeeffekter for å forbedre din markedsstrategi.',
    'Egendefinerte hendelser': 'Spor spesifikke hendelser du selv har definert på nettstedet ditt.',
    Sideflyt: 'Visualiser brukerens navigasjonsvei gjennom nettstedet og finn populære destinasjoner.',
    Hendelsesflyt: 'Spor og analyser sekvenser av hendelser for å forstå brukerintensjonene.',
    Traktanalyse: 'Kartlegg brukerreisen gjennom en konverteringsfunnel og finn frafallspunkter.',
    Brukerprofiler: 'Opprett detaljerte profiler av brukersegmenter basert på atferd og demografi.',
    Brukersammensetning: 'Analyser demografiske og tekniske egenskaper hos brukerne dine.',
    'Tilpasset analyse': 'Lag egendefinerte analyser basert på dine spesifikke behov og KPIer.',
    Diagnoseverktøy: 'Diagnostiser problemer og ineffektiviteter i brukeropplevelsen.',
    Personvernssjekk: 'Sikre at nettstedet oppfyller GDPR og personvernkrav.',
};

const ALL_ANALYSIS_OPTIONS = [
    'Trafikkanalyse',
    'Brukerlojalitet',
    ...ANDRE_ANALYSER_OPTIONS,
];

type ChartType = 'linechart' | 'barchart' | 'piechart' | 'table';
type GrafTab = ChartType | 'nokkeltall' | 'ki-forklaring';

// ─── Component ────────────────────────────────────────────────────────────────

export default function KiBygger() {
    const [activeTab, setActiveTab] = useState('grafbygger');

    // Left panel state
    const [url, setUrl] = useState('');
    const [selectedShortcut, setSelectedShortcut] = useState<string | null>(null);
    const [shortcuts, setShortcuts] = useState(['Trafikkanalyse', 'Brukerlojalitet']);
    const [selectedAndre, setSelectedAndre] = useState<string | null>(null);
    const [showAndreDropdown, setShowAndreDropdown] = useState(false);
    const [hoveredAndre, setHoveredAndre] = useState<string | null>(null);
    const [hoveredAndreInfo, setHoveredAndreInfo] = useState<string | null>(null);
    const [showSettings, setShowSettings] = useState(false);
    const [typePeriode, setTypePeriode] = useState('desember-2025');
    const [visning, setVisning] = useState('besokende');

    // Right panel state
    const [kiOpen, setKiOpen] = useState(true);
    const [sqlOpen, setSqlOpen] = useState(false);
    const [kiPrompt, setKiPrompt] = useState('');
    const [kiSuggestionShown, setKiSuggestionShown] = useState(false);
    const [hoveredKiInfo, setHoveredKiInfo] = useState(false);
    const [grafTab, setGrafTab] = useState<GrafTab>('linechart');
    const [previewResult, setPreviewResult] = useState<unknown[] | null>(null);
    const [sqlValue, setSqlValue] = useState(MOCK_SQL);
    const [showAddDashboardMenu, setShowAddDashboardMenu] = useState(false);
    const [newDashboardName, setNewDashboardName] = useState('');
    const [dashboards, setDashboards] = useState<string[]>(() => {
        try { const s = localStorage.getItem('kibygger-dashboards'); return s ? JSON.parse(s) : ['Mitt Dashboard', 'Prosjekt A']; } catch { return ['Mitt Dashboard', 'Prosjekt A']; }
    });
    const [selectedDashboard, setSelectedDashboard] = useState<string>(() => {
        try { const s = localStorage.getItem('kibygger-selected-dashboard'); return s ?? 'Mitt Dashboard'; } catch { return 'Mitt Dashboard'; }
    });
    const [showNewDashboardModal, setShowNewDashboardModal] = useState(false);
    const [newDashboardInputName, setNewDashboardInputName] = useState('');
    const [showNewDashboardInput, setShowNewDashboardInput] = useState(false);
    const [pendingDashboard, setPendingDashboard] = useState<string | null>(null);
    const [dashboardGraphs, setDashboardGraphs] = useState<Record<string, { title: string; data: unknown[]; size: 'half' | 'full' }[]>>(() => {
        try { const s = localStorage.getItem('kibygger-dashboard-graphs'); return s ? JSON.parse(s) : {}; } catch { return {}; }
    });
    const [urlError, setUrlError] = useState<string | null>(null);
    const [analyseError, setAnalyseError] = useState<string | null>(null);
    const [kiError, setKiError] = useState<string | null>(null);
    const dragIndexRef = useRef<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
    const [expandedCardIndex, setExpandedCardIndex] = useState<number | null>(null);
    const [hoveredDashboard, setHoveredDashboard] = useState<string | null>(null);
    const [deletingDashboard, setDeletingDashboard] = useState<string | null>(null);
    const [sqlCopied, setSqlCopied] = useState(false);
    const [grafTitle, setGrafTitle] = useState('Sidevisninger per dag');

    const dashboardMenuRef = useRef<HTMLDivElement>(null);
    const andreDropdownRef = useRef<HTMLDivElement>(null);

    // ── Persist to localStorage ───────────────────────────────────────────────
    useEffect(() => { localStorage.setItem('kibygger-dashboards', JSON.stringify(dashboards)); }, [dashboards]);
    useEffect(() => { localStorage.setItem('kibygger-selected-dashboard', selectedDashboard); }, [selectedDashboard]);
    useEffect(() => { localStorage.setItem('kibygger-dashboard-graphs', JSON.stringify(dashboardGraphs)); }, [dashboardGraphs]);

    // ── Handlers ──────────────────────────────────────────────────────────────

    const handleHentGraf = () => {
        const newUrlError = !url.trim() ? 'Du må lime inn en URL først.' : null;
        const newAnalyseError = (!selectedShortcut && !selectedAndre) ? 'Velg en analysetype før du henter graf.' : null;
        setUrlError(newUrlError);
        setAnalyseError(newAnalyseError);
        if (newUrlError || newAnalyseError) return;
        setPreviewResult(MOCK_CHART_DATA);
        setSqlValue(MOCK_SQL);
        setKiSuggestionShown(false);
        setGrafTitle(`${selectedShortcut ?? selectedAndre ?? 'Graf'} – sidevisninger per dag`);
    };

    const handleKiHentGraf = () => {
        if (!kiPrompt.trim()) {
            setKiError('Skriv inn et spørsmål til KI-assistenten først.');
            return;
        }
        setKiError(null);
        setPreviewResult(MOCK_CHART_DATA);
        setSqlValue(MOCK_SQL);
        setKiSuggestionShown(true);
        setGrafTitle(kiPrompt.trim() || 'Sidevisninger per dag');
    };

    const handleApplySuggestion = () => {
        setKiPrompt((prev) => prev + KI_SUGGESTION_ADDITION);
    };

    const handleNullstill = () => {
        setSelectedShortcut(null);
        setSelectedAndre(null);
        setTypePeriode('desember-2025');
        setVisning('besokende');
        setUrl('');
        setUrlError(null);
        setAnalyseError(null);
        setPreviewResult(null);
        setSqlValue(MOCK_SQL);
        setKiPrompt('');
        setKiSuggestionShown(false);
        setKiError(null);
        setGrafTab('linechart');
    };

    const handleCreateNewDashboard = () => {
        if (!newDashboardName.trim()) return;
        setDashboards((prev) => [...prev, newDashboardName.trim()]);
        setNewDashboardName('');
        setShowNewDashboardInput(false);
    };

    const handleOpenInGrafbygger = (g: { title: string; data: unknown[]; size: 'half' | 'full' }) => {
        setPreviewResult(g.data as unknown[]);
        setSqlValue(MOCK_SQL);
        setKiSuggestionShown(false);
        setExpandedCardIndex(null);
        setActiveTab('grafbygger');
    };

    const handleDeleteCard = (index: number) => {
        setDashboardGraphs((prev) => {
            const list = [...(prev[selectedDashboard] ?? [])];
            list.splice(index, 1);
            return { ...prev, [selectedDashboard]: list };
        });
        setExpandedCardIndex(null);
    };

    const handleToggleSize = (index: number) => {
        setDashboardGraphs((prev) => {
            const list = [...(prev[selectedDashboard] ?? [])];
            list[index] = { ...list[index], size: list[index].size === 'full' ? 'half' : 'full' };
            return { ...prev, [selectedDashboard]: list };
        });
        setExpandedCardIndex(null);
    };

    const handleDeleteDashboard = (db: string) => {
        setDashboards((prev) => prev.filter((d) => d !== db));
        setDashboardGraphs((prev) => {
            const next = { ...prev };
            delete next[db];
            return next;
        });
        if (selectedDashboard === db) {
            setSelectedDashboard('');
        }
    };

    // ── Quick filter config per analysis type ─────────────────────────────────

    const activeAnalysis = selectedAndre ?? selectedShortcut;

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <DashboardLayout title="KI-bygger" hideHeader>
            <Tabs value={activeTab} onChange={setActiveTab}>
                <Tabs.List>
                    <Tabs.Tab value="grafbygger" label="Grafbygger" />
                    <Tabs.Tab value="dashboard" label="Dashboard" />
                </Tabs.List>

                {/* ═══════════════════════════════ GRAFBYGGER ═══════════════════════════════ */}
                <Tabs.Panel value="grafbygger" className="pt-4 w-full">
                    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '1.25rem', alignItems: 'flex-start' }}>

                        {/* ── Left panel ── */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                            {/* Box 1: URL */}
                            <div style={{ ...boxStyle, border: urlError ? '1px solid #c0392b' : boxStyle.border }}>
                                <BodyShort weight="semibold" style={boxTitleStyle}>1. Lim inn URL for å se webstatistikk</BodyShort>
                                <input
                                    type="url"
                                    placeholder="https://www.nav.no/..."
                                    value={url}
                                    onChange={(e) => { setUrl(e.target.value); setUrlError(null); }}
                                    style={inputStyle}
                                />
                            </div>
                            {urlError && (
                                <p style={{ margin: '-0.5rem 0 0 0', fontSize: '0.8rem', color: '#c0392b' }}>{urlError}</p>
                            )}

                            {/* Box 2: Velg analysetype */}
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '0.25rem' }}>
                                    <button
                                        onClick={handleNullstill}
                                        title="Nullstill valg"
                                        style={{
                                            border: 'none',
                                            background: 'transparent',
                                            color: '#0067C5',
                                            fontSize: '0.8rem',
                                            cursor: 'pointer',
                                            padding: '2px 0',
                                            fontWeight: 500,
                                            textDecoration: 'underline',
                                        }}
                                    >
                                        Nullstill valg
                                    </button>
                                </div>
                                <div style={{ ...boxStyle, border: analyseError ? '1px solid #c0392b' : boxStyle.border }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                    <BodyShort weight="semibold" style={{ ...boxTitleStyle, marginBottom: 0, display: 'inline' }}>2. Velg analysetype</BodyShort>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <button
                                            onClick={() => setShowSettings(!showSettings)}
                                            title="Innstillinger"
                                            style={{
                                                border: 'none',
                                                background: 'transparent',
                                                color: '#0067C5',
                                                fontSize: '1.5rem',
                                                cursor: 'pointer',
                                                padding: '2px',
                                                display: 'flex',
                                                alignItems: 'center',
                                            }}
                                        >
                                            ⚙
                                        </button>
                                    </div>
                                </div>

                                {/* Shortcut buttons */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                    {shortcuts.map((s) => (
                                        <button
                                            key={s}
                                            onClick={() => { setSelectedShortcut(s); setSelectedAndre(null); setAnalyseError(null); }}
                                            style={{
                                                border: selectedShortcut === s ? 'none' : '1px solid #a0a0a0',
                                                borderRadius: '6px',
                                                padding: '6px 4px',
                                                background: selectedShortcut === s ? '#0067C5' : '#ffffff',
                                                color: selectedShortcut === s ? '#ffffff' : '#0067C5',
                                                fontWeight: 600,
                                                fontSize: '0.8rem',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                            }}
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>

                                {/* Andre analyser dropdown */}
                                <div ref={andreDropdownRef} style={{ position: 'relative' }}>
                                    <button
                                        onClick={() => setShowAndreDropdown(!showAndreDropdown)}
                                        style={{
                                            width: '100%',
                                            padding: '7px 10px',
                                            borderRadius: '6px',
                                            border: selectedAndre ? 'none' : '1px solid #a0a0a0',
                                            fontSize: '0.875rem',
                                            backgroundColor: selectedAndre ? '#0067C5' : '#ffffff',
                                            color: selectedAndre ? '#ffffff' : '#444',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                        }}
                                    >
                                        <span>{selectedAndre ?? 'Andre analyser'}</span>
                                        {selectedAndre ? (
                                            <span
                                                onClick={(e) => { e.stopPropagation(); setSelectedAndre(null); }}
                                                style={{ fontSize: '1.1rem', lineHeight: 1, cursor: 'pointer' }}
                                            >×</span>
                                        ) : (
                                            <span style={{ fontSize: '0.65rem' }}>▼</span>
                                        )}
                                    </button>
                                    {showAndreDropdown && (
                                        <div style={dropdownContainerStyle}>
                                            {ANDRE_ANALYSER_OPTIONS.map((opt, idx) => (
                                                <div
                                                    key={opt}
                                                    onMouseEnter={() => setHoveredAndre(opt)}
                                                    onMouseLeave={() => setHoveredAndre(null)}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        padding: '0.6rem 0.75rem',
                                                        borderBottom: idx < ANDRE_ANALYSER_OPTIONS.length - 1 ? '1px solid #e0e0e0' : 'none',
                                                        backgroundColor: hoveredAndre === opt ? '#f0f4ff' : '#ffffff',
                                                        cursor: 'pointer',
                                                        transition: 'background-color 0.15s',
                                                    }}
                                                >
                                                    <span
                                                        onClick={() => { setSelectedAndre(opt); setSelectedShortcut(null); setShowAndreDropdown(false); setAnalyseError(null); }}
                                                        style={{ flex: 1, fontSize: '0.875rem', color: '#0067C5', fontWeight: 500 }}
                                                    >
                                                        {opt}
                                                    </span>
                                                    <div
                                                        style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
                                                        onMouseEnter={() => setHoveredAndreInfo(opt)}
                                                        onMouseLeave={() => setHoveredAndreInfo(null)}
                                                    >
                                                        <span style={{
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            width: '18px', height: '18px', borderRadius: '50%',
                                                            backgroundColor: hoveredAndreInfo === opt ? '#0067C5' : '#e0e0e0',
                                                            color: hoveredAndreInfo === opt ? '#fff' : '#666',
                                                            fontSize: '0.7rem', fontWeight: 'bold', cursor: 'pointer',
                                                            marginLeft: '0.5rem', transition: 'all 0.15s',
                                                        }}>ℹ</span>
                                                        {hoveredAndreInfo === opt && (
                                                            <div style={{ ...tooltipStyle, right: 'auto', left: '26px', top: '-5px', maxWidth: '320px', width: 'max-content' }}>
                                                                {ANDRE_ANALYSER_DESCRIPTIONS[opt]}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                </div>
                            </div>
                            {analyseError && (
                                <p style={{ margin: '-0.5rem 0 0 0', fontSize: '0.8rem', color: '#c0392b' }}>{analyseError}</p>
                            )}

                            {/* Settings panel */}
                            {showSettings && (
                                <div style={{ ...boxStyle, backgroundColor: '#f0f4ff', border: '2px solid #0067C5' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                        <BodyShort weight="semibold">Velg snarveier</BodyShort>
                                        <button onClick={() => setShowSettings(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '1.1rem' }}>✕</button>
                                    </div>
                                    <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.8rem', color: '#666' }}>Velg analysetyper som vises som snarvei:</p>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        {ALL_ANALYSIS_OPTIONS.map((opt) => (
                                            <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={shortcuts.includes(opt)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) setShortcuts((prev) => [...prev, opt]);
                                                        else setShortcuts((prev) => prev.filter((s) => s !== opt));
                                                    }}
                                                />
                                                {opt}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Box 3: Hurtigfiltre */}
                            <div style={{ ...boxStyle, backgroundColor: '#f9fbff' }}>
                                <BodyShort weight="semibold" style={boxTitleStyle}>3. Hurtigfiltre</BodyShort>
                                <QuickFilters
                                    analysisType={activeAnalysis}
                                    typePeriode={typePeriode}
                                    setTypePeriode={setTypePeriode}
                                    visning={visning}
                                    setVisning={setVisning}
                                />
                            </div>

                            {/* Hent graf button */}
                            <button
                                onClick={handleHentGraf}
                                style={primaryButtonStyle}
                                onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#0050a0'; }}
                                onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#0067C5'; }}
                            >
                                Hent graf
                            </button>
                        </div>

                        {/* ── Right panel ── */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                            {/* KI-Assistent box */}
                            <div style={boxStyle}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: kiOpen ? '0.75rem' : 0 }}>
                                    <button
                                        onClick={() => setKiOpen(!kiOpen)}
                                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '0.8rem', color: '#444', padding: '2px 4px' }}
                                        title={kiOpen ? 'Skjul' : 'Vis'}
                                    >
                                        {kiOpen ? '▼' : '▶'}
                                    </button>
                                    <BodyShort weight="semibold">✨ KI-Assistent</BodyShort>
                                    <div
                                        style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
                                        onMouseEnter={() => setHoveredKiInfo(true)}
                                        onMouseLeave={() => setHoveredKiInfo(false)}
                                    >
                                        <span style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            width: '18px', height: '18px', borderRadius: '50%',
                                            backgroundColor: hoveredKiInfo ? '#0067C5' : '#e0e0e0',
                                            color: hoveredKiInfo ? '#fff' : '#666',
                                            fontSize: '0.7rem', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.15s',
                                        }}>ℹ</span>
                                        {hoveredKiInfo && (
                                            <div style={{ ...tooltipStyle, right: 'auto', left: '25px', top: '-10px', maxWidth: '420px', width: 'max-content' }}>
                                                Lim inn URL først. Bruk så KI-byggeren som et alternativ til, eller i tillegg til, valgene på venstre panel, eller til å stille spørsmål.
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {kiOpen && (
                                    <>
                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', marginBottom: '0.75rem' }}>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <Textarea
                                                    label="KI-spørsmål"
                                                    hideLabel
                                                    placeholder="Eksempel: Vis daglige sidevisninger for hele nettstedet i 2025"
                                                    value={kiPrompt}
                                                    onChange={(e) => setKiPrompt(e.target.value)}
                                                    minRows={2}
                                                    style={{ width: '100%', fontSize: '0.9rem' }}
                                                />
                                            </div>
                                            <Button size="small" variant="primary" onClick={handleKiHentGraf} style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                                                Hent graf
                                            </Button>
                                        </div>
                                        {kiError && (
                                            <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.8rem', color: '#c0392b' }}>{kiError}</p>
                                        )}
                                        {kiSuggestionShown && (
                                            <div
                                                onClick={handleApplySuggestion}
                                                style={{
                                                    display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
                                                    backgroundColor: '#f0f4ff', border: '1px solid #c8d9f5',
                                                    borderRadius: '8px', padding: '0.75rem',
                                                    cursor: 'pointer', transition: 'background-color 0.15s',
                                                    marginTop: '0.5rem',
                                                }}
                                                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#e0ecff'; }}
                                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f0f4ff'; }}
                                                title="Klikk for å legge til forslaget i inputfeltet"
                                            >
                                                <span style={{
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    width: '22px', height: '22px', borderRadius: '50%',
                                                    backgroundColor: '#0067C5', color: '#fff',
                                                    fontSize: '0.75rem', fontWeight: 700, flexShrink: 0,
                                                }}>KI</span>
                                                <p style={{ margin: 0, fontSize: '0.875rem', color: '#333', lineHeight: '1.5' }}>
                                                    {KI_SUGGESTION}
                                                </p>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* Grafvindu box */}
                            <div style={boxStyle}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                    <BodyShort weight="semibold">Grafvindu</BodyShort>
                                </div>

                                {/* Graf tab bar */}
                                <div style={{ display: 'flex', gap: '0', marginBottom: '1rem', borderBottom: '2px solid #e0e0e0' }}>
                                    {([
                                        { key: 'linechart', label: 'Linje' },
                                        { key: 'piechart', label: 'Kake' },
                                        { key: 'barchart', label: 'Stolpe' },
                                        { key: 'table', label: 'Tabell' },
                                        { key: 'nokkeltall', label: 'Nøkkeltall' },
                                        { key: 'ki-forklaring', label: 'KI-forklaring' },
                                    ] as { key: GrafTab; label: string }[]).map(({ key, label }) => (
                                        <button
                                            key={key}
                                            onClick={() => setGrafTab(key)}
                                            style={{
                                                border: 'none',
                                                borderBottom: grafTab === key ? '2px solid #0067C5' : '2px solid transparent',
                                                background: 'transparent',
                                                cursor: 'pointer',
                                                padding: '0.4rem 0.75rem',
                                                marginBottom: '-2px',
                                                fontSize: '0.875rem',
                                                fontWeight: grafTab === key ? 600 : 400,
                                                color: grafTab === key ? '#0067C5' : '#555',
                                                transition: 'all 0.15s',
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>

                                {/* Info panels for Nøkkeltall / KI-forklaring — shown above chart */}
                                {grafTab === 'nokkeltall' && (
                                    <div style={{ ...boxStyle, backgroundColor: '#f9fbff', padding: '1rem', marginBottom: '1rem' }}>
                                        <BodyShort size="small" weight="semibold" style={{ marginBottom: '0.5rem', color: '#0067C5' }}>Nøkkeltall</BodyShort>
                                        <p style={{ margin: 0, fontSize: '0.9rem', color: '#333' }}>
                                            {previewResult ? '10 840 sidevisninger totalt · Snitt 1 548 / dag' : 'Hent graf for å se nøkkeltall.'}
                                        </p>
                                    </div>
                                )}
                                {grafTab === 'ki-forklaring' && (
                                    <div style={{ ...boxStyle, backgroundColor: '#f0f4ff', padding: '1rem', marginBottom: '1rem' }}>
                                        <BodyShort size="small" weight="semibold" style={{ marginBottom: '0.5rem', color: '#0067C5' }}>KI-forklaring</BodyShort>
                                        <p style={{ margin: 0, fontSize: '0.9rem', color: '#333', lineHeight: '1.6' }}>
                                            {previewResult ? 'Trafikken økte 45 % fra start til slutt av perioden med to tydelige topper.' : 'Hent graf for å se KI-forklaring.'}
                                        </p>
                                    </div>
                                )}

                                {/* Chart area — always visible */}
                                <div style={{ minHeight: '320px', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '0.5rem', backgroundColor: '#fff', marginBottom: '1rem' }}>
                                    {previewResult && (grafTab === 'linechart' || grafTab === 'nokkeltall' || grafTab === 'ki-forklaring') ? (
                                        <PinnedWidget
                                            result={{ data: previewResult }}
                                            chartType="linechart"
                                            title="Sidevisninger per dag"
                                        />
                                    ) : (
                                        <div style={{ height: '100%', minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: '0.9rem' }}>
                                            {previewResult
                                                ? `${grafTab === 'piechart' ? 'Kakediagram' : grafTab === 'barchart' ? 'Stolpediagram' : 'Tabell'} ikke tilgjengelig i prototype`
                                                : 'Grafen vises her etter at du trykker «Hent graf»'}
                                        </div>
                                    )}
                                </div>

                                {/* Actions under chart */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    <button
                                        onClick={() => {
                                            if (!previewResult) return;
                                            const json = JSON.stringify(previewResult, null, 2);
                                            const blob = new Blob([json], { type: 'application/json' });
                                            const a = document.createElement('a');
                                            a.href = URL.createObjectURL(blob);
                                            a.download = 'graf.json';
                                            a.click();
                                            URL.revokeObjectURL(a.href);
                                        }}
                                        style={{ border: '1px solid #d0d0d0', background: '#fff', cursor: 'pointer', borderRadius: '6px', padding: '6px 14px', fontSize: '0.85rem', color: '#444' }}
                                    >
                                        ↓ Last ned
                                    </button>

                                    {/* Add to dashboard */}
                                    <div ref={dashboardMenuRef} style={{ position: 'relative' }}>
                                        <Button size="small" variant="primary" disabled={!previewResult} onClick={() => setShowAddDashboardMenu(!showAddDashboardMenu)}>
                                            + Legg til Dashboard
                                        </Button>
                                        {showAddDashboardMenu && (
                                            <div style={{
                                                position: 'absolute', bottom: '110%', left: '50%', transform: 'translateX(-50%)',
                                                backgroundColor: '#fff', border: '1px solid #a0a0a0', borderRadius: '6px',
                                                boxShadow: '0 2px 12px rgba(0,0,0,0.15)', zIndex: 20, minWidth: '220px', padding: '0.5rem 0',
                                            }}>
                                                {pendingDashboard ? (
                                                    <div style={{ padding: '0.75rem 1rem' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.6rem' }}>
                                                            <button
                                                                onClick={() => setPendingDashboard(null)}
                                                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', color: '#888', padding: 0, marginRight: '0.5rem' }}
                                                            >
                                                            ←
                                                            </button>
                                                        </div>
                                                        <p style={{ margin: '0 0 0.6rem 0', fontSize: '0.8rem', color: '#555', fontWeight: 600 }}>Velg størrelse</p>
                                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                            {(['half', 'full'] as const).map((s) => (
                                                                <button
                                                                    key={s}
                                                                    onClick={() => {
                                                                        if (previewResult) {
                                                                            setDashboardGraphs((prev) => ({
                                                                                ...prev,
                                                                                [pendingDashboard]: [...(prev[pendingDashboard] ?? []), { title: grafTitle, data: previewResult as unknown[], size: s }],
                                                                            }));
                                                                        }
                                                                        setSelectedDashboard(pendingDashboard);
                                                                        setPendingDashboard(null);
                                                                        setShowAddDashboardMenu(false);
                                                                        setActiveTab('dashboard');
                                                                    }}
                                                                    style={{
                                                                        flex: 1, padding: '0.5rem', border: '1px solid #a0a0a0', borderRadius: '6px',
                                                                        background: '#fff', cursor: 'pointer', fontSize: '0.8rem', color: '#333', fontWeight: 500,
                                                                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem',
                                                                    }}
                                                                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#0067C5'; e.currentTarget.style.color = '#0067C5'; }}
                                                                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#a0a0a0'; e.currentTarget.style.color = '#333'; }}
                                                                >
                                                                    <span style={{ fontSize: '1.2rem' }}>{s === 'half' ? '▣' : '■'}</span>
                                                                    {s === 'half' ? '1×2 (halv)' : '2×2 (hel)'}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        {dashboards.map((db) => (
                                                            <div
                                                                key={db}
                                                                onClick={() => setPendingDashboard(db)}
                                                                style={{ padding: '0.5rem 1rem', cursor: 'pointer', color: '#0067C5', fontWeight: 500, fontSize: '0.875rem', borderBottom: '1px solid #f0f0f0' }}
                                                                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f5f5f5'; }}
                                                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                                                            >
                                                                {db}
                                                            </div>
                                                        ))}
                                                {showNewDashboardInput ? (
                                                    <div style={{ padding: '0.5rem 1rem' }}>
                                                        <input
                                                            type="text"
                                                            placeholder="Navn på dashboard..."
                                                            value={newDashboardName}
                                                            onChange={(e) => setNewDashboardName(e.target.value)}
                                                            onKeyDown={(e) => { if (e.key === 'Enter') handleCreateNewDashboard(); }}
                                                            style={{ width: '100%', padding: '4px 8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem', boxSizing: 'border-box', marginBottom: '0.4rem' }}
                                                            autoFocus
                                                        />
                                                        <Button size="small" variant="primary" style={{ width: '100%' }} onClick={handleCreateNewDashboard}>Opprett</Button>
                                                    </div>
                                                ) : (
                                                        <div
                                                            onClick={() => setShowNewDashboardInput(true)}
                                                            style={{ padding: '0.5rem 1rem', cursor: 'pointer', color: '#0067C5', fontWeight: 600, fontSize: '0.875rem', borderTop: '1px solid #e0e0e0', marginTop: '0.25rem' }}
                                                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f0f4ff'; }}
                                                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                                                        >
                                                            + Opprett nytt Dashboard
                                                        </div>
                                                )}
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        title="Del grafvindu"
                                        style={{ border: '1px solid #d0d0d0', background: '#fff', cursor: 'pointer', borderRadius: '6px', padding: '6px 14px', fontSize: '0.85rem', color: '#444' }}
                                    >
                                        Del
                                    </button>
                                </div>
                            </div>

                            {/* SQL box */}
                            <div style={boxStyle}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: sqlOpen ? '0.75rem' : 0, justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <button
                                            onClick={() => setSqlOpen(!sqlOpen)}
                                            style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '0.8rem', color: '#444', padding: '2px 4px' }}
                                            title={sqlOpen ? 'Skjul SQL' : 'Vis SQL'}
                                        >
                                            {sqlOpen ? '▼' : '▶'}
                                        </button>
                                        <BodyShort weight="semibold">SQL</BodyShort>
                                    </div>
                                    <button
                                        title="Del SQL"
                                        style={secondaryButtonStyle}
                                    >
                                        Del
                                    </button>
                                </div>
                                {sqlOpen && (
                                    previewResult ? (
                                        <>
                                            <SqlCodeEditor
                                                value={sqlValue}
                                                onChange={setSqlValue}
                                                height={280}
                                            />
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <button
                                                        onClick={() => { navigator.clipboard.writeText(sqlValue); setSqlCopied(true); setTimeout(() => setSqlCopied(false), 2000); }}
                                                        style={secondaryButtonStyle}
                                                    >
                                                        {sqlCopied ? 'Kopiert!' : 'Kopier'}
                                                    </button>
                                                    <button style={secondaryButtonStyle}>Formater</button>
                                                    <button style={secondaryButtonStyle}>Valider</button>
                                                </div>
                                                <button style={secondaryButtonStyle}>Kostnad</button>
                                            </div>
                                        </>
                                    ) : (
                                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#999' }}>
                                            SQL vises her etter at du henter en graf.
                                        </p>
                                    )
                                )}
                            </div>
                        </div>
                    </div>
                </Tabs.Panel>

                {/* ═══════════════════════════════ DASHBOARD ═══════════════════════════════ */}
                <Tabs.Panel value="dashboard" className="pt-4">
                    <div style={{ marginBottom: '2rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                            <BodyShort weight="semibold" style={{ fontSize: '1rem' }}>Dashboard-mapper</BodyShort>
                            <button
                                onClick={() => setShowNewDashboardModal(true)}
                                title="Opprett ny mappe"
                                style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.5rem', color: '#0067C5', padding: 0, display: 'flex', alignItems: 'center' }}
                            >
                                +
                            </button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1.2rem' }}>
                            {dashboards.map((db) => (
                                <div
                                    key={db}
                                    onClick={() => setSelectedDashboard(db)}
                                    onMouseEnter={() => setHoveredDashboard(db)}
                                    onMouseLeave={() => setHoveredDashboard(null)}
                                    style={{
                                        position: 'relative',
                                        padding: '1.5rem 1rem', border: selectedDashboard === db ? '2px solid #0067C5' : '1px solid #e0e0e0',
                                        borderRadius: '12px', backgroundColor: selectedDashboard === db ? '#f0f4ff' : '#ffffff',
                                        cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s',
                                        boxShadow: selectedDashboard === db ? '0 4px 12px rgba(0,103,197,0.15)' : '0 2px 6px rgba(0,0,0,0.07)',
                                    }}
                                >
                                    {hoveredDashboard === db && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setDeletingDashboard(db); }}
                                            style={{
                                                position: 'absolute', top: '6px', right: '8px',
                                                border: 'none', background: 'transparent',
                                                color: '#c0392b', fontSize: '1rem', cursor: 'pointer',
                                                lineHeight: 1, padding: '2px 4px', borderRadius: '4px',
                                            }}
                                            title="Slett mappe"
                                        >
                                            ✕
                                        </button>
                                    )}
                                    <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📁</div>
                                    <div style={{ fontSize: '0.9rem', fontWeight: 500, color: '#333', wordBreak: 'break-word' }}>{db}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {selectedDashboard && (
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
                                <BodyShort weight="semibold" style={{ fontSize: '1.15rem' }}>{selectedDashboard}</BodyShort>
                                <button style={secondaryButtonStyle}>Importer</button>
                                <button style={secondaryButtonStyle}>Eksporter</button>
                            </div>
                            {(dashboardGraphs[selectedDashboard] ?? []).length === 0 ? (
                                <div style={{ color: '#999', fontSize: '0.9rem', textAlign: 'center', paddingTop: '3rem' }}>
                                    Ingen grafer lagt til i «{selectedDashboard}» ennå. Gå til Grafbygger-fanen og trykk «+ Legg til Dashboard».
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.25rem' }} onClick={() => setExpandedCardIndex(null)}>
                                    {(dashboardGraphs[selectedDashboard] ?? []).map((g, i) => (
                                        <div
                                            key={i}
                                            draggable
                                            onDragStart={() => { dragIndexRef.current = i; }}
                                            onDragOver={(e) => { e.preventDefault(); setDragOverIndex(i); }}
                                            onDragLeave={() => setDragOverIndex(null)}
                                            onDrop={() => {
                                                const from = dragIndexRef.current;
                                                if (from === null || from === i) { setDragOverIndex(null); return; }
                                                setDashboardGraphs((prev) => {
                                                    const list = [...(prev[selectedDashboard] ?? [])];
                                                    const [moved] = list.splice(from, 1);
                                                    list.splice(i, 0, moved);
                                                    return { ...prev, [selectedDashboard]: list };
                                                });
                                                dragIndexRef.current = null;
                                                setDragOverIndex(null);
                                            }}
                                            onDragEnd={() => { dragIndexRef.current = null; setDragOverIndex(null); }}
                                            onDoubleClick={() => setExpandedCardIndex(expandedCardIndex === i ? null : i)}
                                            style={{
                                                ...boxStyle,
                                                overflow: 'hidden',
                                                position: 'relative',
                                                gridColumn: g.size === 'full' ? 'span 2' : 'span 1',
                                                cursor: 'grab',
                                                outline: dragOverIndex === i ? '2px dashed #0067C5' : 'none',
                                                opacity: dragIndexRef.current === i ? 0.5 : 1,
                                                transition: 'outline 0.1s, opacity 0.1s',
                                            }}
                                        >
                                            <div style={{ height: '260px', position: 'relative', overflow: 'hidden' }}>
                                                <PinnedWidget result={{ data: g.data }} chartType="linechart" title={g.title} />
                                            </div>

                                            {/* Double-click overlay */}
                                            {expandedCardIndex === i && (
                                                <div
                                                    onClick={(e) => e.stopPropagation()}
                                                    style={{
                                                        position: 'absolute',
                                                        inset: 0,
                                                        backgroundColor: 'rgba(0,0,0,0.45)',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: '0.75rem',
                                                        borderRadius: '12px',
                                                        zIndex: 10,
                                                    }}
                                                >
                                                    <button
                                                        onClick={() => handleOpenInGrafbygger(g)}
                                                        style={{
                                                            padding: '0.55rem 1.4rem',
                                                            borderRadius: '6px',
                                                            border: 'none',
                                                            backgroundColor: '#0067C5',
                                                            color: '#fff',
                                                            cursor: 'pointer',
                                                            fontSize: '0.9rem',
                                                            fontWeight: 500,
                                                            width: '180px',
                                                        }}
                                                    >
                                                        Åpne i Grafbygger
                                                    </button>
                                                    <button
                                                        onClick={() => handleToggleSize(i)}
                                                        style={{
                                                            padding: '0.55rem 1.4rem',
                                                            borderRadius: '6px',
                                                            border: '1.5px solid #fff',
                                                            backgroundColor: 'transparent',
                                                            color: '#fff',
                                                            cursor: 'pointer',
                                                            fontSize: '0.9rem',
                                                            fontWeight: 500,
                                                            width: '180px',
                                                        }}
                                                    >
                                                        {g.size === 'full' ? 'Gjør halvbredde (1×2)' : 'Gjør fullbredde (2×2)'}
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteCard(i)}
                                                        style={{
                                                            padding: '0.55rem 1.4rem',
                                                            borderRadius: '6px',
                                                            border: 'none',
                                                            backgroundColor: '#e74c3c',
                                                            color: '#fff',
                                                            cursor: 'pointer',
                                                            fontSize: '0.9rem',
                                                            fontWeight: 500,
                                                            width: '180px',
                                                        }}
                                                    >
                                                        Slett
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {deletingDashboard && (
                        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                            <div style={{ backgroundColor: '#fff', borderRadius: '8px', padding: '2rem', minWidth: '360px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                                <h2 style={{ margin: '0 0 0.75rem 0', fontSize: '1.1rem', color: '#333' }}>Slett mappe</h2>
                                <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.9rem', color: '#555' }}>
                                    Er du sikker på at du vil slette <strong>«{deletingDashboard}»</strong>? Alle grafer i mappen vil også bli slettet.
                                </p>
                                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                                    <button onClick={() => setDeletingDashboard(null)} style={cancelButtonStyle}>Avbryt</button>
                                    <button
                                        onClick={() => { handleDeleteDashboard(deletingDashboard); setDeletingDashboard(null); }}
                                        style={{ padding: '0.5rem 1.5rem', borderRadius: '6px', border: 'none', backgroundColor: '#e74c3c', color: '#fff', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500 }}
                                    >
                                        Slett
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {showNewDashboardModal && (
                        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                            <div style={{ backgroundColor: '#fff', borderRadius: '8px', padding: '2rem', minWidth: '380px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                                <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.15rem', color: '#333' }}>Opprett nytt Dashboard</h2>
                                <input
                                    type="text"
                                    placeholder="Navn på dashboard"
                                    value={newDashboardInputName}
                                    onChange={(e) => setNewDashboardInputName(e.target.value)}
                                    style={{ width: '100%', padding: '0.65rem', borderRadius: '6px', border: '1px solid #ccc', fontSize: '0.9rem', marginBottom: '1rem', boxSizing: 'border-box' }}
                                    autoFocus
                                />
                                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                                    <button onClick={() => { setShowNewDashboardModal(false); setNewDashboardInputName(''); }} style={cancelButtonStyle}>Avbryt</button>
                                    <button
                                        onClick={() => {
                                            if (newDashboardInputName.trim()) {
                                                setDashboards((prev) => [...prev, newDashboardInputName.trim()]);
                                                setSelectedDashboard(newDashboardInputName.trim());
                                                setNewDashboardInputName('');
                                                setShowNewDashboardModal(false);
                                            }
                                        }}
                                        style={{ padding: '0.5rem 1.5rem', borderRadius: '6px', border: 'none', backgroundColor: '#0067C5', color: '#fff', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500 }}
                                    >
                                        Opprett
                                    </button>
                                </div>                                {analyseError && (
                                    <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: '#c0392b' }}>{analyseError}</p>
                                )}                            </div>
                        </div>
                    )}
                </Tabs.Panel>
            </Tabs>
        </DashboardLayout>
    );
}

// ─── Quick filters sub-component ─────────────────────────────────────────────

function QuickFilters({
    analysisType,
    typePeriode,
    setTypePeriode,
    visning,
    setVisning,
}: {
    analysisType: string | null;
    typePeriode: string;
    setTypePeriode: (v: string) => void;
    visning: string;
    setVisning: (v: string) => void;
}) {
    if (!analysisType) {
        return <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: '#999' }}>Velg en analysetype først for å se relevante filtre.</p>;
    }

    const isTrafikkanalyse = analysisType === 'Trafikkanalyse';

    return (
        <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div>
                <label style={filterLabelStyle}>Type periode</label>
                <select value={typePeriode} onChange={(e) => setTypePeriode(e.target.value)} style={selectStyle}>
                    <option value="desember-2025">Desember 2025</option>
                    <option value="november-2025">November 2025</option>
                    <option value="egendefinert">Egendefinert</option>
                </select>
                {typePeriode === 'egendefinert' && (
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginTop: '0.4rem' }}>
                        <input type="date" style={{ ...selectStyle, flex: 1, minWidth: 0, fontSize: '0.75rem', padding: '0.35rem 0.4rem' }} />
                        <span style={{ fontSize: '0.75rem', color: '#888', flexShrink: 0 }}>til</span>
                        <input type="date" style={{ ...selectStyle, flex: 1, minWidth: 0, fontSize: '0.75rem', padding: '0.35rem 0.4rem' }} />
                    </div>
                )}
            </div>
            {isTrafikkanalyse && (
                <div>
                    <label style={filterLabelStyle}>Visning</label>
                    <select value={visning} onChange={(e) => setVisning(e.target.value)} style={selectStyle}>
                        <option value="besokende">Besøkende</option>
                        <option value="sidevisninger">Sidevisninger</option>
                        <option value="andel">Andel (av besøkende)</option>
                    </select>
                </div>
            )}
            {analysisType === 'Brukerlojalitet' && (
                <div>
                    <label style={filterLabelStyle}>Kohortlengde</label>
                    <select style={selectStyle}>
                        <option value="uke">Ukentlig</option>
                        <option value="maned">Månedlig</option>
                    </select>
                </div>
            )}
            {!isTrafikkanalyse && analysisType !== 'Brukerlojalitet' && (
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#999' }}>Filtre for «{analysisType}» er ikke konfigurert i denne prototypen.</p>
            )}
        </div>
    );
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const boxStyle: React.CSSProperties = {
    border: '1px solid #e0e0e0',
    borderRadius: '10px',
    padding: '1rem',
    backgroundColor: '#f9f9f9',
};

const boxTitleStyle: React.CSSProperties = {
    marginBottom: '0.75rem',
    display: 'block',
};

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    borderRadius: '6px',
    border: '1px solid #a0a0a0',
    fontSize: '0.875rem',
    boxSizing: 'border-box',
    backgroundColor: '#fff',
};

const selectStyle: React.CSSProperties = {
    width: '100%',
    padding: '6px 8px',
    borderRadius: '6px',
    border: '1px solid #a0a0a0',
    fontSize: '0.85rem',
    backgroundColor: '#fff',
    color: '#333',
    boxSizing: 'border-box',
};

const filterLabelStyle: React.CSSProperties = {
    fontWeight: 500,
    marginBottom: '4px',
    fontSize: '0.8rem',
    color: '#0067C5',
    display: 'block',
};

const primaryButtonStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.7rem 1rem',
    backgroundColor: '#0067C5',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '0.95rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background-color 0.2s',
};

const secondaryButtonStyle: React.CSSProperties = {
    border: '1px solid #d0d0d0',
    background: '#fff',
    cursor: 'pointer',
    borderRadius: '6px',
    padding: '5px 12px',
    fontSize: '0.85rem',
    color: '#444',
};

const cancelButtonStyle: React.CSSProperties = {
    padding: '0.5rem 1.5rem',
    borderRadius: '6px',
    border: '1px solid #d0d0d0',
    backgroundColor: '#fff',
    color: '#333',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: 500,
};

const dropdownContainerStyle: React.CSSProperties = {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    border: '1px solid #0067C5',
    borderRadius: '6px',
    marginTop: '4px',
    zIndex: 20,
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
};

const tooltipStyle: React.CSSProperties = {
    position: 'absolute',
    right: '28px',
    top: '-5px',
    backgroundColor: '#333',
    color: '#fff',
    padding: '0.5rem 0.75rem',
    borderRadius: '4px',
    fontSize: '0.75rem',
    whiteSpace: 'normal',
    maxWidth: '220px',
    wordWrap: 'break-word',
    zIndex: 30,
    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
    pointerEvents: 'none',
    lineHeight: '1.4',
};
