import { createElement } from 'react';
import KIForklaring from '../components/KIForklaring';
import type { ViewTypeDefinition } from './baseViewType';

export const aiExplanationViewType: ViewTypeDefinition = {
    key: 'kiforklaring',
    render: ({ result, title }) => createElement(KIForklaring, { result, title }),
};
