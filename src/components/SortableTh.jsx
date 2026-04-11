import { useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';

/**
 * Sortable + searchable table header cell.
 *
 * Sort-only (original usage):
 *   <SortableTh col="name" sortCol={sortCol} sortDir={sortDir} onSort={handleSort}>Name</SortableTh>
 *
 * With column search (click magnifier icon to open input, Escape or X to close):
 *   <SortableTh
 *     col="name" sortCol={sortCol} sortDir={sortDir} onSort={handleSort}
 *     searchValue={columnSearch['name'] || ''}
 *     isSearchOpen={activeSearch === 'name'}
 *     onSearchOpen={() => setActiveSearch('name')}
 *     onSearchClose={() => { setActiveSearch(null); setColumnSearch('name', ''); }}
 *     onSearchChange={v => setColumnSearch('name', v)}
 *   >Name</SortableTh>
 */
export default function SortableTh({
    col, sortCol, sortDir, onSort, children, className = '',
    searchValue, isSearchOpen, onSearchOpen, onSearchClose, onSearchChange,
}) {
    const active = sortCol === col;
    const hasSearch = onSearchOpen !== undefined;
    const inputRef = useRef(null);

    useEffect(() => {
        if (isSearchOpen && inputRef.current) inputRef.current.focus();
    }, [isSearchOpen]);

    if (hasSearch && isSearchOpen) {
        return (
            <th
                className={`py-2 px-3 text-xs font-black text-[#64748b] uppercase tracking-wider whitespace-nowrap ${className}`}
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center gap-1 min-w-[120px]">
                    <Search className="h-3 w-3 text-[#94a3b8] flex-shrink-0" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={searchValue || ''}
                        onChange={e => onSearchChange?.(e.target.value)}
                        onKeyDown={e => e.key === 'Escape' && onSearchClose?.()}
                        placeholder="Search..."
                        className="flex-1 text-xs font-normal normal-case tracking-normal border-b border-[#1d4ed8] bg-transparent outline-none text-[#0f172a] placeholder-[#94a3b8] min-w-0 py-0.5"
                        onClick={e => e.stopPropagation()}
                    />
                    <button
                        onClick={e => { e.stopPropagation(); onSearchClose?.(); }}
                        className="flex-shrink-0 text-[#94a3b8] hover:text-[#475569]"
                    >
                        <X className="h-3 w-3" />
                    </button>
                </div>
            </th>
        );
    }

    return (
        <th
            onClick={() => onSort(col)}
            className={`py-4 px-6 text-sm font-bold text-[#1e293b] cursor-pointer select-none group whitespace-nowrap text-center ${className}`}
        >
            <span className="flex items-center justify-center gap-2">
                {children}
                <span className={`transition-all text-sm font-bold ${active ? 'text-[#1d4ed8]' : 'text-[#64748b] group-hover:text-[#1d4ed8]'}`}>
                    {active ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                </span>
                {hasSearch && (
                    <button
                        onClick={e => { e.stopPropagation(); onSearchOpen?.(); }}
                        className={`transition-all font-bold ${searchValue ? 'text-[#dc2626]' : 'text-[#64748b] group-hover:text-[#1d4ed8]'}`}
                        title={`Search by ${typeof children === 'string' ? children : col}`}
                    >
                        <Search className="h-4 w-4" />
                    </button>
                )}
            </span>
        </th>
    );
}
