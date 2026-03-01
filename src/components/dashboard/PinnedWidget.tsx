/**
 * PinnedWidget — renders a frozen AI-bygger result in the Prototype3 pinned grid.
 * Dispatches to the correct isolated dashboard component based on chartType.
 * All children receive `height: 100%` / `position: absolute` from the parent cell,
 * so each component only needs to worry about filling its container.
 */
import DashboardTable from './DashboardTable';
import DashboardLineChart from './DashboardLineChart';
import DashboardAreaChart from './DashboardAreaChart';
import DashboardBarChart from './DashboardBarChart';
import DashboardJourney from './DashboardJourney';
import DashboardPieChart from './DashboardPieChart';

interface PinnedWidgetProps {
    result: any;
    chartType: string;
    colSpan?: number;
    rowSpan?: number;
    title?: string;
}

export default function PinnedWidget({ result, chartType, colSpan = 1, rowSpan = 1, title }: PinnedWidgetProps) {
    switch (chartType) {
        case 'stegvisning':
            return <DashboardJourney result={result} title={title} />;
        case 'regresjon':
            return <DashboardTable data={result?.rows ?? []} title={title || result?.title} />;
        case 'linechart':
            return <DashboardLineChart result={result} title={title} />;
        case 'areachart':
            return <DashboardAreaChart result={result} title={title} />;
        case 'barchart':
            return <DashboardBarChart result={result} title={title} />;
        case 'piechart':
            return <DashboardPieChart result={result} title={title} wide={colSpan >= 2} />;
        default:
            return <DashboardTable data={result?.data ?? []} title={title} />;
    }
}
