import { resolveViewType } from '../../../../client/shared/ui/tables/viewTypes/viewTypeRegistry';
import type { DashboardWidgetType } from '../../model/widgetType';
import { isDashboardWidgetType } from '../../model/widgetTypeGuards';

const widgetAliases: Record<string, DashboardWidgetType> = {
    regression: 'regresjon',
    table: 'table',
    line: 'linechart',
    area: 'areachart',
    bar: 'barchart',
    pie: 'piechart',
    cards: 'statcards',
    journey: 'stegvisning',
    explanation: 'kiforklaring',
};

export function normalizeDashboardWidgetType(chartType: string): DashboardWidgetType {
    const candidate = chartType.trim().toLowerCase();
    if (isDashboardWidgetType(candidate)) {
        return candidate;
    }

    return widgetAliases[candidate] ?? 'table';
}

export function resolveDashboardWidgetRenderer(chartType: string) {
    const normalizedType = normalizeDashboardWidgetType(chartType);
    return resolveViewType(normalizedType);
}
