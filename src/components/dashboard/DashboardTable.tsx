import { useState, useMemo, useCallback } from 'react';
import '../../styles/charts.css';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

interface Props {
    data: any[];
    title?: string;
}

export default function DashboardTable({ data, title = 'Tabell' }: Props) {
    const [searchQuery, setSearchQuery] = useState('');
    const [sortColumn, setSortColumn] = useState<string | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

    const handleSort = useCallback((col: string) => {
        setSortColumn(prev => {
            if (prev === col) setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
            else setSortDirection('desc');
            return col;
        });
    }, []);

    const processed = useMemo(() => {
        if (!data?.length) return [];
        const filtered = searchQuery
            ? data.filter(row => Object.values(row).some(v => String(v ?? '').toLowerCase().includes(searchQuery.toLowerCase())))
            : data;
        if (!sortColumn) return filtered;
        return [...filtered].sort((a, b) => {
            const av = a[sortColumn], bv = b[sortColumn];
            if (av == null) return 1;
            if (bv == null) return -1;
            if (typeof av === 'number' && typeof bv === 'number')
                return sortDirection === 'asc' ? av - bv : bv - av;
            return sortDirection === 'asc'
                ? String(av).localeCompare(String(bv), 'nb-NO')
                : String(bv).localeCompare(String(av), 'nb-NO');
        });
    }, [data, searchQuery, sortColumn, sortDirection]);

    if (!data?.length) return <p className="text-gray-500 text-sm p-4">Ingen data.</p>;

    const keys = Object.keys(data[0]);

    return (
        <div className="widget-card">
            {/* Title + search bar */}
            <div className="widget-header">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span className="widget-title" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
                    <input
                        type="search"
                        placeholder="Søk…"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        style={{ fontSize: 12, padding: '3px 8px', border: '1px solid #d1d5db', borderRadius: 4, width: 140, color: '#374151', background: '#fff' }}
                    />
                </div>
            </div>

            {/* Table */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 1 }}>
                        <tr>
                            {keys.map(key => (
                                <th
                                    key={key}
                                    onClick={() => handleSort(key)}
                                    style={{ padding: '6px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', whiteSpace: 'nowrap', borderBottom: '1px solid #e5e7eb' }}
                                >
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                        {key}
                                        {sortColumn === key
                                            ? sortDirection === 'asc' ? <ArrowUp size={12} color="#2563eb" /> : <ArrowDown size={12} color="#2563eb" />
                                            : <ArrowUpDown size={12} color="#9ca3af" />}
                                    </span>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {processed.map((row, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                {keys.map(key => {
                                    const val = row[key];
                                    const display = val == null ? '–'
                                        : typeof val === 'number' ? val.toLocaleString('nb-NO')
                                        : typeof val === 'object' && 'value' in val ? String(val.value)
                                        : String(val);
                                    return (
                                        <td key={key} style={{ padding: '6px 12px', fontSize: 13, color: '#111827' }}>
                                            {display}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Footer */}
            <div style={{ padding: '4px 12px', borderTop: '1px solid #e5e7eb', background: '#f9fafb', fontSize: 11, color: '#9ca3af', flexShrink: 0 }}>
                {searchQuery ? `${processed.length} av ${data.length} rader` : `${data.length} ${data.length === 1 ? 'rad' : 'rader'}`}
            </div>
        </div>
    );
}
