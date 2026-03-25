import { useMemo } from 'react';
import type { PinnedItem } from '../../../client/shared/ui/tables/layout/PinnedGrid';
import type { DashboardWidgetDefinition, DashboardWidgetResolved } from '../model/widgetType';
import { hasDashboardWidgetData } from '../model/widgetTypeGuards';
import { normalizeDashboardWidgetType } from '../ui/widget/widgetRendererRegistry';

export function useDashboardWidgetResolver(
    widgets: DashboardWidgetDefinition[],
    mockupResults: Record<string, unknown>
) {
    const resolvedWidgets = useMemo<DashboardWidgetResolved[]>(() => {
        return widgets.map((widget) => {
            const rows = mockupResults[widget.id];
            const data = hasDashboardWidgetData(rows) ? rows : [];

            return {
                ...widget,
                chartType: normalizeDashboardWidgetType(widget.chartType),
                result: {
                    success: true,
                    data,
                    rowCount: data.length,
                },
            };
        });
    }, [widgets, mockupResults]);

    const pinnedItems = useMemo<PinnedItem[]>(() => {
        return resolvedWidgets.map((widget) => ({
            id: widget.id,
            customWidget: {
                id: widget.id,
                sql: widget.sql,
                chartType: widget.chartType,
                result: widget.result,
                size: widget.size,
                title: widget.title,
                aiPrompt: widget.aiPrompt,
            },
            colSpan: widget.size.cols,
            rowSpan: widget.size.rows,
        }));
    }, [resolvedWidgets]);

    return {
        resolvedWidgets,
        pinnedItems,
    };
}
