export interface BigQueryQueryStats {
    totalBytesProcessed?: number;
    totalBytesProcessedGB?: string;
    estimatedCostUSD?: string;
}

export interface BigQueryQueryResponse {
    success: boolean;
    data: unknown[];
    rowCount: number;
    queryStats?: BigQueryQueryStats | null;
}

export async function executeBigQueryQuery(query: string, analysisType = 'Kunstig intelligens bygger'): Promise<BigQueryQueryResponse> {
    const response = await fetch('/api/bigquery', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, analysisType }),
    });

    const data = await response.json();

    if (!response.ok) {
        const message = typeof data?.error === 'string' ? data.error : 'Klarte ikke kjore BigQuery-sporring';
        throw new Error(message);
    }

    return data as BigQueryQueryResponse;
}

export async function estimateBigQueryQuery(query: string, analysisType = 'Kunstig intelligens bygger'): Promise<BigQueryQueryStats | null> {
    const response = await fetch('/api/bigquery/estimate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, analysisType }),
    });

    const data = await response.json();

    if (!response.ok) {
        const message = typeof data?.error === 'string' ? data.error : 'Klarte ikke estimere kostnad';
        throw new Error(message);
    }

    return {
        totalBytesProcessed: data.totalBytesProcessed,
        totalBytesProcessedGB: data.totalBytesProcessedGB,
        estimatedCostUSD: data.estimatedCostUSD,
    };
}
