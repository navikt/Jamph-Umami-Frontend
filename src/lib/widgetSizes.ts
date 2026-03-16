export interface WidgetSize { cols: number; rows: number; name: string; }

export const WIDGET_SIZES: Record<string, WidgetSize[]> = {
    table:        [{ cols: 1, rows: 1, name: '1×1' }, { cols: 1, rows: 2, name: '1×2' }, { cols: 2, rows: 1, name: '2×1' }, { cols: 2, rows: 2, name: '2×2' }],
    linechart:    [{ cols: 1, rows: 1, name: '1×1' }, { cols: 2, rows: 1, name: '2×1' }],
    areachart:    [{ cols: 1, rows: 1, name: '1×1' }, { cols: 2, rows: 1, name: '2×1' }],
    barchart:     [{ cols: 1, rows: 1, name: '1×1' }, { cols: 2, rows: 1, name: '2×1' }],
    piechart:     [{ cols: 1, rows: 2, name: '1×2' }, { cols: 2, rows: 1, name: '2×1' }],
    statcards:    [{ cols: 1, rows: 1, name: '1×1' }, { cols: 2, rows: 1, name: '2×1' }],
    stegvisning:  [{ cols: 2, rows: 1, name: 'Standard' }],
    regresjon:    [{ cols: 1, rows: 1, name: 'Standard' }],
    kiforklaring: [{ cols: 1, rows: 1, name: '1×1' }, { cols: 2, rows: 1, name: '2×1' }],
};
