import { useState, useEffect, useRef } from "react";
import { getPrototype4Examples, EXAMPLE_MOCK_DATA } from "./prototype4Examples";
import DashboardTable from "../../components/dashboard/DashboardTable";
import DashboardBarChart from "../../components/dashboard/DashboardBarChart";
import DashboardLineChart from "../../components/dashboard/DashboardLineChart";
import DashboardAreaChart from "../../components/dashboard/DashboardAreaChart";
import DashboardPieChart from "../../components/dashboard/DashboardPieChart";
import DownloadResultsModal from "../../components/chartbuilder/results/DownloadResultsModal";
import ShareWidgetModal from "../../components/analysis/ShareWidgetModal";

type ChatMessage = {
    id: string;
    role: "user" | "bot";
    text: string;
    chart?: { tabOrder: string[]; data: Record<string, unknown>[]; title: string; sql?: string };
    explanation?: string;
};

const WEBSITE_ID = "fb69e1e9-1bd3-4fd9-b700-9d035cbf44e1";

const EXAMPLES = getPrototype4Examples(
    WEBSITE_ID, "/", "aksel.nav.no", "AND url_path LIKE '/%'", () => ""
);

const RENDERABLE_TABS = new Set(['linechart', 'areachart', 'barchart', 'piechart', 'table']);
const TAB_LABELS: Record<string, string> = {
    linechart: 'Linje', areachart: 'Areal', barchart: 'Stolpe', piechart: 'Kake', table: 'Tabell',
};

