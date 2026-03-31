import { Select, Button } from '@navikt/ds-react';
import UrlSearchFormPrototype from './UrlSearchFormPrototype';

interface CustomFilterDef {
    id: string;
    label: string;
    options: Array<{ value: string; label: string; slug?: string }>;
}

interface DashboardConfig {
    customFilters?: CustomFilterDef[];
    hiddenFilters?: { dateRange?: boolean; metricType?: boolean; website?: boolean };
    metricTypeOptions?: string[];
}

export interface FilterBarProps {
    dashboard: DashboardConfig;
    defaultUrlFormValue: string;
    // custom filters
    customFilterValues: Record<string, string>;
    onCustomFilterChange: (filterId: string, value: string) => void;
    onUrlResolved?: (websiteId: string, domain: string, name: string, pathname: string, pathOperator: string) => void;
    // export / import
    onExport?: () => void;
    onImport?: () => void;
    // ai bygger
    aiByggerPanel?: React.ReactNode;
}

export default function FilterBar({
    dashboard,
    defaultUrlFormValue,
    customFilterValues,
    onCustomFilterChange,
    onUrlResolved,
    onExport,
    onImport,
    aiByggerPanel,
}: FilterBarProps) {

    return (
        <>
            <div className="w-full mb-2">
                <UrlSearchFormPrototype
                    targetPath="/prototype3"
                    defaultValue={defaultUrlFormValue}
                    onResolved={(websiteId, domain, name, pathname, pathOperator) => {
                        onUrlResolved?.(websiteId, domain, name, pathname, pathOperator);
                    }}
                    actions={<>
                        {onExport && (
                            <Button variant="secondary" size="small" onClick={onExport}>
                                Eksporter
                            </Button>
                        )}
                        {onImport && (
                            <Button variant="secondary" size="small" onClick={onImport}>
                                Importer
                            </Button>
                        )}
                    </>}
                />
            </div>

            {dashboard.customFilters?.map(filter => (
                <div key={filter.id} className="w-full sm:w-auto min-w-[200px]">
                    <Select
                        label={filter.label}
                        size="small"
                        value={customFilterValues[filter.id] || ''}
                        onChange={(e) => onCustomFilterChange(filter.id, e.target.value)}
                    >
                        <option value="">Velg {filter.label.toLowerCase()}</option>
                        {filter.options.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </Select>
                </div>
            ))}



            {aiByggerPanel && (
                <div style={{ width: '100%', marginTop: 4, height: 560, position: 'relative', overflow: 'hidden' }}>
                    {aiByggerPanel}
                </div>
            )}

        </>
    );
}
