import { createElement } from 'react';
import Journey from '../components/Journey';
import type { ViewTypeDefinition } from './baseViewType';

export const journeyStepsViewType: ViewTypeDefinition = {
    key: 'stegvisning',
    render: ({ result, title }) => createElement(Journey, { result, title }),
};
