import { VerticalBarChart, IVerticalBarChartDataPoint, ResponsiveContainer } from '@fluentui/react-charting';
import '../../../../../styles/charts.css';
import { useChartDataPrep } from '../../../../../lib/useChartDataPrep';

interface Props {
    result: any;
    title?: string;
}

export default function DashboardBarChart({ result, title = 'Stolpediagram' }: Props) {
    const { prepareBarChartData } = useChartDataPrep(result);
    const chartData = prepareBarChartData();

    let displayData: IVerticalBarChartDataPoint[] = [];
    if (chartData && Array.isArray(chartData.data)) {
        if (chartData.data.length > 12) {
            const top11 = chartData.data.slice(0, 11);
            const others = chartData.data.slice(11);
            const otherSum = others.reduce((sum: number, item: IVerticalBarChartDataPoint) => sum + (item.y as number), 0);
            displayData = [...top11, { x: 'Andre', y: otherSum }];
        } else {
            displayData = chartData.data;
        }
    }

    const hasValidData = displayData.some(item => !Number.isNaN(item.y) && typeof item.y === 'number' && item.y !== 0);

    return (
        <div className="widget-card">
            <div className="widget-header">
                <span className="widget-title">{title}</span>
            </div>
            <div className="widget-body">
                {!chartData || !hasValidData
                    ? <p style={{ color: '#6b7280', fontSize: 13, padding: 8 }}>Klarer ikke å vise stolpediagram fra dataene.</p>
                    : <>
                        <style>{`
                            .db-bar-hide-xaxis .ms-Chart-xAxis text,
                            .db-bar-hide-xaxis g[class*="xAxis"] text { display: none !important; }
                        `}</style>
                        <div className="db-bar-hide-xaxis" style={{ width: '100%', height: '100%' }}>
                            <ResponsiveContainer>
                                <VerticalBarChart
                                    data={displayData}
                                    barWidth={chartData.barWidth}
                                    yAxisTickCount={chartData.yAxisTickCount}
                                    margins={{ left: 50, right: 40, top: 20, bottom: 35 }}
                                />
                            </ResponsiveContainer>
                        </div>
                    </>
                }
            </div>
            {hasValidData && (
                <div style={{ padding: '2px 12px 6px', fontSize: 11, color: '#6b7280' }}>
                    Viser {displayData.length} kategorier (hold markøren over stolpene for detaljer)
                </div>
            )}
        </div>
    );
}
