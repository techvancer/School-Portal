import { getErrorMessage } from '../../lib/langHelper';
import { t, getField, getStudentName as _getStudentName } from '../../lib/langHelper';
import { useLang } from '../../context/LanguageContext';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ClipboardList, Trash2, AlertTriangle, CheckCircle, Search, BarChart2, X, Loader2 } from 'lucide-react';
import Breadcrumb from '../../components/Breadcrumb';
import FilterBar from '../../components/FilterBar';
import { useToast } from '../../context/ToastContext';
import { useSortable } from '../../lib/useSortable';
import { useColumnSearch } from '../../lib/useColumnSearch';
import SortableTh from '../../components/SortableTh';
import { useAuth } from '../../context/AuthContext';
import { rest, insert, update, remove, dbQuery } from '../../lib/supabaseClient';
import { useFilterData } from '../../lib/useFilterData';
import { buildFilters, EMPTY_FILTER } from '../../lib/helpers';

export default function AdminExams() {
    const { lang, isAr } = useLang();

    const { addToast } = useToast();
    const location = useLocation();
    const { user } = useAuth();
    const filterData = useFilterData(user, lang);

    const [rows, setRows] = useState([]);
    const { sorted: sortedRows, sortCol, sortDir, handleSort } = useSortable(rows, 'examName');
    const { columnSearch, activeSearch, setActiveSearch, setColumnSearch, applyColumnSearch } = useColumnSearch();
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [applied, setApplied] = useState({ ...EMPTY_FILTER, employeeid: 'All' });
    const [examTypes, setExamTypes] = useState([]);
    const [deleteModal, setDeleteModal] = useState({ show: false, row: null });
    const [detailModal, setDetailModal] = useState({ show: false, row: null });
    const [detailStats, setDetailStats] = useState(null);
    const [detailStatsLoading, setDetailStatsLoading] = useState(false);

    const fetchData = useCallback(async (filters = {}) => {
        if (!user) return;
        try {
            setLoading(true);
            const f = (key, col) => filters[key] && filters[key] !== 'All' ? { [col || key]: `eq.${filters[key]}` } : {};
            const examQueryParams = {
                schoolid: `eq.${user.schoolid}`,
                branchid: `eq.${user.branchid}`,
                select: '*',
                ...f('classid'), ...f('sectionid'), ...f('subjectid'), ...f('examid'),
                ...(filters.employeeid && filters.employeeid !== 'All' ? { employeeid: `eq.${filters.employeeid}` } : {}),
            };
            const [stuExams, examList, clTbl, secRows, subList, empList, enrollmentData, answersData, sclTbl, divTbl, curTbl] = await Promise.all([
                rest('questions_exams_employee_subjects_sections_tbl', examQueryParams),
                rest('exams_tbl', { select: '*' }),
                rest('classes_tbl', { select: '*' }),
                rest('sections_tbl', { select: '*' }),
                rest('subjects_tbl', { select: '*' }),
                rest('employee_tbl', { schoolid: `eq.${user.schoolid}`, branchid: `eq.${user.branchid}`, select: '*' }),
                rest('students_sections_classes_tbl', { schoolid: `eq.${user.schoolid}`, branchid: `eq.${user.branchid}`, select: 'studentid,classid,sectionid' }).catch(() => []),
                rest('studentanswers_tbl', { schoolid: `eq.${user.schoolid}`, branchid: `eq.${user.branchid}`, select: 'examid,classid,sectionid,subjectid' }).catch(() => []),
                rest('sections_classes_tbl', { schoolid: `eq.${user.schoolid}`, branchid: `eq.${user.branchid}`, select: 'classid,sectionid,stageid,divisionid,curriculumid' }).catch(() => []),
                rest('divisions_tbl', { schoolid: `eq.${user.schoolid}`, branchid: `eq.${user.branchid}`, select: 'divisionid,divisionname,divisionname_en' }).catch(() => []),
                rest('curriculums_tbl', { schoolid: `eq.${user.schoolid}`, branchid: `eq.${user.branchid}`, select: 'curriculumid,curriculumname,curriculumname_en' }).catch(() => []),
            ]);

            // Build class enrollment map
            const enrollMap = {};
            (enrollmentData || []).forEach(e => {
                const k = `${e.classid}-${e.sectionid}`;
                enrollMap[k] = (enrollMap[k] || 0) + 1;
            });

            // Build status map from student answers: if exam has answers → 'marked', else 'new'
            const answersMap = {};
            (answersData || []).forEach(ans => {
                const k = `${ans.examid}-${ans.classid}-${ans.sectionid}-${ans.subjectid}`;
                answersMap[k] = true;
            });

            // Deduplicate: one row per examid+classid+sectionid+subjectid+employeeid+attempt_number
            const seen = new Map();
            stuExams.forEach(r => {
                const key = `${r.examid}-${r.classid}-${r.sectionid}-${r.subjectid}-${r.employeeid}-${r.attempt_number || 1}`;
                if (!seen.has(key)) {
                    const exam = examList.find(e => e.examid === r.examid);
                    const cl = clTbl.find(c => c.classid === r.classid);
                    const sec = secRows.find(s => s.sectionid === r.sectionid);
                    const sub = subList.find(s => s.subjectid === r.subjectid);
                    const emp = empList.find(e => e.employeeid === r.employeeid);
                    const scl = (sclTbl || []).find(s => s.classid === r.classid && s.sectionid === r.sectionid);
                    const div = (divTbl || []).find(d => d.divisionid === scl?.divisionid);
                    const cur = (curTbl || []).find(c => c.curriculumid === scl?.curriculumid);

                    const dbStatus = String(exam?.status || '').toLowerCase();
                    const qStatus = String(r.status || '').toLowerCase();
                    
                    let examStatus;
                    if (qStatus === 'cancelled' || dbStatus === 'cancelled') examStatus = 'cancelled';
                    else if (qStatus === 'submitted' || dbStatus === 'submitted') examStatus = 'submitted';
                    else if (['marked', 'completed', 'inprogress'].includes(qStatus) || ['marked', 'completed', 'inprogress'].includes(dbStatus)) examStatus = 'marked';
                    else examStatus = 'new';

                    seen.set(key, {
                        _key: key,
                        examid: r.examid,
                        classid: r.classid,
                        sectionid: r.sectionid,
                        subjectid: r.subjectid,
                        employeeid: r.employeeid,
                        attempt_number: r.attempt_number || 1,
                        examName: lang === 'ar' ? (exam?.examname || exam?.examname_en || '—') : (exam?.examname_en || exam?.examname || '—'),
                        examNameAr: exam?.examname || '',
                        examNameEn: exam?.examname_en || '',
                        classname: getField(cl, 'classname', 'classname_en', lang) || cl?.classname || '?',
                        sectionname: getField(sec, 'sectionname', 'sectionname_en', lang) || sec?.sectionname || '?',
                        subjectName: getField(sub, 'subjectname', 'Subjectname_en', lang) || '—',
                        subjectNameAr: sub?.subjectname || '',
                        subjectNameEn: sub?.Subjectname_en || '',
                        teacherName: getField(emp, 'employeename', 'employeename_en', lang) || emp?.employeename || '—',
                        teacherEmail: emp?.employeeemail || '',
                        curriculumid: scl?.curriculumid ?? null,
                        divisionid: scl?.divisionid ?? null,
                        stageid: scl?.stageid ?? null,
                        curriculumname: getField(cur, 'curriculumname', 'curriculumname_en', lang) || '—',
                        divisionname: getField(div, 'divisionname', 'divisionname_en', lang) || '—',
                        studentCount: enrollMap[`${r.classid}-${r.sectionid}`] || 0,
                        examStatus: examStatus,
                        totalmarks: exam?.totalmarks ?? exam?.total_marks ?? null,
                        duration: exam?.duration ?? null,
                        description: exam?.description ?? exam?.examdescription ?? null,
                        semesterid: r.semisterid ?? r.semesterid ?? null,
                        yearid: r.yearid ?? null,
                        created_at: exam?.created_at ?? null,
                    });
                }
            });

            const enriched = [...seen.values()];
            setRows(enriched);
            const types = [...new Set(enriched.map(r => r.examName))].filter(Boolean);
            setExamTypes(types);
        } catch (e) { addToast(getErrorMessage(e, 'general'), 'error'); }
        finally { setLoading(false); }
    }, [user, lang]);


    const [hasApplied, setHasApplied] = useState(false);
    const appliedRef = useRef(applied);
    appliedRef.current = applied;

    useEffect(() => {
        const navFilters = location.state && typeof location.state === 'object' ? location.state : null;
        if (!navFilters || Array.isArray(navFilters) || Object.keys(navFilters).length === 0) return;
        const merged = { ...EMPTY_FILTER, employeeid: 'All', ...navFilters };
        setApplied(merged);
        setHasApplied(true);
        fetchData(merged);
    }, [location.state, fetchData]);

    // Fetch per-exam stats whenever the detail modal opens
    useEffect(() => {
        if (!detailModal.show || !detailModal.row || !user) { setDetailStats(null); return; }
        const row = detailModal.row;
        setDetailStatsLoading(true);
        (async () => {
            try {
                const base = { schoolid: `eq.${user.schoolid}`, branchid: `eq.${user.branchid}`, examid: `eq.${row.examid}`, classid: `eq.${row.classid}`, sectionid: `eq.${row.sectionid}`, subjectid: `eq.${row.subjectid}`, attempt_number: `eq.${row.attempt_number || 1}` };
                const [answers, questions] = await Promise.all([
                    rest('studentanswers_tbl', { ...base, select: 'studentid,studentmark,questionid' }).catch(() => []),
                    rest('questions_exams_employee_subjects_sections_tbl', { ...base, select: 'questionid,question_marks' }).catch(() => []),
                ]);
                const qMaxMap = {};
                (questions || []).forEach(q => { qMaxMap[q.questionid] = parseFloat(q.question_marks) || 0; });
                const totalPossible = Object.values(qMaxMap).reduce((a, b) => a + b, 0);
                const studentMarks = {};
                (answers || []).forEach(a => {
                    const sid = String(a.studentid);
                    if (!studentMarks[sid]) studentMarks[sid] = 0;
                    studentMarks[sid] += parseFloat(a.studentmark) || 0;
                });
                const marksEntered = Object.keys(studentMarks).length;
                const scores = totalPossible > 0
                    ? Object.values(studentMarks).map(earned => (earned / totalPossible) * 100)
                    : [];
                const avgScore  = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
                const passCount = scores.filter(s => s >= 50).length;
                const passRate  = scores.length ? (passCount / scores.length) * 100 : null;
                const highest   = scores.length ? Math.max(...scores) : null;
                const lowest    = scores.length ? Math.min(...scores) : null;
                setDetailStats({ marksEntered, totalPossible, avgScore, passRate, passCount, highest, lowest, hasData: marksEntered > 0 });
            } catch { setDetailStats(null); }
            finally { setDetailStatsLoading(false); }
        })();
    }, [detailModal.show, detailModal.row, user]); // eslint-disable-line react-hooks/exhaustive-deps

    const filtered = sortedRows.filter(r => {
        const q = search.toLowerCase();
        const matchSearch = !search ||
            r.examName?.toLowerCase().includes(q) ||
            r.subjectName?.toLowerCase().includes(q) ||
            r.teacherName?.toLowerCase().includes(q) ||
            r.classname?.includes(search);
        const mc = applied.classid === 'All' || String(r.classid) === applied.classid;
        const ms = applied.sectionid === 'All' || String(r.sectionid) === applied.sectionid;
        const msub = applied.subjectid === 'All' || String(r.subjectid) === applied.subjectid;
        const mex = applied.examid === 'All' || String(r.examid) === applied.examid;
        const mem = applied.employeeid === 'All' || String(r.employeeid) === applied.employeeid;
        const mcur = applied.curriculumid === 'All' || String(r.curriculumid) === applied.curriculumid;
        const mdiv = applied.divisionid === 'All' || String(r.divisionid) === applied.divisionid;
        const mst = applied.stageid === 'All' || String(r.stageid) === applied.stageid;
        return matchSearch && mc && ms && msub && mex && mem && mcur && mdiv && mst;
    });
    const columnFiltered = applyColumnSearch(filtered);

    const handleDelete = async () => {
        const row = deleteModal.row;
        if (!row) return;
        try {
            await dbQuery(
                `questions_exams_employee_subjects_sections_tbl` +
                `?examid=eq.${row.examid}&classid=eq.${row.classid}&sectionid=eq.${row.sectionid}` +
                `&subjectid=eq.${row.subjectid}&employeeid=eq.${row.employeeid}&attempt_number=eq.${row.attempt_number}`,
                'DELETE'
            );
            addToast(t('examEntryDeleted', lang), 'success');
            setDeleteModal({ show: false, row: null });
            fetchData();
        } catch (err) { addToast(getErrorMessage(err, 'general'), 'error'); }
    };


    useEffect(() => {
        if (!hasApplied) return;
        fetchData(appliedRef.current);
    }, [lang, hasApplied, fetchData]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div className="space-y-8 animate-fade-in pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-[#0f172a]">{t('examsCentral', lang)}</h1>
                    <p className="text-[#64748b] text-sm font-medium">{t('manageExamsDesc', lang)}</p>
                    <Breadcrumb />
                </div>
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 px-4 py-2.5 rounded-lg text-sm font-medium">
                    <span className="text-base">ℹ️</span>
                    {t('examsCreatedByTeachers', lang)}
                </div>
            </div>

            {/* Filters */}
            <FilterBar
                filters={[...buildFilters(applied, filterData, {}, lang), { key: 'employeeid', label: t('teacher', lang), value: applied.employeeid ?? 'All', options: filterData.employees || [] }]}
                appliedFilters={applied}
                scRows={filterData.scRows}

                onApply={vals => { setApplied(vals); setHasApplied(true); fetchData(vals); }}
                onReset={vals => { setApplied({ ...vals, employeeid: 'All' }); setHasApplied(false); setRows([]); }}
            />
            <div className="bg-white rounded-xl border border-[#e2e8f0] p-4 flex items-center gap-3">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94a3b8]" />
                    <input type="text" placeholder={t('searchAdminExamsPlaceholder', lang)} className="input-field pl-10 h-10 w-full" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
            </div>

            {/* Table */}
            <div className="card overflow-hidden bg-white border-[#e2e8f0] rounded-xl shadow-sm">
                <div className="p-6 border-b border-[#e2e8f0] bg-slate-50/50 flex items-center gap-3">
                    <ClipboardList className="h-5 w-5 text-[#1d4ed8]" />
                    <h2 className="text-base font-bold text-[#0f172a]">{t('examsDirectory', lang)}</h2>
                    <span className="ml-auto text-xs text-[#94a3b8] font-medium">{columnFiltered.length} {t('exams', lang)}</span>
                </div>
                <div className="overflow-x-auto" dir={isAr ? 'rtl' : 'ltr'}>
                    <table className={`w-full ${isAr ? 'text-right' : 'text-left'}`}>
                        <thead className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                            <tr className="text-[#64748b] text-xs font-bold uppercase tracking-wider">
                                <SortableTh col="classname" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-6" searchValue={columnSearch['classname']} isSearchOpen={activeSearch==='classname'} onSearchOpen={()=>setActiveSearch('classname')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('classname','');}} onSearchChange={v=>setColumnSearch('classname',v)}>{t('class', lang)}</SortableTh>
                                <SortableTh col="sectionname" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-6" searchValue={columnSearch['sectionname']} isSearchOpen={activeSearch==='sectionname'} onSearchOpen={()=>setActiveSearch('sectionname')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('sectionname','');}} onSearchChange={v=>setColumnSearch('sectionname',v)}>{t('section', lang)}</SortableTh>
                                <SortableTh col="subjectName" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-6" searchValue={columnSearch['subjectName']} isSearchOpen={activeSearch==='subjectName'} onSearchOpen={()=>setActiveSearch('subjectName')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('subjectName','');}} onSearchChange={v=>setColumnSearch('subjectName',v)}>{t('subject', lang)}</SortableTh>
                                <SortableTh col="examName" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-6" searchValue={columnSearch['examName']} isSearchOpen={activeSearch==='examName'} onSearchOpen={()=>setActiveSearch('examName')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('examName','');}} onSearchChange={v=>setColumnSearch('examName',v)}>{t('exam', lang)}</SortableTh>
                                <SortableTh col="teacherName" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-6" searchValue={columnSearch['teacherName']} isSearchOpen={activeSearch==='teacherName'} onSearchOpen={()=>setActiveSearch('teacherName')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('teacherName','');}} onSearchChange={v=>setColumnSearch('teacherName',v)}>{t('teacher', lang)}</SortableTh>
                                <SortableTh col="curriculumname" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-6" searchValue={columnSearch['curriculumname']} isSearchOpen={activeSearch==='curriculumname'} onSearchOpen={()=>setActiveSearch('curriculumname')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('curriculumname','');}} onSearchChange={v=>setColumnSearch('curriculumname',v)}>{t('curriculum', lang)}</SortableTh>
                                <SortableTh col="divisionname" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-6" searchValue={columnSearch['divisionname']} isSearchOpen={activeSearch==='divisionname'} onSearchOpen={()=>setActiveSearch('divisionname')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('divisionname','');}} onSearchChange={v=>setColumnSearch('divisionname',v)}>{t('division', lang)}</SortableTh>
                                <SortableTh col="studentCount" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-6">{t('students', lang)}</SortableTh>
                                <SortableTh col="examStatus" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-6" searchValue={columnSearch['examStatus']} isSearchOpen={activeSearch==='examStatus'} onSearchOpen={()=>setActiveSearch('examStatus')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('examStatus','');}} onSearchChange={v=>setColumnSearch('examStatus',v)}>{t('status', lang)}</SortableTh>
                                <th className="px-6 py-4 text-xs font-bold text-[#64748b] uppercase tracking-wider text-right">{t('action', lang)}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#e2e8f0]">
                            {!hasApplied && (
                                <tr><td colSpan={9} className="px-6 py-20 text-center text-[#94a3b8] font-medium">{t('pressApplyToLoad', lang)}</td></tr>
                            )}
                            {hasApplied && loading && (
                                <tr><td colSpan={9} className="px-6 py-16 text-center text-[#94a3b8]">{t('loading', lang)}</td></tr>
                            )}
                            {hasApplied && !loading && columnFiltered.length === 0 && (
                                <tr>
                                    <td colSpan={9} className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <ClipboardList className="h-10 w-10 text-slate-200" />
                                            <p className="text-slate-400 font-medium">{t('noData', lang)}</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                            {hasApplied && !loading && columnFiltered.length > 0 && (
                                <AnimatePresence initial={false}>
                                    {columnFiltered.map((row) => (
                                        <motion.tr
                                            key={row._key}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            className="hover:bg-blue-50/20 transition-colors"
                                        >
                                            <td className="px-4 py-3 text-center text-sm font-bold text-[#0f172a]">{t('class', lang)} {row.classname}</td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="inline-flex items-center justify-center w-8 h-8 bg-slate-100 rounded-lg text-xs font-black text-[#475569] border border-slate-200">
                                                    {row.sectionname}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center text-sm text-[#475569] font-medium">{row.subjectName}</td>
                                            <td className="px-4 py-3 text-center">
                                                <div>
                                                    <span className="text-sm font-bold text-[#0f172a]">{row.examName}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-center text-sm text-[#475569]">{row.teacherName}</td>
                                            <td className="px-4 py-3 text-center text-sm text-[#475569]">{row.curriculumname}</td>
                                            <td className="px-4 py-3 text-center text-sm text-[#475569]">{row.divisionname}</td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="flex items-center gap-1.5 text-[#10b981] text-xs font-bold bg-green-50 px-2.5 py-1 rounded-full border border-green-100 w-fit">
                                                    <CheckCircle className="h-3 w-3" /> {row.studentCount}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border capitalize ${
                                                    row.examStatus === 'cancelled' ? 'bg-red-50 text-red-700 border-red-200' :
                                                    row.examStatus === 'submitted' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                                    row.examStatus === 'marked' || row.examStatus === 'completed' || row.examStatus === 'inprogress' ? 'bg-green-50 text-green-700 border-green-200' :
                                                    'bg-slate-50 text-slate-600 border-slate-200'
                                                }`}>
                                                    {row.examStatus === 'new' || !row.examStatus ? t('new', lang) :
                                                     row.examStatus === 'marked' || row.examStatus === 'completed' || row.examStatus === 'inprogress' ? t('marked', lang) :
                                                     row.examStatus === 'submitted' ? t('submitted', lang) :
                                                     row.examStatus === 'cancelled' ? t('cancelled', lang) : row.examStatus}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => setDetailModal({ show: true, row })}
                                                        className="p-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors border border-blue-100"
                                                        title="View Details"
                                                    >
                                                        <BarChart2 className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => setDeleteModal({ show: true, row })}
                                                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-red-100"
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </motion.tr>
                                    ))}
                                </AnimatePresence>
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="p-4 bg-slate-50/50 border-t border-[#e2e8f0] flex items-center">
                    <span className="text-xs font-bold text-[#64748b] uppercase tracking-wider mr-3">{t('total', lang)}</span>
                    <div className="px-3 py-1 bg-white rounded-lg border border-[#e2e8f0] text-xs font-black text-[#0f172a] shadow-sm">{columnFiltered.length} {t('rows', lang)}</div>
                </div>
            </div>


            {/* Exam Details Modal */}
            <AnimatePresence>
                {detailModal.show && detailModal.row && (() => {
                    const row = detailModal.row;
                    const st = detailStats;
                    const fmt = (n) => n != null ? `${Math.round(n)}%` : '—';
                    const statusColors = {
                        cancelled: 'bg-red-100 text-red-700 border-red-200',
                        submitted: 'bg-purple-100 text-purple-700 border-purple-200',
                        marked: 'bg-green-100 text-green-700 border-green-200',
                        new: 'bg-slate-100 text-slate-600 border-slate-200',
                    };
                    const statusColor = statusColors[row.examStatus] || statusColors.new;
                    return (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                            onClick={() => setDetailModal({ show: false, row: null })} />
                        <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-2xl w-full max-w-lg shadow-2xl z-10 overflow-hidden relative">

                            {/* Header */}
                            <div className="flex items-start justify-between px-6 py-5 bg-gradient-to-r from-[#1e3a8a] to-[#1d4ed8] text-white">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-white/15 rounded-xl">
                                        <BarChart2 className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-bold">{row.examName}</h3>
                                        <p className="text-blue-200 text-xs mt-0.5">{row.subjectName} · {t('class', lang)} {row.classname} — {row.sectionname}</p>
                                    </div>
                                </div>
                                <button title="Close" onClick={() => setDetailModal({ show: false, row: null })} className="p-1.5 rounded-lg hover:bg-white/20 transition-colors mt-0.5">
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
                                {/* Basic info */}
                                <div className="grid grid-cols-2 gap-3">
                                    {[
                                        { label: t('teacher', lang),    value: row.teacherName },
                                        { label: t('curriculum', lang), value: row.curriculumname },
                                        { label: t('division', lang),   value: row.divisionname },
                                        { label: t('status', lang),     value: (
                                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold border capitalize ${statusColor}`}>
                                                {row.examStatus || 'new'}
                                            </span>
                                        )},
                                        { label: t('students', lang),   value: row.studentCount },
                                        row.totalmarks != null && { label: t('totalMarks', lang), value: row.totalmarks },
                                        row.duration    != null && { label: 'Duration',           value: `${row.duration} min` },
                                        row.description         && { label: 'Description',        value: row.description },
                                    ].filter(Boolean).map((item, i) => (
                                        <div key={i} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                                            <p className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider mb-1">{item.label}</p>
                                            <div className="text-sm font-bold text-[#0f172a]">{item.value}</div>
                                        </div>
                                    ))}
                                </div>

                                {/* Performance stats */}
                                <div>
                                    <p className="text-xs font-bold text-[#64748b] uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <BarChart2 className="h-3.5 w-3.5" /> Performance
                                    </p>
                                    {detailStatsLoading ? (
                                        <div className="flex items-center justify-center py-6 text-[#94a3b8]">
                                            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading stats...
                                        </div>
                                    ) : !st || !st.hasData ? (
                                        <div className="text-center py-6 text-sm text-[#94a3b8] bg-slate-50 rounded-xl border border-slate-100">
                                            No marks entered yet
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
                                                <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Avg Score</p>
                                                <p className="text-2xl font-black text-blue-700 mt-1">{fmt(st.avgScore)}</p>
                                            </div>
                                            <div className={`border rounded-xl p-3 text-center ${st.passRate >= 50 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                                                <p className={`text-[10px] font-bold uppercase tracking-wider ${st.passRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>Pass Rate</p>
                                                <p className={`text-2xl font-black mt-1 ${st.passRate >= 50 ? 'text-green-700' : 'text-red-700'}`}>{fmt(st.passRate)}</p>
                                                <p className={`text-[10px] mt-0.5 ${st.passRate >= 50 ? 'text-green-500' : 'text-red-500'}`}>{st.passCount} / {st.marksEntered} passed</p>
                                            </div>
                                            <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-center">
                                                <p className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider">Highest Score</p>
                                                <p className="text-2xl font-black text-[#0f172a] mt-1">{fmt(st.highest)}</p>
                                            </div>
                                            <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-center">
                                                <p className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider">Lowest Score</p>
                                                <p className="text-2xl font-black text-[#0f172a] mt-1">{fmt(st.lowest)}</p>
                                            </div>
                                            <div className="col-span-2 bg-indigo-50 border border-indigo-100 rounded-xl p-3 flex items-center justify-between">
                                                <p className="text-xs font-bold text-indigo-500">Marks Entered</p>
                                                <p className="text-sm font-black text-indigo-700">{st.marksEntered} / {row.studentCount} students</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                                <button onClick={() => setDetailModal({ show: false, row: null })} className="px-5 py-2 rounded-xl bg-[#1d4ed8] text-white text-sm font-bold hover:bg-[#1e40af]">Close</button>
                            </div>
                        </motion.div>
                    </div>
                    );
                })()}
            </AnimatePresence>

            {/* Delete Modal */}
            <AnimatePresence>
                {deleteModal.show && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                            onClick={() => setDeleteModal({ show: false, row: null })} />
                        <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
                            className="bg-white rounded-2xl w-full max-w-sm shadow-2xl z-10 p-8 text-center relative">
                            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                                <AlertTriangle size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-[#0f172a] mb-2">{t('deleteExamEntry', lang)}</h3>
                            <p className="text-[#64748b] text-sm mb-8 leading-relaxed">
                                {t('delete', lang)} <span className="font-bold text-[#0f172a]">{deleteModal.row?.examName}</span> —{' '}
                                <span className="font-bold">{deleteModal.row?.subjectName}</span> {t('for', lang)} {t('grade', lang)}{' '}
                                <span className="font-bold">{deleteModal.row?.classname}-{deleteModal.row?.sectionname}</span>?
                            </p>
                            <div className="flex gap-4">
                                <button onClick={() => setDeleteModal({ show: false, row: null })} className="flex-1 py-3 font-bold text-slate-600 hover:bg-slate-50 rounded-xl">{t('cancel', lang)}</button>
                                <button onClick={handleDelete} className="flex-1 py-3 font-bold bg-red-600 text-white hover:bg-red-700 rounded-xl">{t('delete', lang)}</button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}