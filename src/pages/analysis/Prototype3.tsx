import { Alert } from "@navikt/ds-react";
import { useSearchParams } from "react-router-dom";
import { useState, useEffect, useMemo, useRef } from "react";
import DashboardLayout from "../../components/dashboard/DashboardLayout";
import { getDashboard } from "../../data/dashboard";
import { normalizeUrlToPath } from "../../lib/utils";
import { AiByggerPanel } from "../../components/analysis/AiByggerPanel";
import PinnedGrid, { PinnedItem } from "../../components/dashboard/PinnedGrid";
import FilterBar from "../../components/dashboard/FilterBar";
import defaultWidgetsData from "../../data/dashboard/defaultWidgets.json";
import mockupResults from "../../data/dashboard/mockupResults.json";

const AKSEL_WEBSITE_ID = 'fb69e1e9-1bd3-4fd9-b700-9d035cbf44e1';
const DEFAULT_URL = 'https://aksel.nav.no/';

const Prototype3 = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const websiteId = searchParams.get("websiteId");
    const domainFromUrl = searchParams.get("domain");
    const pathsFromUrl = searchParams.getAll("path");
    const initialPaths = pathsFromUrl.length > 0 ? pathsFromUrl : ['/'];
    const pathOperator = searchParams.get("pathOperator");
    const metricTypeFromUrl = (searchParams.get("metrikk") || searchParams.get("metricType")) as 'visitors' | 'pageviews' | 'proportion' | null;
    const rawDateRangeFromUrl = searchParams.get("periode");
    const dateRangeFromUrl = rawDateRangeFromUrl === 'this-month' ? 'current_month'
        : rawDateRangeFromUrl === 'last-month' ? 'last_month'
        : rawDateRangeFromUrl;

    const dashboardId = searchParams.get("visning");
    const dashboard = getDashboard(dashboardId);

    const [isResolvingDomain, setIsResolvingDomain] = useState(false);
    const [domainResolutionError, setDomainResolutionError] = useState<string | null>(null);
    const [hasAutoAppliedFilters, setHasAutoAppliedFilters] = useState(false);
    const [selectedWebsite, setSelectedWebsite] = useState<any>(null);

    const getInitialCustomFilterValues = (): Record<string, string> => {
        const values: Record<string, string> = {};
        dashboard.customFilters?.forEach(filter => {
            if (filter.urlParam) {
                const urlSlug = searchParams.get(filter.urlParam);
                if (urlSlug) {
                    const option = filter.options.find(opt => opt.slug === urlSlug || opt.value === urlSlug);
                    values[filter.id] = option?.value || urlSlug;
                }
            }
        });
        return values;
    };

    const [customFilterValues, setCustomFilterValues] = useState<Record<string, string>>(getInitialCustomFilterValues);
    const defaultPathOperator = dashboard.defaultFilterValues?.pathOperator || pathOperator || "starts-with";

    const getStudentDateState = (range: string | null) => {
        if (range === 'last_month') return { dateRange: 'custom', startDate: new Date(2025, 10, 1), endDate: new Date(2025, 10, 30) };
        if (range === 'current_month') return { dateRange: 'custom', startDate: new Date(2025, 11, 1), endDate: new Date(2025, 11, 31) };
        return { dateRange: range || 'current_month', startDate: undefined, endDate: undefined };
    };

    const initialDateState = getStudentDateState(dateRangeFromUrl || 'last_month');

    const getInitialUrlPaths = (): string[] => {
        const initialCustomValues = getInitialCustomFilterValues();
        for (const filter of dashboard.customFilters || []) {
            if (filter.appliesTo === 'urlPath' && filter.urlParam) {
                const value = initialCustomValues[filter.id];
                if (value) return [normalizeUrlToPath(value)];
            }
        }
        return initialPaths.map(p => normalizeUrlToPath(p));
    };

    const initialUrlPathsFromCustomFilter = getInitialUrlPaths();

    const [tempPathOperator, setTempPathOperator] = useState(defaultPathOperator);
    const [tempUrlPaths, setTempUrlPaths] = useState<string[]>(initialUrlPathsFromCustomFilter);
    const [tempDateRange, setTempDateRange] = useState(initialDateState.dateRange);
    const [tempMetricType, setTempMetricType] = useState<'visitors' | 'pageviews' | 'proportion'>(metricTypeFromUrl || 'visitors');
    const [customStartDate, setCustomStartDate] = useState<Date | undefined>(initialDateState.startDate);
    const [customEndDate, setCustomEndDate] = useState<Date | undefined>(initialDateState.endDate);
    const importInputRef = useRef<HTMLInputElement>(null);

    type WidgetEntry = { id: string; sql: string; chartType: string; result: any; size: { cols: number; rows: number }; title: string; aiPrompt?: string };

    const DEFAULT_WIDGETS: WidgetEntry[] = defaultWidgetsData.widgets.map(w => {
        const rows = (mockupResults as Record<string, unknown[]>)[w.id];
        return {
            ...w,
            result: rows ? { success: true, data: rows, rowCount: rows.length } : null,
        };
    });



    const [customWidgets, setCustomWidgets] = useState<WidgetEntry[]>(DEFAULT_WIDGETS);
    const [widgetOrder, setWidgetOrder] = useState<string[]>(DEFAULT_WIDGETS.map(w => w.id));
    const [editingWidget, setEditingWidget] = useState<{ sql: string; chartType: string; title: string; aiPrompt?: string; result?: any } | null>(null);
    const [aiByggerOpen, setAiByggerOpen] = useState(false);

    const [activeFilters, setActiveFilters] = useState({
        pathOperator: defaultPathOperator,
        urlFilters: initialUrlPathsFromCustomFilter,
        dateRange: initialDateState.dateRange,
        customStartDate: initialDateState.startDate,
        customEndDate: initialDateState.endDate,
        metricType: (metricTypeFromUrl || 'visitors') as 'visitors' | 'pageviews' | 'proportion',
    });

    const effectiveWebsiteId = websiteId || AKSEL_WEBSITE_ID;

    const getVisualDateRange = () => {
        if (tempDateRange === 'custom' && customStartDate && customEndDate) {
            const isDec2025 = customStartDate.getFullYear() === 2025 && customStartDate.getMonth() === 11 && customStartDate.getDate() === 1
                && customEndDate.getFullYear() === 2025 && customEndDate.getMonth() === 11 && customEndDate.getDate() === 31;
            const isNov2025 = customStartDate.getFullYear() === 2025 && customStartDate.getMonth() === 10 && customStartDate.getDate() === 1
                && customEndDate.getFullYear() === 2025 && customEndDate.getMonth() === 10 && customEndDate.getDate() === 30;
            if (isDec2025) return 'current_month';
            if (isNov2025) return 'last_month';
        }
        return tempDateRange;
    };

    const normalizeDomain = (domain: string) => (domain === "www.nav.no" ? domain : domain.replace(/^www\./, ""));

    useEffect(() => {
        const resolveDomainToWebsiteId = async () => {
            if (websiteId || !domainFromUrl) return;
            setIsResolvingDomain(true);
            setDomainResolutionError(null);
            try {
                const response = await fetch('/api/bigquery/websites');
                const data = await response.json();
                const websitesData = data.data || [];
                const relevantTeams = ['aa113c34-e213-4ed6-a4f0-0aea8a503e6b', 'bceb3300-a2fb-4f73-8cec-7e3673072b30'];
                const prodWebsites = websitesData.filter((w: any) => relevantTeams.includes(w.teamId));
                const filteredWebsites = prodWebsites.filter((item: any) => item.domain !== "nav.no");
                let inputDomain = domainFromUrl === "nav.no" ? "www.nav.no" : domainFromUrl;
                const normalizedInput = normalizeDomain(inputDomain);
                const matchedWebsite = filteredWebsites.find((item: any) =>
                    normalizeDomain(item.domain) === normalizedInput ||
                    normalizedInput.endsWith(`.${normalizeDomain(item.domain)} `)
                );
                if (matchedWebsite) {
                    const newParams = new URLSearchParams(searchParams);
                    newParams.set('websiteId', matchedWebsite.id);
                    newParams.delete('domain');
                    setSearchParams(newParams, { replace: true });
                    setSelectedWebsite(matchedWebsite);
                } else {
                    setDomainResolutionError(`Fant ingen nettside for domenet "${domainFromUrl}"`);
                }
            } catch {
                setDomainResolutionError('Kunne ikke slå opp domenet');
            } finally {
                setIsResolvingDomain(false);
            }
        };
        resolveDomainToWebsiteId();
    }, [domainFromUrl, websiteId, searchParams, setSearchParams]);

    useEffect(() => {
        if (!hasAutoAppliedFilters && selectedWebsite && initialPaths.length > 0) {
            const autoDateState = getStudentDateState("current_month");
            setActiveFilters({
                pathOperator: pathOperator || "equals",
                urlFilters: initialPaths.map(p => normalizeUrlToPath(p)),
                dateRange: autoDateState.dateRange,
                customStartDate: autoDateState.startDate,
                customEndDate: autoDateState.endDate,
                metricType: metricTypeFromUrl || 'visitors',
            });
            setHasAutoAppliedFilters(true);
        }
    }, [selectedWebsite, initialPaths, pathOperator, hasAutoAppliedFilters, metricTypeFromUrl]);

    const handleUpdate = () => {
        const url = new URL(window.location.href);
        if (!dashboard.hiddenFilters?.website && selectedWebsite) {
            url.searchParams.set('websiteId', selectedWebsite.id);
            url.searchParams.delete('path');
            tempUrlPaths.forEach(p => { if (p) url.searchParams.append('path', p); });
            if (tempPathOperator && tempPathOperator !== "equals") url.searchParams.set('pathOperator', tempPathOperator);
            else url.searchParams.delete('pathOperator');
        }
        const visualRange = getVisualDateRange();
        if (visualRange !== 'current_month') url.searchParams.set('periode', visualRange);
        else url.searchParams.delete('periode');
        if (tempMetricType && tempMetricType !== "visitors") url.searchParams.set('metrikk', tempMetricType);
        else url.searchParams.delete('metrikk');
        setSearchParams(url.searchParams);
        setActiveFilters({
            pathOperator: tempPathOperator,
            urlFilters: tempUrlPaths,
            dateRange: tempDateRange,
            customStartDate: tempDateRange === 'custom' ? customStartDate : undefined,
            customEndDate: tempDateRange === 'custom' ? customEndDate : undefined,
            metricType: tempMetricType,
        });
    };

    const handleUrlResolved = (resolvedWebsiteId: string, domain: string, name: string, pathname: string, operator: string) => {
        setSelectedWebsite({ id: resolvedWebsiteId, domain, name });
        setTempUrlPaths([pathname]);
        setTempPathOperator(operator as 'equals' | 'starts-with');
    };

    const handleCustomFilterChange = (filterId: string, value: string) => {
        setCustomFilterValues(prev => ({ ...prev, [filterId]: value }));
        const filterDef = dashboard.customFilters?.find(f => f.id === filterId);
        if (!filterDef) return;
        if (filterDef.urlParam) {
            const url = new URL(window.location.href);
            if (value) {
                const urlValue = filterDef.options.find(opt => opt.value === value)?.slug || value;
                url.searchParams.set(filterDef.urlParam, urlValue);
            } else {
                url.searchParams.delete(filterDef.urlParam);
            }
            setSearchParams(url.searchParams);
        }
        if (filterDef.appliesTo === 'urlPath') {
            setTempUrlPaths(value ? [value] : []);
            setTempPathOperator(filterDef.pathOperator ?? defaultPathOperator);
        }
    };

    const arraysEqual = (a: string[], b: string[]) => a.length === b.length && a.every((v, i) => v === b[i]);
    const datesEqual = (a: Date | undefined, b: Date | undefined) => {
        if (!a && !b) return true;
        if (!a || !b) return false;
        return a.getTime() === b.getTime();
    };

    const hasChanges =
        tempDateRange !== activeFilters.dateRange ||
        !arraysEqual(tempUrlPaths, activeFilters.urlFilters) ||
        tempPathOperator !== activeFilters.pathOperator ||
        tempMetricType !== activeFilters.metricType ||
        (!dashboard.hiddenFilters?.website && selectedWebsite && selectedWebsite.id !== websiteId) ||
        (tempDateRange === 'custom' && (
            !datesEqual(customStartDate, activeFilters.customStartDate) ||
            !datesEqual(customEndDate, activeFilters.customEndDate)
        ));

    const requiredFiltersAreSatisfied = useMemo(() => {
        if (!dashboard.customFilters) return true;
        const required = dashboard.customFilters.filter(f => f.required);
        return required.every(f => f.appliesTo === 'urlPath' ? activeFilters.urlFilters.length > 0 : !!customFilterValues[f.id]);
    }, [dashboard.customFilters, activeFilters.urlFilters, customFilterValues]);

    // Build the ordered widget list for PinnedGrid
    const customWidgetMap = new Map(customWidgets.map(cw => [cw.id, cw]));
    const pinnedWidgets = widgetOrder
        .map(id => { const cw = customWidgetMap.get(id); return cw ? { id, customWidget: cw, colSpan: cw.size?.cols ?? 1, rowSpan: cw.size?.rows ?? 1 } : null; })
        .filter(w => w !== null) as PinnedItem[];

    const handleReorder = (fromId: string, toId: string) => {
        setWidgetOrder(prev => {
            const arr = [...prev];
            const from = arr.indexOf(fromId);
            const to = arr.indexOf(toId);
            if (from !== -1 && to !== -1) [arr[from], arr[to]] = [arr[to], arr[from]];
            return arr;
        });
    };

    const handleDeleteWidget = (id: string) => {
        setCustomWidgets(prev => prev.filter(cw => cw.id !== id));
        setWidgetOrder(prev => prev.filter(prevId => prevId !== id));
    };

    const handleExport = () => {
        const exportData = {
            version: 1,
            exportedAt: new Date().toISOString(),
            widgets: widgetOrder
                .map(id => customWidgets.find(w => w.id === id))
                .filter(Boolean)
                .map(w => ({
                    id: w!.id,
                    title: w!.title,
                    aiPrompt: w!.aiPrompt ?? '',
                    chartType: w!.chartType,
                    size: w!.size,
                    sql: w!.sql,
                })),
        };
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dashboard-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        file.text().then((text) => {
            try {
                const parsed = JSON.parse(text);
                if (!Array.isArray(parsed?.widgets)) throw new Error('Ugyldig format');
                const imported: WidgetEntry[] = parsed.widgets.map((w: any) => ({
                    id: w.id ?? crypto.randomUUID(),
                    title: w.title ?? '',
                    aiPrompt: w.aiPrompt ?? '',
                    chartType: w.chartType ?? 'table',
                    size: w.size ?? { cols: 1, rows: 1 },
                    sql: w.sql ?? '',
                    result: null,
                }));
                setCustomWidgets(imported);
                setWidgetOrder(imported.map(w => w.id));
            } catch {
                alert('Kunne ikke lese filen. Sjekk at det er en gyldig dashboard-JSON.');
            }
        });
        // reset so same file can be re-imported
        e.target.value = '';
    };

    return (
        <DashboardLayout
            title={`Prototype 3 – ${dashboard.title}`}
            description={dashboard.description}
            filters={
                <FilterBar
                    dashboard={dashboard}
                    defaultUrlFormValue={domainFromUrl ? `https://${domainFromUrl}${searchParams.get('path') || '/'}` : DEFAULT_URL}
                    tempDateRange={tempDateRange}
                    setTempDateRange={setTempDateRange}
                    customStartDate={customStartDate}
                    setCustomStartDate={setCustomStartDate}
                    customEndDate={customEndDate}
                    setCustomEndDate={setCustomEndDate}
                    visualDateRange={getVisualDateRange()}
                    tempMetricType={tempMetricType}
                    setTempMetricType={setTempMetricType}
                    customFilterValues={customFilterValues}
                    onCustomFilterChange={handleCustomFilterChange}
                    hasChanges={hasChanges}
                    onUpdate={handleUpdate}
                    onUrlResolved={handleUrlResolved}
                    onExport={handleExport}
                    onImport={() => importInputRef.current?.click()}
                    aiByggerOpen={aiByggerOpen}
                    onAiByggerOpenChange={setAiByggerOpen}
                    aiByggerPanel={
                        <AiByggerPanel
                            websiteId={effectiveWebsiteId}
                            path={activeFilters.urlFilters[0] || '/'}
                            pathOperator={activeFilters.pathOperator || 'starts-with'}
                            startDate={activeFilters.customStartDate}
                            endDate={activeFilters.customEndDate}
                            editWidget={editingWidget}
                            onAddWidget={(sql, chartType, result, size, title, aiPrompt) => {
                                const id = crypto.randomUUID();
                                setCustomWidgets(prev => [{ id, sql, chartType, result, size, title: title || '', aiPrompt: aiPrompt || '' }, ...prev]);
                                setWidgetOrder(prev => [id, ...prev]);
                            }}
                        />
                    }
                />
            }
            hideHeader
        >
            <input
                ref={importInputRef}
                type="file"
                accept=".json,application/json"
                style={{ display: 'none' }}
                onChange={handleImportFile}
            />

            {isResolvingDomain ? null : domainResolutionError ? (
                <div className="p-8 col-span-full">
                    <Alert variant="error" size="small">{domainResolutionError}</Alert>
                </div>
            ) : !effectiveWebsiteId ? (
                <div className="w-fit">
                    <Alert variant="info" size="small">Legg til URL-sti og trykk Oppdater for å vise statistikk.</Alert>
                </div>
            ) : !requiredFiltersAreSatisfied ? (
                <div className="w-fit">
                    <Alert variant="info" size="small">
                        {dashboard.customFilterRequiredMessage || "Velg nødvendige filtre for å vise data."}
                    </Alert>
                </div>
            ) : (
                <div>
                    <PinnedGrid
                        widgets={pinnedWidgets}
                        onReorder={handleReorder}
                        onDelete={handleDeleteWidget}
                        onEdit={(w) => {
                            setEditingWidget({ sql: w.customWidget.sql, chartType: w.customWidget.chartType, title: w.customWidget.title, aiPrompt: w.customWidget.aiPrompt, result: w.customWidget.result });
                            setAiByggerOpen(true);
                        }}
                        onResize={(id, size) => {
                            setCustomWidgets(prev => prev.map(cw => cw.id === id ? { ...cw, size } : cw));
                        }}
                        onDropExternal={(data) => {
                            const id = crypto.randomUUID();
                            setCustomWidgets(prev => [{ id, sql: data.sql, chartType: data.chartType, result: data.result, size: data.size, title: data.title || '', aiPrompt: data.aiPrompt || '' }, ...prev]);
                            setWidgetOrder(prev => [id, ...prev]);
                        }}
                    />
                    {/* AI-bygger removed – now in accordion in FilterBar */}
                </div>
            )}
        </DashboardLayout>
    );
};

export default Prototype3;
