import { createElement } from 'react';
import BarChart from '../components/BarChart';
import type { ViewTypeDefinition } from './baseViewType';

export const barChartViewType: ViewTypeDefinition = {
    key: 'barchart',
    render: ({ result, title }) => createElement(BarChart, { result, title }),
};
