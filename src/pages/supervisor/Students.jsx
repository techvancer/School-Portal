import { t, getField, getStudentName as _getStudentName } from '../../lib/langHelper';
import { useLang } from '../../context/LanguageContext';
import { useLocation } from 'react-router-dom';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Search } from 'lucide-react';
import FilterBar from '../../components/FilterBar';
import { useSortable } from '../../lib/useSortable';
import SortableTh from '../../components/SortableTh';
import { useAuth } from '../../context/AuthContext';
import { rest } from '../../lib/supabaseClient';
import { useToast } from '../../context/ToastContext';
import { buildFilters, EMPTY_FILTER } from '../../lib/helpers';
import { useFilterData } from '../../lib/useFilterData';

export default function SupervisorStudents() {
    const { lang, isAr } = useLang();

    const { user } = useAuth();
    const location = useLocation();
    const hasRunFromState = useRef(false);
    const baseFilterData = useFilterData(user, lang);
    const { addToast } = useToast();
    const [students, setStudents] = useState([]);
    const { sorted: sortedStudents, sortCol, sortDir, handleSort } = useSortable(students, 'fullname');
    const [hasApplied, setHasApplied] = useState(false);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [columnSearch, setColumnSearch] = useState({});
    const [activeSearch, setActiveSearch] = useState(null);
    const [applied, setApplied] = useState({ stageid:'All', classid:'All', sectionid:'All', curriculumid:'All', divisionid:'All', subjectid:'All', examid:'All', semisterid:'All' });
    const appliedRef = useRef(applied);
    appliedRef.current = applied;

    const fetchData = useCallback(async (filters = {}) => {
        if (!user) return;
        try {
            setLoading(true);
            const sid = user.schoolid;
            const bid = user.branchid;

            // Get supervisor's assigned stages
            const supStages = await rest('employees_types_stages_tbl', {
                employeeid: `eq.${user.employeeid}`, schoolid: `eq.${sid}`, branchid: `eq.${bid}`, select: 'stageid'
            });
            const stageIds = [...new Set((supStages || []).map(r => String(r.stageid)).filter(Boolean))];

            // Apply stage filter if selected
            const stageParam = filters.stageid && filters.stageid !== 'All'
                ? { stageid: `eq.${filters.stageid}` }
                : stageIds.length ? { stageid: `in.(${stageIds})` } : {};

            const classStages = await rest('classes_stages_tbl', {
                schoolid: `eq.${sid}`, branchid: `eq.${bid}`, ...stageParam, select: 'classid,stageid'
            });

            let supervisedClassIds = [...new Set((classStages || []).map(r => String(r.classid)))];
            if (filters.classid && filters.classid !== 'All') {
                supervisedClassIds = supervisedClassIds.filter(id => id === String(filters.classid));
            }
            if (supervisedClassIds.length === 0) { setStudents([]); setLoading(false); return; }

            // Build students_sections_classes_tbl query with all active filters
            const stuScParams = {
                schoolid: `eq.${sid}`, branchid: `eq.${bid}`,
                classid: `in.(${supervisedClassIds})`,
                select: 'studentid,classid,sectionid,stageid,divisionid,curriculumid',
                ...(filters.sectionid    && filters.sectionid    !== 'All' ? { sectionid:    `eq.${filters.sectionid}` }    : {}),
                ...(filters.curriculumid && filters.curriculumid !== 'All' ? { curriculumid: `eq.${filters.curriculumid}` } : {}),
                ...(filters.divisionid   && filters.divisionid   !== 'All' ? { divisionid:   `eq.${filters.divisionid}` }   : {}),
            };

            const [stuScRows, clTbl, secRows, stgRows] = await Promise.all([
                rest('students_sections_classes_tbl', stuScParams),
                rest('classes_tbl', { select: '*' }),
                rest('sections_tbl', { select: '*' }),
                rest('stages_tbl', { schoolid: `eq.${sid}`, branchid: `eq.${bid}`, select: '*' }),
            ]);

            const studentIds = [...new Set((stuScRows || []).map(r => r.studentid))];
            if (studentIds.length === 0) { setStudents([]); setLoading(false); return; }

            const stuList = await rest('students_tbl', {
                studentid: `in.(${studentIds})`, select: '*'
            });

            const merged = (stuList || []).map(s => {
                const sc = (stuScRows || []).find(x => String(x.studentid) === String(s.studentid));
                if (!sc) return null;
                const cl  = (clTbl   || []).find(c => String(c.classid)   === String(sc.classid));
                const sec = (secRows || []).find(x => String(x.sectionid) === String(sc.sectionid));
                const stg = (stgRows || []).find(x => String(x.stageid)   === String(sc.stageid));
                return {
                    ...s,
                    classid: sc.classid, sectionid: sc.sectionid,
                    stageid: sc.stageid, divisionid: sc.divisionid, curriculumid: sc.curriculumid,
                    classname:   getField(cl, 'classname', 'classname_en', lang)   || cl?.classname   || '?',
                    sectionname: getField(sec, 'sectionname', 'sectionname_en', lang) || sec?.sectionname || '?',
                    stagename:   getField(stg, 'stagename', 'stagename_en', lang)   || stg?.stagename   || '—',
                    fullname: _getStudentName(s, lang) || '—',
                };
            }).filter(Boolean);
            setStudents(merged);
        } catch (e) {
            console.error(e);
            addToast(t('errorLoadingStudents', lang) || 'Unable to load student data. Please try again.', 'error');
            setStudents([]);
        } finally {
            setLoading(false);
        }
    }, [user, addToast, lang]);

  // Read URL params from dashboard card click and auto-apply
  useEffect(() => {
    if (!user || hasRunFromState.current) return;
    hasRunFromState.current = true;
    const keys = ['curriculumid', 'divisionid', 'stageid', 'classid', 'sectionid'];
    const fromUrl = {};
    const state = location.state || {};
    keys.forEach(k => { if (state[k]) fromUrl[k] = state[k]; });
    // Only auto-apply if navigated here with filter state from another page
    if (Object.keys(fromUrl).length > 0) {
      const merged = { ...applied, ...fromUrl };
      setApplied(merged);
      setHasApplied(true);
      fetchData(merged);
    }
  }, [fetchData, user]);




    // DB already handles class/section/stage filters — search-only client filter
    const filtered = students.filter(s => {
        if (!search) return true;
        const fullname = s.fullname || _getStudentName(s, lang) || '';
        return fullname.toLowerCase().includes(search.toLowerCase());
    });

    // Column search handler
    const handleColumnSearch = (col, val) => {
        setColumnSearch(prev => ({ ...prev, [col]: val }));
    };


    useEffect(() => {
        if (!hasApplied) return;
        fetchData(appliedRef.current);
    }, [lang, hasApplied, fetchData]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div className="space-y-6 animate-fade-in pb-12">
            <div>
                <h1 className="text-xl sm:text-2xl font-bold text-[#0f172a]">{t('students', lang)}</h1>
                <p className="text-[#64748b] text-sm">{t('studentsUnderSupervision', lang)}</p>
            </div>
            <FilterBar
                filters={buildFilters(applied, baseFilterData, {}, lang).filter(f => !['examid','subjectid','semisterid'].includes(f.key))}
                onApply={vals => { setApplied(vals); setHasApplied(true); fetchData(vals); }}
                onReset={vals => { setApplied(vals); setHasApplied(false); setStudents([]); setSearch(''); }}
            />
            <div className="bg-white rounded-xl border border-[#e2e8f0] p-4 flex items-center gap-3">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94a3b8]" />
                    <input type="text" placeholder={t('searchStudentsPlaceholder', lang)} className="input-field pl-10 h-10 w-full" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
            </div>
            <div className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden">
                <div className="overflow-x-auto" dir={isAr ? 'rtl' : 'ltr'}><table className={`w-full ${isAr ? 'text-right' : 'text-left'} min-w-[600px]`}>
                    <thead className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                        <tr>
  <th className="px-4 py-4 text-xs font-bold text-[#64748b] uppercase">{t('id', lang)}</th>
  <SortableTh col="fullname" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-4" searchValue={columnSearch['fullname']} isSearchOpen={activeSearch==='fullname'} onSearchOpen={()=>setActiveSearch('fullname')} onSearchClose={()=>{setActiveSearch(null);handleColumnSearch('fullname','');}} onSearchChange={v=>handleColumnSearch('fullname',v)}>{t('name', lang)}</SortableTh>
  <SortableTh col="classname" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-4" searchValue={columnSearch['classname']} isSearchOpen={activeSearch==='classname'} onSearchOpen={()=>setActiveSearch('classname')} onSearchClose={()=>{setActiveSearch(null);handleColumnSearch('classname','');}} onSearchChange={v=>handleColumnSearch('classname',v)}>{t('class', lang)}</SortableTh>
  <SortableTh col="sectionname" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-4" searchValue={columnSearch['sectionname']} isSearchOpen={activeSearch==='sectionname'} onSearchOpen={()=>setActiveSearch('sectionname')} onSearchClose={()=>{setActiveSearch(null);handleColumnSearch('sectionname','');}} onSearchChange={v=>handleColumnSearch('sectionname',v)}>{t('section', lang)}</SortableTh>
  <SortableTh col="stagename" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-4" searchValue={columnSearch['stagename']} isSearchOpen={activeSearch==='stagename'} onSearchOpen={()=>setActiveSearch('stagename')} onSearchClose={()=>{setActiveSearch(null);handleColumnSearch('stagename','');}} onSearchChange={v=>handleColumnSearch('stagename',v)}>{t('stage', lang)}</SortableTh>
  <SortableTh col="studentemail" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-4" searchValue={columnSearch['studentemail']} isSearchOpen={activeSearch==='studentemail'} onSearchOpen={()=>setActiveSearch('studentemail')} onSearchClose={()=>{setActiveSearch(null);handleColumnSearch('studentemail','');}} onSearchChange={v=>handleColumnSearch('studentemail',v)}>{t('email', lang)}</SortableTh>
  <SortableTh col="studentmobile" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-4" searchValue={columnSearch['studentmobile']} isSearchOpen={activeSearch==='studentmobile'} onSearchOpen={()=>setActiveSearch('studentmobile')} onSearchClose={()=>{setActiveSearch(null);handleColumnSearch('studentmobile','');}} onSearchChange={v=>handleColumnSearch('studentmobile',v)}>{t('mobile', lang)}</SortableTh>
</tr>
                    </thead>
                    <tbody className="divide-y divide-[#e2e8f0]">
                        {!hasApplied ? <tr><td colSpan={7} className="px-6 py-12 text-center text-[#94a3b8] font-medium">{t('pressApplyToLoad', lang)}</td></tr>
                        : loading ? <tr><td colSpan={7} className="px-6 py-12 text-center text-[#94a3b8]">{t('loading', lang)}</td></tr>
                        : filtered.length === 0 ? <tr><td colSpan={7} className="px-6 py-12 text-center text-[#94a3b8]">{t('noData', lang)}</td></tr>
                        : sortedStudents.filter(s => {
                            const q = search.trim().toLowerCase();
                            if (q && !(s.fullname || s.fullName || '').toLowerCase().includes(q)) return false;
                            return Object.entries(columnSearch).every(([col, term]) => !term || !term.trim() || String(s[col] ?? '').toLowerCase().includes(term.toLowerCase()));
                        }).map(s => (
                            <tr key={s.studentid} className="hover:bg-[#f8fafc]">
                                <td className="px-4 py-3 text-center"><span className="text-xs font-mono bg-slate-100 px-2 py-1 rounded text-[#94a3b8]">#{s.studentid}</span></td>
                                <td className="px-4 py-3 text-center">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xs">{(_getStudentName(s, lang) || '').substring(0,2).toUpperCase()}</div>
                                        <span className="text-sm font-bold text-[#0f172a]">{_getStudentName(s, lang)}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-center text-sm font-medium">{s.classname}</td>
                                <td className="px-4 py-3 text-center"><span className="inline-flex items-center justify-center px-2 py-0.5 rounded bg-[#eff6ff] text-[#1d4ed8] text-xs font-bold border border-blue-100">{s.sectionname}</span></td>
                                <td className="px-4 py-3 text-center text-xs text-[#64748b]">{s.stagename}</td>
                                <td className="px-4 py-3 text-center text-sm text-[#475569]">{s.studentemail || '—'}</td>
                                <td className="px-4 py-3 text-center text-sm text-[#475569]">{s.studentmobile || '—'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            </div>
            <p className="text-xs text-[#94a3b8]">{t('total', lang)}: {sortedStudents.filter(s => { const q = search.trim().toLowerCase(); if (q && !(s.fullname||s.fullName||"").toLowerCase().includes(q)) return false; return Object.entries(columnSearch).every(([col,term])=>!term||!term.trim()||String(s[col]??"").toLowerCase().includes(term.toLowerCase())); }).length} {t('student', lang)}</p>
        </div>
    );
}
