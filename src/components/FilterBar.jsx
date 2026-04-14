/**
 * FilterBar — horizontal-scrollable filter bar with Apply + Reset buttons.
 * Change 13: supports required fields (red asterisk + error highlight).
 *
 * Props:
 *   filters: Array of { key, label, value, options, required? }
 *   onApply: (filterValues: object) => void
 *   onReset: (filterValues: object) => void
 *   requiredFields?: string[] — keys that are required (alternative to per-filter required)
 */
import { useState, useEffect } from 'react';
import { SlidersHorizontal, RotateCcw, X, ChevronDown, AlertCircle } from 'lucide-react';
import { useLang } from '../context/LanguageContext';
import { t } from '../lib/langHelper';

export default function FilterBar({ filters = [], onApply, onReset, onChange, requiredFields = [], appliedFilters = null }) {
    const { lang } = useLang();
    const [draft, setDraft] = useState(() =>
        Object.fromEntries(filters.map(f => [f.key, f.value ?? 'All']))
    );
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [fieldErrors, setFieldErrors] = useState({});
    const [showErrorBanner, setShowErrorBanner] = useState(false);

    // Cascade lock: a filter is locked if any PREVIOUS filter in the array
    // has more than 1 real option (i.e. it has choices) but hasn't been selected yet
    const isLocked = (key) => {
        const idx = filters.findIndex(f => f.key === key);
        if (idx <= 0) return false;
        for (let i = 0; i < idx; i++) {
            const prev = filters[i];
            const realOpts = (prev.options || []).filter(o => o.value !== 'All' && o.value !== undefined && o.value !== '');
            if (realOpts.length > 1 && (!draft[prev.key] || draft[prev.key] === 'All')) return true;
        }
        return false;
    };
    useEffect(() => {
        let autoNext = null;
        setDraft(prev => {
            const next = { ...prev };
            filters.forEach(f => {
                // Only sync from parent if the draft key doesn't exist yet (first mount)
                const parentVal = f.value ?? 'All';
                if (prev[f.key] === undefined) {
                    // Key doesn't exist yet — initialise it
                    next[f.key] = parentVal;
                }
                // Auto-select if exactly 1 real option, draft is still 'All', and filter is not locked.
                // Compute locked state from 'next' (not stale 'draft') so newly-selected upstream
                // filters are reflected immediately.
                const realOpts = (f.options || []).filter(o => o.value !== 'All' && o.value !== undefined && o.value !== '');
                const idx = filters.findIndex(ff => ff.key === f.key);
                const lockedInNext = idx > 0 && filters.slice(0, idx).some(prev => {
                    const prevReal = (prev.options || []).filter(o => o.value !== 'All' && o.value !== undefined && o.value !== '');
                    return prevReal.length > 1 && (!next[prev.key] || next[prev.key] === 'All');
                });
                if (realOpts.length === 1 && (!next[f.key] || next[f.key] === 'All') && !lockedInNext) {
                    next[f.key] = String(realOpts[0].value);
                }
                // NOTE: intentionally NOT syncing parent 'All' back into draft on options change —
                // that was causing language-change to reset user selections.
                // The Reset button calls handleReset() which sets the draft directly.
            });
            // Capture if anything changed so we can notify parent via onChange
            const anyChanged = Object.keys(next).some(k => next[k] !== (prev[k] ?? 'All'));
            if (anyChanged) autoNext = next;
            return next;
        });
        // Notify parent of auto-selected values so cascade logic in parent can react
        if (autoNext && onChange) onChange(autoNext);
    }, [filters.map(f => (f.options||[]).length).join(',')]); // eslint-disable-line

    // After any selection, cascade auto-select for downstream filters that have exactly one option and are now unlocked.
    // skipKey: the filter the user just changed — never auto-override their explicit choice.
    const cascadeAutoSelect = (d, skipKey = null) => {
        const result = { ...d };
        filters.forEach(f => {
            if (f.key === skipKey) return; // don't override the user's explicit selection
            const realOpts = (f.options || []).filter(o => o.value !== 'All' && o.value !== undefined && o.value !== '');
            const fidx = filters.findIndex(ff => ff.key === f.key);
            const locked = fidx > 0 && filters.slice(0, fidx).some(prev => {
                const prevReal = (prev.options || []).filter(o => o.value !== 'All' && o.value !== undefined && o.value !== '');
                return prevReal.length > 1 && (!result[prev.key] || result[prev.key] === 'All');
            });
            if (realOpts.length === 1 && (!result[f.key] || result[f.key] === 'All') && !locked) {
                result[f.key] = String(realOpts[0].value);
            }
        });
        return result;
    };

    const handleChange = (key, val) => {
        // Reset all filters that come AFTER the changed one in the displayed order.
        // Using the filters array position (not a hardcoded hierarchy) so pages that
        // display filters in a custom order (e.g. Division before Curriculum) don't
        // have upstream filters reset when a downstream one changes.
        const idx = filters.findIndex(f => f.key === key);
        let newDraft = { ...draft, [key]: val };
        if (idx >= 0) {
            filters.slice(idx + 1).forEach(f => { newDraft[f.key] = 'All'; });
        }
        // Pass skipKey so the user's explicit choice (including 'All') is never overridden.
        newDraft = cascadeAutoSelect(newDraft, key);
        setDraft(newDraft);
        if (onChange) onChange(newDraft);
        if (fieldErrors[key]) setFieldErrors(prev => ({ ...prev, [key]: false }));
        if (showErrorBanner) setShowErrorBanner(false);
    };

    // Change 13: validate required fields before applying
    const handleApply = () => {
        const required = filters.filter(f => f.required).map(f => f.key).concat(requiredFields);
        const errors = {};
        required.forEach(key => {
            if (!draft[key] || draft[key] === 'All') errors[key] = true;
        });

        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
            setShowErrorBanner(true);
            return;
        }

        setFieldErrors({});
        setShowErrorBanner(false);
        if (onApply) onApply(draft);
        setDrawerOpen(false);
    };

    const handleReset = () => {
        const reset = Object.fromEntries(filters.map(f => [f.key, 'All']));
        setDraft(reset);
        if (onChange) onChange(reset);
        setFieldErrors({});
        setShowErrorBanner(false);
        if (onReset) onReset(reset);
        setDrawerOpen(false);
    };

    const activeCount = appliedFilters
        ? filters.filter(f => (appliedFilters[f.key] ?? 'All') !== 'All').length
        : filters.filter(f => (draft[f.key] ?? 'All') !== 'All').length;
    const hasRequired = filters.some(f => f.required) || requiredFields.length > 0;

    const selectStyle = {
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 10px center',
        paddingRight: '2rem',
        appearance: 'none',
    };

    const isError = (key) => fieldErrors[key];

    return (
        <>
            {/* ── ERROR BANNER (Change 13) ──────────────────────────────── */}
            {showErrorBanner && (
                <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-medium">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    {lang === 'ar' ? 'يرجى ملء جميع الحقول المطلوبة' : 'Please fill in all required fields'}
                    <span className="font-bold text-red-500 mx-1">*</span>
                    {lang === 'ar' ? 'قبل تطبيق الفلتر.' : 'before applying the filter.'}
                    <button onClick={() => setShowErrorBanner(false)} className="mx-auto text-red-400 hover:text-red-600">
                        <X className="h-4 w-4" />
                    </button>
                </div>
            )}

            {/* ── DESKTOP ─────────────────────────────────────────────────── */}
            <div className="hidden md:block bg-white border border-[#e2e8f0] rounded-xl shadow-sm">
                <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-[#f1f5f9]">
                    <SlidersHorizontal className="h-4 w-4 text-[#1d4ed8]" />
                    <span className="text-sm font-bold text-[#0f172a]">{lang === 'ar' ? 'تصفية حسب' : 'Filter by'}</span>
                    {activeCount > 0 && (
                        <span className="mx-1 text-xs font-bold bg-[#1d4ed8] text-white px-2 py-0.5 rounded-full">
                            {activeCount} {lang === 'ar' ? 'نشط' : 'active'}
                        </span>
                    )}
                    {/* Change 13: required legend */}
                    {hasRequired && (
                        <span className="mx-auto text-[10px] text-[#94a3b8] flex items-center gap-1">
                            <span className="text-red-500 font-bold">*</span> {lang === 'ar' ? 'حقل مطلوب' : 'Required field'}
                        </span>
                    )}
                </div>
                <div className="flex items-end gap-4 px-4 py-3 overflow-x-auto"
                    style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 transparent' }}>
                    {filters.map(f => (
                        <div key={f.key} className="flex flex-col gap-1 flex-shrink-0">
                            {/* Change 13: red asterisk for required */}
                            <label className={`text-[10px] font-bold uppercase tracking-wider whitespace-nowrap flex items-center gap-0.5 ${isError(f.key) ? 'text-red-500' : isLocked(f.key) ? 'text-[#cbd5e1]' : 'text-[#64748b]'}`}>
                                {f.label}
                                {f.required && <span className="text-red-500 font-black">*</span>}
                                {isLocked(f.key) && <span className="mx-0.5">🔒</span>}
                            </label>
                            <select
                                value={draft[f.key] ?? 'All'}
                                onChange={e => handleChange(f.key, e.target.value)}
                                disabled={isLocked(f.key)}
                                className={`h-9 px-3 rounded-lg border text-sm font-medium focus:outline-none focus:ring-2 min-w-[130px] transition-colors ${
                                    isLocked(f.key)
                                        ? 'border-[#e2e8f0] bg-[#f8fafc] text-[#cbd5e1] cursor-not-allowed opacity-60'
                                        : isError(f.key)
                                        ? 'border-red-400 bg-red-50 text-[#0f172a] focus:ring-red-200 cursor-pointer'
                                        : 'border-[#e2e8f0] bg-white text-[#0f172a] focus:ring-[#1d4ed8]/30 cursor-pointer'
                                }`}
                                style={selectStyle}
                            >
                                {f.options.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>
                    ))}
                    <div className="flex items-end gap-2 flex-shrink-0 mx-2">
                        <button onClick={handleApply}
                            className="h-9 px-5 bg-[#1d4ed8] hover:bg-[#1e40af] text-white text-sm font-bold rounded-lg transition-all whitespace-nowrap shadow-sm">
                            {t('applyFilters', lang)}
                        </button>
                        <button onClick={handleReset}
                            className="h-9 px-4 border border-[#e2e8f0] text-[#64748b] text-sm font-bold rounded-lg hover:bg-slate-50 transition-all whitespace-nowrap flex items-center gap-1.5">
                            <RotateCcw className="h-3.5 w-3.5" /> {t('resetFilters', lang)}
                        </button>
                    </div>
                </div>
            </div>

            {/* ── MOBILE TRIGGER ──────────────────────────────────────────── */}
            <div className="md:hidden">
                <button onClick={() => setDrawerOpen(true)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-white border border-[#e2e8f0] rounded-xl shadow-sm text-sm font-bold text-[#0f172a]">
                    <span className="flex items-center gap-2">
                        <SlidersHorizontal className="h-4 w-4 text-[#1d4ed8]" />
                        {lang === 'ar' ? 'تصفية حسب' : 'Filter by'}
                        {activeCount > 0 && (
                            <span className="text-xs font-bold bg-[#1d4ed8] text-white px-2 py-0.5 rounded-full">
                                {activeCount}
                            </span>
                        )}
                        {Object.values(fieldErrors).some(Boolean) && (
                            <span className="text-xs font-bold bg-red-500 text-white px-2 py-0.5 rounded-full">!</span>
                        )}
                    </span>
                    <ChevronDown className="h-4 w-4 text-[#94a3b8]" />
                </button>
            </div>

            {/* ── MOBILE DRAWER ────────────────────────────────────────────── */}
            {drawerOpen && (
                <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
                    <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
                    <div className="relative bg-white rounded-t-2xl shadow-2xl z-10 max-h-[85vh] flex flex-col">
                        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[#e2e8f0]">
                            <span className="flex items-center gap-2 font-bold text-[#0f172a]">
                                <SlidersHorizontal className="h-4 w-4 text-[#1d4ed8]" /> Filters
                            </span>
                            {hasRequired && (
                                <span className="text-[10px] text-[#94a3b8] flex items-center gap-1">
                                    <span className="text-red-500 font-bold">*</span> {lang === 'ar' ? 'مطلوب' : 'Required'}
                                </span>
                            )}
                            <button onClick={() => setDrawerOpen(false)}
                                className="p-1.5 rounded-lg hover:bg-slate-100 text-[#64748b]">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                            {filters.map(f => (
                                <div key={f.key}>
                                    <label className={`block text-xs font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1 ${isError(f.key) ? 'text-red-500' : isLocked(f.key) ? 'text-[#cbd5e1]' : 'text-[#64748b]'}`}>
                                        {f.label}
                                        {f.required && <span className="text-red-500 font-black">*</span>}
                                        {isLocked(f.key) && <span>🔒</span>}
                                    </label>
                                    <select
                                        value={draft[f.key] ?? 'All'}
                                        onChange={e => handleChange(f.key, e.target.value)}
                                        disabled={isLocked(f.key)}
                                        className={`w-full h-11 px-3 rounded-xl border text-sm font-medium focus:outline-none focus:ring-2 ${
                                            isLocked(f.key)
                                                ? 'border-[#e2e8f0] bg-[#f8fafc] text-[#cbd5e1] cursor-not-allowed opacity-60'
                                                : isError(f.key)
                                                ? 'border-red-400 bg-red-50 text-[#0f172a] focus:ring-red-200'
                                                : 'border-[#e2e8f0] bg-white text-[#0f172a] focus:ring-[#1d4ed8]/30'
                                        }`}
                                        style={selectStyle}>
                                        {f.options.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                    {/* Change 13: inline error message */}
                                    {isError(f.key) && (
                                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                            <AlertCircle className="h-3 w-3" /> {lang === 'ar' ? 'هذا الحقل مطلوب' : 'This field is required'}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="px-5 py-4 border-t border-[#e2e8f0] flex gap-3">
                            <button onClick={handleReset}
                                className="flex-1 h-11 border border-[#e2e8f0] text-[#64748b] font-bold rounded-xl hover:bg-slate-50 flex items-center justify-center gap-2">
                                <RotateCcw className="h-4 w-4" /> {t('resetFilters', lang)}
                            </button>
                            <button onClick={handleApply}
                                className="flex-1 h-11 bg-[#1d4ed8] text-white font-bold rounded-xl hover:bg-[#1e40af]">
                                {t('applyFilters', lang)}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
