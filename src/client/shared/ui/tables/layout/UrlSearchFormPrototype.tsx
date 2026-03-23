import { TextField, Alert } from "@navikt/ds-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

interface Website {
    id: string;
    name: string;
    domain: string;
    shareId: string;
    teamId: string;
    createdAt: string;
}

interface UrlSearchFormProps {
    children?: React.ReactNode;
    targetPath?: string;
    defaultValue?: string;
    /** If provided, called with resolved website info instead of navigating */
    onResolved?: (websiteId: string, domain: string, name: string, pathname: string, pathOperator: string) => void;
    /** Called on every keystroke so parent can detect uncommitted changes */
    onInputChange?: (value: string) => void;
}

function UrlSearchFormPrototype({ children, targetPath = '/dashboard', defaultValue = '', onResolved, onInputChange }: UrlSearchFormProps) {
    const navigate = useNavigate();
    const [filteredData, setFilteredData] = useState<Website[] | null>(null);
    const [searchQuery, setSearchQuery] = useState<string>(defaultValue);
    const [alertVisible, setAlertVisible] = useState<boolean>(false);
    const [hasLoadedData, setHasLoadedData] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [pathOperator, setPathOperator] = useState<'equals' | 'starts-with'>('equals');

    const normalizeDomain = (domain: string) => {
        if (domain === "www.nav.no") return domain;
        return domain.replace(/^www\./, "");
    };

    const fetchWebsites = async (): Promise<Website[]> => {
        // If we already have data, return it
        if (hasLoadedData && filteredData) {
            return filteredData;
        }

        setIsLoading(true);
        const baseUrl = ''; // Use relative path for local API

        try {
            const response = await fetch(`${baseUrl}/api/bigquery/websites`);
            const json = await response.json();
            const websitesData = json.data || [];

            const relevantTeams = [
                'aa113c34-e213-4ed6-a4f0-0aea8a503e6b',
                'bceb3300-a2fb-4f73-8cec-7e3673072b30'
            ];

            const prodWebsites = websitesData.filter((website: Website) =>
                relevantTeams.includes(website.teamId)
            );

            const filteredItems = prodWebsites.filter((item: Website) => item.domain !== "nav.no");

            // Deduplicate by domain
            const uniqueWebsites = filteredItems.filter((website: Website, index: number, self: Website[]) =>
                index === self.findIndex((w) => w.domain === website.domain)
            );

            // Sort by domain
            uniqueWebsites.sort((a: Website, b: Website) => a.domain.localeCompare(b.domain));

            setFilteredData(uniqueWebsites);
            setHasLoadedData(true);
            setIsLoading(false);
            return uniqueWebsites;
        } catch (error) {
            console.error("Error fetching data:", error);
            setIsLoading(false);
            throw error;
        }
    };

    const handleSearchChange = (value: string) => {
        setSearchQuery(value);
        setAlertVisible(false);
        setSearchError(null);
        onInputChange?.(value);
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!searchQuery) {
            setSearchError("Du må sette inn en URL-adresse.");
            return;
        }
        setSearchError(null);
        setAlertVisible(false);

        let inputUrl = searchQuery;
        if (!inputUrl.startsWith('http://') && !inputUrl.startsWith('https://')) {
            inputUrl = 'https://' + inputUrl;
        }

        try {
            let urlObj = new URL(inputUrl);

            if (urlObj.hostname === "nav.no") {
                inputUrl = inputUrl.replace("://nav.no", "://www.nav.no");
                urlObj = new URL(inputUrl);
            }

            const websites = await fetchWebsites();

            const inputDomain = urlObj.hostname;
            const normalizedInputDomain = normalizeDomain(inputDomain);

            const matchedWebsite = websites.find(
                (item) =>
                    normalizeDomain(item.domain) === normalizedInputDomain ||
                    normalizedInputDomain.endsWith(`.${normalizeDomain(item.domain)}`)
            );

            if (matchedWebsite) {
                if (onResolved) {
                    onResolved(matchedWebsite.id, matchedWebsite.domain, matchedWebsite.name, urlObj.pathname, pathOperator);
                    onInputChange?.('');
                } else {
                    navigate(`${targetPath}?websiteId=${matchedWebsite.id}&domain=${matchedWebsite.domain}&name=${encodeURIComponent(matchedWebsite.name)}&path=${encodeURIComponent(urlObj.pathname)}&pathOperator=${pathOperator}`);
                }
            } else {
                setAlertVisible(true);
            }

        } catch (error) {
            setSearchError("Ugyldig URL-format eller feil ved oppslag.");
            console.error("Error:", error);
        }
    };

    return (
        <div>
            <form role="search" onSubmit={handleSubmit}>
                <div style={{ width: '100%' }}>
                    <TextField
                        label="Lim inn URL for å se webstatistikk"
                        value={searchQuery}
                        error={searchError}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(e as any); }}
                        placeholder="https://aksel.nav.no/..."
                        style={{ width: '100%' }}
                    />
                    <div className="flex items-center gap-2 mt-2">
                        <span className="text-sm text-gray-600">URL-sti</span>
                        <select
                            className="text-sm bg-white border border-gray-300 rounded text-[#0067c5] font-medium cursor-pointer focus:outline-none py-1 px-2"
                            value={pathOperator}
                            onChange={(e) => setPathOperator(e.target.value as 'equals' | 'starts-with')}
                        >
                            <option value="equals">er lik</option>
                            <option value="starts-with">starter med</option>
                        </select>
                        <span className="text-sm text-gray-500">den innlimte URL-stien</span>
                    </div>
                    {alertVisible && <Alert style={{ marginTop: "20px" }} variant="warning">Denne siden har ikke fått støtte for Umami enda. Fortvil ikke — kontakt Team ResearchOps for å få lagt den til :)</Alert>}
                </div>
                {children}
            </form>
        </div>
    );
}

export default UrlSearchFormPrototype;
