import type { DashboardWidgetType } from './widgetType';

const DASHBOARD_WIDGET_TYPES = new Set<DashboardWidgetType>([
    'table',
    'regresjon',
    'linechart',
    'areachart',
    'barchart',
    'piechart',
    'statcards',
    'stegvisning',
    'kiforklaring',
]);

export function isDashboardWidgetType(value: string): value is DashboardWidgetType {
    return DASHBOARD_WIDGET_TYPES.has(value as DashboardWidgetType);
}

export function hasDashboardWidgetData(value: unknown): value is unknown[] {
    return Array.isArray(value);
}
