// Shared hook for preparing chart data from a BigQuery result object.
// Used by ResultsPanel consumers — replaces copy-pasted prepare* functions in each page.
import { translateValue } from './translations';

/** Returns true if the value looks like a number (actual number or numeric string). */
function isNumericValue(val: unknown): boolean {
    if (typeof val === 'number') return !Number.isNaN(val);
    if (typeof val === 'string') return val.trim() !== '' && !Number.isNaN(Number(val));
    return false;
}

/**
 * Given the first two keys and a sample row, returns { labelKey, valueKey }
 * so that labelKey is always the categorical column and valueKey the numeric one.
 * If the SQL returned the numeric column first, the two are swapped.
 */
function detectLabelValueKeys(
    keys: string[],
    firstRow: Record<string, unknown>,
): { labelKey: string; valueKey: string } {
    const [k0, k1] = keys;
    if (isNumericValue(firstRow[k0]) && !isNumericValue(firstRow[k1])) {
        return { labelKey: k1, valueKey: k0 };
    }
    return { labelKey: k0, valueKey: k1 };
}

/**
 * Maps an x-axis value to a number or Date for Fluent charting.
 * Date strings  → Date object
 * Numbers/numeric strings → number
 * Anything else (categorical) → 1-based row index so the line renders correctly.
 */
function resolveX(xValue: unknown, rowIndex: number): number | Date {
    if (typeof xValue === 'number') return xValue;
    if (typeof xValue === 'string') {
        if (/^\d{4}-\d{2}-\d{2}/.exec(xValue)) return new Date(xValue);
        const asNum = Number(xValue);
        if (!Number.isNaN(asNum)) return asNum;
    }
    return rowIndex + 1;
}

export function useChartDataPrep(result: any) {
    const prepareLineChartData = (includeAverage = false) => {
        if (!result?.data?.length) return null;
        const data = result.data;
        const keys = Object.keys(data[0]);
        if (keys.length < 2) return null;

        if (keys.length === 3) {
            const [xKey, seriesKey, yKey] = keys;
            const seriesMap = new Map<string, any[]>();
            data.forEach((row: any) => {
                const seriesValue = String(translateValue(seriesKey, row[seriesKey]) || 'Ukjent');
                if (!seriesMap.has(seriesValue)) seriesMap.set(seriesValue, []);
                const xValue = row[xKey];
                const yValue = typeof row[yKey] === 'number' ? row[yKey] : Number.parseFloat(row[yKey]) || 0;
                seriesMap.get(seriesValue)!.push({ x: resolveX(xValue, seriesMap.get(seriesValue)!.length), y: yValue, xAxisCalloutData: String(xValue), yAxisCalloutData: String(yValue) });
            });
            return {
                data: { lineChartData: Array.from(seriesMap.entries()).map(([legend, pts]) => ({ legend, data: pts, color: '#0067C5' })) },
                enabledLegendsWrapLines: true,
            };
        }

        const { labelKey: xKey, valueKey: yKey } = detectLabelValueKeys(keys, data[0]);
        const chartPoints = data.map((row: any, i: number) => {
            const xValue = row[xKey];
            const yValue = typeof row[yKey] === 'number' ? row[yKey] : Number.parseFloat(row[yKey]) || 0;
            return { x: resolveX(xValue, i), y: yValue, xAxisCalloutData: String(xValue), yAxisCalloutData: String(yValue) };
        });
        const lineChartData: any[] = [{ legend: yKey, data: chartPoints, color: '#0067C5' }];
        if (includeAverage && chartPoints.length > 0) {
            const avgY = chartPoints.reduce((s: number, p: any) => s + p.y, 0) / chartPoints.length;
            lineChartData.push({
                legend: 'Gjennomsnitt',
                data: chartPoints.map((p: any) => ({ ...p, y: avgY, yAxisCalloutData: avgY.toFixed(2) })),
                color: '#262626',
                lineOptions: { lineBorderWidth: '2', strokeDasharray: '5 5' },
            });
        }
        return { data: { lineChartData }, enabledLegendsWrapLines: true };
    };

    const prepareBarChartData = () => {
        if (!result?.data?.length) return null;
        const data = result.data;
        const keys = Object.keys(data[0]);
        if (keys.length < 2) return null;
        const { labelKey, valueKey } = detectLabelValueKeys(keys, data[0]);
        const total = data.reduce((s: number, r: any) => s + (typeof r[valueKey] === 'number' ? r[valueKey] : Number.parseFloat(r[valueKey]) || 0), 0);
        return {
            data: data.map((row: any) => {
                const value = typeof row[valueKey] === 'number' ? row[valueKey] : Number.parseFloat(row[valueKey]) || 0;
                const label = String(translateValue(labelKey, row[labelKey]) || 'Ukjent');
                return { x: label, y: value, xAxisCalloutData: label, yAxisCalloutData: `${value} (${total > 0 ? ((value / total) * 100).toFixed(1) : 0}%)`, color: '#0067C5', legend: label };
            }),
            barWidth: 'auto' as const,
            yAxisTickCount: 5,
            enableReflow: true,
        };
    };

    const preparePieChartData = () => {
        if (!result?.data?.length) return null;
        const data = result.data;
        const keys = Object.keys(data[0]);
        if (keys.length < 2) return null;
        const { labelKey, valueKey } = detectLabelValueKeys(keys, data[0]);
        const total = data.reduce((s: number, r: any) => s + (typeof r[valueKey] === 'number' ? r[valueKey] : Number.parseFloat(r[valueKey]) || 0), 0);
        return {
            data: data.map((row: any) => ({
                y: typeof row[valueKey] === 'number' ? row[valueKey] : Number.parseFloat(row[valueKey]) || 0,
                x: String(translateValue(labelKey, row[labelKey]) || 'Ukjent'),
            })),
            total,
        };
    };

    return { prepareLineChartData, prepareBarChartData, preparePieChartData };
}
