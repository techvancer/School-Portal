import { t, getField, getStudentName as _getStudentName } from '../lib/langHelper';
import { useLang } from '../context/LanguageContext';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Save, RefreshCw, AlertCircle, RotateCcw } from 'lucide-react';
import Breadcrumb from '../components/Breadcrumb';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { insert, update, rest, dbQuery } from '../lib/supabaseClient';
import { useFilterData } from '../lib/useFilterData';
import { buildFilters, EMPTY_FILTER, getStudentFullName, calcGrade, loadGrades, calcGradeFromList } from '../lib/helpers';
import FilterBar from '../components/FilterBar';
import ConfirmDialog from '../components/ConfirmDialog';
import { useLocation } from 'react-router-dom';




export default function EditMarks() {
    const { lang, isAr } = useLang();

    const { user } = useAuth();
    const { addToast } = useToast();
    const location = useLocation();
    const filterData = useFilterData(user, lang);
    const directEditState = useMemo(() => {
        const state = location.state && typeof location.state === 'object' ? location.state : null;
        if (!state || Array.isArray(state)) return null;
        return state.classid && state.sectionid && state.subjectid && state.examid ? state : null;
    }, [location.state]);
    const autoLoadRef = useRef(false); // prevent double-fire in strict mode
    const prefillActiveRef = useRef(false); // suppress cascade resets during nav prefill

    const [allAssignments, setAllAssignments] = useState([]);
    const [allExams, setAllExams] = useState([]);

    // Change 9: filter selectors (all required)
    const [selClass,    setSelClass]    = useState('');
    const [selSection,  setSelSection]  = useState('');
    const [selSubject,  setSelSubject]  = useState('');
    const [selExam,     setSelExam]     = useState('');

    const [classOptions,   setClassOptions]   = useState([]);
    const [sectionOptions, setSectionOptions] = useState([]);
    const [subjectOptions, setSubjectOptions] = useState([]);
    const [examOptions,    setExamOptions]    = useState([]);

    const [students,  setStudents]  = useState([]);
    const [questions, setQuestions] = useState([]); // [{questionid, question_marks}]
    const [marks,     setMarks]     = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving,  setIsSaving]  = useState(false);
    const [confirm, setConfirm] = useState({ open: false });
    const [loaded,    setLoaded]    = useState(false);
    const [fieldErrors, setFieldErrors] = useState({});
    const [grades, setGrades] = useState([]);

    const sel = { backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,backgroundRepeat:'no-repeat',backgroundPosition:'right 10px center',paddingRight:'2rem',appearance:'none' };

    useEffect(() => {
        if (!user) return;
        (async () => {
            const [empSec, clTbl, secRows, subTbl, examTbl] = await Promise.all([
                rest('employees_sections_subjects_classes_semisters_curriculums_tbl', {
                    employeeid: `eq.${user.employeeid}`, schoolid: `eq.${user.schoolid}`, branchid: `eq.${user.branchid}`, select: '*'
                }),
                rest('classes_tbl',   { select: 'classid,classname_en,classname' }),
                rest('sections_tbl',  { select: 'sectionid,sectionname_en,sectionname' }),
                rest('subjects_tbl',  { select: 'subjectid,subjectname,Subjectname_en' }),
                rest('exams_tbl',     { select: 'examid,examname_en' }),
            ]);
            const seen = new Set();
            const assignments = empSec.filter(r => {
                const k = `${r.classid}-${r.sectionid}-${r.subjectid}`;
                if (seen.has(k)) return false; seen.add(k); return true;
            }).map(r => {
                const cl  = clTbl.find(c => c.classid === r.classid);
                const sec = secRows.find(s => s.sectionid === r.sectionid);
                const sub = subTbl.find(s => s.subjectid === r.subjectid);
                return {
                    ...r,
                    classname:   getField(cl, 'classname', 'classname_en', lang)   || cl?.classname   || String(r.classid),
                    sectionname: getField(sec, 'sectionname', 'sectionname_en', lang) || sec?.sectionname || String(r.sectionid),
                    subjectname: getField(sub, 'subjectname', 'Subjectname_en', lang) || sub?.subjectname || String(r.subjectid),
                };
            });
            setAllAssignments(assignments);
            setAllExams(examTbl);
            const clOpts = [...new Map(assignments.map(a => [a.classid, a])).values()];
            setClassOptions(clOpts);

            // Pre-fill from navigation state (coming from Exams page Edit icon)
            const nav = location.state || {};
            if (nav.classid && nav.sectionid && nav.subjectid && nav.examid) {
                const navClass   = String(nav.classid);
                const navSection = String(nav.sectionid);
                const navSubject = String(nav.subjectid);
                const navExam    = String(nav.examid);

                prefillActiveRef.current = true; // suppress cascade resets

                setSelClass(navClass);

                // Build section options for this class
                const secOpts = [...new Map(assignments.filter(a => String(a.classid) === navClass).map(a => [a.sectionid, a])).values()];
                setSectionOptions(secOpts);
                setSelSection(navSection);

                // Build subject options for this class+section
                const subOpts = [...new Map(assignments.filter(a => String(a.classid) === navClass && String(a.sectionid) === navSection).map(a => [a.subjectid, a])).values()];
                setSubjectOptions(subOpts);
                setSelSubject(navSubject);

                // Build exam options for this class+section+subject
                const stuExams = await rest('students_exams_employees_section_subjects_classes_semisters_cur', {
                    employeeid: `eq.${user.employeeid}`, classid: `eq.${navClass}`,
                    sectionid: `eq.${navSection}`, subjectid: `eq.${navSubject}`, select: 'examid',
                });
                const seenEx = new Set();
                const uniqueEx = stuExams.filter(r => { if (seenEx.has(r.examid)) return false; seenEx.add(r.examid); return true; });
                const exOpts = uniqueEx.map(r => ({ examid: r.examid, name: examTbl.find(e => e.examid === r.examid)?.examname_en || `Exam ${r.examid}` }));
                setExamOptions(exOpts);
                setSelExam(navExam);

                prefillActiveRef.current = false; // allow cascades again
                autoLoadRef.current = true; // trigger auto-load once state settles
            } else if (clOpts.length === 1) {
                setSelClass(String(clOpts[0].classid));
            }
        })();
    }, [user, lang]);

    useEffect(() => { loadGrades().then(setGrades); }, []);

    useEffect(() => {
        if (prefillActiveRef.current) return; // skip during nav-state prefill
        setSelSection(''); setSelSubject(''); setSelExam(''); setLoaded(false);
        if (!selClass) { setSectionOptions([]); setSubjectOptions([]); setExamOptions([]); return; }
        const secOpts = [...new Map(allAssignments.filter(a => String(a.classid) === selClass).map(a => [a.sectionid, a])).values()];
        setSectionOptions(secOpts);
        if (secOpts.length === 1) setSelSection(String(secOpts[0].sectionid));
    }, [selClass, allAssignments]);

    useEffect(() => {
        if (prefillActiveRef.current) return; // skip during nav-state prefill
        setSelSubject(''); setSelExam(''); setLoaded(false);
        if (!selSection) { setSubjectOptions([]); setExamOptions([]); return; }
        const subOpts = [...new Map(allAssignments.filter(a => String(a.classid) === selClass && String(a.sectionid) === selSection).map(a => [a.subjectid, a])).values()];
        setSubjectOptions(subOpts);
        if (subOpts.length === 1) setSelSubject(String(subOpts[0].subjectid));
    }, [selSection, selClass, allAssignments]);

    useEffect(() => {
        if (prefillActiveRef.current) return; // skip during nav-state prefill
        setSelExam(''); setLoaded(false);
        if (!selSubject) { setExamOptions([]); return; }
        (async () => {
            const stuExams = await rest('students_exams_employees_section_subjects_classes_semisters_cur', {
                employeeid: `eq.${user.employeeid}`, classid: `eq.${selClass}`,
                sectionid: `eq.${selSection}`, subjectid: `eq.${selSubject}`, select: 'examid',
            });
            const seen = new Set();
            const unique = stuExams.filter(r => { if (seen.has(r.examid)) return false; seen.add(r.examid); return true; });
            const exOpts = unique.map(r => ({ examid: r.examid, name: allExams.find(e => e.examid === r.examid)?.examname_en || `Exam ${r.examid}` }));
            setExamOptions(exOpts);
            if (exOpts.length === 1) setSelExam(String(exOpts[0].examid));
        })();
    }, [selSubject, selClass, selSection, user, allExams, lang]);

    const handleLoad = useCallback(async () => {
        // Change 9: validate all required fields
        const errors = {};
        if (!selClass)   errors.classid   = true;
        if (!selSection) errors.sectionid = true;
        if (!selSubject) errors.subjectid = true;
        if (!selExam)    errors.examid    = true;
        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
            addToast(t('pleaseFillAllRequired', lang) || 'Please fill all required fields *', 'error');
            return;
        }
        setFieldErrors({});

        const sec = allAssignments.find(a =>
            String(a.classid) === selClass && String(a.sectionid) === selSection && String(a.subjectid) === selSubject
        );
        if (!sec) return;
        setIsLoading(true); setLoaded(false);
        try {
            const [stuList, stuScRows, qs, existing] = await Promise.all([
                rest('students_tbl', { select: '*' }),
                rest('students_sections_classes_tbl', {
                    classid: `eq.${sec.classid}`, sectionid: `eq.${sec.sectionid}`,
                    schoolid: `eq.${user.schoolid}`, select: 'studentid'
                }),
                rest('questions_exams_employee_subjects_sections_tbl', {
                    examid: `eq.${selExam}`, employeeid: `eq.${user.employeeid}`,
                    subjectid: `eq.${sec.subjectid}`, classid: `eq.${sec.classid}`,
                    sectionid: `eq.${sec.sectionid}`,
                    select: 'questionid,question_marks,status',
                    order: 'questionid.asc',
                }),
                rest('studentanswers_tbl', {
                    examid: `eq.${selExam}`, employeeid: `eq.${user.employeeid}`,
                    classid: `eq.${sec.classid}`, sectionid: `eq.${sec.sectionid}`,
                    subjectid: `eq.${sec.subjectid}`, select: '*',
                }),
            ]);

            const examStatusFromQ = (qs?.[0]?.status || '').toLowerCase();
            const isFinalized = ['marked', 'completed', 'inprogress', 'submitted'].includes(examStatusFromQ);

            let enrolledIds;
            if (isFinalized) {
                const examEnrolledRows = await rest('students_exams_employees_section_subjects_classes_semisters_cur', {
                    examid: `eq.${parseInt(selExam)}`,
                    employeeid: `eq.${user.employeeid}`,
                    classid: `eq.${sec.classid}`,
                    sectionid: `eq.${sec.sectionid}`,
                    subjectid: `eq.${sec.subjectid}`,
                    select: 'studentid',
                });
                enrolledIds = new Set(examEnrolledRows.map(r => r.studentid));
                existing.forEach(ans => enrolledIds.add(ans.studentid));
            } else {
                enrolledIds = new Set(stuScRows.map(r => r.studentid));
                existing.forEach(ans => enrolledIds.add(ans.studentid));
            }

            const enrolled = Array.from(enrolledIds).map(id => {
                const s = stuList.find(st => st.studentid === id);
                return s ? { ...s, fullName: getStudentFullName(s, lang) } : null;
            }).filter(Boolean);

            setStudents(enrolled);
            // Change 9: sort questions ascending
            const sortedQs = [...qs].sort((a, b) => a.questionid - b.questionid);
            setQuestions(sortedQs);

            const m = {};
            existing.forEach(a => {
                if (!m[a.studentid]) m[a.studentid] = {};
                m[a.studentid][a.questionid] = a.studentmark ?? '';
            });
            enrolled.forEach(s => {
                if (!m[s.studentid]) m[s.studentid] = {};
                sortedQs.forEach(q => { if (m[s.studentid][q.questionid] === undefined) m[s.studentid][q.questionid] = ''; });
            });
            setMarks(m);
            setLoaded(true);
        } catch (e) { addToast(e.message, 'error'); }
        finally { setIsLoading(false); }
    }, [selClass, selSection, selSubject, selExam, allAssignments, user, lang]);

    // Auto-load when all 4 selectors populated via navigation state from Exams page
    useEffect(() => {
        if (autoLoadRef.current && selClass && selSection && selSubject && selExam) {
            autoLoadRef.current = false;
            handleLoad();
        }
    }, [selClass, selSection, selSubject, selExam, handleLoad]);


    // Validate mark input — show error and keep original value if exceeded
    const [markErrors, setMarkErrors] = useState({});
    const [sortCol, setSortCol] = useState('fullName');
    const [sortDir, setSortDir] = useState('asc');
    const [studentSearch, setStudentSearch] = useState('');
    const handleSort = (col) => {
        if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortCol(col); setSortDir('asc'); }
    };
    const sortArrow = (col) => sortCol === col ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ' ⇅';
    const handleMarkChange = (sid, qid, val, maxMark) => {
        const errKey = `${sid}-${qid}`;
        if (val !== '') {
            const num = parseFloat(val);
            if (isNaN(num) || num < 0) return; // silently ignore non-numeric/negative
            if (num > maxMark) {
                setMarkErrors(prev => ({ ...prev, [errKey]: `${t('maxIs', lang) || 'Max is'} ${maxMark}` }));
                // Keep the previous value — do NOT change marks state
                return;
            }
        }
        setMarkErrors(prev => { const n = { ...prev }; delete n[errKey]; return n; });
        setMarks(prev => ({ ...prev, [sid]: { ...(prev[sid] || {}), [qid]: val } }));
    };

    const handleSave = async () => {
        if (Object.keys(markErrors).length > 0) {
            addToast('Fix the highlighted errors before saving.', 'error');
            return;
        }
        const sec = allAssignments.find(a =>
            String(a.classid) === selClass && String(a.sectionid) === selSection && String(a.subjectid) === selSubject
        );
        if (!sec) return;
        setIsSaving(true);
        try {
            const examStatusRows = await rest('questions_exams_employee_subjects_sections_tbl', {
                examid: `eq.${parseInt(selExam)}`,
                employeeid: `eq.${user.employeeid}`,
                classid: `eq.${sec.classid}`,
                sectionid: `eq.${sec.sectionid}`,
                subjectid: `eq.${sec.subjectid}`,
                select: 'status',
                limit: 1,
            }).catch(() => []);
            const examStatus = (examStatusRows?.[0]?.status || '').toLowerCase();
            const examIsFinalized = ['marked', 'completed', 'inprogress', 'submitted'].includes(examStatus);

            let saved = 0;
            for (const stu of students) {
                const existingEnr = await rest('students_exams_employees_section_subjects_classes_semisters_cur', {
                    studentid: `eq.${stu.studentid}`,
                    examid: `eq.${parseInt(selExam)}`,
                    employeeid: `eq.${user.employeeid}`,
                    classid: `eq.${sec.classid}`,
                    sectionid: `eq.${sec.sectionid}`,
                    subjectid: `eq.${sec.subjectid}`,
                    select: 'studentid',
                });
                if (!existingEnr?.length && !examIsFinalized) {
                    await insert('students_exams_employees_section_subjects_classes_semisters_cur', {
                        studentid: stu.studentid,
                        examid: parseInt(selExam),
                        employeeid: user.employeeid,
                        subjectid: sec.subjectid,
                        sectionid: sec.sectionid,
                        classid: sec.classid,
                        semisterid: 1,
                        yearid: 2026,
                        stageid: sec.stageid,
                        curriculumid: user.curriculumid || 1,
                        divisionid: user.divisionid || 1,
                        branchid: user.branchid,
                        schoolid: user.schoolid,
                    });
                }

                for (const q of questions) {
                    const answer = marks[stu.studentid]?.[q.questionid];
                    if (answer === undefined) continue;

                    let markValue = null;
                    if (answer !== '' && answer !== null) {
                        const numVal = parseFloat(answer);
                        if (isNaN(numVal)) continue;
                        markValue = String(numVal);
                    }

                    try {
                        await insert('studentanswers_tbl', {
                            questionid: q.questionid, studentid: stu.studentid, examid: parseInt(selExam),
                            employeeid: user.employeeid, subjectid: sec.subjectid,
                            sectionid: sec.sectionid, classid: sec.classid,
                            semisterid: 1, yearid: 2026, stageid: sec.stageid,
                            curriculumid: user.curriculumid || 1, divisionid: user.divisionid || 1,
                            branchid: user.branchid, schoolid: user.schoolid, typeid: 1,
                            studentmark: markValue,
                        });
                        saved++;
                    } catch (insertError) {
                        if (insertError.message?.includes('duplicate')) {
                            try {
                                await dbQuery(
                                    `studentanswers_tbl?questionid=eq.${q.questionid}&studentid=eq.${stu.studentid}&examid=eq.${parseInt(selExam)}&employeeid=eq.${user.employeeid}&classid=eq.${sec.classid}&sectionid=eq.${sec.sectionid}&subjectid=eq.${sec.subjectid}`,
                                    'PATCH',
                                    { studentmark: markValue },
                                    'return=minimal'
                                );
                                saved++;

                            } catch {}
                        } else throw insertError;
                    }
                }
            }
            if (saved > 0) {
                const markParams = `examid=eq.${parseInt(selExam)}&employeeid=eq.${user.employeeid}&classid=eq.${sec.classid}&sectionid=eq.${sec.sectionid}&subjectid=eq.${sec.subjectid}&schoolid=eq.${user.schoolid}&branchid=eq.${user.branchid}`;
                await dbQuery(
                    `questions_exams_employee_subjects_sections_tbl?${markParams}`,
                    'PATCH',
                    { status: 'marked' },
                    'return=minimal'
                );
            }
            addToast(`${t('savedCountPart1', lang) || 'Saved'} ${saved} ${t('savedCountPart2', lang) || 'records!'}`, 'success');
        } catch (e) {
            addToast(e.message?.includes('fk_studentmark_studexam')
                ? t('createExamFirstError', lang) || 'Error: Create the exam first before entering marks.'
                : (e.message || 'Failed to save'), 'error');
        }
        finally { setIsSaving(false); }
    };

    const selSecObj = allAssignments.find(a =>
        String(a.classid) === selClass && String(a.sectionid) === selSection && String(a.subjectid) === selSubject
    );

    // Compute per-student total and grade
    const totalPossible = questions.reduce((sum, q) => sum + (parseFloat(q.question_marks) || 1), 0);
    const getStudentTotal = (sid) => questions.reduce((sum, q) => sum + (parseFloat(marks[sid]?.[q.questionid]) || 0), 0);

    const errCls = (key) => fieldErrors[key] ? 'border-red-400 bg-red-50' : '';

    const filteredStudents = [...students].filter(stu => (stu.fullName || '').toLowerCase().includes(studentSearch.trim().toLowerCase())).sort((a, b) => {
        if (sortCol === 'fullName') {
            const av = (a.fullName || '').toLowerCase();
            const bv = (b.fullName || '').toLowerCase();
            return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
        }
        if (sortCol === '_total') {
            const at = getStudentTotal(a.studentid);
            const bt = getStudentTotal(b.studentid);
            return sortDir === 'asc' ? at - bt : bt - at;
        }
        return 0;
    });


    // Re-fetch when language changes so all labels/names update without page refresh

    return (
        <div className="space-y-6 pb-12">
            <div>
                <h1 className="text-xl sm:text-2xl font-bold text-[#0f172a]">{t('editMarks', lang)}</h1>
                <Breadcrumb showBack={true} />
            </div>

            {/* Change 9: single horizontal row filter in order: Classes→Section→Subject→Exam */}
            {!directEditState && (
            <div className="bg-white rounded-xl border border-[#e2e8f0] p-5">
                <div className="flex items-center gap-1 mb-4">
                    <AlertCircle className="h-3.5 w-3.5 text-red-400" />
                    <span className="text-xs text-[#94a3b8]">{t('allFieldsRequiredDesc', lang) || 'Fields marked * are required'}</span>
                </div>
                <div className="flex flex-wrap gap-4 items-end">
                    {/* Classes* */}
                    <div className="flex flex-col gap-1 min-w-[150px]">
                        <label className={`text-[10px] font-bold uppercase tracking-wider ${fieldErrors.classid ? 'text-red-500' : 'text-[#64748b]'}`}>{t('classes', lang)}<span className="text-red-500">*</span>
                        </label>
                        <select className={`input-field h-10 ${errCls('classid')}`} value={selClass}
                            onChange={e => { setSelClass(e.target.value); setFieldErrors(p => ({...p, classid: false})); }}
                            style={sel}>
                            <option value="">{t('selectClass', lang) || '-- Select Class --'}</option>
                            {classOptions.map(a => <option key={a.classid} value={String(a.classid)}>{a.classname || ''}</option>)}
                        </select>
                    </div>
                    {/* Section* */}
                    <div className="flex flex-col gap-1 min-w-[140px]">
                        <label className={`text-[10px] font-bold uppercase tracking-wider ${fieldErrors.sectionid ? 'text-red-500' : 'text-[#64748b]'}`}>
                            {t('section', lang)} <span className="text-red-500">*</span>
                        </label>
                        <select className={`input-field h-10 ${errCls('sectionid')}`} value={selSection}
                            onChange={e => { setSelSection(e.target.value); setFieldErrors(p => ({...p, sectionid: false})); }}
                            disabled={!selClass} style={sel}>
                            <option value="">{t('selectSection', lang) || '-- Select Section --'}</option>
                            {sectionOptions.map(a => <option key={a.sectionid} value={String(a.sectionid)}>{a.sectionname}</option>)}
                        </select>
                    </div>
                    {/* Subject* */}
                    <div className="flex flex-col gap-1 min-w-[150px]">
                        <label className={`text-[10px] font-bold uppercase tracking-wider ${fieldErrors.subjectid ? 'text-red-500' : 'text-[#64748b]'}`}>
                            {t('subject', lang)} <span className="text-red-500">*</span>
                        </label>
                        <select className={`input-field h-10 ${errCls('subjectid')}`} value={selSubject}
                            onChange={e => { setSelSubject(e.target.value); setFieldErrors(p => ({...p, subjectid: false})); }}
                            disabled={!selSection} style={sel}>
                            <option value="">{t('selectSubject', lang) || '-- Select Subject --'}</option>
                            {subjectOptions.map(a => <option key={a.subjectid} value={String(a.subjectid)}>{a.subjectname}</option>)}
                        </select>
                    </div>
                    {/* Exam* */}
                    <div className="flex flex-col gap-1 min-w-[160px]">
                        <label className={`text-[10px] font-bold uppercase tracking-wider ${fieldErrors.examid ? 'text-red-500' : 'text-[#64748b]'}`}>
                            {t('exam', lang)} <span className="text-red-500">*</span>
                        </label>
                        <select className={`input-field h-10 ${errCls('examid')}`} value={selExam}
                            onChange={e => { setSelExam(e.target.value); setFieldErrors(p => ({...p, examid: false})); }}
                            disabled={!selSubject} style={sel}>
                            <option value="">{t('selectExam', lang) || '-- Select Exam --'}</option>
                            {examOptions.map(e => <option key={e.examid} value={String(e.examid)}>{t(e.name, lang)}</option>)}
                        </select>
                    </div>
                    <button onClick={handleLoad} disabled={isLoading}
                        className="h-10 px-5 btn-primary flex items-center gap-2 disabled:opacity-50 mt-4">
                        {isLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> {t('applying', lang) || 'Applying...'}</> : <>{t('applyFilter', lang)}</>}
                    </button>
                    <button onClick={() => { setSelClass(''); setSelSection(''); setSelSubject(''); setSelExam(''); setStudents([]); setQuestions([]); setMarks({}); setLoaded(false); setFieldErrors({}); }}
                        className="h-10 px-5 mt-4 rounded-xl border border-[#e2e8f0] font-semibold text-[#64748b] bg-white hover:bg-slate-50 flex items-center gap-2 text-sm">
                        <RotateCcw className="h-3.5 w-3.5" /> {t('reset', lang)}
                    </button>
                </div>
                {Object.values(fieldErrors).some(Boolean) && (
                    <div className="mt-3 flex items-center gap-2 text-red-600 text-sm font-medium">
                        <AlertCircle className="h-4 w-4" />
                        {t('selectAllRequiredError', lang) || 'Please select all required fields before loading marks.'}
                    </div>
                )}
            </div>
            )}

            {isLoading && (
                <div className="flex items-center justify-center py-16 text-[#94a3b8]">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" /> {t('loadingMarks', lang) || 'Loading marks...'}
                </div>
            )}

            {loaded && (
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden">
                    <div className="px-6 py-4 border-b border-[#e2e8f0] bg-slate-50 flex items-center justify-between flex-wrap gap-2">
                        <div>
                            <span className="text-sm font-bold text-[#0f172a]">
                                {selSecObj?.classname} – {selSecObj?.sectionname} – {selSecObj?.subjectname}
                            </span>
                            <span className="ml-3 text-xs text-[#94a3b8]">{students.length} {t('students', lang)} · {questions.length} {t('questions', lang)} · {t('totalMarks', lang)}: {totalPossible}</span>
                        </div>
                        <span className="text-xs text-[#94a3b8] bg-white border border-[#e2e8f0] px-2 py-1 rounded">
                            {examOptions.find(e => String(e.examid) === String(selExam))?.name}
                        </span>
                    </div>

                    {students.length === 0 ? (
                        <div className="py-12 text-center text-[#94a3b8]">{t('noStudentsEnrolled', lang) || 'No students enrolled.'}</div>
                    ) : questions.length === 0 ? (
                        <div className="py-12 text-center text-[#94a3b8]">{t('noQuestionsFound', lang) || 'No questions found. Please create questions first.'}</div>
                    ) : (
                        <>
                            <div className="px-4 pt-4">
                                <input
                                    type="text"
                                    value={studentSearch}
                                    onChange={e => setStudentSearch(e.target.value)}
                                    placeholder={t('searchStudentByName', lang) || 'Search by student name'}
                                    className="input-field h-10 w-full md:w-80"
                                />
                            </div>
                            <div className="overflow-x-auto">
                                <table className={`w-full ${isAr ? 'text-right' : 'text-left'} border-collapse`}>
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-[#e2e8f0]">
                                            <th className={`py-4 px-4 font-bold text-[#64748b] text-sm sticky ${isAr ? 'right-0' : 'left-0'} bg-slate-50 z-10 min-w-[220px] cursor-pointer select-none`} onClick={() => handleSort('fullName')}>{t('student', lang)}<span className="text-[#1d4ed8] ml-1">{sortArrow('fullName')}</span></th>
                                            {/* Change 9: show question_marks as max for each question */}
                                            {questions.map((q, i) => (
                                                <th key={q.questionid} className="py-4 px-3 font-bold text-center min-w-[90px]">
                                                    <div className="text-sm text-[#64748b]">{t('questionShort', lang) || 'Q'}{i + 1}</div>
                                                    <div className="text-[10px] font-normal text-[#94a3b8]">{t('max', lang)}: {q.question_marks || 1}</div>
                                                </th>
                                            ))}
                                            <th className="py-4 px-4 font-bold text-center bg-blue-50/60 border-l border-[#e2e8f0] text-[#1d4ed8] text-sm cursor-pointer select-none" onClick={() => handleSort('_total')}>{t('total', lang)}<span className="text-[#94a3b8] ml-1">{sortArrow('_total')}</span></th>
                                            <th className="py-4 px-4 font-bold text-center text-sm text-[#64748b]">%</th>
                                            <th className="py-4 px-4 font-bold text-center text-sm text-[#64748b]">{t('grade', lang)}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredStudents.map((stu, idx) => {
                                            const total = getStudentTotal(stu.studentid);
                                            const pct   = totalPossible > 0 ? (total / totalPossible) * 100 : 0;
                                            const grade = calcGradeFromList(pct, grades);
                                            return (
                                                <motion.tr key={stu.studentid}
                                                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.03 }}
                                                    className="border-b border-[#e2e8f0] hover:bg-slate-50 group transition-colors">
                                                    <td className={`py-3 px-4 sticky ${isAr ? 'right-0' : 'left-0'} bg-white group-hover:bg-slate-50 z-10`}>
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-7 w-7 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xs flex-shrink-0">
                                                                {stu.fullName?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                                            </div>
                                                            <span className="text-sm font-bold text-[#0f172a]">{stu.fullName}</span>
                                                        </div>
                                                    </td>
                                                    {questions.map(q => {
                                                        const maxMark = parseFloat(q.question_marks) || 1;
                                                        return (
                                                            <td key={q.questionid} className="py-2 px-2 text-center">
                                                                {/* Change 9: decimal input, max = question_marks */}
                                                                <div className="flex flex-col items-center gap-0.5">
                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        max={maxMark}
                                                                        step="0.25"
                                                                        value={marks[stu.studentid]?.[q.questionid] ?? ''}
                                                                        onChange={e => handleMarkChange(stu.studentid, q.questionid, e.target.value, maxMark)}
                                                                        onFocus={e => e.target.select()}
                                                                        className={`w-16 h-9 text-center font-bold text-[#0f172a] bg-transparent border rounded outline-none transition-all text-sm ${markErrors[`${stu.studentid}-${q.questionid}`] ? 'border-red-400 bg-red-50' : 'border-transparent hover:border-slate-300 focus:border-[#1d4ed8] focus:bg-white focus:ring-2 focus:ring-blue-100'}`}
                                                                        placeholder="0"
                                                                    />
                                                                    {markErrors[`${stu.studentid}-${q.questionid}`] && (
                                                                        <span className="text-[9px] text-red-500 font-bold leading-none">{markErrors[`${stu.studentid}-${q.questionid}`]}</span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        );
                                                    })}
                                                    <td className="py-3 px-4 text-center text-base font-black text-[#1d4ed8] bg-blue-50/40 border-l border-[#e2e8f0]">
                                                        {total.toFixed(2).replace(/\.00$/, '')} / {totalPossible}
                                                    </td>
                                                    <td className="py-3 px-4 text-center text-sm font-semibold text-[#64748b]">
                                                        {pct.toFixed(1)}%
                                                    </td>
                                                    {/* Change 9: Grade updates automatically */}
                                                    <td className="py-3 px-4 text-center">
                                                        <span className={`inline-flex items-center justify-center px-2 py-1 rounded-lg text-xs font-bold border ${grade.color}`}>
                                                            {grade.label}
                                                        </span>
                                                    </td>
                                                </motion.tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <div className="p-4 border-t border-[#e2e8f0] bg-slate-50 flex justify-end">
                                <button onClick={() => setConfirm({ open: true })} disabled={isSaving}
                                    className="btn-primary h-11 px-8 font-bold flex items-center gap-2 shadow-md disabled:opacity-60">
                                    {isSaving ? <><Loader2 className="h-4 w-4 animate-spin" /> {t('saving', lang) || 'Saving...'}</> : <><Save className="h-4 w-4" /> {t('saveAllChanges', lang) || 'Save All Changes'}</>}
                                </button>
                            </div>
                        </>
                    )}
                </motion.div>
            )}
        <ConfirmDialog
            open={confirm.open}
            title={isAr ? 'حفظ التغييرات؟' : 'Save Changes?'}
            message={isAr ? 'سيتم تحديث جميع الدرجات المعدّلة في قاعدة البيانات.' : 'All edited marks will be updated in the database.'}
            confirmLabel={isAr ? 'حفظ' : 'Save'}
            cancelLabel={isAr ? 'إلغاء' : 'Cancel'}
            variant="primary"
            loading={isSaving}
            onConfirm={() => { setConfirm({ open: false }); handleSave(); }}
            onCancel={() => setConfirm({ open: false })}
        />
        </div>
    );
}