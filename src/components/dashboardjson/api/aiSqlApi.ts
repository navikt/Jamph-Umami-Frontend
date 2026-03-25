const DEFAULT_LLM_MODEL = 'qwen2.5-coder:7b';

function stripMarkdownCodeFences(input: string): string {
    return input
        .replaceAll(/```sql\r?\n?/gi, '')
        .replaceAll(/```\r?\n?/g, '')
        .trim();
}

function asRecord(data: unknown): Record<string, unknown> | null {
    if (!data || typeof data !== 'object') {
        return null;
    }

    return data as Record<string, unknown>;
}

function extractResponseField(payload: Record<string, unknown>): string | null {
    return typeof payload.response === 'string' ? stripMarkdownCodeFences(payload.response) : null;
}

function parseSqlValue(sqlValue: unknown): string | null {
    if (typeof sqlValue === 'string') {
        try {
            const parsed = JSON.parse(sqlValue);
            const parsedRecord = asRecord(parsed);
            if (!parsedRecord) {
                return stripMarkdownCodeFences(sqlValue);
            }

            return extractResponseField(parsedRecord) ?? stripMarkdownCodeFences(sqlValue);
        } catch {
            return stripMarkdownCodeFences(sqlValue);
        }
    }

    const sqlRecord = asRecord(sqlValue);
    if (!sqlRecord) {
        return null;
    }

    return extractResponseField(sqlRecord);
}

function parseSqlFromResponse(data: unknown): string | null {
    const payload = asRecord(data);
    if (!payload) {
        return null;
    }

    const directResponse = extractResponseField(payload);
    if (directResponse) {
        return directResponse;
    }

    if (!('sql' in payload)) {
        return null;
    }

    return parseSqlValue(payload.sql);
}

export async function generateSqlFromPrompt(prompt: string): Promise<string> {
    const ragApiBase = import.meta.env.VITE_RAG_API_URL;

    if (!ragApiBase) {
        throw new Error('Mangler VITE_RAG_API_URL for LLM-kall.');
    }

    const response = await fetch(`${ragApiBase}/api/sql`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            query: prompt,
            model: DEFAULT_LLM_MODEL,
        }),
    });

    const data = await response.json();

    if (!response.ok) {
        const message = typeof data?.error === 'string' ? data.error : 'LLM-kall feilet';
        throw new Error(message);
    }

    const sql = parseSqlFromResponse(data);

    if (!sql) {
        throw new Error('Fant ingen SQL i LLM-responsen.');
    }

    return sql;
}
