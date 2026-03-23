import type { ViewTypeDefinition } from './baseViewType';
import { aiExplanationViewType } from './aiExplanationViewType';
import { areaChartViewType } from './areaChartViewType';
import { barChartViewType } from './barChartViewType';
import { journeyStepsViewType } from './journeyStepsViewType';
import { lineChartViewType } from './lineChartViewType';
import { pieChartViewType } from './pieChartViewType';
import { statCardsViewType } from './statCardsViewType';
import { tableViewType } from './tableViewType';

const viewTypes: ViewTypeDefinition[] = [
    lineChartViewType,
    barChartViewType,
    areaChartViewType,
    pieChartViewType,
    statCardsViewType,
    journeyStepsViewType,
    aiExplanationViewType,
    tableViewType,
];

const viewTypeRegistry = new Map<string, ViewTypeDefinition>();

for (const viewType of viewTypes) {
    viewTypeRegistry.set(viewType.key, viewType);
    for (const alias of viewType.aliases ?? []) {
        viewTypeRegistry.set(alias, viewType);
    }
}

export function resolveViewType(chartType: string): ViewTypeDefinition {
    return viewTypeRegistry.get(chartType) ?? tableViewType;
}
