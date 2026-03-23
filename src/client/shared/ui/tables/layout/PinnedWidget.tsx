/**
 * PinnedWidget — renders a frozen AI-bygger result in the Prototype3 pinned grid.
 * Dispatches to the correct isolated dashboard component based on chartType.
 * All children receive `height: 100%` / `position: absolute` from the parent cell,
 * so each component only needs to worry about filling its container.
 * If result is null but sql is provided, auto-fetches from /api/bigquery on mount.
 */
import { useState, useEffect } from 'react';
import { resolveViewType } from '../viewTypes/viewTypeRegistry';

interface PinnedWidgetProps {
    readonly result: any;
    readonly sql?: string;
    readonly chartType: string;
    readonly colSpan?: number;
    readonly rowSpan?: number;
    readonly title?: string;
}

export default function PinnedWidget({ result: initialResult, sql, chartType, colSpan = 1, rowSpan = 1, title }: PinnedWidgetProps) {
    const [result, setResult] = useState(initialResult);
    const [loading, setLoading] = useState(!initialResult && !!sql);
    const [fetchError, setFetchError] = useState(false);

    useEffect(() => {
        if (initialResult || !sql) return;
        setLoading(true);
        setFetchError(false);
        fetch('/api/bigquery', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: sql, analysisType: 'Dashboard widget' }),
        })
            .then(r => r.json())
            .then(data => setResult(data))
            .catch(() => setFetchError(true))
            .finally(() => setLoading(false));
    }, [sql]);

    if (loading) {
        return (
            <div className="widget-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 13 }}>
                Laster...
            </div>
        );
    }

    if (fetchError) {
        return (
            <div className="widget-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', fontSize: 13 }}>
                Kunne ikke laste data
            </div>
        );
    }

    const viewType = resolveViewType(chartType);
    return viewType.render({ result, chartType, colSpan, rowSpan, title });
}
