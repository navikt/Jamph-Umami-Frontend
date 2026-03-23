import { createElement } from 'react';
import LineChart from '../components/LineChart';
import type { ViewTypeDefinition } from './baseViewType';

export const lineChartViewType: ViewTypeDefinition = {
    key: 'linechart',
    render: ({ result, title }) => createElement(LineChart, { result, title }),
};
