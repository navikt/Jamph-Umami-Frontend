import type { ReactNode } from 'react';

export interface ViewRenderProps {
    result: any;
    chartType: string;
    colSpan?: number;
    rowSpan?: number;
    title?: string;
}

export interface ViewTypeDefinition {
    key: string;
    aliases?: string[];
    render: (props: ViewRenderProps) => ReactNode;
}
