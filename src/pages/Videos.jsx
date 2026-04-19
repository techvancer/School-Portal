import { t, getField, getStudentName as _getStudentName } from '../lib/langHelper';
import { useLang } from '../context/LanguageContext';
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Video, Loader2, ExternalLink, Plus, Save, X, Lock, Unlock } from 'lucide-react';
import Breadcrumb from '../components/Breadcrumb';
import FilterBar from '../components/FilterBar';
import ConfirmDialog from '../components/ConfirmDialog';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { insert, rest, dbQuery } from '../lib/supabaseClient';
import { getClassName, getSectionName, getSubjectName } from '../lib/helpers';




export default function Videos() {
    const { lang, isAr } = useLang();

    const { user } = useAuth();
    const { addToast } = useToast();

    const [assignments,    setAssignments]    = useState([]);
    const [examsData,      setExamsData]      = useState([]);
    const [semestersData,  setSemestersData]  = useState([]);

    // filterDraft tracks FilterBar's current selections (for cascade options loading)
    const [filterDraft, setFilterDraft] = useState({});
    // appliedRef holds the last applied filter values (for loadQuestions & langChanged)
    const appliedRef = useRef(null);

    const [classOptions,    setClassOptions]    = useState([]);
    const [sectionOptions,  setSectionOptions]  = useState([]);
    const [subjectOptions,  setSubjectOptions]  = useState([]);
    const [examOptions,     setExamOptions]     = useState([]);
    const [semesterOptions, setSemesterOptions] = useState([]);

    const lookupRef = useRef({ cl: [], sec: [], sub: [] });

    const [questions,    setQuestions]    = useState([]);
    const [loading,      setLoading]      = useState(false);
    const [searched,     setSearched]     = useState(false);
    const [answeredKeys, setAnsweredKeys] = useState(new Set());

    // unlock state for video URL editing
    const [editingId,   setEditingId]   = useState(null);
    const [editUrl,     setEditUrl]     = useState('');
    const [saving,      setSaving]      = useState(false);
    const [unlockedIds, setUnlockedIds] = useState(new Set());
    const [confirm, setConfirm] = useState({ open: false, question: null });

    // Initial data load: assignments + lookup tables
    useEffect(() => {
        if (!user) return;
        (async () => {
            const [empSec, clTbl, secRows, subTbl, examTbl, semTbl, answers] = await Promise.all([
                rest('employees_sections_subjects_classes_semisters_curriculums_tbl', {
                    employeeid: `eq.${user.employeeid}`, schoolid: `eq.${user.schoolid}`, branchid: `eq.${user.branchid}`, select: '*'
                }),
                rest('classes_tbl',  { select: 'classid,classname_en,classname' }),
                rest('sections_tbl', { select: 'sectionid,sectionname_en,sectionname' }),
                rest('subjects_tbl', { select: 'subjectid,Subjectname_en,subjectname' }),
                rest('exams_tbl',    { select: 'examid,examname_en,examname' }),
                rest('semisters_tbl',{ select: 'semisterid,semistername_en,semistername' }),
                rest('studentanswers_tbl', { employeeid: `eq.${user.employeeid}`, select: 'examid,classid,sectionid,subjectid' }),
            ]);
            const aKeys = new Set(answers.map(a => `${a.examid}-${a.classid}-${a.sectionid}-${a.subjectid}`));
            setAnsweredKeys(aKeys);
            setExamsData(examTbl);
            setSemestersData(semTbl);

            lookupRef.current = { cl: clTbl, sec: secRows, sub: subTbl };

            const seen = new Set();
            const asgn = empSec.filter(r => {
                const k = `${r.classid}-${r.sectionid}-${r.subjectid}`;
                if (seen.has(k)) return false; seen.add(k); return true;
            });
            setAssignments(asgn);
            const clOpts = [...new Map(asgn.map(a => [a.classid, a])).values()];
            setClassOptions(clOpts);
            // Auto-select is handled by FilterBar when classOptions has 1 item
        })();
    }, [user]);

    // Cascade: section options when class changes
    useEffect(() => {
        const classid = filterDraft.classid;
        setSectionOptions([]); setSubjectOptions([]); setExamOptions([]); setSemesterOptions([]);
        if (!classid || classid === 'All') return;
        const filtered = assignments.filter(a => String(a.classid) === classid);
        const secOpts = [...new Map(filtered.map(a => [a.sectionid, a])).values()];
        setSectionOptions(secOpts);
        setSubjectOptions([]);
        // Auto-select is handled by FilterBar's useEffect when options arrive
    }, [filterDraft.classid, assignments]);

    // Subject options when section changes
    useEffect(() => {
        const classid  = filterDraft.classid;
        const sectionid = filterDraft.sectionid;
        setSubjectOptions([]); setExamOptions([]); setSemesterOptions([]);
        if (!sectionid || sectionid === 'All') return;
        const filtered = assignments.filter(a => String(a.classid) === classid && String(a.sectionid) === sectionid);
        const subOpts = [...new Map(filtered.map(a => [a.subjectid, a])).values()];
        setSubjectOptions(subOpts);
        // Auto-select is handled by FilterBar's useEffect when options arrive
    }, [filterDraft.sectionid, filterDraft.classid, assignments]);

    // Exam/Semester options when subject changes (DB fetch)
    useEffect(() => {
        const { classid, sectionid, subjectid } = filterDraft;
        setExamOptions([]); setSemesterOptions([]);
        if (!subjectid || subjectid === 'All') return;
        (async () => {
            const [stuExams, qExams] = await Promise.all([
                rest('students_exams_employees_section_subjects_classes_semisters_cur', {
                    employeeid: `eq.${user.employeeid}`, classid: `eq.${classid}`,
                    sectionid: `eq.${sectionid}`, subjectid: `eq.${subjectid}`, select: 'examid,semisterid',
                }),
                rest('questions_exams_employee_subjects_sections_tbl', {
                    employeeid: `eq.${user.employeeid}`, classid: `eq.${classid}`,
                    sectionid: `eq.${sectionid}`, subjectid: `eq.${subjectid}`,
                    status: 'in.(new,marked,submitted,completed,inprogress)', select: 'examid',
                }),
            ]);
            const allowedExamIds = new Set(qExams.map(e => String(e.examid)));
            const seen = new Set();
            const unique = stuExams.filter(r => {
                if (!allowedExamIds.has(String(r.examid))) return false;
                if (seen.has(r.examid)) return false;
                seen.add(r.examid);
                return true;
            });
            const exOpts = unique.map(r => ({
                examid: r.examid,
                semisterid: r.semisterid,
                name: (() => { const ex = examsData.find(e => e.examid === r.examid); return getField(ex, 'examname', 'examname_en', lang) || `Exam ${r.examid}`; })(),
            }));
            setExamOptions(exOpts);
            // Auto-select is handled by FilterBar's useEffect when options arrive
            const semIds = [...new Set(unique.map(r => r.semisterid).filter(Boolean))];
            const semOpts = semIds.map(id => ({
                semisterid: id,
                semistername_en: semestersData.find(s => s.semisterid === id)?.semistername_en || `Semester ${id}`,
                semistername: semestersData.find(s => s.semisterid === id)?.semistername || semestersData.find(s => s.semisterid === id)?.semistername_en || `Semester ${id}`,
            }));
            setSemesterOptions(semOpts);
            // Auto-select is handled by FilterBar's useEffect when options arrive
        })();
    }, [filterDraft.subjectid, filterDraft.sectionid, filterDraft.classid, user, examsData, semestersData, lang]);

    // loadQuestions takes explicit filter params
    const loadQuestions = useCallback(async (params) => {
        setLoading(true);
        try {
            const [qs, examTbl, clTbl, secRows, subTbl] = await Promise.all([
                rest('questions_exams_employee_subjects_sections_tbl', {
                    employeeid: `eq.${user.employeeid}`, classid: `eq.${params.classid}`,
                    sectionid: `eq.${params.sectionid}`, subjectid: `eq.${params.subjectid}`,
                    examid: `eq.${params.examid}`, select: '*',
                    order: 'questionid.asc',
                }),
                rest('exams_tbl',    { select: 'examid,examname_en,examname' }),
                rest('classes_tbl',  { select: 'classid,classname_en,classname' }),
                rest('sections_tbl', { select: 'sectionid,sectionname_en,sectionname' }),
                rest('subjects_tbl', { select: 'subjectid,Subjectname_en,subjectname' }),
            ]);
            setQuestions(qs.map(q => {
                const exam = examTbl.find(e => e.examid === q.examid);
                const cl   = clTbl.find(c => c.classid === q.classid);
                const sec  = secRows.find(s => s.sectionid === q.sectionid);
                const sub  = subTbl.find(s => s.subjectid === q.subjectid);
                const key  = `${q.examid}-${q.classid}-${q.sectionid}-${q.subjectid}`;
                return {
                    ...q,
                    examname:    getField(exam, 'examname', 'examname_en', lang),
                    classname:   getClassName(cl, lang),
                    sectionname: getSectionName(sec, lang),
                    subjectname: getSubjectName(sub, lang),
                    examCompleted: answeredKeys.has(key),
                };
            }));
        } catch (e) { addToast(e.message, 'error'); }
        finally { setLoading(false); }
    }, [user, answeredKeys, addToast, lang]);

    // Reload on language change if already searched
    useEffect(() => {
        const handler = () => {
            if (!searched || !appliedRef.current) return;
            loadQuestions(appliedRef.current);
        };
        window.addEventListener('langChanged', handler);
        return () => window.removeEventListener('langChanged', handler);
    }, [searched, loadQuestions]);

    const handleFilterChange = (vals) => {
        setFilterDraft(vals);
    };

    const handleApply = async (vals) => {
        appliedRef.current = vals;
        setSearched(true);
        await loadQuestions(vals);
    };

    const handleReset = () => {
        appliedRef.current = null;
        setSearched(false);
        setQuestions([]);
    };

    const handleSaveUrl = async (q) => {
        setSaving(true);
        try {
            await dbQuery(
                `questions_exams_employee_subjects_sections_tbl?questionid=eq.${q.questionid}&examid=eq.${q.examid}&employeeid=eq.${user.employeeid}`,
                'PATCH',
                { video_url: editUrl },
                'return=minimal'
            );
            setQuestions(prev => prev.map(r => r.questionid === q.questionid ? { ...r, video_url: editUrl } : r));
            addToast('Video URL saved!', 'success');
            setEditingId(null);
            setUnlockedIds(prev => { const n = new Set(prev); n.delete(q.questionid); return n; });
        } catch (e) { addToast(e.message, 'error'); }
        finally { setSaving(false); }
    };

    const handleUnlock = (qid) => { setUnlockedIds(prev => new Set([...prev, qid])); };
    const handleLock   = (qid) => { setUnlockedIds(prev => { const n = new Set(prev); n.delete(qid); return n; }); if (editingId === qid) setEditingId(null); };

    const filterFields = [
        {
            key: 'classid',
            label: t('class', lang),
            required: true,
            options: [
                { value: 'All', label: t('allClasses', lang) || 'All Classes' },
                ...classOptions.map(a => ({
                    value: String(a.classid),
                    label: getClassName(lookupRef.current.cl.find(c => String(c.classid) === String(a.classid)), lang) || String(a.classid)
                }))
            ]
        },
        {
            key: 'sectionid',
            label: t('section', lang),
            required: true,
            options: [
                { value: 'All', label: t('allSections', lang) || 'All Sections' },
                ...sectionOptions.map(a => ({
                    value: String(a.sectionid),
                    label: getSectionName(lookupRef.current.sec.find(s => String(s.sectionid) === String(a.sectionid)), lang) || String(a.sectionid)
                }))
            ]
        },
        {
            key: 'subjectid',
            label: t('subject', lang),
            required: true,
            options: [
                { value: 'All', label: t('allSubjects', lang) || 'All Subjects' },
                ...subjectOptions.map(a => ({
                    value: String(a.subjectid),
                    label: getSubjectName(lookupRef.current.sub.find(s => String(s.subjectid) === String(a.subjectid)), lang) || String(a.subjectid)
                }))
            ]
        },
        {
            key: 'examid',
            label: t('exam', lang),
            required: true,
            options: [
                { value: 'All', label: t('allExams', lang) || 'All Exams' },
                ...examOptions.map(e => ({ value: String(e.examid), label: e.name }))
            ]
        },
        {
            key: 'semisterid',
            label: t('semester', lang),
            required: true,
            options: [
                { value: 'All', label: t('allSemesters', lang) || 'All Semesters' },
                ...semesterOptions.map(s => ({
                    value: String(s.semisterid),
                    label: lang === 'ar' ? (s.semistername || s.semistername_en) : s.semistername_en
                }))
            ]
        },
    ];

    return (
        <div className="space-y-6 pb-12">
            <div>
                <h1 className="text-xl sm:text-2xl font-bold text-[#0f172a]">{t('videos', lang)}</h1>
                <p className="text-[#64748b] text-sm">{t('manageVideosDesc', lang) || 'Manage videos attached to exam questions.'}</p>
                <Breadcrumb />
            </div>

            <FilterBar
                filters={filterFields}
                onChange={handleFilterChange}
                onApply={handleApply}
                onReset={handleReset}
            />

            {!searched && !loading && (
                <div className="text-center py-20 text-[#94a3b8]">
                    <Video className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium">{t('videosPrompt', lang) || 'Fill all filters and click "Show Videos".'}</p>
                </div>
            )}
            {loading && (
                <div className="flex items-center justify-center py-16 text-[#94a3b8]">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" /> {t('searching', lang) || 'Searching...'}
                </div>
            )}
            {searched && !loading && questions.length === 0 && (
                <div className="text-center py-16 text-[#94a3b8]">
                    <Video className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">{t('noData', lang)}</p>
                </div>
            )}
            {searched && !loading && questions.length > 0 && (
                <div className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden">
                    <div className="p-5 border-b border-[#e2e8f0] bg-slate-50 flex items-center gap-3">
                        <Video className="h-5 w-5 text-[#1d4ed8]" />
                        <h2 className="text-base font-bold text-[#0f172a]">{t('videosTable', lang) || 'Questions & Videos'}</h2>
                        <span className="ml-auto text-xs text-[#94a3b8]">{questions.length} {t('questions', lang)}</span>
                    </div>
                    <div className="overflow-x-auto" dir={isAr ? 'rtl' : 'ltr'}>
                        <table className={`w-full ${isAr ? 'text-right' : 'text-left'}`}>
                            <thead className="bg-slate-50 border-b border-[#e2e8f0]">
                                <tr>{[t('questionid', lang) || 'Q#', t('class', lang), t('section', lang), t('subject', lang), t('exam', lang), t('type', lang) || 'Type', t('status', lang), t('videoUrl', lang), t('actions', lang)].map(h => (
                                    <th key={h} className="py-4 px-4 text-xs font-black text-[#64748b] uppercase tracking-wider">{h}</th>
                                ))}</tr>
                            </thead>
                            <tbody className="divide-y divide-[#e2e8f0]">
                                {questions.map((q, i) => {
                                    const isUnlocked = unlockedIds.has(q.questionid);
                                    const canEdit    = !q.examCompleted || isUnlocked;
                                    const isEditing  = editingId === q.questionid;
                                    return (
                                        <motion.tr key={`${q.questionid}-${q.examid}-${q.classid}-${q.sectionid}-${q.subjectid}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                                            className="hover:bg-slate-50 transition-colors">
                                            <td className="py-3 px-4 text-sm text-[#94a3b8] font-mono">#{q.questionid}</td>
                                            <td className="py-3 px-4 text-sm font-bold text-[#0f172a]">{q.classname}</td>
                                            <td className="py-3 px-4">
                                                <span className="inline-flex items-center justify-center px-2 py-0.5 rounded bg-[#eff6ff] text-[#1d4ed8] text-xs font-bold border border-blue-100">{q.sectionname}</span>
                                            </td>
                                            <td className="py-3 px-4 text-sm text-[#475569]">{q.subjectname}</td>
                                            <td className="py-3 px-4 text-sm font-semibold text-[#0f172a]">{q.examname}</td>
                                            <td className="py-3 px-4 text-sm text-[#475569]">{q.question_type === 'true_false' ? (isAr ? 'صح/خطأ' : 'True/False') : q.question_type === 'matching' ? (isAr ? 'مطابقة' : 'Matching') : q.question_type === 'essay' ? (isAr ? 'مقالي' : 'Essay') : (isAr ? 'اختيار من متعدد' : 'MCQ')}</td>
                                            <td className="py-3 px-4">
                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${q.examCompleted ? 'bg-green-50 text-green-700 border-green-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                                                    {q.examCompleted ? t('completed', lang) : t('new', lang)}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 max-w-[200px]">
                                                {isEditing ? (
                                                    <input type="text" value={editUrl} onChange={e => setEditUrl(e.target.value)}
                                                        placeholder="https://youtu.be/..."
                                                        className="w-full h-8 px-2 text-xs border border-[#1d4ed8] rounded focus:outline-none focus:ring-2 focus:ring-blue-200" />
                                                ) : q.video_url ? (
                                                    <a href={q.video_url} target="_blank" rel="noopener noreferrer"
                                                        className="flex items-center gap-1 text-xs text-[#1d4ed8] hover:underline truncate max-w-[160px]">
                                                        <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                                        <span className="truncate">{q.video_url}</span>
                                                    </a>
                                                ) : <span className="text-xs text-[#94a3b8] italic">{t('noVideo', lang)}</span>}
                                            </td>
                                            <td className="py-3 px-4">
                                                {canEdit ? (
                                                    isEditing ? (
                                                        <div className="flex items-center gap-1.5">
                                                            <button onClick={() => setConfirm({ open: true, question: q })} disabled={saving}
                                                                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-white bg-[#1d4ed8] rounded-lg hover:bg-[#1e40af] disabled:opacity-60">
                                                                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} {t('save', lang)}
                                                            </button>
                                                            <button onClick={() => { setEditingId(null); if (q.examCompleted) handleLock(q.questionid); }}
                                                                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-[#64748b] bg-slate-100 rounded-lg hover:bg-slate-200">
                                                                <X className="h-3 w-3" /> {t('cancel', lang)}
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-1.5">
                                                            <button onClick={() => { setEditingId(q.questionid); setEditUrl(q.video_url || ''); }}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#1d4ed8] bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100">
                                                                <Plus className="h-3 w-3" /> {q.video_url ? t('edit', lang) : t('add', lang)} {t('url', lang)}
                                                            </button>
                                                            {isUnlocked && (
                                                                <button onClick={() => handleLock(q.questionid)}
                                                                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-[#64748b] bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200">
                                                                    <Lock className="h-3 w-3" /> {t('lock', lang)}
                                                                </button>
                                                            )}
                                                        </div>
                                                    )
                                                ) : (
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="flex items-center gap-1 text-xs text-[#94a3b8]"><Lock className="h-3.5 w-3.5" /> {t('locked', lang)}</span>
                                                        <button onClick={() => handleUnlock(q.questionid)}
                                                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100">
                                                            <Unlock className="h-3 w-3" /> {t('unlock', lang)}
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </motion.tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <ConfirmDialog
                open={confirm.open}
                title={isAr ? 'حفظ رابط الفيديو؟' : 'Save Video URL?'}
                message={isAr ? 'سيتم ربط رابط الفيديو بهذا السؤال.' : 'The video URL will be attached to this question.'}
                confirmLabel={isAr ? 'حفظ' : 'Save'}
                cancelLabel={isAr ? 'إلغاء' : 'Cancel'}
                variant="primary"
                loading={saving}
                onConfirm={() => { const q = confirm.question; setConfirm({ open: false, question: null }); handleSaveUrl(q); }}
                onCancel={() => setConfirm({ open: false, question: null })}
            />
        </div>
    );
}
