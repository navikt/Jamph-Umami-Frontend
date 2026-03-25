export type DashboardWidgetType =
    | 'table'
    | 'regresjon'
    | 'linechart'
    | 'areachart'
    | 'barchart'
    | 'piechart'
    | 'statcards'
    | 'stegvisning'
    | 'kiforklaring'
    | 'pageflow'
    | 'metrics';

export interface DashboardWidgetSize {
    cols: number;
    rows: number;
}

export interface DashboardWidgetDefinition {
    id: string;
    title: string;
    chartType: string;
    sql: string;
    aiPrompt?: string;
    size: DashboardWidgetSize;
}

export interface DashboardWidgetResolved extends DashboardWidgetDefinition {
    chartType: DashboardWidgetType;
    result: {
        success: boolean;
        data: unknown[];
        rowCount: number;
    };
}
