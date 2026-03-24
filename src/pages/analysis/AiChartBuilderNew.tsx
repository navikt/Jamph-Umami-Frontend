import { useState, useEffect, useRef } from 'react';
import PinnedWidget from '../../components/dashboard/PinnedWidget';
import { getPrototype4Examples, EXAMPLE_MOCK_DATA } from './prototype4Examples';

type ChatMsg = {
    id: string;
    role: 'user' | 'bot';
    text: string;
    sql?: string;
    result?: any;
    loading?: boolean;
};

const defaultQuery = `SELECT
  website_id,
  name
FROM
  \`fagtorsdag-prod-81a6.umami_student.public_website\`
LIMIT 100;`;

const WEBSITE_ID = 'fb69e1e9-1bd3-4fd9-b700-9d035cbf44e1';
const ALL_EXAMPLES = getPrototype4Examples(WEBSITE_ID, '/', 'aksel.nav.no', "AND url_path LIKE '/%'", () => '');

// First 3 used as chat history (load mock data directly)
const HISTORY = ALL_EXAMPLES.slice(0, 3);
// Next 3 used as example prompts — "beveger" moved to last
const EXAMPLES = [ALL_EXAMPLES[4], ALL_EXAMPLES[5], ALL_EXAMPLES[3]];

const TABS = [
    { value: 'linechart', label: 'Linjediagram' },
    { value: 'barchart', label: 'Stolpediagram' },
    { value: 'table', label: 'Tabell' },
];