function ChartCard({ tabOrder, data, title, sql }: Readonly<{ tabOrder: string[]; data: Record<string, unknown>[]; title: string; sql?: string }>) {
    const tabs = tabOrder.filter(t => RENDERABLE_TABS.has(t));
    const [activeTab, setActiveTab] = useState(tabs[0] ?? 'table');
    const [downloadOpen, setDownloadOpen] = useState(false);
    const [shareOpen, setShareOpen] = useState(false);
    const result = { data };

    function renderChart() {
        if (activeTab === 'barchart') return <DashboardBarChart result={result} title={title} />;
        if (activeTab === 'linechart') return <DashboardLineChart result={result} title={title} />;
        if (activeTab === 'areachart') return <DashboardAreaChart result={result} title={title} />;
        if (activeTab === 'piechart') return <DashboardPieChart result={result} title={title} wide={true} />;
        return <DashboardTable data={data} title={title} />;
    }

    return (
        <>
        <div style={{ border: '1px solid #dde1e7', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
            {/* Tab bar */}
            <div style={{ display: 'flex', borderBottom: '1px solid #dde1e7', background: '#fafafa', padding: '0 8px', gap: 2 }}>
                {tabs.map(t => (
                    <button key={t} onClick={() => setActiveTab(t)} style={{
                        padding: '7px 14px', border: 'none', cursor: 'pointer', fontSize: 12,
                        background: activeTab === t ? '#0067C5' : 'transparent',
                        color: activeTab === t ? '#fff' : '#555',
                        fontWeight: activeTab === t ? 600 : 400,
                        borderRadius: activeTab === t ? '4px 4px 0 0' : 0,
                    }}>
                        {TAB_LABELS[t] ?? t}
                    </button>
                ))}
            </div>
            {/* Chart */}
            <div style={{ height: 300, padding: 8 }}>
                {renderChart()}
            </div>
            {/* Del / Lagre */}
            <div style={{ display: 'flex', gap: 8, padding: '8px 12px', borderTop: '1px solid #dde1e7', background: '#fafafa' }}>
                <button onClick={() => setShareOpen(true)} style={{
                    padding: '5px 16px', fontSize: 12, border: '1px solid #0067C5',
                    borderRadius: 4, background: '#0067C5', color: '#fff', cursor: 'pointer', fontWeight: 600,
                }}>Del</button>
                <button onClick={() => setDownloadOpen(true)} style={{
                    padding: '5px 16px', fontSize: 12, border: '1px solid #0067C5',
                    borderRadius: 4, background: '#fff', color: '#0067C5', cursor: 'pointer', fontWeight: 600,
                }}>Lagre</button>
            </div>
        </div>
        <DownloadResultsModal
            result={result} open={downloadOpen} onClose={() => setDownloadOpen(false)}
            chartType={activeTab} title={title}
        />
        <ShareWidgetModal
            open={shareOpen} onClose={() => setShareOpen(false)}
            sql={sql ?? ''} chartType={activeTab} defaultTitle={title}
            sizes={[{ cols: 1, rows: 1, name: '1x1' }, { cols: 2, rows: 1, name: '2x1' }, { cols: 1, rows: 2, name: '1x2' }]}
            result={result}
        />
        </>
    );
}

const EXAMPLE_MESSAGES: Record<string, ChatMessage[]> = {};
EXAMPLES.forEach(ex => {
    EXAMPLE_MESSAGES[ex.id] = [
        { id: ex.id + "-w", role: "bot", text: "Hva kan jeg hjelpe deg med?" },
        { id: ex.id + "-u", role: "user", text: ex.userMessage },
        {
            id: ex.id + "-b",
            role: "bot",
            text: ex.botReply,
            chart: EXAMPLE_MOCK_DATA[ex.id]
                ? { tabOrder: ex.tabOrder, data: EXAMPLE_MOCK_DATA[ex.id], title: ex.title, sql: ex.sql }
                : undefined,
            explanation: ex.explanation,
        },
    ];
});

const NEW_CHAT_ID = "new";

const Prototype4 = () => {
    const [activeChatId, setActiveChatId] = useState<string>(NEW_CHAT_ID);
    const [sessionMessages, setSessionMessages] = useState<Record<string, ChatMessage[]>>(() => {
        const init: Record<string, ChatMessage[]> = {
            [NEW_CHAT_ID]: [{ id: "welcome", role: "bot", text: "Hva kan jeg hjelpe deg med?" }],
        };
        EXAMPLES.forEach(ex => { init[ex.id] = [...EXAMPLE_MESSAGES[ex.id]]; });
        return init;
    });
    const [inputText, setInputText] = useState("");
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const shouldScrollRef = useRef(false);

    const messages = sessionMessages[activeChatId] ?? [];

    useEffect(() => {
        if (shouldScrollRef.current) {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
            shouldScrollRef.current = false;
        }
    }, [messages]);

    const handleSendMessage = () => {
        const text = inputText.trim();
        if (!text) return;
        setInputText("");
        shouldScrollRef.current = true;
        setSessionMessages(prev => ({
            ...prev,
            [activeChatId]: [...(prev[activeChatId] ?? []), { id: crypto.randomUUID(), role: "user" as const, text }],
        }));
    };

    const handleNewChat = () => {
        const id = crypto.randomUUID();
        setSessionMessages(prev => ({
            ...prev,
            [id]: [{ id: "w-" + id, role: "bot", text: "Hva kan jeg hjelpe deg med?" }],
        }));
        setActiveChatId(id);
    };

    return (
        <div style={{ display: "flex", height: "calc(100vh - 120px)", minHeight: 500, background: "#fff" }}>

            {/* Sidebar */}
            <div style={{ width: 220, borderRight: "1px solid #e0e0e0", background: "#f7f7f7", display: "flex", flexDirection: "column", flexShrink: 0 }}>
                <div style={{ padding: "14px 12px 10px", borderBottom: "1px solid #e8e8e8", fontWeight: 600, fontSize: 14 }}>
                    Chats
                </div>
                <div style={{ flex: 1, overflowY: "auto" }}>
                    {/* Ny samtale */}
                    <button
                        onClick={() => setActiveChatId(NEW_CHAT_ID)}
                        style={{
                            display: "block", width: "100%", textAlign: "left",
                            padding: "10px 12px", border: "none",
                            borderLeft: activeChatId === NEW_CHAT_ID ? "3px solid #0067C5" : "3px solid transparent",
                            background: activeChatId === NEW_CHAT_ID ? "#e8f0fe" : "transparent",
                            cursor: "pointer", fontSize: 13,
                            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                        }}>
                        Ny samtale
                    </button>
                    {EXAMPLES.map(ex => (
                        <button
                            key={ex.id}
                            onClick={() => setActiveChatId(ex.id)}
                            style={{
                                display: "block", width: "100%", textAlign: "left",
                                padding: "9px 12px", border: "none",
                                borderLeft: activeChatId === ex.id ? "3px solid #0067C5" : "3px solid transparent",
                                background: activeChatId === ex.id ? "#e8f0fe" : "transparent",
                                cursor: "pointer", fontSize: 13,
                                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                            }}>
                            {ex.title}
                        </button>
                    ))}
                </div>
                <div style={{ padding: "10px 12px", borderTop: "1px solid #e0e0e0" }}>
                    <button
                        onClick={handleNewChat}
                        style={{ width: "100%", padding: "7px", border: "1px solid #c0c0c0", borderRadius: 4, background: "#fff", cursor: "pointer", fontSize: 13 }}>
                        + Ny samtale
                    </button>
                </div>
            </div>

            {/* Chat area */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
                    {messages.map(msg => (
                        <div key={msg.id} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", marginBottom: 16 }}>
                            <div style={{ maxWidth: msg.chart ? "85%" : "70%" }}>
                                <div style={{
                                    padding: "9px 14px",
                                    borderRadius: msg.role === "user" ? "12px 12px 0 12px" : "0 12px 12px 12px",
                                    background: msg.role === "user" ? "#0067C5" : "#f0f4ff",
                                    color: msg.role === "user" ? "#fff" : "#262626",
                                    fontSize: 14, lineHeight: 1.5,
                                }}>
                                    {msg.text}
                                </div>
                                {msg.chart && (
                                    <div style={{ marginTop: 8 }}>
                                        <ChartCard
                                            tabOrder={msg.chart.tabOrder}
                                            data={msg.chart.data}
                                            title={msg.chart.title}
                                            sql={msg.chart.sql}
                                        />
                                    </div>
                                )}
                                {msg.explanation && (
                                    <div style={{
                                        marginTop: 8, padding: "10px 14px",
                                        borderRadius: "0 12px 12px 12px",
                                        background: "#f0f4ff",
                                        color: "#262626", fontSize: 13, lineHeight: 1.6,
                                        borderLeft: "3px solid #0067C5",
                                    }}>
                                        <span style={{ fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: "#0067C5", display: "block", marginBottom: 4 }}>KI-analyse</span>
                                        {msg.explanation}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>
                <div style={{ padding: "12px 24px", borderTop: "1px solid #e8e8e8", background: "#fafafa", display: "flex", gap: 8, alignItems: "flex-end" }}>
                    <textarea
                        placeholder="Skriv inn her..."
                        value={inputText}
                        onChange={e => setInputText(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                        rows={2}
                        style={{
                            flex: 1, padding: "9px 12px", borderRadius: 6, border: "1px solid #c0c0c0",
                            fontSize: 14, resize: "none", fontFamily: "inherit", outline: "none",
                            background: "#fff", color: "#262626",
                        }}
                    />
                    <button
                        onClick={handleSendMessage}
                        disabled={!inputText.trim()}
                        style={{
                            padding: "9px 18px", borderRadius: 6, border: "none",
                            background: inputText.trim() ? "#0067C5" : "#ccc",
                            color: "#fff",
                            cursor: inputText.trim() ? "pointer" : "default",
                            fontSize: 14, fontWeight: 500,
                        }}>
                        Send
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Prototype4;