/**
 * WidgetVisning — a bare page that renders a single dashboard widget with no chrome.
 * Used for "Kopier delbar lenke" from ShareWidgetModal.
 * Reads: ?sql=...&chartType=...&title=...&cols=...&rows=...
 */
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import PinnedWidget from '../../components/dashboard/PinnedWidget';
import '../../styles/charts.css';

export default function WidgetVisning() {
    const [searchParams] = useSearchParams();

    const sql = searchParams.get('sql') ?? '';
    const chartType = searchParams.get('chartType') ?? 'table';
    const title = searchParams.get('title') ?? '';
    const cols = Number.parseInt(searchParams.get('cols') ?? '2', 10);
    const rows = Number.parseInt(searchParams.get('rows') ?? '1', 10);

    const COL_PX = 600;
    const ROW_PX = 400;
    const widgetW = cols * COL_PX;
    const widgetH = rows * ROW_PX;

    const [result, setResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!sql) { setError('Ingen SQL-spørring i lenken.'); return; }
        setLoading(true);
        fetch('/api/bigquery', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: sql, analysisType: 'Widget-deling' }),
        })
            .then(async r => {
                const d = await r.json();
                if (!r.ok) throw new Error(d.error || 'Spørringen feilet');
                return d;
            })
            .then(d => setResult(d))
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    }, [sql]);

    if (!sql) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#6b7280', fontSize: 14 }}>
                Ingen spørring funnet i lenken.
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#ef4444', fontSize: 14 }}>
                {error}
            </div>
        );
    }

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            background: '#f3f4f6',
            padding: 32,
            boxSizing: 'border-box',
        }}>
            <div style={{
                width: Math.min(widgetW, window.innerWidth - 64),
                height: widgetH,
                position: 'relative',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                borderRadius: 8,
                overflow: 'hidden',
            }}>
                {loading
                    ? (
                        <div className="widget-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af', fontSize: 13 }}>
                            Laster data...
                        </div>
                    )
                    : <PinnedWidget result={result} sql={undefined} chartType={chartType} title={title} colSpan={cols} rowSpan={rows} />
                }
            </div>
        </div>
    );
}
