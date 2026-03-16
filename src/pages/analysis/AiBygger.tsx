// Standalone page wrapper  used by /ai-bygger route.
// The actual panel lives in AiByggerPanel to be shared with Prototype3.
import { AiByggerPanel } from '../../components/analysis/AiByggerPanel';

export default function AiBygger() {
    const urlParams = new URLSearchParams(globalThis.location.search);
    const websiteId = urlParams.get('websiteId') || 'fb69e1e9-1bd3-4fd9-b700-9d035cbf44e1';
    const path = urlParams.get('path') || '/';
    const pathOperator = urlParams.get('pathOperator') || 'starts-with';

    return (
        <div className="w-full h-full overflow-hidden">
            <AiByggerPanel websiteId={websiteId} path={path} pathOperator={pathOperator} />
        </div>
    );
}
