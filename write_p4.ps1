$f = "c:\Users\PerEr\Documents\Github\jamph-sql-ki-assistent\Jamph-Umami-Frontend\src\pages\analysis\Prototype4.tsx"
$content = @"
import { useState, useEffect, useRef } from "react";
import { getPrototype4Examples } from "./prototype4Examples";

type ChatMessage = { id: string; role: "user" | "bot"; text: string; hasChart?: boolean };

const WEBSITE_ID = "fb69e1e9-1bd3-4fd9-b700-9d035cbf44e1";

const EXAMPLES = getPrototype4Examples(
    WEBSITE_ID,
    "/",
    "aksel.nav.no",
    "AND url_path LIKE '/%'",
    () => ""
);

const EXAMPLE_SESSION_MESSAGES: Record<string, ChatMessage[]> = {};
EXAMPLES.forEach(ex => {
    EXAMPLE_SESSION_MESSAGES[ex.id] = [
        { id: ex.id + "-u", role: "user", text: ex.userMessage },
        { id: ex.id + "-b", role: "bot", text: ex.botReply, hasChart: true },
    ];
});

const NEW_CHAT_ID = "new";

const Prototype4 = () => {
    const [activeChatId, setActiveChatId] = useState<string>(NEW_CHAT_ID);
    const [newChatMessages, setNewChatMessages] = useState<ChatMessage[]>([
        { id: "welcome", role: "bot", text: "Hva kan jeg hjelpe deg med?" }
    ]);
    const [inputText, setInputText] = useState("");
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const isExample = activeChatId !== NEW_CHAT_ID;
    const messages = isExample
        ? (EXAMPLE_SESSION_MESSAGES[activeChatId] ?? [])
        : newChatMessages;

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSendMessage = () => {
        const text = inputText.trim();
        if (!text || isExample) return;
        setInputText("");
        setNewChatMessages(prev => [...prev, { id: crypto.randomUUID(), role: "user" as const, text }]);
    };

    const handleNewChat = () => {
        setActiveChatId(NEW_CHAT_ID);
        setNewChatMessages([{ id: "welcome-" + crypto.randomUUID(), role: "bot", text: "Hva kan jeg hjelpe deg med?" }]);
    };

    return (
        <div style={{ display: "flex", height: "calc(100vh - 120px)", minHeight: 500, background: "#fff" }}>
            <div style={{ width: 220, borderRight: "1px solid #e0e0e0", background: "#f7f7f7", display: "flex", flexDirection: "column", flexShrink: 0 }}>
                <div style={{ padding: "14px 12px 10px", borderBottom: "1px solid #e8e8e8", fontWeight: 600, fontSize: 14 }}>
                    Chats
                </div>
                <div style={{ flex: 1, overflowY: "auto" }}>
                    <button onClick={() => setActiveChatId(NEW_CHAT_ID)} style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 12px", border: "none", borderLeft: activeChatId === NEW_CHAT_ID ? "3px solid #0067C5" : "3px solid transparent", background: activeChatId === NEW_CHAT_ID ? "#e8f0fe" : "transparent", cursor: "pointer", fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        Ny samtale
                    </button>
                    <div style={{ margin: "6px 12px", borderTop: "1px solid #e0e0e0" }} />
                    <div style={{ padding: "2px 12px 6px", fontSize: 11, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        Eksempler
                    </div>
                    {EXAMPLES.map(ex => (
                        <button key={ex.id} onClick={() => setActiveChatId(ex.id)} style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 12px", border: "none", borderLeft: activeChatId === ex.id ? "3px solid #0067C5" : "3px solid transparent", background: activeChatId === ex.id ? "#e8f0fe" : "transparent", cursor: "pointer", fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {ex.title}
                        </button>
                    ))}
                </div>
                <div style={{ padding: "10px 12px", borderTop: "1px solid #e0e0e0" }}>
                    <button onClick={handleNewChat} style={{ width: "100%", padding: "7px", border: "1px solid #c0c0c0", borderRadius: 4, background: "#fff", cursor: "pointer", fontSize: 13 }}>
                        + Ny samtale
                    </button>
                </div>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
                    {messages.map(msg => (
                        <div key={msg.id} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", marginBottom: 16 }}>
                            <div style={{ maxWidth: "70%" }}>
                                <div style={{ padding: "9px 14px", borderRadius: msg.role === "user" ? "12px 12px 0 12px" : "0 12px 12px 12px", background: msg.role === "user" ? "#0067C5" : "#f0f4ff", color: msg.role === "user" ? "#fff" : "#262626", fontSize: 14, lineHeight: 1.5 }}>
                                    {msg.text}
                                </div>
                                {msg.hasChart && (
                                    <div style={{ marginTop: 8, border: "1px solid #d0d8e8", borderRadius: 8, background: "#f8faff", height: 180, display: "flex", alignItems: "center", justifyContent: "center", color: "#aaa", fontSize: 13 }}>
                                        [ Graf / tabell her ]
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>
                <div style={{ padding: "12px 24px", borderTop: "1px solid #e8e8e8", background: "#fafafa", display: "flex", gap: 8, alignItems: "flex-end" }}>
                    <textarea placeholder={isExample ? "Dette er et eksempel - start en ny samtale for å skrive" : "Skriv inn her..."} value={inputText} disabled={isExample} onChange={e => setInputText(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }} rows={2} style={{ flex: 1, padding: "9px 12px", borderRadius: 6, border: "1px solid #c0c0c0", fontSize: 14, resize: "none", fontFamily: "inherit", outline: "none", background: isExample ? "#f5f5f5" : "#fff", color: isExample ? "#aaa" : "#262626" }} />
                    <button onClick={handleSendMessage} disabled={isExample || !inputText.trim()} style={{ padding: "9px 18px", borderRadius: 6, border: "none", background: !isExample && inputText.trim() ? "#0067C5" : "#ccc", color: "#fff", cursor: !isExample && inputText.trim() ? "pointer" : "default", fontSize: 14, fontWeight: 500 }}>
                        Send
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Prototype4;
"@
[System.IO.File]::WriteAllText($f, $content, [System.Text.Encoding]::UTF8)
Write-Host "Done"