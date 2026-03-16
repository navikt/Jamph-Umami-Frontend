import { LineChart, ResponsiveContainer } from '@fluentui/react-charting';
import '../../styles/charts.css';
import { useChartDataPrep } from '../../lib/useChartDataPrep';

interface Props {
    result: any;
    title?: string;
}

export default function DashboardLineChart({ result, title = 'Linjediagram' }: Props) {
    const { prepareLineChartData } = useChartDataPrep(result);
    const chartData = prepareLineChartData(false);

    return (
        <div className="widget-card">
            <div className="widget-header">
                <span className="widget-title">{title}</span>
            </div>
            <div className="widget-body">
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
