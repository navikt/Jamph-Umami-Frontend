import { createElement } from 'react';
import PieChart from '../components/PieChart';
import type { ViewTypeDefinition } from './baseViewType';

export const pieChartViewType: ViewTypeDefinition = {
    key: 'piechart',
    render: ({ result, title, colSpan }) => createElement(PieChart, { result, title, wide: (colSpan ?? 1) >= 2 }),
};
