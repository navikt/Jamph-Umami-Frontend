import { useRef, useState } from 'react';
import { BodyShort, Button, Modal, TextField } from '@navikt/ds-react';
import PinnedWidget from '../dashboard/PinnedWidget';

type GrafTab = 'linechart' | 'barchart' | 'piechart' | 'table' | 'nokkeltall' | 'ki-forklaring';

interface DashboardGraph {
    title: string;
    data: unknown[];
    size: 'half' | 'full';
    grafTab?: GrafTab;
}

interface DashboardTabProps {
    dashboards: string[];
    setDashboards: React.Dispatch<React.SetStateAction<string[]>>;
    selectedDashboard: string;
    setSelectedDashboard: (db: string) => void;
    dashboardGraphs: Record<string, DashboardGraph[]>;
    setDashboardGraphs: React.Dispatch<React.SetStateAction<Record<string, DashboardGraph[]>>>;
    onOpenInGrafbygger: (graph: DashboardGraph) => void;
}

export default function DashboardTab({
    dashboards,
    setDashboards,
    selectedDashboard,
    setSelectedDashboard,
    dashboardGraphs,
    setDashboardGraphs,
    onOpenInGrafbygger,
}: DashboardTabProps) {
    const [showNewDashboardModal, setShowNewDashboardModal] = useState(false);
    const [newDashboardName, setNewDashboardName] = useState('');
    const [deletingDashboard, setDeletingDashboard] = useState<string | null>(null);
    const [expandedCardIndex, setExpandedCardIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
    const dragIndexRef = useRef<number | null>(null);

    const handleDeleteDashboard = (db: string) => {
        setDashboards((prev) => prev.filter((d) => d !== db));
        setDashboardGraphs((prev) => {
            const next = { ...prev };
            delete next[db];
            return next;
        });
        if (selectedDashboard === db) setSelectedDashboard('');
    };

    const handleToggleSize = (index: number) => {
        setDashboardGraphs((prev) => {
            const list = [...(prev[selectedDashboard] ?? [])];
            list[index] = { ...list[index], size: list[index].size === 'full' ? 'half' : 'full' };
            return { ...prev, [selectedDashboard]: list };
        });
        setExpandedCardIndex(null);
    };

    const handleDeleteCard = (index: number) => {
        setDashboardGraphs((prev) => {
            const list = [...(prev[selectedDashboard] ?? [])];
            list.splice(index, 1);
            return { ...prev, [selectedDashboard]: list };
        });
        setExpandedCardIndex(null);
    };

    return (
        <div className="pt-4">
            {/* Dashboard-mapper */}
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-4">
                    <BodyShort weight="semibold" className="text-base">Dashboard-mapper</BodyShort>
                    <Button
                        variant="tertiary"
                        size="small"
                        onClick={() => setShowNewDashboardModal(true)}
                        aria-label="Opprett ny mappe"
                    >
                        +
                    </Button>
                </div>

                <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
                    {dashboards.map((db) => (
                        <div
                            key={db}
                            onClick={() => setSelectedDashboard(db)}
                            className={`relative p-6 rounded-xl text-center cursor-pointer transition-all ${
                                selectedDashboard === db
                                        ? 'border-2 shadow-md'
                                        : 'border border-gray-200 bg-white shadow-sm hover:border-gray-400'
                            }`}
                            style={selectedDashboard === db ? { borderColor: 'var(--a-border-action-selected)', backgroundColor: 'var(--a-surface-selected)' } : undefined}
                        >
                            <button
                                className="absolute top-1.5 right-2 bg-transparent border-0 text-red-600 text-base cursor-pointer leading-none px-1 rounded opacity-0 hover:opacity-100 focus:opacity-100 group-hover:opacity-100"
                                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
                                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '0'; }}
                                onClick={(e) => { e.stopPropagation(); setDeletingDashboard(db); }}
                                title="Slett mappe"
                                aria-label={`Slett ${db}`}
                            >
                                ✕
                            </button>
                            <div className="text-4xl mb-3">📁</div>
                            <div className="text-sm font-medium text-gray-700 break-words">{db}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Valgt dashboard */}
            {selectedDashboard && (
                <div>
                    <div className="flex items-center gap-3 mb-5">
                        <BodyShort weight="semibold" className="text-lg">{selectedDashboard}</BodyShort>
                        <Button variant="secondary" size="small">Importer</Button>
                        <Button variant="secondary" size="small">Eksporter</Button>
                    </div>

                    {(dashboardGraphs[selectedDashboard] ?? []).length === 0 ? (
                        <div className="text-gray-400 text-sm text-center pt-12">
                            Ingen grafer lagt til i «{selectedDashboard}» ennå. Gå til Grafbygger-fanen og trykk «+ Legg til Dashboard».
                        </div>
                    ) : (
                        <div
                            className="grid gap-5"
                            style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}
                            onClick={() => setExpandedCardIndex(null)}
                        >
                            {(dashboardGraphs[selectedDashboard] ?? []).map((g, i) => (
                                <div
                                    key={g.title + i}
                                    draggable
                                    onDragStart={() => { dragIndexRef.current = i; }}
                                    onDragOver={(e) => { e.preventDefault(); setDragOverIndex(i); }}
                                    onDragLeave={() => setDragOverIndex(null)}
                                    onDrop={() => {
                                        const from = dragIndexRef.current;
                                        if (from === null || from === i) { setDragOverIndex(null); return; }
                                        setDashboardGraphs((prev) => {
                                            const list = [...(prev[selectedDashboard] ?? [])];
                                            const [moved] = list.splice(from, 1);
                                            list.splice(i, 0, moved);
                                            return { ...prev, [selectedDashboard]: list };
                                        });
                                        dragIndexRef.current = null;
                                        setDragOverIndex(null);
                                    }}
                                    onDragEnd={() => { dragIndexRef.current = null; setDragOverIndex(null); }}
                                    onDoubleClick={(e) => { e.stopPropagation(); setExpandedCardIndex(expandedCardIndex === i ? null : i); }}
                                    className={`relative border border-gray-200 rounded-xl bg-white overflow-hidden cursor-grab ${
                                        dragOverIndex === i ? 'outline outline-2 outline-dashed outline-blue-500' : ''
                                    }`}
                                    style={{ gridColumn: g.size === 'full' ? 'span 2' : 'span 1' }}
                                >
                                    <div className="h-64 relative overflow-hidden">
                                        <PinnedWidget result={{ data: g.data }} chartType={g.grafTab || 'linechart'} title={g.title} />
                                    </div>

                                    {/* expand overlay */}
                                    {expandedCardIndex === i && (
                                        <div
                                            className="absolute inset-0 bg-black/45 flex flex-col items-center justify-center gap-3 rounded-xl z-10"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <Button
                                                variant="primary"
                                                type="button"
                                                onClick={() => { onOpenInGrafbygger(g); setExpandedCardIndex(null); }}
                                            >
                                                Åpne i Grafbygger
                                            </Button>
                                            <Button
                                                variant="secondary"
                                                type="button"
                                                onClick={() => handleToggleSize(i)}
                                            >
                                                {g.size === 'full' ? 'Gjør halvbredde (1×2)' : 'Gjør fullbredde (2×2)'}
                                            </Button>
                                            <Button
                                                variant="danger"
                                                type="button"
                                                onClick={() => handleDeleteCard(i)}
                                            >
                                                Slett
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Slett dashboard-modal */}
            <Modal
                open={!!deletingDashboard}
                onClose={() => setDeletingDashboard(null)}
                header={{ heading: 'Slett mappe' }}
            >
                <Modal.Body>
                    <BodyShort>
                        Er du sikker på at du vil slette <strong>«{deletingDashboard}»</strong>?
                        Alle grafer i mappen vil også bli slettet.
                    </BodyShort>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="danger" onClick={() => { if (deletingDashboard) { handleDeleteDashboard(deletingDashboard); setDeletingDashboard(null); } }}>
                        Slett
                    </Button>
                    <Button variant="secondary" onClick={() => setDeletingDashboard(null)}>Avbryt</Button>
                </Modal.Footer>
            </Modal>

            {/* Opprett nytt dashboard-modal */}
            <Modal
                open={showNewDashboardModal}
                onClose={() => { setShowNewDashboardModal(false); setNewDashboardName(''); }}
                header={{ heading: 'Opprett nytt Dashboard' }}
            >
                <Modal.Body>
                    <TextField
                        label="Navn på dashboard"
                        placeholder="Navn på dashboard"
                        value={newDashboardName}
                        onChange={(e) => setNewDashboardName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && newDashboardName.trim()) {
                                setDashboards((prev) => [...prev, newDashboardName.trim()]);
                                setSelectedDashboard(newDashboardName.trim());
                                setNewDashboardName('');
                                setShowNewDashboardModal(false);
                            }
                        }}
                        autoFocus
                    />
                </Modal.Body>
                <Modal.Footer>
                    <Button
                        variant="primary"
                        disabled={!newDashboardName.trim()}
                        onClick={() => {
                            if (newDashboardName.trim()) {
                                setDashboards((prev) => [...prev, newDashboardName.trim()]);
                                setSelectedDashboard(newDashboardName.trim());
                                setNewDashboardName('');
                                setShowNewDashboardModal(false);
                            }
                        }}
                    >
                        Opprett
                    </Button>
                    <Button variant="secondary" onClick={() => { setShowNewDashboardModal(false); setNewDashboardName(''); }}>
                        Avbryt
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
}
