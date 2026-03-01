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

interface PinnedWidgetProps {
    result: any;
    chartType: string;
}

export default function PinnedWidget({ result, chartType }: PinnedWidgetProps) {
    switch (chartType) {
        case 'stegvisning':
            return <DashboardJourney result={result} />;
        case 'regresjon':
            return <DashboardTable data={result?.rows ?? []} title={result?.title} />;
        case 'linechart':
            return <DashboardLineChart result={result} />;
        case 'areachart':
            return <DashboardAreaChart result={result} />;
        case 'barchart':
            return <DashboardBarChart result={result} />;
        default:
            // table, piechart, or any future tab type
            return <DashboardTable data={result?.data ?? []} />;
    }
}
