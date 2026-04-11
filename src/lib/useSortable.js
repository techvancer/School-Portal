import { useState, useMemo } from 'react';

/**
 * Reusable sort hook for table data.
 * Usage: const { sorted, sortCol, sortDir, handleSort } = useSortable(data, 'name');
 */
export function useSortable(data = [], defaultCol = '', defaultDir = 'asc') {
    const [sortCol, setSortCol] = useState(defaultCol);
    const [sortDir, setSortDir] = useState(defaultDir);

    const handleSort = (col) => {
        if (sortCol === col) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortCol(col);
            setSortDir('asc');
        }
    };

    const sorted = useMemo(() => {
        if (!sortCol) return data;
        return [...data].sort((a, b) => {
            const av = a[sortCol] ?? '';
            const bv = b[sortCol] ?? '';
            const an = Number(av), bn = Number(bv);
            const cmp = (!isNaN(an) && !isNaN(bn))
                ? an - bn
                : String(av).toLowerCase().localeCompare(String(bv).toLowerCase());
            return sortDir === 'asc' ? cmp : -cmp;
        });
    }, [data, sortCol, sortDir]);

    return { sorted, sortCol, sortDir, handleSort };
}
