import UmamiJourneyView from '../analysis/journey/UmamiJourneyView';

interface Props {
    result: any;
    title?: string;
    journeyDirection?: 'forward' | 'backward';
    websiteId?: string;
}

export default function DashboardJourney({ result, title = 'Sideflyt', journeyDirection = 'forward', websiteId }: Props) {
    const nodes = result?.nodes;
    const links = result?.links;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fff' }}>
            <div style={{ padding: '8px 12px', borderBottom: '1px solid #e5e7eb', background: '#f9fafb', flexShrink: 0 }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>{title}</span>
            </div>
            <div style={{ flex: 1, overflow: 'auto' }}>
                {!nodes || !links
                    ? <p style={{ color: '#6b7280', fontSize: 13, padding: 8 }}>Ingen flytdata å vise.</p>
                    : <UmamiJourneyView
                        nodes={nodes}
                        links={links}
                        journeyDirection={journeyDirection}
                        websiteId={websiteId}
                    />
                }
            </div>
        </div>
    );
}
