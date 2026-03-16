/**
 * DashboardPieChart — frozen pie chart for the Prototype3 pinned grid.
 * wide=false (1×2): pie top, legend below.
 * wide=true  (2×1): pie left, legend right.
 */
import { PieChart, ResponsiveContainer } from '@fluentui/react-charting';
import '../../styles/charts.css';

interface Props {
    result: any;
    title?: string;
    wide?: boolean;
}

// Fluent PieChart assigns colours in this order internally
const COLORS = ['#0067C5','#52A0E4','#23A98D','#FF9100','#C30000','#7F4FCF','#00857C','#D05C17'];

const hideLabelsStyle = `
  .pie-chart-wrapper text[class*="pieLabel"],
  .pie-chart-wrapper g[class*="arc"] text { opacity: 0 !important; pointer-events: none !important; }
`;

export default function DashboardPieChart({ result, title, wide = false }: Props) {
    const rows: any[] = result?.data ?? [];
    if (!rows.length) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#888', fontSize: 13 }}>
                Ingen data
            </div>
        );
    }

    const keys = Object.keys(rows[0]);
    const labelKey = keys[0];
    const valueKey = keys[1] ?? keys[0];

    // @fluentui/react-charting PieChart expects { x: string, y: number }[]
    const allData = rows.map((r) => ({
        x: String(r[labelKey] ?? ''),
        y: Number(r[valueKey]) || 0,
    }));

    // Cap at 12 slices, group remainder as "Andre" (same as ResultsPanel)
    const data = allData.length > 12
        ? [...allData.slice(0, 11), { x: 'Andre', y: allData.slice(11).reduce((s, d) => s + d.y, 0) }]
        : allData;

    const total = data.reduce((s, d) => s + d.y, 0);

    const Legend = () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, overflowY: 'auto', padding: '4px 10px' }}>
            {data.map((d, i) => (
                <div key={d.x} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#333', minWidth: 0 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.x}</span>
                    <span style={{ marginLeft: 'auto', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                        {total > 0 ? `${((d.y / total) * 100).toFixed(1)}%` : d.y.toLocaleString('nb-NO')}
                    </span>
                </div>
            ))}
        </div>
    );

    if (wide) {
        // 2×1: pie left, legend right
        return (
            <div className="widget-card" style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', minWidth: 0 }}>
                <div className="widget-header">
                    <span className="widget-title">{title}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'row', flex: 1, minWidth: 0, overflow: 'hidden' }}>
                <style>{hideLabelsStyle}</style>
                <div className="pie-chart-wrapper" style={{ flex: '0 0 55%', position: 'relative', minWidth: 0 }}>
                    <div style={{ position: 'absolute', inset: 0 }}>
                        <ResponsiveContainer>
                            <PieChart data={data} chartTitle="" />
                        </ResponsiveContainer>
                    </div>
                </div>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <Legend />
                </div>
            </div>
        </div>
        );
    }

    // 1×2: pie top, legend below
    return (
        <div className="widget-card" style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', minWidth: 0 }}>
            <div className="widget-header">
                <span className="widget-title">{title}</span>
            </div>
            <style>{hideLabelsStyle}</style>
            <div className="pie-chart-wrapper" style={{ flex: '0 0 60%', position: 'relative', minWidth: 0 }}>
                <div style={{ position: 'absolute', inset: 0 }}>
                    <ResponsiveContainer>
                        <PieChart data={data} chartTitle="" />
                    </ResponsiveContainer>
                </div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <Legend />
            </div>
        </div>
    );
}
