import { t, getField, getStudentName as _getStudentName } from '../../lib/langHelper';
import { useLang } from '../../context/LanguageContext';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Search, ClipboardList } from 'lucide-react';
import FilterBar from '../../components/FilterBar';
import { useSortable } from '../../lib/useSortable';
import SortableTh from '../../components/SortableTh';
import { useAuth } from '../../context/AuthContext';
import { rest, dbQuery } from '../../lib/supabaseClient';
import { useToast } from '../../context/ToastContext';
import { useFilterData } from '../../lib/useFilterData';
import { buildFilters, EMPTY_FILTER } from '../../lib/helpers';

export default function SupervisorExams() {
    const { lang, isAr } = useLang();

    const { user } = useAuth();
    const baseFilterData = useFilterData(user, lang);
    const { addToast } = useToast();
    const [exams, setExams] = useState([]);
    const { sorted: sortedExams, sortCol, sortDir, handleSort } = useSortable(exams, 'examname');
    const [hasApplied, setHasApplied] = useState(false);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [columnSearch, setColumnSearch] = useState({});
    const [activeSearch, setActiveSearch] = useState(null);
    const [applied, setApplied] = useState({ ...EMPTY_FILTER, employeeid: 'All' });
    const appliedRef = useRef(applied);
    appliedRef.current = applied;

    const fetchData = useCallback(async (filters = {}) => {
        if (!user) return;
        try {
            setLoading(true);
            const sid = user.schoolid;
            const bid = user.branchid;

            const supStages = await dbQuery(`employees_types_stages_tbl?employeeid=eq.${user.employeeid}&schoolid=eq.${sid}&branchid=eq.${bid}&select=stageid`);
            const stageIds = [...new Set((supStages || []).map(r => String(r.stageid)).filter(Boolean))];

            const stageFilter = filters.stageid && filters.stageid !== 'All'
                ? `stageid=eq.${filters.stageid}`
                : stageIds.length ? `stageid=in.(${stageIds.join(',')})` : '';

            const classStages = await dbQuery(`classes_stages_tbl?select=classid,stageid&schoolid=eq.${sid}&branchid=eq.${bid}${stageFilter ? '&' + stageFilter : ''}`);
            let supervisedClassIds = [...new Set((classStages || []).map(r => String(r.classid)))];
            if (filters.classid && filters.classid !== 'All') {
                supervisedClassIds = supervisedClassIds.filter(id => id === String(filters.classid));
            }
            if (supervisedClassIds.length === 0) { setExams([]); setLoading(false); return; }

            const examParams = {
                schoolid: `eq.${sid}`, branchid: `eq.${bid}`,
                classid: `in.(${supervisedClassIds})`,
                select: '*',
                ...(filters.sectionid    && filters.sectionid    !== 'All' ? { sectionid:    `eq.${filters.sectionid}` }    : {}),
                ...(filters.subjectid    && filters.subjectid    !== 'All' ? { subjectid:    `eq.${filters.subjectid}` }    : {}),
                ...(filters.examid       && filters.examid       !== 'All' ? { examid:       `eq.${filters.examid}` }       : {}),
                ...(filters.employeeid   && filters.employeeid   !== 'All' ? { employeeid:   `eq.${filters.employeeid}` }   : {}),
            };

            // Build exam query string from examParams
            const examQs = Object.entries(examParams).filter(([k]) => k !== 'select').map(([k, v]) => `${k}=${v}`).join('&');
            const [examRows, examTypes, classRows, sectionRows, subjectRows, empList, answerRows, questionRows] = await Promise.all([
                dbQuery(`questions_exams_employee_subjects_sections_tbl?${examQs}&select=*`),
                dbQuery('exams_tbl?select=*'),
                dbQuery('classes_tbl?select=*'),
                dbQuery('sections_tbl?select=*'),
                dbQuery('subjects_tbl?select=*'),
                dbQuery(`employee_tbl?schoolid=eq.${sid}&branchid=eq.${bid}&select=*`),
                dbQuery(`studentanswers_tbl?schoolid=eq.${sid}&branchid=eq.${bid}&classid=in.(${supervisedClassIds.join(',')})&select=examid,classid,sectionid,subjectid,employeeid,studentid,studentmark,questionid,attempt_number`),
                dbQuery(`questions_exams_employee_subjects_sections_tbl?schoolid=eq.${sid}&branchid=eq.${bid}&classid=in.(${supervisedClassIds.join(',')})&select=examid,classid,sectionid,subjectid,employeeid,questionid,question_marks,attempt_number,status`),
            ]);

            const dedupe = new Map();
            (examRows || []).forEach(r => {
                const key = `${r.examid}-${r.classid}-${r.sectionid}-${r.subjectid}-${r.employeeid}-${r.attempt_number || 1}`;
                if (!dedupe.has(key)) dedupe.set(key, r);
            });

            const merged = [...dedupe.values()].map(r => {
                const exam = (examTypes || []).find(e => String(e.examid) === String(r.examid));
                const cl = (classRows || []).find(c => String(c.classid) === String(r.classid));
                const sec = (sectionRows || []).find(s => String(s.sectionid) === String(r.sectionid));
                const sub = (subjectRows || []).find(s => String(s.subjectid) === String(r.subjectid));
                const emp = (empList || []).find(e => String(e.employeeid) === String(r.employeeid));
                const rows = (answerRows || []).filter(a =>
                    String(a.examid) === String(r.examid) &&
                    String(a.classid) === String(r.classid) &&
                    String(a.sectionid) === String(r.sectionid) &&
                    String(a.subjectid) === String(r.subjectid) &&
                    String(a.employeeid) === String(r.employeeid) &&
                    String(a.attempt_number || 1) === String(r.attempt_number || 1)
                );
                // Total possible marks for this exam-class-section-subject-employee combo
                const qRows = (questionRows || []).filter(q =>
                    String(q.examid)     === String(r.examid)     &&
                    String(q.classid)    === String(r.classid)    &&
                    String(q.sectionid)  === String(r.sectionid)  &&
                    String(q.subjectid)  === String(r.subjectid)  &&
                    String(q.employeeid) === String(r.employeeid) &&
                    String(q.attempt_number || 1) === String(r.attempt_number || 1)
                );
                const totalMax = qRows.reduce((sum, q) => sum + (parseFloat(q.question_marks) || 0), 0);

                // Sum all question marks per student
                const stuTotals = rows.reduce((acc, cur) => {
                    const sid = String(cur.studentid);
                    acc[sid] = (acc[sid] || 0) + (Number(cur.studentmark) || 0);
                    return acc;
                }, {});
                const tookCount = Object.keys(stuTotals).length;
                const studentPcts = Object.values(stuTotals).map(total =>
                    totalMax > 0 ? (total / totalMax) * 100 : 0
                );
                const avgMarks = studentPcts.length ? parseFloat((studentPcts.reduce((a, b) => a + b, 0) / studentPcts.length).toFixed(1)) : null;
                const passedCount = studentPcts.filter(pct => pct >= 50).length;
                
                // Determine exam status based on active question row status
                const qStatuses = [...new Set(qRows.map(q => String(q.status || '').toLowerCase() || 'new'))];
                let examStatus = 'New';
                if (qStatuses.includes('cancelled')) examStatus = 'Cancelled';
                else if (qStatuses.includes('marked') || qStatuses.includes('completed')) examStatus = 'Marked';
                else if (qStatuses.includes('submitted')) examStatus = 'Submitted';

                
                return {
                    ...r,
                    examName: getField(exam, 'examname', 'examname_en', lang) || `Exam ${r.examid}`,
                    classname: getField(cl, 'classname', 'classname_en', lang) || cl?.classname || r.classid,
                    sectionname: getField(sec, 'sectionname', 'sectionname_en', lang) || sec?.sectionname || r.sectionid,
                    subjectName: getField(sub, 'subjectname', 'Subjectname_en', lang) || sub?.subjectname_en || getField(sub, 'subjectname', 'Subjectname_en', lang) || sub?.subjectname || `Subject ${r.subjectid}`,
                    teacherName: getField(emp, 'employeename', 'employeename_en', lang) || emp?.employeename || '—',
                    avgMarks,
                    passedCount,
                    tookCount,
                    examStatus: examStatus,
                };
            });
            setExams(merged);
        } catch (e) {
            console.error(e);
            addToast(t('errorLoadingExams', lang) || 'Unable to load exam data. Please try again.', 'error');
            setExams([]);
        } finally {
            setLoading(false);
        }
    }, [user, addToast, lang]);


    // Build filter options dynamically from loaded exams so dropdowns are scoped
    const filterData = useMemo(() => {
        const fromExams = (keyFn, valFn, labelFn, allLabelKey) => [
            { value: 'All', label: t(allLabelKey, lang) },
            ...[...new Map(exams.map(e => [String(keyFn(e)), e])).values()]
                .map(e => ({ value: String(valFn(e)), label: labelFn(e) }))
        ];
        return {
            ...baseFilterData,
            // Only override subjects/exams/employees from loaded data when we have rows;
            // otherwise fall back to baseFilterData so the dropdowns are populated before first Apply
            exams:    exams.length ? fromExams(e => e.examid,    e => e.examid,    e => e.examName,    'allExams')    : baseFilterData.exams,
            subjects: exams.length ? fromExams(e => e.subjectid, e => e.subjectid, e => e.subjectName, 'allSubjects') : baseFilterData.subjects,
            employees: exams.length ? fromExams(e => e.employeeid, e => e.employeeid, e => e.teacherName, 'allEmployees') : baseFilterData.employees,
        };
    }, [exams, baseFilterData]);

    // DB already applies all filters — client side is search only
    const filtered = sortedExams.filter(e => {
        if (!search.trim()) return true;
        const q = search.trim().toLowerCase();
        return e.subjectName?.toLowerCase().includes(q) || e.teacherName?.toLowerCase().includes(q) || e.examName?.toLowerCase().includes(q);
    });

    // Column search handler
    const handleColumnSearch = (col, val) => {
        setColumnSearch(prev => ({ ...prev, [col]: val }));
    };

    const columnFiltered = filtered.filter(exam => {
        const entries = Object.entries(columnSearch);
        if (!entries.length) return true;
        return entries.every(([col, term]) => {
            if (!term || !term.trim()) return true;
            return String(exam[col] ?? '').toLowerCase().includes(term.toLowerCase().trim());
        });
    });


    // Re-fetch when language changes (use ref so we always have current filters without double-fetching on Apply)
    useEffect(() => {
        if (!hasApplied) return;
        fetchData(appliedRef.current);
    }, [lang, hasApplied, fetchData]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div className="space-y-6 animate-fade-in pb-12">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-[#0f172a]">{t('exams', lang)}</h1>
                    <p className="text-[#64748b] text-sm">{t('examsUnderSupervision', lang)}</p>
                </div>
            </div>
            <FilterBar
                filters={buildFilters(applied, filterData, {}, lang)}
                appliedFilters={applied}
                scRows={filterData.scRows}

                onApply={vals => { setApplied(vals); setHasApplied(true); fetchData(vals); }}
                onReset={vals => { setApplied(vals); setHasApplied(false); setExams([]); }}
            />
            <div className="bg-white rounded-xl border border-[#e2e8f0] p-4 flex items-center gap-3">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94a3b8]" />
                    <input type="text" placeholder={t('searchExamsPlaceholder', lang)} className="input-field pl-10 h-10 w-full" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
            </div>
            <div className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden">
                <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center gap-2">
                    <ClipboardList className="h-5 w-5 text-[#64748b]" />
                    <span className="font-bold text-[#0f172a]">{t('examsDirectory', lang)}</span>
                    <span className="ml-auto text-xs text-[#94a3b8]">{columnFiltered.length} {t('exams', lang)}</span>
                </div>
                <div className="overflow-x-auto" dir={isAr ? 'rtl' : 'ltr'}>
                    <table className={`w-full ${isAr ? 'text-right' : 'text-left'}`}>
                        <thead className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                            <tr>
  <SortableTh col="classname" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-4" searchValue={columnSearch['classname']} isSearchOpen={activeSearch==='classname'} onSearchOpen={()=>setActiveSearch('classname')} onSearchClose={()=>{setActiveSearch(null);handleColumnSearch('classname','');}} onSearchChange={v=>handleColumnSearch('classname',v)}>{t('class', lang)}</SortableTh>
  <SortableTh col="sectionname" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-4" searchValue={columnSearch['sectionname']} isSearchOpen={activeSearch==='sectionname'} onSearchOpen={()=>setActiveSearch('sectionname')} onSearchClose={()=>{setActiveSearch(null);handleColumnSearch('sectionname','');}} onSearchChange={v=>handleColumnSearch('sectionname',v)}>{t('section', lang)}</SortableTh>
  <SortableTh col="subjectName" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-4" searchValue={columnSearch['subjectName']} isSearchOpen={activeSearch==='subjectName'} onSearchOpen={()=>setActiveSearch('subjectName')} onSearchClose={()=>{setActiveSearch(null);handleColumnSearch('subjectName','');}} onSearchChange={v=>handleColumnSearch('subjectName',v)}>{t('subject', lang)}</SortableTh>
  <SortableTh col="examName" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-4" searchValue={columnSearch['examName']} isSearchOpen={activeSearch==='examName'} onSearchOpen={()=>setActiveSearch('examName')} onSearchClose={()=>{setActiveSearch(null);handleColumnSearch('examName','');}} onSearchChange={v=>handleColumnSearch('examName',v)}>{t('exam', lang)}</SortableTh>
  <SortableTh col="teacherName" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-4" searchValue={columnSearch['teacherName']} isSearchOpen={activeSearch==='teacherName'} onSearchOpen={()=>setActiveSearch('teacherName')} onSearchClose={()=>{setActiveSearch(null);handleColumnSearch('teacherName','');}} onSearchChange={v=>handleColumnSearch('teacherName',v)}>{t('teacher', lang)}</SortableTh>
  <SortableTh col="examStatus" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-4" searchValue={columnSearch['examStatus']} isSearchOpen={activeSearch==='examStatus'} onSearchOpen={()=>setActiveSearch('examStatus')} onSearchClose={()=>{setActiveSearch(null);handleColumnSearch('examStatus','');}} onSearchChange={v=>handleColumnSearch('examStatus',v)}>{t('status', lang)}</SortableTh>
  <SortableTh col="avgMarks" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-4" searchValue={columnSearch['avgMarks']} isSearchOpen={activeSearch==='avgMarks'} onSearchOpen={()=>setActiveSearch('avgMarks')} onSearchClose={()=>{setActiveSearch(null);handleColumnSearch('avgMarks','');}} onSearchChange={v=>handleColumnSearch('avgMarks',v)}>{t('avgMarks', lang)}</SortableTh>
  <SortableTh col="passedCount" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-4" searchValue={columnSearch['passedCount']} isSearchOpen={activeSearch==='passedCount'} onSearchOpen={()=>setActiveSearch('passedCount')} onSearchClose={()=>{setActiveSearch(null);handleColumnSearch('passedCount','');}} onSearchChange={v=>handleColumnSearch('passedCount',v)}>{t('passed', lang)}</SortableTh>
  <SortableTh col="tookCount" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-4" searchValue={columnSearch['tookCount']} isSearchOpen={activeSearch==='tookCount'} onSearchOpen={()=>setActiveSearch('tookCount')} onSearchClose={()=>{setActiveSearch(null);handleColumnSearch('tookCount','');}} onSearchChange={v=>handleColumnSearch('tookCount',v)}>{t('took', lang)}</SortableTh>
</tr>
                        </thead>
                        <tbody className="divide-y divide-[#e2e8f0]">
                            {!hasApplied ? <tr><td colSpan={9} className="px-6 py-12 text-center text-[#94a3b8] font-medium">{isAr ? 'اضغط على ' : 'Press '}<span className="text-[#1d4ed8] font-bold">{isAr ? 'تطبيق الفلتر' : 'Apply Filter'}</span>{isAr ? ' لتحميل البيانات.' : ' to load data.'}</td></tr>
                            : loading ? <tr><td colSpan={9} className="px-6 py-12 text-center text-[#94a3b8]">{t('loading', lang)}</td></tr>
                            : columnFiltered.length === 0 ? <tr><td colSpan={9} className="px-6 py-12 text-center text-[#94a3b8]">{t('noData', lang)}</td></tr>
                            : columnFiltered.map((e, i) => (
                                <tr key={i} className="hover:bg-[#f8fafc]">
                                    <td className="px-4 py-3 text-center text-sm font-bold text-[#0f172a]">{e.classname}</td>
                                    <td className="px-4 py-3 text-center"><span className="inline-flex items-center justify-center px-2 py-0.5 rounded bg-[#eff6ff] text-[#1d4ed8] text-xs font-bold border border-blue-100 min-w-[28px]">{e.sectionname}</span></td>
                                    <td className="px-4 py-3 text-center text-sm text-[#475569]">{e.subjectName}</td>
                                    <td className="px-4 py-3 text-center">
                                        <p className="text-sm font-bold text-[#0f172a]">{e.examName}</p>
                                    </td>
                                    <td className="px-4 py-3 text-center text-sm text-[#475569]">{e.teacherName}</td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${
                                            e.examStatus === 'Marked' 
                                                ? 'bg-green-50 text-green-700 border-green-200' 
                                                : e.examStatus === 'Submitted'
                                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                : e.examStatus === 'Cancelled'
                                                ? 'bg-red-50 text-red-700 border-red-200'
                                                : 'bg-slate-50 text-slate-600 border-slate-200'
                                        }`}>
                                            {e.examStatus === 'Marked' ? t('marked', lang) : e.examStatus === 'Submitted' ? t('submitted', lang) : e.examStatus === 'Cancelled' ? t('cancelled', lang) : t('new', lang)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-center text-sm font-bold text-[#0f172a]">{e.avgMarks == null ? '—' : e.avgMarks.toFixed(1)}</td>
                                    <td className="px-4 py-3 text-center text-sm font-bold text-green-700">{e.passedCount}</td>
                                    <td className="px-4 py-3 text-center text-sm font-bold text-[#0f172a]">{e.tookCount}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}