export default function AiChartBuilderNew() {
    const [messages, setMessages] = useState<ChatMsg[]>([
        { id: 'welcome', role: 'bot', text: 'Hva kan jeg hjelpe deg med i dag?' },
    ]);
    const [inputText, setInputText] = useState('');
    const [busy, setBusy] = useState(false);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [examplesOpen, setExamplesOpen] = useState(false);
    const [displayResult, setDisplayResult] = useState<any>(null);
    const [displaySql, setDisplaySql] = useState('');
    const [displayTitle, setDisplayTitle] = useState('');
    const [activeTab, setActiveTab] = useState('table');
    const [showSql, setShowSql] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const prevCountRef = useRef(1);
    const shouldScrollRef = useRef(false);

    useEffect(() => {
        if (messages.length > prevCountRef.current && shouldScrollRef.current) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            shouldScrollRef.current = false;
        }
        prevCountRef.current = messages.length;
    }, [messages]);

    const loadExample = (ex: (typeof ALL_EXAMPLES)[0]) => {
        const mockRows = EXAMPLE_MOCK_DATA[ex.id];
        if (!mockRows) return;
        const tab = ex.tabOrder[0] === 'areachart' ? 'linechart'
            : (ex.tabOrder[0] === 'stegvisning' || ex.tabOrder[0] === 'statcards') ? 'table'
            : ex.tabOrder[0];
        const result = { data: mockRows };
        setDisplayResult(result);
        setDisplaySql(ex.sql);
        setDisplayTitle(ex.title);
        setActiveTab(tab);
        setMessages([
            { id: 'welcome', role: 'bot', text: 'Hva kan jeg hjelpe deg med i dag?' },
            { id: ex.id + '-u', role: 'user', text: ex.userMessage },
            { id: ex.id + '-b', role: 'bot', text: ex.botReply, sql: ex.sql, result },
        ]);
    };

    const handleSend = async (text: string, doScroll = false) => {
        if (!text.trim() || busy) return;
        shouldScrollRef.current = doScroll;
        setBusy(true);
        const botId = crypto.randomUUID();
        setMessages(prev => [
            ...prev,
            { id: crypto.randomUUID(), role: 'user', text },
            { id: botId, role: 'bot', text: 'Genererer SQL...', loading: true },
        ]);
        setInputText('');

        let sql = defaultQuery;
        try {
            const res = await fetch(`${import.meta.env.VITE_RAG_API_URL}/api/sql`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: text, model: 'qwen2.5-coder:7b' }),
            });
            const data = await res.json();
            if (data?.sql) {
                sql = data.sql.replace(/```sql\n?/g, '').replace(/```\n?/g, '').trim();
            }
        } catch { /* use defaultQuery */ }

        setMessages(prev => prev.map(m =>
            m.id === botId ? { ...m, text: 'Henter data...' } : m
        ));

        try {
            const res = await fetch('/api/bigquery', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: sql, analysisType: 'AI Builder' }),
            });
            if (!res.ok) throw new Error((await res.json()).error || 'Feil ved henting');
            const data = await res.json();
            setMessages(prev => prev.map(m =>
                m.id === botId
                    ? { ...m, text: 'Her er resultatet:', sql, result: data, loading: false }
                    : m
            ));
            setDisplayResult(data);
            setDisplaySql(sql);
            setDisplayTitle(text);
            setActiveTab('table');
        } catch (e: any) {
            setMessages(prev => prev.map(m =>
                m.id === botId
                    ? { ...m, text: `Beklager, noe gikk galt: ${e.message ?? ''}`, loading: false }
                    : m
            ));
        } finally {
            setBusy(false);
        }
    };

    function renderChart() {
        if (!displayResult) return null;
        return <PinnedWidget result={displayResult} chartType={activeTab} title={displayTitle} />;
    }

    return (
        <div style={{ display: 'flex', height: 'calc(100vh - 64px)', background: '#f5f7fa', overflow: 'hidden' }}>

            {/* LEFT PANEL */}
            <div style={{
                width: 340,
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                background: '#fff',
                borderRight: '1px solid #dde1e7',
            }}>

                {/* Chat-historikk */}
                <div style={{ borderBottom: '1px solid #eaecf0' }}>
                    <button
                        onClick={() => setHistoryOpen(v => !v)}
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            width: '100%', padding: '12px 16px',
                            background: 'none', border: 'none', cursor: 'pointer',
                            fontWeight: 600, fontSize: 13, color: '#1a1a1a',
                        }}
                    >
                        <span>Chat-historikk</span>
                        <span style={{ fontSize: 10, color: '#888', transform: historyOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▼</span>
                    </button>
                    {historyOpen && (
                        <div style={{ padding: '0 16px 12px' }}>
                            {HISTORY.map(h => (
                                <button key={h.id} onClick={() => loadExample(h)}
                                    style={{
                                        display: 'block', width: '100%', textAlign: 'left',
                                        padding: '5px 10px', marginBottom: 3,
                                        background: '#fff', border: '1px solid #dde1e7',
                                        borderRadius: 4, cursor: 'pointer', fontSize: 12, color: '#333',
                                    }}>
                                    - {h.userMessage.length > 50 ? h.userMessage.slice(0, 50) + '...' : h.userMessage}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Eksempelspørsmål */}
                <div style={{ borderBottom: '1px solid #eaecf0' }}>
                    <button
                        onClick={() => setExamplesOpen(v => !v)}
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            width: '100%', padding: '12px 16px',
                            background: 'none', border: 'none', cursor: 'pointer',
                            fontWeight: 600, fontSize: 13, color: '#1a1a1a',
                        }}
                    >
                        <span>Eksempelspørsmål</span>
                        <span style={{ fontSize: 10, color: '#888', transform: examplesOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▼</span>
                    </button>
                    {examplesOpen && (
                        <div style={{ padding: '0 16px 12px' }}>
                            {EXAMPLES.map(ex => (
                                <button key={ex.id} onClick={() => loadExample(ex)}
                                    style={{
                                        display: 'block', width: '100%', textAlign: 'left',
                                        padding: '5px 10px', marginBottom: 3,
                                        background: '#fff', border: '1px solid #dde1e7',
                                        borderRadius: 4, cursor: 'pointer', fontSize: 12, color: '#333',
                                    }}>
                                    - {ex.userMessage.length > 50 ? ex.userMessage.slice(0, 50) + '...' : ex.userMessage}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Messages */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
                    {messages.map(msg => (
                        <div key={msg.id} style={{ marginBottom: 10 }}>
                            {msg.role === 'user' ? (
                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    <div style={{
                                        background: '#0067C5', color: '#fff',
                                        padding: '8px 12px', borderRadius: '12px 12px 2px 12px',
                                        fontSize: 13, maxWidth: '90%', wordBreak: 'break-word',
                                    }}>
                                        {msg.text}
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <div style={{
                                        background: msg.loading ? '#f5f5f5' : '#eef2ff',
                                        padding: '8px 12px', borderRadius: '2px 12px 12px 12px',
                                        fontSize: 13, color: '#1a1a1a',
                                        fontStyle: msg.loading ? 'italic' : 'normal',
                                    }}>
                                        {msg.text}
                                        {!msg.loading && msg.result && (
                                            <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
                                                Graftype: <strong>Linjediagram</strong>
                                                {msg.sql && (
                                                    <span style={{ marginLeft: 10 }}>
                                                        Periode: 2017–2021
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                </div>
                            )}
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div style={{
                    padding: '12px 16px',
                    borderTop: '1px solid #eaecf0',
                    display: 'flex', gap: 8, alignItems: 'center',
                    background: '#fafafa',
                }}>
                    <input
                        type="text"
                        value={inputText}
                        onChange={e => setInputText(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !busy) handleSend(inputText, true); }}
                        placeholder="Skriv inn din forespørsel her..."
                        disabled={busy}
                        style={{
                            flex: 1, padding: '8px 12px',
                            border: '1px solid #c0c0c0', borderRadius: 4,
                            fontSize: 13, outline: 'none',
                            background: busy ? '#f5f5f5' : '#fff',
                        }}
                    />
                    <button
                        onClick={() => handleSend(inputText, true)}
                        disabled={!inputText.trim() || busy}
                        style={{
                            padding: '8px 18px',
                            background: !inputText.trim() || busy ? '#ccc' : '#0067C5',
                            color: '#fff', border: 'none', borderRadius: 4,
                            cursor: !inputText.trim() || busy ? 'default' : 'pointer',
                            fontSize: 13, fontWeight: 600,
                        }}>
                        Send
                    </button>
                </div>
            </div>

            {/* RIGHT PANEL */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

                {/* Chart type tabs */}
                <div style={{
                    display: 'flex', alignItems: 'center',
                    borderBottom: '1px solid #dde1e7',
                    background: '#fff',
                    padding: '0 16px',
                    flexShrink: 0,
                    gap: 4,
                }}>
                    {TABS.map(t => (
                        <button key={t.value} onClick={() => setActiveTab(t.value)}
                            style={{
                                padding: '10px 18px',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: 13,
                                background: activeTab === t.value ? '#0067C5' : 'transparent',
                                color: activeTab === t.value ? '#fff' : '#555',
                                fontWeight: activeTab === t.value ? 600 : 400,
                                borderRadius: activeTab === t.value ? '6px 6px 0 0' : 0,
                            }}>
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* Chart/table area */}
                <div style={{ flex: 1, overflow: 'auto', padding: 20, minHeight: 0, background: '#fff' }}>
                    {displayResult ? renderChart() : (
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            height: '100%', color: '#aaa', fontSize: 14,
                        }}>
                            Still et spørsmål for å se resultater her
                        </div>
                    )}
                </div>

                {/* SQL panel */}
                {displaySql && (
                    <div style={{
                        borderTop: '1px solid #dde1e7',
                        background: '#fafafa',
                        flexShrink: 0,
                        maxHeight: showSql ? 240 : 44,
                        overflow: 'hidden',
                        transition: 'max-height 0.2s ease',
                    }}>
                        <div style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '10px 20px',
                        }}>
                            <span style={{ fontWeight: 600, fontSize: 13 }}>SQL-spørring</span>
                            <button onClick={() => setShowSql(v => !v)}
                                style={{
                                    fontSize: 12, border: '1px solid #c0c0c0', borderRadius: 4,
                                    padding: '3px 12px', background: '#fff', cursor: 'pointer',
                                }}>
                                {showSql ? 'Skjul SQL' : 'Vis SQL'}
                            </button>
                        </div>
                        {showSql && (
                            <pre style={{
                                margin: 0, padding: '0 20px 16px',
                                fontSize: 12, fontFamily: 'monospace',
                                whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                                overflowY: 'auto', maxHeight: 180, color: '#333',
                            }}>
                                {displaySql}
                            </pre>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
