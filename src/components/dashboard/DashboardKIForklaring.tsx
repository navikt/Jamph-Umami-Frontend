import '../../styles/charts.css';

interface Props {
    readonly result: any;
    readonly title?: string;
}

export default function DashboardKIForklaring({ result, title }: Props) {
    const text: string = result?.text ?? '';

    return (
        <div className="widget-card" style={{ flexDirection: 'column', justifyContent: 'flex-start' }}>
            {title && (
                <div className="widget-header">
                    <span className="widget-title">{title}</span>
                </div>
            )}
            <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {text ? (
                    <p style={{ fontSize: 14, lineHeight: 1.75, color: '#1f2937', margin: 0 }}>
                        {text}
                    </p>
                ) : (
                    <p style={{ fontSize: 13, color: '#9ca3af', fontStyle: 'italic', margin: 0 }}>
                        Ingen forklaring tilgjengelig for denne spørringen.
                    </p>
                )}
            </div>
        </div>
    );
}
