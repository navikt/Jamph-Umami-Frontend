import UmamiJourneyView from '../analysis/journey/UmamiJourneyView';
import '../../styles/charts.css';

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
        <div className="widget-card">
            <div className="widget-header">
                <span className="widget-title">{title}</span>
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
