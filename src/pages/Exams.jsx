import { t, getField, getStudentName as _getStudentName } from '../lib/langHelper';
import { useLang } from '../context/LanguageContext';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ClipboardList, Plus, Trash2, AlertTriangle, Loader2, Search, Upload, PlayCircle, Pencil, Ban, Play } from 'lucide-react';
import FilterBar from '../components/FilterBar';
import { useNavigate, useLocation } from 'react-router-dom';
import Breadcrumb from '../components/Breadcrumb';
import { useToast } from '../context/ToastContext';
import { useSortable } from '../lib/useSortable';
import SortableTh from '../components/SortableTh';
import { useAuth } from '../context/AuthContext';
import { rest, dbQuery } from '../lib/supabaseClient';
import { buildFilters, EMPTY_FILTER, loadGrades, calcGradeFromList } from '../lib/helpers';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList, AreaChart, Area, ComposedChart, Line, Legend } from 'recharts';
import { useFilterData } from '../lib/useFilterData';
import { useColumnSearch } from '../lib/useColumnSearch';



async function deleteRows(table, filters) {
    const params = Object.entries(filters).map(([k, v]) => `${k}=eq.${v}`).join('&');
    return dbQuery(`${table}?${params}`, 'DELETE');
}

// Status derived from whether studentmarks exist
function getStatus(examKey, answeredKeys) {
    if (answeredKeys.has(examKey)) return 'marked';
    return 'new';
}

const STATUS_STYLES = {
    new: 'bg-blue-50 text-blue-700 border-blue-200',
    marked: 'bg-green-50 text-green-700 border-green-200',
    submitted: 'bg-purple-50 text-purple-700 border-purple-200',
    cancelled: 'bg-red-50 text-red-700 border-red-200',
};

