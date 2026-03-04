import { useState, useEffect, useRef } from "react";
import { Chat, Button, Textarea, VStack } from "@navikt/ds-react";
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
                <Button size="small" variant="primary" onClick={() => setShareOpen(true)}>Del datafremstilling</Button>
                <Button size="small" variant="secondary" onClick={() => setDownloadOpen(true)}>Last ned</Button>
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
                    <Button onClick={handleNewChat} variant="secondary" size="small" style={{ width: "100%" }}>
                        + Ny samtale
                    </Button>
                </div>
            </div>

            {/* Chat area */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
                    <VStack gap="space-4">
                        {messages.map(msg => msg.role === "user" ? (
                            <Chat key={msg.id} name="Deg" position="right" data-color="brand-beige" size="small">
                                <Chat.Bubble>{msg.text}</Chat.Bubble>
                            </Chat>
                        ) : (
                            <Chat key={msg.id} avatar="KI" name="KI bygger" data-color="brand-blue" size="small">
                                <Chat.Bubble>{msg.text}</Chat.Bubble>
                                {msg.chart && (
                                    <Chat.Bubble>
                                        <ChartCard
                                            tabOrder={msg.chart.tabOrder}
                                            data={msg.chart.data}
                                            title={msg.chart.title}
                                            sql={msg.chart.sql}
                                        />
                                    </Chat.Bubble>
                                )}
                                {msg.explanation && (
                                    <Chat.Bubble>
                                        <span style={{ fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 4 }}>KI-analyse</span>
                                        {msg.explanation}
                                    </Chat.Bubble>
                                )}
                            </Chat>
                        ))}
                    </VStack>
                    <div ref={messagesEndRef} />
                </div>
                <div style={{ padding: "12px 24px", borderTop: "1px solid #e8e8e8", background: "#fafafa", display: "flex", gap: 8, alignItems: "flex-end" }}>
                    <div style={{ flex: 1 }}>
                        <Textarea
                            label=""
                            hideLabel
                            placeholder="Skriv inn her..."
                            value={inputText}
                            onChange={e => setInputText(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                            minRows={2}
                            maxRows={4}
                            resize={false}
                        />
                    </div>
                    <Button
                        onClick={handleSendMessage}
                        disabled={!inputText.trim()}
                        variant="primary"
                    >
                        Send
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default Prototype4;