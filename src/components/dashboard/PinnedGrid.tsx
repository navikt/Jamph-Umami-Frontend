import { useState } from 'react';
import PinnedWidget from './PinnedWidget';

export interface PinnedItem {
    id: string;
    customWidget: {
        id?: string;
        sql: string;
        chartType: string;
        result: any;
        size: { cols: number; rows: number };
        title: string;
        aiPrompt?: string;
    };
    colSpan: number;
    rowSpan: number;
}

interface PinnedGridProps {
    widgets: PinnedItem[];
    onReorder: (fromId: string, toId: string) => void;
    onDelete: (id: string) => void;
    onEdit?: (widget: PinnedItem) => void;
}

export default function PinnedGrid({ widgets, onReorder, onDelete, onEdit }: PinnedGridProps) {
    const [dragId, setDragId] = useState<string | null>(null);
    const [overId, setOverId] = useState<string | null>(null);
    const [overDelete, setOverDelete] = useState(false);

    if (widgets.length === 0) return null;

    return (
        <>
            <div className="grid grid-cols-2 gap-0">
                {widgets.map((w) => {
                    const isOver = overId === w.id && dragId !== w.id;
                    const isDragging = dragId === w.id;
                    return (
                        <div
                            key={w.id}
                            draggable
                            onDoubleClick={() => onEdit?.(w)}
                            onDragStart={(e) => { e.dataTransfer.setData('text/plain', w.id); e.dataTransfer.effectAllowed = 'move'; setDragId(w.id); }}
                            onDragEnd={() => { setDragId(null); setOverId(null); setOverDelete(false); }}
                            onDragEnter={(e) => { e.preventDefault(); if (dragId !== w.id) setOverId(w.id); }}
                            onDragOver={(e) => e.preventDefault()}
                            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverId(prev => prev === w.id ? null : prev); }}
                            onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); if (id && id !== w.id) { onReorder(id, w.id); } setDragId(null); setOverId(null); }}
                            style={{
                                gridColumn: `span ${w.colSpan}`,
                                gridRow: `span ${w.rowSpan}`,
                                aspectRatio: `${5 * w.colSpan}/${4 * w.rowSpan}`,
                                position: 'relative',
                                overflow: 'hidden',
                                border: '1px solid #e0e0e0',
                                background: '#fff',
                                opacity: isDragging ? 0.35 : 1,
                                transition: 'opacity 0.15s',
                                cursor: 'grab',
                            }}
                        >
                            {isOver && (
                                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.18)', zIndex: 10, pointerEvents: 'none' }} />
                            )}
                            <PinnedWidget result={w.customWidget.result} sql={w.customWidget.sql} chartType={w.customWidget.chartType} colSpan={w.colSpan} rowSpan={w.rowSpan} title={w.customWidget.title} />
                        </div>
                    );
                })}
            </div>

            {/* Delete zone — appears while any widget is being dragged */}
            {dragId && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0 8px', pointerEvents: 'none' }}>
                    <div
                        onDragEnter={(e) => { e.preventDefault(); setOverDelete(true); }}
                        onDragOver={(e) => e.preventDefault()}
                        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverDelete(false); }}
                            onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); if (id) { onDelete(id); } setDragId(null); setOverDelete(false); }}
                        style={{
                            pointerEvents: 'all',
                            width: 56,
                            height: 56,
                            borderRadius: '50%',
                            background: overDelete ? '#c0392b' : '#e74c3c',
                            border: `3px solid ${overDelete ? '#922b21' : '#c0392b'}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'copy',
                            transform: overDelete ? 'scale(1.18)' : 'scale(1)',
                            transition: 'transform 0.12s, background 0.12s, border-color 0.12s',
                            boxShadow: overDelete ? '0 4px 16px rgba(192,57,43,0.5)' : '0 2px 8px rgba(0,0,0,0.2)',
                        }}
                    >
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </div>
                </div>
            )}
        </>
    );
}