export default function Exams() {
    const { lang, isAr } = useLang();

    const navigate = useNavigate();
    const location = useLocation();
    const { addToast } = useToast();
    const { user } = useAuth();
    const filterData = useFilterData(user, lang);
    const [exams, setExams] = useState([]);
    const [hasApplied, setHasApplied] = useState(false);
    const [loading, setLoading] = useState(true);
    const [deleteModal, setDeleteModal] = useState({ show: false, exam: null });
    const [cancelModal, setCancelModal] = useState({ show: false, exam: null });
    const [cancelling, setCancelling] = useState(false);
    const [search, setSearch] = useState('');
    const [applied, setApplied] = useState({ ...EMPTY_FILTER });
    const [deleting, setDeleting] = useState(false);
    const [answeredKeys, setAnsweredKeys] = useState(new Set());
    const [examVisual, setExamVisual] = useState({ data: [], loading: false, examid: null });
    const [grades, setGrades] = useState([]);
    const [teacherExamBaseOptions, setTeacherExamOptions] = useState([]);
    const examTblRef = useRef([]); // raw exams_tbl rows cached for relabeling on lang change
    const teacherExamOptions = useMemo(() => [
        { value: 'All', label: t('allExams', lang) },
        ...teacherExamBaseOptions.map(r => {
            const raw = examTblRef.current.find(e => e.examid === r.examid);
            return { value: String(r.examid), label: getField(raw, 'examname', 'examname_en', lang) || r.examname };
        })
    ], [teacherExamBaseOptions.map(r => r.examid).join(','), lang]); // eslint-disable-line
    const [allStudentScores, setAllStudentScores] = useState([]);
    const [chartScores, setChartScores] = useState([]);
    const [chartLoading, setChartLoading] = useState(false);
    const [chartMaxMark, setChartMaxMark] = useState(100);
    const { sorted: sortedExamsBase, sortCol, sortDir, handleSort } = useSortable(exams, 'examname');
    const { columnSearch, activeSearch, setActiveSearch, setColumnSearch, applyColumnSearch } = useColumnSearch();

    const fetchExams = useCallback(async () => {
        if (!user) return;
        try {
            setLoading(true);
            const [stuExams, examTbl, answers, questionRows] = await Promise.all([
                rest('students_exams_employees_section_subjects_classes_semisters_cur', {
                    employeeid: `eq.${user.employeeid}`, schoolid: `eq.${user.schoolid}`, branchid: `eq.${user.branchid}`, select: 'examid,classid,sectionid,subjectid,stageid,semisterid,yearid,curriculumid,divisionid,studentid',
                }),
                rest('exams_tbl', { select: '*' }),
                rest('studentanswers_tbl', { employeeid: `eq.${user.employeeid}`, schoolid: `eq.${user.schoolid}`, branchid: `eq.${user.branchid}`, select: 'examid,classid,sectionid,subjectid,studentid,attempt_number' }),
                rest('questions_exams_employee_subjects_sections_tbl', {
                    employeeid: `eq.${user.employeeid}`, schoolid: `eq.${user.schoolid}`, branchid: `eq.${user.branchid}`,
                    select: 'examid,classid,sectionid,subjectid,question_marks,status,attempt_number,exam_type',
                }).catch(() => []),
            ]);

            // Scope classes/sections/subjects to IDs in both student enrollments and question rows
            const neededClassIds   = [...new Set([...stuExams.map(r => r.classid),   ...(questionRows || []).map(q => q.classid)])];
            const neededSectionIds = [...new Set([...stuExams.map(r => r.sectionid), ...(questionRows || []).map(q => q.sectionid)])];
            const neededSubjectIds = [...new Set([...stuExams.map(r => r.subjectid), ...(questionRows || []).map(q => q.subjectid)])];
            const [clTbl, secRows, subTbl] = await Promise.all([
                neededClassIds.length   ? rest('classes_tbl',  { classid:   `in.(${neededClassIds})`,   select: 'classid,classname,classname_en' })   : [],
                neededSectionIds.length ? rest('sections_tbl', { sectionid: `in.(${neededSectionIds})`, select: 'sectionid,sectionname,sectionname_en' }) : [],
                neededSubjectIds.length ? rest('subjects_tbl', { subjectid: `in.(${neededSubjectIds})`, select: 'subjectid,subjectname,Subjectname_en' }) : [],
            ]);
            examTblRef.current = examTbl; // cache for language relabeling

            // Keep latest-attempt tracking for chart/answeredKeys only
            const latestAttemptMap = {};
            (questionRows || []).forEach(q => {
                const k = `${q.examid}-${q.classid}-${q.sectionid}-${q.subjectid}`;
                const cur = parseInt(q.attempt_number, 10) || 1;
                if (!latestAttemptMap[k] || cur > latestAttemptMap[k]) latestAttemptMap[k] = cur;
            });
            const latestAnswers = (answers || []).filter(a => {
                const k = `${a.examid}-${a.classid}-${a.sectionid}-${a.subjectid}`;
                return (parseInt(a.attempt_number, 10) || 1) === (latestAttemptMap[k] ?? 1);
            });
            const aKeys = new Set(latestAnswers.map(a => `${a.examid}-${a.classid}-${a.sectionid}-${a.subjectid}`));
            setAnsweredKeys(aKeys);

            // Group ALL question rows by attempt (examid-classid-sectionid-subjectid-attempt_number)
            // so cancelled attempts remain visible alongside new ones
            const attemptGroupMap = {};
            (questionRows || []).forEach(q => {
                const k = `${q.examid}-${q.classid}-${q.sectionid}-${q.subjectid}-${parseInt(q.attempt_number, 10) || 1}`;
                if (!attemptGroupMap[k]) attemptGroupMap[k] = [];
                attemptGroupMap[k].push(q);
            });

            const rows = Object.values(attemptGroupMap).map(qs => {
                const q0 = qs[0];
                const attemptNum = parseInt(q0.attempt_number, 10) || 1;
                const exam = examTbl.find(e => e.examid === q0.examid);
                const cl   = clTbl.find(c => c.classid   === q0.classid);
                const sec  = secRows.find(s => s.sectionid === q0.sectionid);
                const sub  = subTbl.find(s => s.subjectid  === q0.subjectid);

                const totalMark = qs.reduce((sum, q) => sum + (parseFloat(q.question_marks) || 0), 0);

                const qStatus = String(q0.status || '').toLowerCase();
                let status;
                if (qStatus === 'cancelled') status = 'cancelled';
                else if (qStatus === 'submitted') status = 'submitted';
                else if (['marked', 'completed', 'inprogress'].includes(qStatus)) status = 'marked';
                else status = 'new';

                const attemptAnswers = (answers || []).filter(a =>
                    String(a.examid)    === String(q0.examid) &&
                    String(a.classid)   === String(q0.classid) &&
                    String(a.sectionid) === String(q0.sectionid) &&
                    String(a.subjectid) === String(q0.subjectid) &&
                    (parseInt(a.attempt_number, 10) || 1) === attemptNum
                );
                const marksEntered = new Set(attemptAnswers.map(a => a.studentid)).size;

                const totalStudents = new Set(stuExams.filter(x =>
                    String(x.examid)    === String(q0.examid) &&
                    String(x.classid)   === String(q0.classid) &&
                    String(x.sectionid) === String(q0.sectionid) &&
                    String(x.subjectid) === String(q0.subjectid)
                ).map(x => x.studentid)).size;

                const stuRow = stuExams.find(x =>
                    String(x.examid)    === String(q0.examid) &&
                    String(x.classid)   === String(q0.classid) &&
                    String(x.sectionid) === String(q0.sectionid) &&
                    String(x.subjectid) === String(q0.subjectid)
                );

                return {
                    examid:         q0.examid,
                    classid:        q0.classid,
                    sectionid:      q0.sectionid,
                    subjectid:      q0.subjectid,
                    attempt_number: attemptNum,
                    stageid:        stuRow?.stageid,
                    semisterid:     stuRow?.semisterid,
                    yearid:         stuRow?.yearid,
                    curriculumid:   stuRow?.curriculumid,
                    divisionid:     stuRow?.divisionid,
                    status, marksEntered, totalStudents, totalMark,
                    examname:    getField(exam, 'examname',    'examname_en',    lang) || `Exam ${q0.examid}`,
                    examType:    q0.exam_type || 'normal',
                    classname:   getField(cl,  'classname',   'classname_en',   lang) || cl?.classname   || String(q0.classid),
                    sectionname: getField(sec, 'sectionname', 'sectionname_en', lang) || sec?.sectionname || String(q0.sectionid),
                    subjectname: getField(sub, 'subjectname', 'Subjectname_en', lang) || sub?.subjectname || String(q0.subjectid),
                };
            });
            setExams(rows);
            // Build exam options scoped to this teacher only
            const teacherExams = [...new Map(rows.map(r => [r.examid, r])).values()];
            setTeacherExamOptions(teacherExams);

            // Fetch all student scores for the distribution chart
            try {
                const [answerRows, questionRows] = await Promise.all([
                    rest('studentanswers_tbl', {
                        employeeid: `eq.${user.employeeid}`,
                        schoolid: `eq.${user.schoolid}`,
                        branchid: `eq.${user.branchid}`,
                        select: 'studentid,examid,classid,sectionid,subjectid,studentmark,questionid',
                    }),
                    rest('questions_exams_employee_subjects_sections_tbl', {
                        employeeid: `eq.${user.employeeid}`,
                        schoolid: `eq.${user.schoolid}`,
                        branchid: `eq.${user.branchid}`,
                        select: 'questionid,question_marks,examid,classid,sectionid,subjectid',
                    }),
                ]);
                // Max marks per exam-class-section-subject-question
                const qMaxMap = {};
                (questionRows || []).forEach(q => {
                    const k = `${q.examid}-${q.classid}-${q.sectionid}-${q.subjectid}-${q.questionid}`;
                    qMaxMap[k] = parseFloat(q.question_marks) || 0;
                });
                // Total max per exam-class-section-subject combo
                const totalMaxMap = {};
                (questionRows || []).forEach(q => {
                    const k = `${q.examid}-${q.classid}-${q.sectionid}-${q.subjectid}`;
                    totalMaxMap[k] = (totalMaxMap[k] || 0) + (parseFloat(q.question_marks) || 0);
                });
                // Sum earned marks per student per exam-class-section-subject
                const stuEarned = {};
                (answerRows || []).forEach(a => {
                    const k = `${a.examid}-${a.classid}-${a.sectionid}-${a.subjectid}-${a.studentid}`;
                    stuEarned[k] = (stuEarned[k] || 0) + (parseFloat(a.studentmark) || 0);
                });
                // Convert to pct scores — one entry per student per exam combo
                const scores = Object.entries(stuEarned).map(([k, earned]) => {
                    const parts = k.split('-');
                    const comboKey = parts.slice(0, 4).join('-');
                    const totalMax = totalMaxMap[comboKey] || 0;
                    return totalMax > 0 ? parseFloat((earned / totalMax * 100).toFixed(1)) : 0;
                }).filter(s => s > 0);
                setAllStudentScores(scores);
            } catch { setAllStudentScores([]); }
        } catch (e) { addToast(e.message, 'error'); }
        finally { setLoading(false); }
    }, [user, lang]);

    useEffect(() => { fetchExams(); }, [fetchExams]);
    useEffect(() => { loadGrades().then(setGrades); }, []);
    useEffect(() => {
        const navFilters = location.state && typeof location.state === 'object' ? location.state : null;
        if (!navFilters || Array.isArray(navFilters) || Object.keys(navFilters).length === 0) return;
        const merged = { ...EMPTY_FILTER, ...navFilters };
        setApplied(merged);
        // Only auto-apply if at least one filter has a real value (not 'All')
        const hasRealFilter = Object.values(navFilters).some(v => v && v !== 'All');
        if (hasRealFilter) setHasApplied(true);
    }, [location.state]);


    const handleDelete = async () => {
        const e = deleteModal.exam;
        if (!e) return;
        setDeleting(true);
        try {
            // Delete only this specific attempt's questions and answers
            await deleteRows('questions_exams_employee_subjects_sections_tbl', { examid: e.examid, employeeid: user.employeeid, classid: e.classid, sectionid: e.sectionid, attempt_number: e.attempt_number });
            await deleteRows('studentanswers_tbl', { examid: e.examid, employeeid: user.employeeid, classid: e.classid, sectionid: e.sectionid, attempt_number: e.attempt_number });
            // Only remove student enrollments if no other attempts remain for this combo
            const remaining = await rest('questions_exams_employee_subjects_sections_tbl', {
                examid: `eq.${e.examid}`, employeeid: `eq.${user.employeeid}`,
                classid: `eq.${e.classid}`, sectionid: `eq.${e.sectionid}`, subjectid: `eq.${e.subjectid}`,
                select: 'questionid', limit: 1,
            });
            if (!remaining?.length) {
                await deleteRows('students_exams_employees_section_subjects_classes_semisters_cur', { examid: e.examid, employeeid: user.employeeid, classid: e.classid, sectionid: e.sectionid });
            }
            addToast('Exam deleted!', 'success');
            setDeleteModal({ show: false, exam: null });
            fetchExams();
        } catch (err) { addToast(err.message, 'error'); }
        finally { setDeleting(false); }
    };

    const handleCancel = async () => {
        const e = cancelModal.exam;
        if (!e) return;
        setCancelling(true);
        try {
            const params = `examid=eq.${e.examid}&employeeid=eq.${user.employeeid}&classid=eq.${e.classid}&sectionid=eq.${e.sectionid}&subjectid=eq.${e.subjectid}&attempt_number=eq.${e.attempt_number}&schoolid=eq.${user.schoolid}&branchid=eq.${user.branchid}`;
            await dbQuery(`questions_exams_employee_subjects_sections_tbl?${params}`, 'PATCH', { status: 'cancelled' }, 'return=minimal');
            addToast('Exam cancelled and locked.', 'success');
            setCancelModal({ show: false, exam: null });
            fetchExams();
        } catch (err) { addToast(err.message, 'error'); }
        finally { setCancelling(false); }
    };




    // Fetch student marks visual when a specific exam is selected
    useEffect(() => {
        const examId = applied.examid;
        if (!examId || examId === 'All' || !user) {
            setExamVisual({ data: [], loading: false, examid: null });
            return;
        }
        const examRows = exams.filter(e => String(e.examid) === String(examId));
        if (examRows.length === 0) {
            setExamVisual({ data: [], loading: false, examid: null });
            return;
        }

        setExamVisual({ data: [], loading: true, examid: examId });
        (async () => {
            try {
                // Fetch for every class/section/subject combo of this exam
                const allData = await Promise.all(examRows.map(async r => {
                    const [allQuestionRows, studentRows, allAnswerRows] = await Promise.all([
                        rest('questions_exams_employee_subjects_sections_tbl', {
                            examid: `eq.${examId}`,
                            employeeid: `eq.${user.employeeid}`,
                            classid: `eq.${r.classid}`,
                            sectionid: `eq.${r.sectionid}`,
                            subjectid: `eq.${r.subjectid}`,
                            select: 'questionid,question_marks,attempt_number',
                        }),
                        rest('students_tbl', { select: 'studentid,studentfirstname_en,studentfathersname_en,studentsurname_en,studentfirstname_ar,studentfathersname_ar,studentsurname_ar,studentgrandfathersname_en,studentgrandfathersname_ar' }),
                        rest('studentanswers_tbl', {
                            examid: `eq.${examId}`,
                            employeeid: `eq.${user.employeeid}`,
                            classid: `eq.${r.classid}`,
                            sectionid: `eq.${r.sectionid}`,
                            subjectid: `eq.${r.subjectid}`,
                            select: 'studentid,questionid,studentmark,attempt_number',
                        }),
                    ]);

                    // Find latest attempt number for this combo
                    const latestAttempt = (allQuestionRows || []).reduce((max, q) =>
                        Math.max(max, parseInt(q.attempt_number, 10) || 1), 1);

                    // Filter to latest attempt only (ignore superseded attempts)
                    const questionRows = (allQuestionRows || []).filter(q =>
                        (parseInt(q.attempt_number, 10) || 1) === latestAttempt);
                    const answerRows = (allAnswerRows || []).filter(a =>
                        (parseInt(a.attempt_number, 10) || 1) === latestAttempt);

                    // Max marks per question (latest attempt only)
                    const qMaxMap = {};
                    questionRows.forEach(q => { qMaxMap[q.questionid] = parseFloat(q.question_marks) || 0; });
                    const totalMax = Object.values(qMaxMap).reduce((a, b) => a + b, 0);

                    // Sum marks per student — only for students who have actual answer records
                    const stuTotals = {};
                    answerRows.forEach(a => {
                        stuTotals[a.studentid] = (stuTotals[a.studentid] || 0) + (parseFloat(a.studentmark) || 0);
                    });

                    return { stuTotals, studentRows, totalMax };
                }));

                // Merge all combos into one data array
                const merged = {};
                const studentRowsAll = allData[0]?.studentRows || [];
                let totalMax = 0;
                allData.forEach(d => {
                    if (d.totalMax > totalMax) totalMax = d.totalMax;
                    Object.entries(d.stuTotals).forEach(([sid, earned]) => {
                        merged[sid] = (merged[sid] || 0) + earned;
                    });
                });

                const data = Object.entries(merged).map(([sid, earned]) => {
                    const stu = studentRowsAll.find(s => String(s.studentid) === String(sid));
                    const name = _getStudentName(stu, lang) || `#${sid}`;
                    const pct = totalMax > 0 ? parseFloat((earned / totalMax * 100).toFixed(1)) : 0;
                    return { name, earned: parseFloat(earned.toFixed(1)), pct, totalMax };
                }).sort((a, b) => b.pct - a.pct);

                setExamVisual({ data, loading: false, examid: examId });
            } catch {
                setExamVisual({ data: [], loading: false, examid: examId });
            }
        })();
    }, [applied.examid, exams, user, lang]);

    const filteredExams = applyColumnSearch(sortedExamsBase.filter(e => {
        const ms = !search || e.examname?.toLowerCase().includes(search.toLowerCase()) || e.subjectname?.toLowerCase().includes(search.toLowerCase());
        const mcur = !applied.curriculumid || applied.curriculumid === 'All' || String(e.curriculumid) === applied.curriculumid;
        const mdiv = !applied.divisionid || applied.divisionid === 'All' || String(e.divisionid) === applied.divisionid;
        const mc = !applied.classid || applied.classid === 'All' || String(e.classid) === applied.classid;
        const msec = !applied.sectionid || applied.sectionid === 'All' || String(e.sectionid) === applied.sectionid;
        const mex = !applied.examid || applied.examid === 'All' || String(e.examid) === applied.examid;
        const msub = !applied.subjectid || applied.subjectid === 'All' || String(e.subjectid) === applied.subjectid;
        const msem = !applied.semisterid || applied.semisterid === 'All' || String(e.semisterid) === applied.semisterid;
        return ms && mcur && mdiv && mc && msec && mex && msub && msem;
    }));

    // Fetch per-student scores for distribution chart — triggered by applied filters
    useEffect(() => {
        if (!user || !hasApplied) { setChartScores([]); return; }
        // Build stable key from applied filters to avoid infinite re-render
        const examRows = sortedExamsBase.filter(e => {
            const mcur = !applied.curriculumid || applied.curriculumid === 'All' || String(e.curriculumid) === applied.curriculumid;
            const mdiv = !applied.divisionid || applied.divisionid === 'All' || String(e.divisionid) === applied.divisionid;
            const mc = !applied.classid || applied.classid === 'All' || String(e.classid) === applied.classid;
            const msec = !applied.sectionid || applied.sectionid === 'All' || String(e.sectionid) === applied.sectionid;
            const mex = !applied.examid || applied.examid === 'All' || String(e.examid) === applied.examid;
            const msub = !applied.subjectid || applied.subjectid === 'All' || String(e.subjectid) === applied.subjectid;
            const msem = !applied.semisterid || applied.semisterid === 'All' || String(e.semisterid) === applied.semisterid;
            return mcur && mdiv && mc && msec && mex && msub && msem;
        });
        if (examRows.length === 0) { setChartScores([]); return; }
        setChartLoading(true);
        (async () => {
            try {
                const examIds = examRows.map(e => e.examid);
                const classIds = examRows.map(e => e.classid);
                const sectionIds = examRows.map(e => e.sectionid);
                const subjectIds = examRows.map(e => e.subjectid);

                const [answerRows, questionRows] = await Promise.all([
                    dbQuery(`studentanswers_tbl?employeeid=eq.${user.employeeid}&examid=in.(${examIds.join(',')})&classid=in.(${classIds.join(',')})&sectionid=in.(${sectionIds.join(',')})&subjectid=in.(${subjectIds.join(',')})&select=studentid,examid,classid,sectionid,subjectid,questionid,studentmark,attempt_number`).catch(() => []),
                    dbQuery(`questions_exams_employee_subjects_sections_tbl?employeeid=eq.${user.employeeid}&examid=in.(${examIds.join(',')})&classid=in.(${classIds.join(',')})&sectionid=in.(${sectionIds.join(',')})&subjectid=in.(${subjectIds.join(',')})&select=questionid,question_marks,examid,classid,sectionid,subjectid,attempt_number`).catch(() => []),
                ]);

                // We calculate max and scores per each exam row safely — latest attempt only
                const results = examRows.map(e => {
                    const allEQ = (questionRows || []).filter(q => String(q.examid) === String(e.examid) && String(q.classid) === String(e.classid) && String(q.sectionid) === String(e.sectionid) && String(q.subjectid) === String(e.subjectid));
                    const latestAttempt = allEQ.reduce((max, q) => Math.max(max, parseInt(q.attempt_number, 10) || 1), 1);
                    const eQuestions = allEQ.filter(q => (parseInt(q.attempt_number, 10) || 1) === latestAttempt);
                    const totalMax = eQuestions.reduce((sum, q) => sum + (parseFloat(q.question_marks) || 0), 0);
                    if (totalMax === 0) return { scores: [], totalMax: 0 };

                    const allEA = (answerRows || []).filter(a => String(a.examid) === String(e.examid) && String(a.classid) === String(e.classid) && String(a.sectionid) === String(e.sectionid) && String(a.subjectid) === String(e.subjectid));
                    const eAnswers = allEA.filter(a => (parseInt(a.attempt_number, 10) || 1) === latestAttempt);
                    const stuTotals = {};
                    eAnswers.forEach(a => {
                        stuTotals[a.studentid] = (stuTotals[a.studentid] || 0) + (parseFloat(a.studentmark) || 0);
                    });
                    const scores = Object.values(stuTotals).map(earned =>
                        parseFloat((earned / totalMax * 100).toFixed(1))
                    );
                    return { scores, totalMax };
                });
                
                const allScores = results.flatMap(r => r.scores).filter(s => s >= 0);
                const validMaxes = results.map(r => r.totalMax).filter(m => m > 0);
                // All Exams: sum all exam max marks. Single exam: use that exam's max
                const maxMark = applied.examid && applied.examid !== 'All'
                    ? (validMaxes[0] || 100)
                    : validMaxes.reduce((a, b) => a + b, 0) || 100;
                setChartScores(allScores);
                setChartMaxMark(maxMark);
            } catch { setChartScores([]); }
            finally { setChartLoading(false); }
        })();
    }, [applied, user, hasApplied]);


    // Refresh charts when language changes
    useEffect(() => {
        const handler = () => { fetchExams(); };
        window.addEventListener('langChanged', handler);
        return () => window.removeEventListener('langChanged', handler);
    }, [fetchExams]);

    return (
        <div className="space-y-8 animate-fade-in relative pb-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-[#0f172a]">{t('exams', lang)}</h1>
                    <p className="text-[#64748b] text-sm">{t('manageExams', lang) || 'Manage exams and grading submissions.'}</p>
                    <Breadcrumb />
                </div>
                <button onClick={() => navigate('/exams/create', { state: { prefill: applied } })}
                    className="flex items-center justify-center gap-2 bg-[#1d4ed8] hover:bg-[#1e40af] text-white px-4 py-2.5 rounded-lg text-sm font-bold transition-all hover:shadow-lg cursor-pointer">
                    <Plus className="h-4 w-4" /> {t('createNewExam', lang) || 'Create New Exam'}
                </button>
            </div>

            <FilterBar
                filters={buildFilters(applied, { ...filterData, exams: teacherExamOptions }, {}, lang)}
                appliedFilters={applied}

                onApply={vals => { setApplied(vals); setHasApplied(true); fetchExams(); }}
                onReset={vals => { setApplied(vals); setHasApplied(false); }}
            />
            {filteredExams.length > 0 && (chartScores.length > 0 || chartLoading) && (() => {
                const scores = chartScores; // already percentages 0–100
                // Divide 0–100% into 10 equal bins of 10% each
                const bins = Array.from({ length: 10 }, (_, i) => ({
                    range: `${i * 10}%–${(i + 1) * 10}%`,
                    midpoint: i * 10 + 5,
                    count: 0,
                }));
                scores.forEach(s => {
                    const idx = Math.min(Math.floor(s / 10), 9);
                    bins[idx].count += 1;
                });

                const total = scores.length;
                // Bell curve in percentage domain
                const mean = total > 0 ? scores.reduce((a, b) => a + b, 0) / total : 50;
                const variance = total > 1
                    ? scores.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (total - 1)
                    : Math.pow(100 / 6, 2);
                const std = Math.sqrt(variance) || (100 / 6);
                const maxCount = Math.max(...bins.map(b => b.count), 1);

                const histData = bins.map(b => {
                    const bell = (1 / (std * Math.sqrt(2 * Math.PI))) *
                        Math.exp(-0.5 * Math.pow((b.midpoint - mean) / std, 2));
                    const bellScaled = parseFloat((bell * std * Math.sqrt(2 * Math.PI) * maxCount).toFixed(2));
                    return { ...b, bell: bellScaled };
                });

                return (
                    <div className="bg-white rounded-xl border border-[#e2e8f0] p-6">
                        <div className="flex items-center justify-between mb-1">
                            <h3 className="font-bold text-sm text-[#0f172a]">{t('studentScoresDistribution', lang) || 'Student Exam Scores Distribution'}</h3>
                            <span className="text-xs font-bold text-[#64748b] bg-slate-100 px-2 py-1 rounded-lg">
                                {applied.examid && applied.examid !== 'All'
                                    ? (teacherExamOptions.find(o => String(o.value) === String(applied.examid))?.label || 'Selected Exam')
                                    : t('allExams', lang)}
                            </span>
                        </div>
                        <p className="text-xs text-[#94a3b8] mb-5">{t('scoreFrequencyDesc', lang) || 'Frequency of scores across all students in the filtered exams'}</p>
                        <div style={{ height: 280, minWidth: 0 }}>
                            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                <ComposedChart data={histData} margin={{ top: 10, right: 30, left: 10, bottom: 35 }} barCategoryGap="8%">
                                    <defs>
                                        <linearGradient id="histGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#6366f1" stopOpacity={0.85} />
                                            <stop offset="100%" stopColor="#818cf8" stopOpacity={0.45} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis
                                        dataKey="range"
                                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                                        tickLine={false}
                                        axisLine={{ stroke: '#e2e8f0' }}
                                        label={{ value: isAr ? 'درجات الامتحان (%)' : 'Exam Scores (%)', position: 'insideBottom', offset: -22, fontSize: 12, fill: '#64748b', fontWeight: 600 }}
                                    />
                                    <YAxis
                                        allowDecimals={false}
                                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                                        tickLine={false}
                                        axisLine={false}
                                        width={40}
                                        label={{ value: isAr ? 'عدد الطلاب' : 'Number of Students', angle: -90, position: 'insideLeft', offset: 5, fontSize: 12, fill: '#64748b', fontWeight: 600 }}
                                    />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
                                        formatter={(value, name) => [
                                            name === 'count' ? `${value} ${isAr ? 'طالب' : `student${value !== 1 ? 's' : ''}`}` : value.toFixed(2),
                                            name === 'count' ? (isAr ? 'توزيع الدرجات' : isAr ? 'توزيع الدرجات' : 'Marks Distribution') : (isAr ? 'المنحنى الطبيعي' : isAr ? 'المنحنى الطبيعي' : 'Normal Curve')
                                        ]}
                                    />
                                    <Legend
                                        verticalAlign="top"
                                        align="right"
                                        iconType="circle"
                                        formatter={v => <span style={{ fontSize: 11, color: '#475569', fontWeight: 600 }}>{v === 'count' ? isAr ? 'توزيع الدرجات' : 'Marks Distribution' : isAr ? 'المنحنى الطبيعي' : 'Normal Curve'}</span>}
                                    />
                                    <Bar dataKey="count" name="count" fill="url(#histGrad)" radius={[5, 5, 0, 0]} animationDuration={900} />
                                    <Line dataKey="bell" name="bell" type="monotone" stroke="#f59e0b" strokeWidth={2.5} dot={false} animationDuration={1200} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                );
            })()}

            <div className="bg-white rounded-xl border border-[#e2e8f0] p-4 flex items-center gap-3">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94a3b8]" />
                    <input type="text" placeholder={t('searchStudentPlaceholder', lang) || 'Search...'} className="input-field pl-10 h-10 w-full" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
            </div>

            <div className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden min-h-[300px]">
                <div className="p-5 border-b border-[#e2e8f0] bg-slate-50 flex items-center gap-3">
                    <ClipboardList className="h-5 w-5 text-[#1d4ed8]" />
                    <h2 className="text-base font-bold text-[#0f172a]">{t('examsDirectory', lang)}</h2>
                </div>
                {!hasApplied ? (
                    <div className="flex flex-col items-center justify-center py-20 text-[#94a3b8] gap-3">
                        <Search className="h-10 w-10 opacity-20" />
                        <p className="font-medium text-sm">{t('pressApplyToLoad', lang)}</p>
                    </div>
                ) : loading ? (
                    <div className="flex items-center justify-center py-20 text-[#94a3b8]"><Loader2 className="h-7 w-7 animate-spin mr-2" /> {t('loading', lang)}</div>
                ) : filteredExams.length === 0 ? (
                    <div className="py-20 text-center text-[#94a3b8] flex flex-col items-center justify-center gap-3">
                        <ClipboardList className="h-12 w-12 opacity-20" />
                        <p className="text-sm font-medium">{t('noExamsFound', lang)}</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto" dir={isAr ? 'rtl' : 'ltr'}>
                        <table className={`w-full ${isAr ? 'text-right' : 'text-left'}`}>
                            <thead className="bg-slate-50 border-b border-[#e2e8f0]">
                                <tr>
                                    <SortableTh col="classname" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} searchValue={columnSearch['classname']} isSearchOpen={activeSearch==='classname'} onSearchOpen={()=>setActiveSearch('classname')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('classname','');}} onSearchChange={v=>setColumnSearch('classname',v)}>{t('class', lang)}</SortableTh>
                                    <SortableTh col="sectionname" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} searchValue={columnSearch['sectionname']} isSearchOpen={activeSearch==='sectionname'} onSearchOpen={()=>setActiveSearch('sectionname')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('sectionname','');}} onSearchChange={v=>setColumnSearch('sectionname',v)}>{t('section', lang)}</SortableTh>
                                    <SortableTh col="subjectname" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} searchValue={columnSearch['subjectname']} isSearchOpen={activeSearch==='subjectname'} onSearchOpen={()=>setActiveSearch('subjectname')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('subjectname','');}} onSearchChange={v=>setColumnSearch('subjectname',v)}>{t('subject', lang)}</SortableTh>
                                    <SortableTh col="examname" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} searchValue={columnSearch['examname']} isSearchOpen={activeSearch==='examname'} onSearchOpen={()=>setActiveSearch('examname')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('examname','');}} onSearchChange={v=>setColumnSearch('examname',v)}>{t('exam', lang)}</SortableTh>
                                    <SortableTh col="examType" sortCol={sortCol} sortDir={sortDir} onSort={handleSort}>{isAr ? 'نوع الامتحان' : 'Exam Type'}</SortableTh>
                                    <SortableTh col="marksEntered" sortCol={sortCol} sortDir={sortDir} onSort={handleSort}>{t('marksEntered', lang)}</SortableTh>
                                    <SortableTh col="totalMark" sortCol={sortCol} sortDir={sortDir} onSort={handleSort}>{isAr ? 'الدرجة الإجمالية' : 'Total Mark'}</SortableTh>
                                    <SortableTh col="status" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} searchValue={columnSearch['status']} isSearchOpen={activeSearch==='status'} onSearchOpen={()=>setActiveSearch('status')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('status','');}} onSearchChange={v=>setColumnSearch('status',v)}>{t('status', lang)}</SortableTh>
                                    <th className="py-4 px-6 text-xs font-black text-[#64748b] uppercase tracking-wider">{t('actions', lang)}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#e2e8f0]">
                                {filteredExams.map((e, i) => (
                                    <motion.tr key={`${e.examid}-${e.classid}-${e.sectionid}`}
                                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                                        className={`transition-colors cursor-pointer ${e.status === 'cancelled' ? 'opacity-60 bg-slate-50' : 'hover:bg-slate-50'}`}
                                        onClick={() => navigate(`/exams/${e.examid}/${e.classid}/${e.sectionid}/${e.subjectid}/upload`)}>
                                        <td className={`py-4 px-6 text-sm font-bold ${e.status === 'cancelled' ? 'text-[#94a3b8]' : 'text-[#0f172a]'}`}>{e.classname}</td>
                                        <td className="py-4 px-6">
                                            <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-bold border ${e.status === 'cancelled' ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-[#eff6ff] text-[#1d4ed8] border-blue-100'}`}>{e.sectionname}</span>
                                        </td>
                                        <td className={`py-4 px-6 text-sm ${e.status === 'cancelled' ? 'text-[#94a3b8]' : 'text-[#475569]'}`}>{e.subjectname}</td>
                                        <td className={`py-4 px-6 text-sm font-semibold ${e.status === 'cancelled' ? 'text-[#94a3b8]' : 'text-[#0f172a]'}`}>{e.examname}</td>
                                        <td className={`py-4 px-6 text-sm font-semibold ${e.status === 'cancelled' ? 'text-[#94a3b8]' : 'text-[#475569]'}`}>
                                            {e.examType === 'auto_graded' ? (isAr ? 'اختبار آلي' : 'Auto Graded') : (isAr ? 'اختبار عادي' : 'Normal')}
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className="text-sm font-bold text-[#0f172a]">{e.marksEntered ?? 0}</span>
                                            <span className="text-xs text-[#94a3b8] ml-1">/ {e.totalStudents ?? 0}</span>
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className="text-sm font-bold text-[#0f172a]">{e.totalMark > 0 ? e.totalMark : '—'}</span>
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border capitalize ${STATUS_STYLES[e.status] || STATUS_STYLES.new}`}>
                                                {t(e.status, lang) || e.status}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-1">
                                                {/* View — only for cancelled exams */}
                                                {e.status === 'cancelled' && (
                                                    <button title="View Exam"
                                                        onClick={(ev) => { ev.stopPropagation(); navigate(`/exams/${e.examid}/${e.classid}/${e.sectionid}/${e.subjectid}/upload`); }}
                                                        className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-all">
                                                        <PlayCircle className="h-4 w-4" />
                                                    </button>
                                                )}
                                                {/* Upload Marks — only for new exams */}
                                                {e.status === 'new' && (
                                                    <button title="Upload Marks"
                                                        onClick={(ev) => { ev.stopPropagation(); navigate(`/exams/${e.examid}/${e.classid}/${e.sectionid}/${e.subjectid}/upload-marks`); }}
                                                        className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 transition-all">
                                                        <Upload className="h-4 w-4" />
                                                    </button>
                                                )}
                                                {/* Start Grading — only for marked exams */}
                                                {e.status === 'marked' && (
                                                    <button title="Process Marks"
                                                        onClick={async (ev) => {
                                                            ev.stopPropagation();
                                                            try {
                                                                const response = await fetch('https://n8n.srv1133195.hstgr.cloud/webhook-test/strat_grading', {
                                                                    method: 'POST',
                                                                    headers: { 'Content-Type': 'application/json' },
                                                                    body: JSON.stringify({
                                                                        eventType: 'start-grading-workflow',
                                                                        examid: e.examid, classid: e.classid, sectionid: e.sectionid,
                                                                        subjectid: e.subjectid, employeeid: user.employeeid,
                                                                        timestamp: new Date().toISOString(),
                                                                    }),
                                                                });
                                                                // Always update status to submitted regardless of webhook result
                                                                await dbQuery(
                                                                    `questions_exams_employee_subjects_sections_tbl?examid=eq.${e.examid}&employeeid=eq.${user.employeeid}&classid=eq.${e.classid}&sectionid=eq.${e.sectionid}&subjectid=eq.${e.subjectid}&schoolid=eq.${user.schoolid}&branchid=eq.${user.branchid}`,
                                                                    'PATCH',
                                                                    { status: 'submitted' },
                                                                    'return=minimal'
                                                                );
                                                                if (response.ok) {
                                                                    addToast('Marks processing started!', 'success');
                                                                } else {
                                                                    addToast('Status updated. Workflow trigger failed — check n8n.', 'warning');
                                                                }
                                                                await fetchExams();
                                                            } catch (err) { addToast(`Error: ${err.message}`, 'error'); }
                                                        }}
                                                        className="p-2 rounded-lg text-green-600 hover:bg-green-50 transition-all">
                                                        <Play className="h-4 w-4" />
                                                    </button>
                                                )}
                                                {/* Edit Marks — not available for cancelled */}
                                                {e.status !== 'cancelled' && (
                                                    <button title="Edit Marks"
                                                        onClick={(ev) => { ev.stopPropagation(); navigate(`/edit-marks`, { state: { examid: e.examid, classid: e.classid, sectionid: e.sectionid, subjectid: e.subjectid } }); }}
                                                        className="p-2 rounded-lg text-indigo-600 hover:bg-indigo-50 transition-all">
                                                        <Pencil className="h-4 w-4" />
                                                    </button>
                                                )}
                                                {/* Cancel — not available for already cancelled */}
                                                {e.status !== 'cancelled' && (
                                                    <button title="Cancel Exam"
                                                        onClick={(ev) => { ev.stopPropagation(); setCancelModal({ show: true, exam: e }); }}
                                                        className="p-2 rounded-lg text-orange-500 hover:bg-orange-50 transition-all">
                                                        <Ban className="h-4 w-4" />
                                                    </button>
                                                )}
                                                {/* Delete — not available for cancelled/marked/submitted */}
                                                {!['cancelled', 'marked', 'submitted'].includes(e.status) && (
                                                    <button title="Delete Exam"
                                                        onClick={(ev) => { ev.stopPropagation(); setDeleteModal({ show: true, exam: e }); }}
                                                        className="p-2 rounded-lg text-red-600 hover:bg-red-50 transition-all">
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </motion.tr>
                                ))}
                            </tbody>
                        </table>
                        <p className="px-6 py-3 text-xs text-[#94a3b8] border-t border-[#e2e8f0]">{t('showing', lang)}: {filteredExams.length} / {exams.length} {t('exams', lang)}</p>
                    </div>
                )}
            </div>

            {/* Exam Marks Visual — shown when a specific exam is selected AND has data */}
            <AnimatePresence>
                {applied.examid && applied.examid !== 'All' && examVisual.data.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 16 }}
                        className="bg-white rounded-xl border border-[#e2e8f0] p-6 shadow-sm"
                    >
                        <div className="flex items-center justify-between mb-5">
                            <div>
                                <h2 className="text-base font-bold text-[#0f172a]">{t('studentResults', lang)}</h2>
                                <p className="text-xs text-[#94a3b8] mt-0.5">{t('marksBreakdownDesc', lang)}</p>
                            </div>
                            {examVisual.data.length > 0 && (
                                <div className="flex items-center gap-4 text-xs">
                                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> {t('pass', lang)} (≥50%)</span>
                                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-400 inline-block" /> {t('borderline', lang)} (40–49%)</span>
                                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> {t('fail', lang)} (&lt;40%)</span>
                                </div>
                            )}
                        </div>

                        {examVisual.loading ? (
                            <div className="flex items-center justify-center py-12 text-[#94a3b8]">
                                <Loader2 className="h-6 w-6 animate-spin mr-2" /> {t('loadingMarks', lang)}
                            </div>
                        ) : examVisual.data.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-[#94a3b8] gap-2">
                                <ClipboardList className="h-10 w-10 opacity-30" />
                                <p className="text-sm font-medium">{t('noMarksEnteredYet', lang)}</p>
                            </div>
                        ) : (
                            <>
                                {/* Summary cards */}
                                <div className="grid grid-cols-4 gap-3 mb-6">
                                    {(() => {
                                        const total = examVisual.data.length;
                                        const passing = examVisual.data.filter(d => d.pct >= 50).length;
                                        const avg = parseFloat((examVisual.data.reduce((a, b) => a + b.pct, 0) / total).toFixed(1));
                                        const highest = examVisual.data[0];
                                        const lowest = examVisual.data[examVisual.data.length - 1];
                                        return (
                                            <>
                                                <div className="bg-slate-50 rounded-xl p-4 border border-[#e2e8f0]">
                                                    <p className="text-xs text-[#64748b] font-medium mb-1">{t('classAverage', lang)}</p>
                                                    <p className="text-2xl font-bold text-[#0f172a]">{avg}%</p>
                                                </div>
                                                <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                                                    <p className="text-xs text-green-700 font-medium mb-1">{t('passRate', lang)}</p>
                                                    <p className="text-2xl font-bold text-green-700">{Math.round(passing / total * 100)}%</p>
                                                    <p className="text-[10px] text-green-500 mt-0.5">{passing} {t('of', lang)} {total} {t('students', lang)}</p>
                                                </div>
                                                <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                                                    <p className="text-xs text-blue-700 font-medium mb-1">{t('highest', lang)}</p>
                                                    <p className="text-2xl font-bold text-blue-700">{highest?.pct}%</p>
                                                    <p className="text-[10px] text-blue-500 mt-0.5 truncate">{highest?.name}</p>
                                                </div>
                                                <div className="bg-red-50 rounded-xl p-4 border border-red-100">
                                                    <p className="text-xs text-red-700 font-medium mb-1">{t('lowest', lang)}</p>
                                                    <p className="text-2xl font-bold text-red-700">{lowest?.pct}%</p>
                                                    <p className="text-[10px] text-red-500 mt-0.5 truncate">{lowest?.name}</p>
                                                </div>
                                            </>
                                        );
                                    })()}
                                </div>

                                {/* Bar chart */}
                                <div style={{ height: Math.max(200, examVisual.data.length * 44), minWidth: 0 }}>
                                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                        <BarChart data={examVisual.data} layout="vertical" margin={{ top: 4, right: 70, left: 8, bottom: 4 }} barSize={22}>
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                            <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} />
                                            <YAxis dataKey="name" type="category" tick={{ fill: '#475569', fontSize: 12, fontWeight: 600 }} tickLine={false} axisLine={false} width={130} />
                                            <Tooltip
                                                formatter={(v, name, props) => [`${props.payload.earned} / ${props.payload.totalMax} ${t('mark', lang)} (${v}%)`, t('grade', lang)]}
                                                contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                                                cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                                            />
                                            <Bar dataKey="pct" radius={[0, 6, 6, 0]} animationDuration={900}>
                                                {examVisual.data.map((entry, i) => (
                                                    <Cell key={i} fill={entry.pct >= 50 ? '#22c55e' : entry.pct >= 40 ? '#fbbf24' : '#ef4444'} />
                                                ))}
                                                <LabelList dataKey="pct" position="right" formatter={v => `${v}%`} style={{ fill: '#475569', fontSize: 12, fontWeight: 700 }} />
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>

                            </>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {deleteModal.show && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0"><AlertTriangle className="h-5 w-5 text-red-600" /></div>
                                <div>
                                    <h3 className="font-bold text-[#0f172a]">{t('deleteExam', lang)}</h3>
                                    <p className="text-sm text-[#64748b]">{t('deleteExamDesc', lang)}</p>
                                </div>
                            </div>
                            <div className="bg-red-50 border border-red-100 rounded-lg p-3 mb-5 text-sm text-red-700 font-medium">
                                "{deleteModal.exam?.examname}" — {t('classes', lang)} {deleteModal.exam?.classname}, {t('section', lang)} {deleteModal.exam?.sectionname}
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setDeleteModal({ show: false, exam: null })} className="flex-1 px-4 py-2 border border-[#e2e8f0] rounded-lg text-sm font-bold text-[#475569] hover:bg-slate-50">{t('cancel', lang)}</button>
                                <button onClick={handleDelete} disabled={deleting} className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60">
                                    {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} {t('delete', lang)}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Cancel Exam Confirmation Modal */}
            <AnimatePresence>
                {cancelModal.show && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0"><Ban className="h-5 w-5 text-orange-600" /></div>
                                <div>
                                    <h3 className="font-bold text-[#0f172a]">{isAr ? "إلغاء الامتحان" : "Cancel Exam"}</h3>
                                    <p className="text-sm text-[#64748b]">This exam will be permanently locked. It cannot be edited or deleted after cancellation.</p>
                                </div>
                            </div>
                            <div className="bg-orange-50 border border-orange-100 rounded-lg p-3 mb-5 text-sm text-orange-700 font-medium">
                                "{cancelModal.exam?.examname}" — {t('classes', lang)} {cancelModal.exam?.classname}, {t('section', lang)} {cancelModal.exam?.sectionname}
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setCancelModal({ show: false, exam: null })} className="flex-1 px-4 py-2 border border-[#e2e8f0] rounded-lg text-sm font-bold text-[#475569] hover:bg-slate-50">{isAr ? "رجوع" : "Go Back"}</button>
                                <button onClick={handleCancel} disabled={cancelling} className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60">
                                    {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />} Cancel Exam
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}