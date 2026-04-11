import { t, getField, getStudentName as _getStudentName } from '../lib/langHelper';
import { useLang } from '../context/LanguageContext';
import { useLocation } from 'react-router-dom';
import { useState, useCallback, useEffect, useRef } from 'react';
import { Search, Loader2 } from 'lucide-react';
import Breadcrumb from '../components/Breadcrumb';
import { useSortable } from '../lib/useSortable';
import { useColumnSearch } from '../lib/useColumnSearch';
import SortableTh from '../components/SortableTh';
import { useAuth } from '../context/AuthContext';
import { rest } from '../lib/supabaseClient';
import { useFilterData } from '../lib/useFilterData';
import { buildFilters, EMPTY_FILTER } from '../lib/helpers';

function getStudentFullName(s, lang) {
    return _getStudentName(s, lang) || '—';
}

export default function Students() {
    const { lang, isAr } = useLang();

    const { user } = useAuth();
    const location = useLocation();
    const hasRunFromState = useRef(false);
    const filterData = useFilterData(user, lang);

    const [students, setStudents] = useState([]);
    const { sorted: sortedStudents, sortCol, sortDir, handleSort } = useSortable(students, 'studentid');
    const { columnSearch, activeSearch, setActiveSearch, setColumnSearch, applyColumnSearch } = useColumnSearch();
    const [loading, setLoading]   = useState(false);
    const [hasApplied, setHasApplied] = useState(false); // don't show table until Apply pressed
    const [search, setSearch]     = useState('');
    const [draft, setDraft]       = useState({ ...EMPTY_FILTER });
    const [fieldErrors, setFieldErrors] = useState({});

    // All filter keys (excludes examid per previous change)
    const filterFields = buildFilters(draft, filterData, {}, lang).filter(f => f.key !== 'examid');
    // All are required — every key must not be 'All'
    const REQUIRED_KEYS = filterFields.map(f => f.key);

    // Auto-select any dropdown that has exactly one real option
    useEffect(() => {
        const updates = {};
        filterFields.forEach(f => {
            const realOpts = (f.options || []).filter(o => o.value !== 'All' && o.value !== undefined && o.value !== '');
            if (realOpts.length === 1 && (!draft[f.key] || draft[f.key] === 'All')) {
                updates[f.key] = String(realOpts[0].value);
            }
        });
        if (Object.keys(updates).length > 0) {
            setDraft(prev => ({ ...prev, ...updates }));
        }
    }, [filterData]);

    const fetchData = useCallback(async (filters) => {
        if (!user) return;
        try {
            setLoading(true);
            const [empSec, stuList, stuScRows, clTbl, secRows, divList, curList] = await Promise.all([
                rest('employees_sections_subjects_classes_semisters_curriculums_tbl', {
                    employeeid: `eq.${user.employeeid}`, select: 'classid,sectionid,stageid'
                }),
                rest('students_tbl', { select: '*' }),
                rest('students_sections_classes_tbl', {
                    schoolid:  `eq.${user.schoolid}`,
                    branchid:  `eq.${user.branchid}`,
                    select: '*',
                    ...(filters.classid      && filters.classid      !== 'All' ? { classid:      `eq.${filters.classid}` }      : {}),
                    ...(filters.sectionid    && filters.sectionid    !== 'All' ? { sectionid:    `eq.${filters.sectionid}` }    : {}),
                    ...(filters.stageid      && filters.stageid      !== 'All' ? { stageid:      `eq.${filters.stageid}` }      : {}),
                    ...(filters.divisionid   && filters.divisionid   !== 'All' ? { divisionid:   `eq.${filters.divisionid}` }   : {}),
                    ...(filters.curriculumid && filters.curriculumid !== 'All' ? { curriculumid: `eq.${filters.curriculumid}` } : {}),
                }),
                rest('classes_tbl',   { select: '*' }),
                rest('sections_tbl',  { select: '*' }),
                rest('divisions_tbl',  { schoolid: `eq.${user.schoolid}`, branchid: `eq.${user.branchid}`, select: '*' }).catch(() => []),
                rest('curriculums_tbl',{ schoolid: `eq.${user.schoolid}`, branchid: `eq.${user.branchid}`, select: '*' }).catch(() => []),
            ]);

            const seen = new Set();
            const mySec = empSec.filter(r => {
                const k = `${r.classid}-${r.sectionid}`;
                if (seen.has(k)) return false; seen.add(k); return true;
            });
            const myClassSec = new Set(mySec.map(r => `${r.classid}-${r.sectionid}`));

            const merged = stuList.map(s => {
                const sc = stuScRows.find(x => x.studentid === s.studentid);
                if (!sc) return null;
                if (!myClassSec.has(`${sc.classid}-${sc.sectionid}`)) return null;
                const cl  = clTbl.find(c => c.classid === sc.classid);
                const sec = secRows.find(x => x.sectionid === sc.sectionid);
                const div = divList.find(d => String(d.divisionid) === String(sc.divisionid));
                const cur = curList.find(c => String(c.curriculumid) === String(sc.curriculumid));
                return {
                    ...s,
                    classid: sc.classid, sectionid: sc.sectionid,
                    stageid: sc.stageid, divisionid: sc.divisionid, curriculumid: sc.curriculumid,
                    classname:     getField(cl, 'classname', 'classname_en', lang)  || cl?.classname  || '—',
                    sectionname:   getField(sec, 'sectionname', 'sectionname_en', lang) || sec?.sectionname || '—',
                    divisionname:  getField(div, 'divisionname', 'divisionname_en', lang)  || div?.divisionname  || '—',
                    curriculumname:getField(cur, 'curriculumname', 'curriculumname_en', lang) || cur?.curriculumname || '—',
                    fullName: getStudentFullName(s, lang),
                };
            }).filter(Boolean);

            setStudents(merged);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [user, lang]);
    // Read URL params from dashboard card click and auto-apply
    useEffect(() => {
        if (!user || hasRunFromState.current) return;
        hasRunFromState.current = true;
        const keys = ['curriculumid','divisionid','stageid','classid','sectionid'];
        const fromUrl = {};
        const state = location.state || {};
        keys.forEach(k => { if (state[k]) fromUrl[k] = state[k]; });
        // Only auto-apply if navigated here with filter state from another page
        if (Object.keys(fromUrl).length > 0) {
            const merged = { ...EMPTY_FILTER, ...fromUrl };
            setDraft(merged);
            setHasApplied(true);
            fetchData(merged);
        }
    }, [fetchData, user]);


    const handleDraftChange = (key, val) => {
        setDraft(prev => ({ ...prev, [key]: val }));
        if (fieldErrors[key]) setFieldErrors(prev => ({ ...prev, [key]: false }));
    };

    const handleApply = () => {
        // Validate: all filter fields must be selected (not 'All')
        const errors = {};
        REQUIRED_KEYS.forEach(key => {
            if (!draft[key] || draft[key] === 'All') errors[key] = true;
        });
        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
            return;
        }
        setFieldErrors({});
        setHasApplied(true);
        fetchData(draft);
    };

    const handleReset = () => {
        setDraft({ ...EMPTY_FILTER });
        setFieldErrors({});
        setStudents([]);
        setHasApplied(false);
        setSearch('');
    };

    const filtered = applyColumnSearch(sortedStudents.filter(s => {
        if (!search) return true;
        return s.fullName?.toLowerCase().includes(search.toLowerCase());
    }));

    const selectStyle = {
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
        paddingRight: '2rem', appearance: 'none',
    };


    useEffect(() => {
        if (!hasApplied) return;
        fetchData(draft);
    }, [lang, hasApplied, draft, fetchData]);

    return (
        <div className="space-y-6 pb-12">
            <div>
                <h1 className="text-xl sm:text-2xl font-bold text-[#0f172a]">{t('students', lang)}</h1>
                <p className="text-[#64748b] text-sm">{t('studentsEnrolledHeading', lang) || 'Students enrolled in your classes'}</p>
                <Breadcrumb />
            </div>

            {/* Filter — all fields required */}
            <div className="bg-white border border-[#e2e8f0] rounded-xl shadow-sm">
                <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-[#f1f5f9]">
                    <span className="text-sm font-bold text-[#0f172a]">{t('filterStudents', lang) || 'Filter Students'}</span>
                    <span className="text-xs text-[#94a3b8] ml-1">· {t('allFieldsRequiredDesc', lang) || 'All fields marked * are required'}</span>
                </div>
                <div className="flex items-end gap-4 px-4 py-3 overflow-x-auto flex-wrap">
                    {filterFields.map(f => (
                        <div key={f.key} className="flex flex-col gap-1 flex-shrink-0">
                            <label className={`text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${fieldErrors[f.key] ? 'text-red-500' : 'text-[#64748b]'}`}>
                                {f.label} <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={draft[f.key] ?? 'All'}
                                onChange={e => handleDraftChange(f.key, e.target.value)}
                                className={`h-9 pl-3 rounded-lg border text-sm font-medium focus:outline-none focus:ring-2 min-w-[130px] transition-colors ${
                                    fieldErrors[f.key]
                                        ? 'border-red-400 bg-red-50 focus:ring-red-200'
                                        : 'border-[#e2e8f0] bg-white focus:ring-[#1d4ed8]/30'
                                }`}
                                style={selectStyle}
                            >
                                {(f.options || []).map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                            {fieldErrors[f.key] && (
                                <span className="text-[10px] text-red-500 font-medium">{t('required', lang)}</span>
                            )}
                        </div>
                    ))}
                    <div className="flex items-end gap-2 flex-shrink-0 ml-2">
                        <button
                            onClick={handleApply}
                            className="h-9 px-5 bg-[#1d4ed8] hover:bg-[#1e40af] text-white text-sm font-bold rounded-lg transition-all whitespace-nowrap shadow-sm"
                        >
                            {t('applyFilter', lang)}
                        </button>
                        <button
                            onClick={handleReset}
                            className="h-9 px-4 border border-[#e2e8f0] text-[#64748b] text-sm font-bold rounded-lg hover:bg-slate-50 transition-all"
                        >
                            {t('reset', lang)}
                        </button>
                    </div>
                </div>
            </div>

            {/* Only show search + table after Apply Filter is pressed */}
            {!hasApplied ? (
                <div className="bg-white rounded-xl border border-[#e2e8f0] py-16 flex flex-col items-center justify-center gap-3 text-[#94a3b8]">
                    <Search className="h-10 w-10 opacity-30" />
                    <p className="text-sm font-medium">{t('studentsFilterPrompt', lang) || 'Fill all filters and press Apply Filter to see students.'}</p>
                </div>
            ) : (
                <>
                    {/* Search */}
                    <div className="bg-white rounded-xl border border-[#e2e8f0] p-4 flex items-center gap-3">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94a3b8]" />
                            <input
                                type="text"
                                placeholder={t('searchStudentPlaceholder', lang) || 'Search student by name...'}
                                className="input-field pl-10 h-10 w-full"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                        <span className="text-xs text-[#94a3b8] font-medium whitespace-nowrap">
                            {filtered.length} result{filtered.length !== 1 ? 's' : ''}
                        </span>
                    </div>

                    {/* Table */}
                    <div className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden">
                        <div className="overflow-x-auto" dir={isAr ? 'rtl' : 'ltr'}>
                            <table className={`w-full ${isAr ? 'text-right' : 'text-left'} min-w-[800px]`}>
                                <thead className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                                    <tr>
                                        <SortableTh col="studentid" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-4" searchValue={columnSearch['studentid']} isSearchOpen={activeSearch === 'studentid'} onSearchOpen={() => setActiveSearch('studentid')} onSearchClose={() => { setActiveSearch(null); setColumnSearch('studentid', ''); }} onSearchChange={v => setColumnSearch('studentid', v)}>ID</SortableTh>
                                        <SortableTh col="fullName" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-4" searchValue={columnSearch['fullName']} isSearchOpen={activeSearch === 'fullName'} onSearchOpen={() => setActiveSearch('fullName')} onSearchClose={() => { setActiveSearch(null); setColumnSearch('fullName', ''); }} onSearchChange={v => setColumnSearch('fullName', v)}>{t('studentFullName', lang) || 'Student Full Name'}</SortableTh>
                                        <SortableTh col="studentemail" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-4" searchValue={columnSearch['studentemail']} isSearchOpen={activeSearch === 'studentemail'} onSearchOpen={() => setActiveSearch('studentemail')} onSearchClose={() => { setActiveSearch(null); setColumnSearch('studentemail', ''); }} onSearchChange={v => setColumnSearch('studentemail', v)}>{t('email', lang)}</SortableTh>
                                        <SortableTh col="studentmobile" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-4" searchValue={columnSearch['studentmobile']} isSearchOpen={activeSearch === 'studentmobile'} onSearchOpen={() => setActiveSearch('studentmobile')} onSearchClose={() => { setActiveSearch(null); setColumnSearch('studentmobile', ''); }} onSearchChange={v => setColumnSearch('studentmobile', v)}>{t('mobile', lang)}</SortableTh>
                                        <SortableTh col="classname" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-4" searchValue={columnSearch['classname']} isSearchOpen={activeSearch === 'classname'} onSearchOpen={() => setActiveSearch('classname')} onSearchClose={() => { setActiveSearch(null); setColumnSearch('classname', ''); }} onSearchChange={v => setColumnSearch('classname', v)}>{t('classes', lang)}</SortableTh>
                                        <SortableTh col="sectionname" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-4" searchValue={columnSearch['sectionname']} isSearchOpen={activeSearch === 'sectionname'} onSearchOpen={() => setActiveSearch('sectionname')} onSearchClose={() => { setActiveSearch(null); setColumnSearch('sectionname', ''); }} onSearchChange={v => setColumnSearch('sectionname', v)}>{t('section', lang)}</SortableTh>
                                        <SortableTh col="divisionname" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-4" searchValue={columnSearch['divisionname']} isSearchOpen={activeSearch === 'divisionname'} onSearchOpen={() => setActiveSearch('divisionname')} onSearchClose={() => { setActiveSearch(null); setColumnSearch('divisionname', ''); }} onSearchChange={v => setColumnSearch('divisionname', v)}>{t('division', lang)}</SortableTh>
                                        <SortableTh col="curriculumname" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-4" searchValue={columnSearch['curriculumname']} isSearchOpen={activeSearch === 'curriculumname'} onSearchOpen={() => setActiveSearch('curriculumname')} onSearchClose={() => { setActiveSearch(null); setColumnSearch('curriculumname', ''); }} onSearchChange={v => setColumnSearch('curriculumname', v)}>{t('curriculum', lang)}</SortableTh>
                                        <th className="px-4 py-4 text-xs font-bold text-[#64748b] uppercase tracking-wider">{t('parent', lang)}</th>
                                        <th className="px-4 py-4 text-xs font-bold text-[#64748b] uppercase tracking-wider">{t('parentEmail', lang)}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#e2e8f0]">
                                    {loading ? (
                                        <tr><td colSpan={10} className="px-6 py-12 text-center text-[#94a3b8]">
                                            <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                                        </td></tr>
                                    ) : filtered.length === 0 ? (
                                        <tr><td colSpan={10} className="px-6 py-12 text-center text-[#94a3b8]">{t('noData', lang)}</td></tr>
                                    ) : filtered.map(s => (
                                        <tr key={s.studentid} className="hover:bg-[#f8fafc]">
                                            <td className="px-4 py-4 text-xs text-[#94a3b8] font-mono">#{s.studentid}</td>
                                            <td className="px-4 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-8 w-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xs flex-shrink-0">
                                                        {s.fullName?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                                    </div>
                                                    <p className="text-sm font-bold text-[#0f172a]">{s.fullName}</p>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-sm text-[#475569]">{s.studentemail || '—'}</td>
                                            <td className="px-4 py-4 text-sm text-[#475569]">{s.studentmobile || '—'}</td>
                                            <td className="px-4 py-4 text-sm font-medium">{s.classname}</td>
                                            <td className="px-4 py-4">
                                                <span className="inline-flex items-center justify-center px-2 py-0.5 rounded bg-[#eff6ff] text-[#1d4ed8] text-xs font-bold border border-blue-100">
                                                    {s.sectionname}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 text-xs text-[#64748b]">{s.divisionname}</td>
                                            <td className="px-4 py-4 text-xs text-[#64748b]">{s.curriculumname}</td>
                                            <td className="px-4 py-4 text-sm text-[#475569]">{getField(s, 'parentname_ar', 'parentname_en', lang) || s.parentname_ar || s.parentname || '—'}</td>
                                            <td className="px-4 py-4 text-sm text-[#475569]">{s.parentemail || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
