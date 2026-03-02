import { useState, useRef } from 'react';
import { Select, Button, Modal, DatePicker } from '@navikt/ds-react';
import { format } from 'date-fns';
import UrlSearchForm from './UrlSearchForm';

type MetricType = 'visitors' | 'pageviews' | 'proportion';

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
    // date
    tempDateRange: string;
    setTempDateRange: (v: string) => void;
    customStartDate: Date | undefined;
    setCustomStartDate: (d: Date | undefined) => void;
    customEndDate: Date | undefined;
    setCustomEndDate: (d: Date | undefined) => void;
    visualDateRange: string;
    // metric
    tempMetricType: MetricType;
    setTempMetricType: (v: MetricType) => void;
    // custom filters
    customFilterValues: Record<string, string>;
    onCustomFilterChange: (filterId: string, value: string) => void;
    // apply
    hasChanges: boolean;
    onUpdate: () => void;
    onUrlResolved?: (websiteId: string, domain: string, name: string, pathname: string, pathOperator: string) => void;
    // export / import
    onExport?: () => void;
    onImport?: () => void;
}

export default function FilterBar({
    dashboard,
    defaultUrlFormValue,
    tempDateRange,
    setTempDateRange,
    customStartDate,
    setCustomStartDate,
    customEndDate,
    setCustomEndDate,
    visualDateRange,
    tempMetricType,
    setTempMetricType,
    customFilterValues,
    onCustomFilterChange,
    hasChanges,
    onUpdate,
    onUrlResolved,
    onExport,
    onImport,
}: FilterBarProps) {
    const [isDateModalOpen, setIsDateModalOpen] = useState(false);
    const dateModalRef = useRef<HTMLDialogElement>(null);

    return (
        <>
            <div className="w-full mb-2">
                <UrlSearchForm targetPath="/prototype3" defaultValue={defaultUrlFormValue} onResolved={onUrlResolved} />
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

            {!dashboard.hiddenFilters?.dateRange && (
                <div className="w-full sm:w-auto min-w-[128px]">
                    <Select label="Type periode" size="small" value="maaned" onChange={() => {}}>
                        <option value="maaned">Måned</option>
                        <option value="uke">Uke</option>
                        <option value="fra-til">Fra–til dato</option>
                        <option value="kvartal">Kvartal</option>
                        <option value="ar">År</option>
                    </Select>
                </div>
            )}

            {!dashboard.hiddenFilters?.dateRange && (
                <div className="w-full sm:w-auto min-w-[160px]">
                    <Select
                        label="Periode"
                        size="small"
                        value={visualDateRange}
                        onChange={(e) => {
                            const value = e.target.value;
                            if (value === 'custom') {
                                setIsDateModalOpen(true);
                            } else if (value === 'custom-edit') {
                                setCustomStartDate(undefined);
                                setCustomEndDate(undefined);
                                setIsDateModalOpen(true);
                            } else if (value === 'current_month') {
                                setTempDateRange('custom');
                                setCustomStartDate(new Date(2025, 11, 1));
                                setCustomEndDate(new Date(2025, 11, 31));
                            } else if (value === 'last_month') {
                                setTempDateRange('custom');
                                setCustomStartDate(new Date(2025, 10, 1));
                                setCustomEndDate(new Date(2025, 10, 30));
                            } else {
                                setTempDateRange(value);
                            }
                        }}
                    >
                        <option value="current_month">Desember 2025</option>
                        <option value="last_month">November 2025</option>
                        {tempDateRange === 'custom' && customStartDate && customEndDate && visualDateRange === 'custom' ? (
                            <>
                                <option value="custom">{`${format(customStartDate, 'dd.MM.yy')} - ${format(customEndDate, 'dd.MM.yy')} `}</option>
                                <option value="custom-edit">Endre datoer</option>
                            </>
                        ) : (
                            <option value="custom">Egendefinert</option>
                        )}
                    </Select>
                </div>
            )}

            {!dashboard.hiddenFilters?.metricType && (
                <div className="w-full sm:w-auto min-w-[150px]">
                    <Select
                        label="Visning"
                        size="small"
                        value={tempMetricType}
                        onChange={(e) => setTempMetricType(e.target.value as MetricType)}
                    >
                        {(!dashboard.metricTypeOptions || dashboard.metricTypeOptions.includes('visitors')) && (
                            <option value="visitors">Unike besøkende</option>
                        )}
                        {(!dashboard.metricTypeOptions || dashboard.metricTypeOptions.includes('pageviews')) && (
                            <option value="pageviews">Sidevisninger</option>
                        )}
                        {(!dashboard.metricTypeOptions || dashboard.metricTypeOptions.includes('proportion')) && (
                            <option value="proportion">Andel (%)</option>
                        )}
                    </Select>
                </div>
            )}

            <div className="flex flex-col">
                <span className="navds-label navds-form-field__label" style={{ marginBottom: '6px' }}>Dashboard handlinger</span>
                <div className="flex items-center gap-2">
                    <Button onClick={onUpdate} size="small" variant={hasChanges ? 'primary' : 'secondary'}>
                        Oppdater
                    </Button>
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
                </div>
            </div>

            <Modal
                ref={dateModalRef}
                open={isDateModalOpen}
                onClose={() => setIsDateModalOpen(false)}
                header={{ heading: 'Velg datoperiode', closeButton: true }}
            >
                <Modal.Body>
                    <div className="flex flex-col gap-4">
                        <DatePicker
                            mode="range"
                            selected={{ from: customStartDate, to: customEndDate }}
                            onSelect={(range) => {
                                if (range) {
                                    setCustomStartDate(range.from);
                                    setCustomEndDate(range.to);
                                }
                            }}
                        >
                            <div className="flex flex-col gap-2">
                                <DatePicker.Input id="p3-start-date" label="Fra dato" size="small"
                                    value={customStartDate ? format(customStartDate, 'dd.MM.yyyy') : ''} />
                                <DatePicker.Input id="p3-end-date" label="Til dato" size="small"
                                    value={customEndDate ? format(customEndDate, 'dd.MM.yyyy') : ''} />
                            </div>
                        </DatePicker>
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <Button
                        onClick={() => {
                            if (customStartDate && customEndDate) {
                                setTempDateRange('custom');
                                setIsDateModalOpen(false);
                            }
                        }}
                        disabled={!customStartDate || !customEndDate}
                    >
                        Bruk datoer
                    </Button>
                    <Button variant="secondary" onClick={() => setIsDateModalOpen(false)}>Avbryt</Button>
                </Modal.Footer>
            </Modal>
        </>
    );
}
