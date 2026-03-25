import { createElement } from 'react';
import StatCards from '../components/StatCards';
import type { ViewTypeDefinition } from './baseViewType';

export const statCardsViewType: ViewTypeDefinition = {
    key: 'statcards',
    render: ({ result, title }) => createElement(StatCards, { result, title }),
};
