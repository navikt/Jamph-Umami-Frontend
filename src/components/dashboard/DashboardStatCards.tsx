/**
 * DashboardStatCards — maks 4 nøkkeltallskort.
 * Alle kort behandles likt — ingen "total"-referanse, ingen prosentberegning.
 */
import '../../styles/charts.css';

interface Props {
    result: any;
    title?: string;
}

const CARD_COLORS = [
    // pos 0: blå
    {
        bg: '#eff6ff',
        border: '#bfdbfe',
        label: '#1d4ed8',
        value: '#1d4ed8',
    },
    // pos 1: grønn
    {
        bg: '#f0fdf4',
        border: '#bbf7d0',
        label: '#15803d',
        value: '#15803d',
    },
    // pos 2: amber
    {
        bg: '#fffbeb',
        border: '#fde68a',
        label: '#b45309',
        value: '#b45309',
    },
    // pos 3: rød
    {
        bg: '#fff1f2',
        border: '#fecdd3',
        label: '#991b1b',
        value: '#991b1b',
    },
];

export default function DashboardStatCards({ result, title }: Props) {
    const rows: any[] = (result?.data ?? []).slice(0, 4);

    if (!rows.length) {
        return (
            <div className="widget-card">
                {title && <div className="widget-header"><span className="widget-title">{title}</span></div>}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: '#9ca3af', fontSize: 13 }}>
                    Ingen data
                </div>
            </div>
        );
    }

    const keys = Object.keys(rows[0]);
    const labelKey = keys[0];
    const valueKey = keys[1] ?? keys[0];

    return (
        <div className="widget-card">
            {title && <div className="widget-header"><span className="widget-title">{title}</span></div>}
            <div style={{ display: 'flex', flex: 1, gap: 12, padding: 12, overflow: 'hidden' }}>
                {rows.map((row, i) => {
                    const color = CARD_COLORS[i % CARD_COLORS.length];
                    const rawValue = Number(row[valueKey]);
                    const displayValue = isNaN(rawValue)
                        ? String(row[valueKey])
                        : rawValue.toLocaleString('nb-NO');

                    return (
                        <div
                            key={String(row[labelKey])}
                            style={{
                                flex: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6,
                                padding: '16px 8px',
                                background: color.bg,
                                border: `1.5px solid ${color.border}`,
                                borderRadius: 12,
                                minWidth: 0,
                                textAlign: 'center',
                            }}
                        >
                            <span style={{ fontSize: 12, fontWeight: 600, color: color.label, lineHeight: 1.3 }}>
                                {String(row[labelKey])}
                            </span>
                            <span style={{ fontSize: 32, fontWeight: 700, color: color.value, lineHeight: 1.1 }}>
                                {displayValue}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
