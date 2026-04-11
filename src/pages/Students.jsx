import { t, getField, getStudentName as _getStudentName } from '../lib/langHelper';
import { useLang } from '../context/LanguageContext';
import { useLocation } from 'react-router-dom';
import { useState, useCallback, useEffect, useRef } from 'react';
import { Search, Loader2 } from 'lucide-react';
import Breadcrumb from '../components/Breadcrumb';
import FilterBar from '../components/FilterBar';
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
    const [applied, setApplied]   = useState({ ...EMPTY_FILTER });

    // All filter keys (excludes examid per previous change)
    const filterFields = buildFilters(applied, filterData, {}, lang).filter(f => f.key !== 'examid');
    const REQUIRED_KEYS = filterFields.map(f => f.key);

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
            setApplied(merged);
            setHasApplied(true);
            fetchData(merged);
        }
    }, [fetchData, user]);

    const filtered = applyColumnSearch(sortedStudents.filter(s => {
        if (!search) return true;
        return s.fullName?.toLowerCase().includes(search.toLowerCase());
    }));

    useEffect(() => {
        if (!hasApplied) return;
        fetchData(applied);
    }, [lang, hasApplied, applied, fetchData]);

    return (
        <div className="space-y-6 pb-12">
            <div>
                <h1 className="text-xl sm:text-2xl font-bold text-[#0f172a]">{t('students', lang)}</h1>
                <p className="text-[#64748b] text-sm">{t('studentsEnrolledHeading', lang) || 'Students enrolled in your classes'}</p>
                <Breadcrumb />
            </div>

            <FilterBar
                filters={filterFields.map(f => ({ ...f, required: true }))}
                requiredFields={REQUIRED_KEYS}
                appliedFilters={applied}
                onApply={(vals) => { setApplied(vals); setHasApplied(true); fetchData(vals); }}
                onReset={(vals) => { setApplied(vals); setStudents([]); setHasApplied(false); setSearch(''); }}
            />

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
