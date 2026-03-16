import React, { useState, useEffect, useRef } from 'react';
import PinnedWidget from './PinnedWidget';
import { WIDGET_SIZES } from '../../lib/widgetSizes';

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

type ExternalWidgetDrop = { chartType: string; sql: string; result: any; title: string; aiPrompt?: string; size: { cols: number; rows: number } };

interface PinnedGridProps {
    widgets: PinnedItem[];
    onReorder: (fromId: string, toId: string) => void;
    onDelete: (id: string) => void;
    onEdit?: (widget: PinnedItem) => void;
    onResize?: (id: string, size: { cols: number; rows: number }) => void;
    onDropExternal?: (data: ExternalWidgetDrop) => void;
}

export default function PinnedGrid({ widgets, onReorder, onDelete, onEdit, onResize, onDropExternal }: PinnedGridProps) {
    const [dragId, setDragId] = useState<string | null>(null);
    const [overId, setOverId] = useState<string | null>(null);
    const [overDelete, setOverDelete] = useState(false);
    const [externalOver, setExternalOver] = useState(false);
    const [activeOverlayId, setActiveOverlayId] = useState<string | null>(null);
    const scrollRafRef = useRef<number | null>(null);

    useEffect(() => {
        if (!dragId) { if (scrollRafRef.current) { cancelAnimationFrame(scrollRafRef.current); scrollRafRef.current = null; } return; }
        const ZONE = 80; const SPEED = 12;
        let lastY = 0;
        const onDragOver = (e: DragEvent) => { lastY = e.clientY; };
        const scroll = () => {
            if (lastY < ZONE) window.scrollBy(0, -SPEED);
            else if (lastY > window.innerHeight - ZONE) window.scrollBy(0, SPEED);
            scrollRafRef.current = requestAnimationFrame(scroll);
        };
        window.addEventListener('dragover', onDragOver);
        scrollRafRef.current = requestAnimationFrame(scroll);
        return () => { window.removeEventListener('dragover', onDragOver); if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current); };
    }, [dragId]);

    function handleExternalDrop(e: React.DragEvent) {
        const raw = e.dataTransfer.getData('application/aibygger');
        if (raw && onDropExternal) { try { onDropExternal(JSON.parse(raw)); } catch { /* ignore */ } }
    }

    if (widgets.length === 0) {
        return (
            <div
                onDragOver={(e) => { if (e.dataTransfer.types.includes('application/aibygger')) { e.preventDefault(); setExternalOver(true); } }}
                onDragLeave={() => setExternalOver(false)}
                onDrop={(e) => { e.preventDefault(); handleExternalDrop(e); setExternalOver(false); }}
                style={{ minHeight: 120, border: `2px dashed ${externalOver ? '#0067C5' : '#d1d5db'}`, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 13, transition: 'border-color 0.15s, background 0.15s', background: externalOver ? '#eff6ff' : 'transparent', margin: '8px 0' }}
            >
                Slipp her for å legge til widget
            </div>
        );
    }

    return (
        <>
            <div
                data-pinned-grid
                className="grid grid-cols-2 gap-0"
                onDragOver={(e) => { if (e.dataTransfer.types.includes('application/aibygger')) { e.preventDefault(); setExternalOver(true); } }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setExternalOver(false); }}
                onDrop={(e) => { const raw = e.dataTransfer.getData('application/aibygger'); if (raw) { e.preventDefault(); handleExternalDrop(e); setExternalOver(false); } }}
                style={{ outline: externalOver ? '2px dashed #0067C5' : 'none', outlineOffset: 2, borderRadius: 4, transition: 'outline-color 0.15s' }}
            >
                {widgets.map((w) => {
                    const isOver = overId === w.id && dragId !== w.id;
                    const isDragging = dragId === w.id;
                    return (
                        <div
                            key={w.id}
                            draggable
                            onDoubleClick={(e) => { e.stopPropagation(); setActiveOverlayId(prev => prev === w.id ? null : w.id); }}
                            onDragStart={(e) => { e.dataTransfer.setData('text/plain', w.id); e.dataTransfer.effectAllowed = 'move'; setDragId(w.id); setExternalOver(false); }}
                            onDragEnd={() => { setDragId(null); setOverId(null); setOverDelete(false); }}
                            onDragEnter={(e) => { e.preventDefault(); if (dragId !== w.id) setOverId(w.id); }}
                            onDragOver={(e) => e.preventDefault()}
                            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverId(prev => prev === w.id ? null : prev); }}
                            onDrop={(e) => { e.preventDefault(); const raw = e.dataTransfer.getData('application/aibygger'); if (raw) { e.stopPropagation(); handleExternalDrop(e); setExternalOver(false); return; } const id = e.dataTransfer.getData('text/plain'); if (id && id !== w.id) { onReorder(id, w.id); } setDragId(null); setOverId(null); }}
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
                            {activeOverlayId === w.id && (
                                <div
                                    style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                                    onClick={() => setActiveOverlayId(null)}
                                >
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onEdit?.(w); setActiveOverlayId(null); setTimeout(() => document.getElementById('ki-bygger-accordion')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); }}
                                        style={{ padding: '6px 20px', background: '#0067C5', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14, fontWeight: 500 }}
                                    >Åpne i KI bygger</button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onDelete(w.id); setActiveOverlayId(null); }}
                                        style={{ padding: '6px 20px', background: '#c0392b', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14, fontWeight: 500 }}
                                    >Slett</button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onDelete(w.id); onEdit?.(w); setActiveOverlayId(null); setTimeout(() => document.getElementById('ki-bygger-accordion')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); }}
                                        style={{ padding: '6px 20px', background: '#0067C5', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14, fontWeight: 500 }}
                                    >Slett og åpne i KI bygger</button>
                                    {(WIDGET_SIZES[w.customWidget.chartType] ?? []).length > 0 && (
                                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 }}>
                                            {(WIDGET_SIZES[w.customWidget.chartType] ?? []).map(size => (
                                                <button
                                                    key={size.name}
                                                    onClick={(e) => { e.stopPropagation(); onResize?.(w.id, size); setActiveOverlayId(null); }}
                                                    style={{ padding: '4px 12px', background: (w.colSpan === size.cols && w.rowSpan === size.rows) ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.2)', color: (w.colSpan === size.cols && w.rowSpan === size.rows) ? '#111' : '#fff', border: '1px solid rgba(255,255,255,0.5)', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: (w.colSpan === size.cols && w.rowSpan === size.rows) ? 700 : 400 }}
                                                >{size.name}</button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Delete zone — fixed to bottom of screen while dragging */}
            {dragId && (
                <div style={{
                    position: 'fixed',
                    bottom: 72,
                    left: 0,
                    right: 0,
                    display: 'flex',
                    justifyContent: 'center',
                    zIndex: 9999,
                    pointerEvents: 'none',
                }}>
                    <div
                        onDragEnter={(e) => { e.preventDefault(); setOverDelete(true); }}
                        onDragOver={(e) => e.preventDefault()}
                        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverDelete(false); }}
                        onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); if (id) { onDelete(id); } setDragId(null); setOverDelete(false); }}
                        style={{
                            pointerEvents: 'all',
                            width: overDelete ? 72 : 56,
                            height: overDelete ? 72 : 56,
                            borderRadius: '50%',
                            background: overDelete ? '#c0392b' : '#e74c3c',
                            border: `3px solid ${overDelete ? '#922b21' : '#c0392b'}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'copy',
                            transition: 'width 0.12s, height 0.12s, background 0.12s, border-color 0.12s',
                            boxShadow: overDelete ? '0 4px 24px rgba(192,57,43,0.6)' : '0 2px 12px rgba(0,0,0,0.25)',
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
