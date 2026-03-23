import { createElement } from 'react';
import Table from '../components/Table';
import type { ViewTypeDefinition } from './baseViewType';

export const tableViewType: ViewTypeDefinition = {
    key: 'table',
    aliases: ['regresjon'],
    render: ({ result, chartType, title }) => {
        const data = chartType === 'regresjon' ? (result?.rows ?? []) : (result?.data ?? []);
        const resolvedTitle = chartType === 'regresjon' ? (title || result?.title) : title;
        return createElement(Table, { data, title: resolvedTitle });
    },
};
