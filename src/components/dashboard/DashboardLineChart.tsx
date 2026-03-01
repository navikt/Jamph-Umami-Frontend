import { LineChart, ResponsiveContainer } from '@fluentui/react-charting';
import { useChartDataPrep } from '../../lib/useChartDataPrep';

interface Props {
    result: any;
    title?: string;
}

export default function DashboardLineChart({ result, title = 'Linjediagram' }: Props) {
    const { prepareLineChartData } = useChartDataPrep(result);
    const chartData = prepareLineChartData(false);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fff' }}>
            <div style={{ padding: '8px 12px', borderBottom: '1px solid #e5e7eb', background: '#f9fafb', flexShrink: 0 }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>{title}</span>
            </div>
            <div style={{ flex: 1, padding: '8px', overflow: 'hidden' }}>
                {!chartData
                    ? <p style={{ color: '#6b7280', fontSize: 13, padding: 8 }}>Klarer ikke å vise linjediagram fra dataene.</p>
                    : <ResponsiveContainer>
                        <LineChart
                            data={chartData.data}
                            legendsOverflowText="Flere"
                            yAxisTickCount={8}
                            allowMultipleShapesForPoints={false}
                            enablePerfOptimization={true}
                            margins={{ left: 50, right: 40, top: 10, bottom: 30 }}
                        />
                    </ResponsiveContainer>
                }
            </div>
        </div>
    );
}
