import { t, getField, getStudentName as _getStudentName } from '../../lib/langHelper';
import { useLang } from '../../context/LanguageContext';
import { useLocation } from 'react-router-dom';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Search } from 'lucide-react';
import FilterBar from '../../components/FilterBar';
import { useSortable } from '../../lib/useSortable';
import SortableTh from '../../components/SortableTh';
import { useAuth } from '../../context/AuthContext';
import { rest, dbQuery } from '../../lib/supabaseClient';
import { useToast } from '../../context/ToastContext';
import { useFilterData } from '../../lib/useFilterData';
import { buildFilters, EMPTY_FILTER } from '../../lib/helpers';

export default function SupervisorTeachers() {
    const { lang, isAr } = useLang();

    const { user } = useAuth();
    const location = useLocation();
    const hasRunFromState = useRef(false);
    const baseFilterData = useFilterData(user, lang);
    const { addToast } = useToast();
    const [teachers, setTeachers] = useState([]);
    const [assignmentsMap, setAssignmentsMap] = useState({});
    const { sorted: sortedTeachers, sortCol, sortDir, handleSort } = useSortable(teachers, 'name');
    const [hasApplied, setHasApplied] = useState(false);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [columnSearch, setColumnSearch] = useState({});
    const [activeSearch, setActiveSearch] = useState(null);
    const [applied, setApplied] = useState({ ...EMPTY_FILTER });

    const fetchData = useCallback(async () => {
        if (!user) return;
        try {
            setLoading(true);
            const [supStages, classStages, empTypes, empList, assignments, classRows, sectionRows, subjectRows, answerRows] = await Promise.all([
                dbQuery(`employees_types_stages_tbl?employeeid=eq.${user.employeeid}&schoolid=eq.${user.schoolid}&branchid=eq.${user.branchid}&select=*`),
                dbQuery('classes_stages_tbl?select=*'),
                dbQuery('employees_types_tbl?select=*'),
                dbQuery(`employee_tbl?schoolid=eq.${user.schoolid}&branchid=eq.${user.branchid}&select=*`),
                dbQuery(`employees_sections_subjects_classes_semisters_curriculums_tbl?schoolid=eq.${user.schoolid}&branchid=eq.${user.branchid}&select=*`),
                dbQuery('classes_tbl?select=*'),
                dbQuery('sections_tbl?select=*'),
                dbQuery('subjects_tbl?select=*'),
                dbQuery(`studentanswers_tbl?schoolid=eq.${user.schoolid}&branchid=eq.${user.branchid}&select=employeeid,studentmark,classid,sectionid,subjectid`),
            ]);

            const stageIds = [...new Set((supStages || []).map(r => String(r.stageid)).filter(Boolean))];
            const supervisedClassIds = new Set(
                (classStages || [])
                    .filter(r => stageIds.length === 0 || stageIds.includes(String(r.stageid)))
                    .map(r => String(r.classid))
            );
            const teacherIds = new Set((empTypes || []).filter(r => String(r.typeid) === '1').map(r => String(r.employeeid)));
            const supervisedAssignments = (assignments || []).filter(r => supervisedClassIds.has(String(r.classid)) && teacherIds.has(String(r.employeeid)));
            const supervisedTeacherIds = [...new Set(supervisedAssignments.map(r => String(r.employeeid)))];

            const aMap = {};
            supervisedAssignments.forEach(a => {
                if (!aMap[String(a.employeeid)]) aMap[String(a.employeeid)] = [];
                aMap[String(a.employeeid)].push(a);
            });
            setAssignmentsMap(aMap);

            const result = supervisedTeacherIds.map(employeeid => {
                const emp = (empList || []).find(e => String(e.employeeid) === String(employeeid));
                const assigns = supervisedAssignments.filter(a => String(a.employeeid) === String(employeeid));
                const classLabels = [...new Set(assigns.map(a => {
                    const cl = (classRows || []).find(c => String(c.classid) === String(a.classid));
                    const sec = (sectionRows || []).find(s => String(s.sectionid) === String(a.sectionid));
                    return `${getField(cl, 'classname', 'classname_en', lang) || cl?.classname || a.classid} - ${getField(sec, 'sectionname', 'sectionname_en', lang) || sec?.sectionname || a.sectionid}`;
                }))];
                const subjects = [...new Set(assigns.map(a => {
                    const sub = (subjectRows || []).find(s => String(s.subjectid) === String(a.subjectid));
                    return getField(sub, 'subjectname', 'Subjectname_en', lang) || sub?.['Subjectname_en'] || sub?.subjectname || `Subject ${a.subjectid}`;
                }))];
                const scores = (answerRows || []).filter(r => String(r.employeeid) === String(employeeid)).map(r => Number(r.studentmark) || 0);
                const avgMarks = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length) : null;

                return { ...emp, classLabels, subjects, avgMarks };
            }).filter(Boolean);

            setTeachers(result);
        } catch (e) {
            console.error(e);
            addToast(t('errorLoadingTeachers', lang) || 'Unable to load teacher data. Please try again.', 'error');
            setTeachers([]);
        } finally {
            setLoading(false);
        }
    }, [user, addToast, lang]);

    useEffect(() => { fetchData(); }, [fetchData]);

    useEffect(() => {
        if (!user || hasRunFromState.current) return;
        hasRunFromState.current = true;
        const keys = ['curriculumid', 'divisionid', 'stageid', 'classid', 'sectionid', 'subjectid'];
        const fromUrl = {};
        const state = location.state || {};
        keys.forEach(k => { if (state[k]) fromUrl[k] = state[k]; });
        const merged = Object.keys(fromUrl).length > 0 ? { ...applied, ...fromUrl } : applied;
        if (Object.keys(fromUrl).length > 0) setApplied(merged);
        setHasApplied(true);
        fetchData();
    }, [fetchData, user]);

    const filterData = useMemo(() => ({
        ...baseFilterData,
        employees: [{ value: 'All', label: t('allEmployees', lang) }],
    }), [baseFilterData]);

    const filtered = teachers.filter(teacher => {
        const q = search.trim().toLowerCase();
        const ms = !q || (getField(teacher, 'employeename', 'employeename_en', lang) || teacher.employeename || '').toLowerCase().includes(q) || teacher.subjects.some(s => s.toLowerCase().includes(q));
        const assigns = assignmentsMap[String(teacher.employeeid)] || [];
        const mc   = applied.classid      === 'All' || assigns.some(a => String(a.classid)      === String(applied.classid));
        const msec = applied.sectionid    === 'All' || assigns.some(a => String(a.sectionid)    === String(applied.sectionid));
        const mst  = applied.stageid      === 'All' || assigns.some(a => String(a.stageid)      === String(applied.stageid));
        const msub = applied.subjectid    === 'All' || assigns.some(a => String(a.subjectid)    === String(applied.subjectid));
        const msem = applied.semisterid   === 'All' || assigns.some(a => String(a.semisterid)   === String(applied.semisterid));
        const mcur = applied.curriculumid === 'All' || assigns.some(a => String(a.curriculumid) === String(applied.curriculumid));
        const mdiv = applied.divisionid   === 'All' || assigns.some(a => String(a.divisionid)   === String(applied.divisionid));
        return ms && mc && msec && mst && msub && msem && mcur && mdiv;
    });

    const handleColumnSearch = (col, val) => {
        setColumnSearch(prev => ({ ...prev, [col]: val }));
    };

    // Column filter computed BEFORE return — avoids JSX block-body parse issues
    const columnFiltered = sortedTeachers.filter(teacher => {
        const assigns = assignmentsMap[String(teacher.employeeid)] || [];
        const mc   = applied.classid      === 'All' || assigns.some(a => String(a.classid)      === String(applied.classid));
        const msec = applied.sectionid    === 'All' || assigns.some(a => String(a.sectionid)    === String(applied.sectionid));
        const mst  = applied.stageid      === 'All' || assigns.some(a => String(a.stageid)      === String(applied.stageid));
        const msub = applied.subjectid    === 'All' || assigns.some(a => String(a.subjectid)    === String(applied.subjectid));
        const msem = applied.semisterid   === 'All' || assigns.some(a => String(a.semisterid)   === String(applied.semisterid));
        const mcur = applied.curriculumid === 'All' || assigns.some(a => String(a.curriculumid) === String(applied.curriculumid));
        const mdiv = applied.divisionid   === 'All' || assigns.some(a => String(a.divisionid)   === String(applied.divisionid));
        
        if (!(mc && msec && mst && msub && msem && mcur && mdiv)) return false;

        // Apply top search bar
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            const name = (getField(teacher, 'employeename', 'employeename_en', lang) || teacher.employeename || '').toLowerCase();
            const email = (teacher.employeeemail || '').toLowerCase();
            const subjects = (teacher.subjects || []).join(' ').toLowerCase();
            if (!name.includes(q) && !email.includes(q) && !subjects.includes(q)) return false;
        }
        // Apply column search
        const entries = Object.entries(columnSearch);
        if (!entries.length) return true;
        return entries.every(([col, term]) => {
            if (!term || !term.trim()) return true;
            let val = '';
            if (col === 'name') val = getField(teacher, 'employeename', 'employeename_en', lang) || teacher.employeename || '';
            else if (col === 'subjectname') val = (teacher.subjects || []).join(' ');
            else val = String(teacher[col] ?? '');
            return val.toLowerCase().includes(term.toLowerCase().trim());
        });
    });

    return (
        <div className="space-y-6 animate-fade-in pb-12">
            <div>
                <h1 className="text-xl sm:text-2xl font-bold text-[#0f172a]">{t('teachers', lang)}</h1>
                <p className="text-[#64748b] text-sm">{t('teachersUnderSupervision', lang)}</p>
            </div>

            <FilterBar
                filters={buildFilters(applied, filterData, {}, lang).filter(f => !['examid', 'semisterid'].includes(f.key))}
                appliedFilters={applied}
                onApply={vals => { setApplied(vals); setHasApplied(true); fetchData(); }}
                onReset={vals => { setApplied(vals); setHasApplied(false); setTeachers([]); }}
            />

            <div className="bg-white rounded-xl border border-[#e2e8f0] p-4 flex items-center gap-3">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94a3b8]" />
                    <input
                        type="text"
                        placeholder={t('searchTeachersPlaceholder', lang)}
                        className="input-field pl-10 h-10 w-full"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
            </div>

            <div className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden">
                <div className="overflow-x-auto" dir={isAr ? 'rtl' : 'ltr'}>
                    <table className={`w-full min-w-[600px] ${isAr ? 'text-right' : 'text-left'}`}>
                        <thead className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                            <tr>
                                <th className="px-4 py-4 text-xs font-bold text-[#64748b] uppercase">{t('id', lang)}</th>
                                <SortableTh
                                    col="name" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-4"
                                    searchValue={columnSearch['name']} isSearchOpen={activeSearch === 'name'}
                                    onSearchOpen={() => setActiveSearch('name')}
                                    onSearchClose={() => { setActiveSearch(null); handleColumnSearch('name', ''); }}
                                    onSearchChange={v => handleColumnSearch('name', v)}
                                >{t('name', lang)}</SortableTh>
                                <SortableTh
                                    col="employeeemail" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-4"
                                    searchValue={columnSearch['employeeemail']} isSearchOpen={activeSearch === 'employeeemail'}
                                    onSearchOpen={() => setActiveSearch('employeeemail')}
                                    onSearchClose={() => { setActiveSearch(null); handleColumnSearch('employeeemail', ''); }}
                                    onSearchChange={v => handleColumnSearch('employeeemail', v)}
                                >{t('email', lang)}</SortableTh>
                                <SortableTh
                                    col="subjectname" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-4"
                                    searchValue={columnSearch['subjectname']} isSearchOpen={activeSearch === 'subjectname'}
                                    onSearchOpen={() => setActiveSearch('subjectname')}
                                    onSearchClose={() => { setActiveSearch(null); handleColumnSearch('subjectname', ''); }}
                                    onSearchChange={v => handleColumnSearch('subjectname', v)}
                                >{t('subjects', lang)}</SortableTh>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#e2e8f0]">
                            {!hasApplied ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-[#94a3b8] font-medium">
                                        {t('pressApplyToLoad', lang)}
                                    </td>
                                </tr>
                            ) : loading ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-[#94a3b8]">
                                        {t('loading', lang)}
                                    </td>
                                </tr>
                            ) : columnFiltered.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-[#94a3b8]">
                                        {t('noData', lang)}
                                    </td>
                                </tr>
                            ) : columnFiltered.map(teacher => (
                                <tr key={teacher.employeeid} className="hover:bg-[#f8fafc]">
                                    <td className="px-4 py-3 text-center">
                                        <span className="text-xs font-mono bg-slate-100 px-2 py-1 rounded text-[#94a3b8]">
                                            #{teacher.employeeid}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-center align-middle">
                                        <div className="flex items-center justify-center gap-3">
                                            <div className="h-9 w-9 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xs uppercase">
                                                {(getField(teacher, 'employeename', 'employeename_en', lang) || teacher.employeename || '').substring(0, 2).toUpperCase()}
                                            </div>
                                            <span className="text-sm font-bold text-[#0f172a]">
                                                {getField(teacher, 'employeename', 'employeename_en', lang) || teacher.employeename}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-center text-sm text-[#475569]">
                                        {teacher.employeeemail || '—'}
                                    </td>
                                    <td className="px-4 py-3 text-center align-middle">
                                        <div className="flex flex-wrap justify-center gap-1">
                                            {teacher.subjects.length > 0
                                                ? teacher.subjects.map((s, i) => (
                                                    <span key={i} className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                                                        {s}
                                                    </span>
                                                ))
                                                : (
                                                    <span className="text-xs text-[#94a3b8]">
                                                        {t('notAssigned', lang)}
                                                    </span>
                                                )
                                            }
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="p-4 bg-slate-50/50 border-t border-[#e2e8f0] flex items-center">
                    <span className="text-xs font-bold text-[#64748b] uppercase tracking-wider mr-3">{t('total', lang)}</span>
                    <div className="px-3 py-1 bg-white rounded-lg border border-[#e2e8f0] text-xs font-black text-[#0f172a] shadow-sm">
                        {columnFiltered.length} {t('rows', lang)}
                    </div>
                </div>
            </div>
        </div>
    );
}
