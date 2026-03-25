import { createElement } from 'react';
import AreaChart from '../components/AreaChart';
import type { ViewTypeDefinition } from './baseViewType';

export const areaChartViewType: ViewTypeDefinition = {
    key: 'areachart',
    render: ({ result, title }) => createElement(AreaChart, { result, title }),
};
