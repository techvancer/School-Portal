import { useState, useCallback } from 'react';

/**
 * Per-column search hook.
 * Returns:
 *   columnSearch  — { colKey: searchString }
 *   activeSearch  — which column's input is open
 *   setActiveSearch
 *   setColumnSearch
 *   applyColumnSearch(rows) — filters rows by all active column searches
 *   clearColumnSearch(col)
 */
export function useColumnSearch() {
    const [columnSearch, setColumnSearchState] = useState({});
    const [activeSearch, setActiveSearch] = useState(null);

    const setColumnSearch = useCallback((col, value) => {
        setColumnSearchState(prev => {
            if (value === '' || value === undefined) {
                const next = { ...prev };
                delete next[col];
                return next;
            }
            return { ...prev, [col]: value };
        });
    }, []);

    const clearColumnSearch = useCallback((col) => {
        setColumnSearchState(prev => {
            const next = { ...prev };
            delete next[col];
            return next;
        });
        setActiveSearch(null);
    }, []);

    const applyColumnSearch = useCallback((rows) => {
        const entries = Object.entries(columnSearch).filter(([, v]) => v && v.trim() !== '');
        if (!entries.length) return rows;
        return rows.filter(row =>
            entries.every(([col, term]) => {
                const val = row[col];
                if (val === undefined || val === null) return false;
                return String(val).toLowerCase().includes(term.toLowerCase());
            })
        );
    }, [columnSearch]);

    return { columnSearch, activeSearch, setActiveSearch, setColumnSearch, clearColumnSearch, applyColumnSearch };
}
