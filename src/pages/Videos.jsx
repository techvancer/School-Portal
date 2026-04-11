import { t, getField, getStudentName as _getStudentName } from '../lib/langHelper';
import { useLang } from '../context/LanguageContext';
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Video, Search, Loader2, ExternalLink, Plus, Save, X, Lock, Unlock, AlertCircle } from 'lucide-react';
import Breadcrumb from '../components/Breadcrumb';
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

    // Change 2 filter order: Classes → Section → Subject → Exam → Semester
    const [selClass,    setSelClass]    = useState('');
    const [selSection,  setSelSection]  = useState('');
    const [selSubject,  setSelSubject]  = useState('');
    const [selExam,     setSelExam]     = useState('');
    const [selSemester, setSelSemester] = useState('');

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
    const [fieldErrors,  setFieldErrors]  = useState({});

    // Change 14: unlock state
    const [editingId,   setEditingId]   = useState(null);
    const [editUrl,     setEditUrl]     = useState('');
    const [saving,      setSaving]      = useState(false);
    const [unlockedIds, setUnlockedIds] = useState(new Set());

    const selStyle = { backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,backgroundRepeat:'no-repeat',backgroundPosition:'right 10px center',paddingRight:'2rem',appearance:'none' };

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
            if (clOpts.length === 1) setSelClass(String(clOpts[0].classid));
        })();
    }, [user]);

    // Cascade: section options when class changes
    useEffect(() => {
        setSelSection(''); setSelSubject(''); setSelExam(''); setSelSemester('');
        if (!selClass) { setSectionOptions([]); setSubjectOptions([]); setExamOptions([]); setSemesterOptions([]); return; }
        const filtered = assignments.filter(a => String(a.classid) === selClass);
        const secOpts = [...new Map(filtered.map(a => [a.sectionid, a])).values()];
        setSectionOptions(secOpts);
        setSubjectOptions([]);
        if (secOpts.length === 1) setSelSection(String(secOpts[0].sectionid));
    }, [selClass, assignments]);

    // Subject options when section changes
    useEffect(() => {
        setSelSubject(''); setSelExam(''); setSelSemester('');
        if (!selSection) { setSubjectOptions([]); setExamOptions([]); setSemesterOptions([]); return; }
        const filtered = assignments.filter(a => String(a.classid) === selClass && String(a.sectionid) === selSection);
        const subOpts = [...new Map(filtered.map(a => [a.subjectid, a])).values()];
        setSubjectOptions(subOpts);
        if (subOpts.length === 1) setSelSubject(String(subOpts[0].subjectid));
    }, [selSection, selClass, assignments]);

    // Exam/Semester options when subject changes
    useEffect(() => {
        setSelExam(''); setSelSemester('');
        if (!selSubject) { setExamOptions([]); setSemesterOptions([]); return; }
        (async () => {
            const [stuExams, qExams] = await Promise.all([
                rest('students_exams_employees_section_subjects_classes_semisters_cur', {
                    employeeid: `eq.${user.employeeid}`, classid: `eq.${selClass}`,
                    sectionid: `eq.${selSection}`, subjectid: `eq.${selSubject}`, select: 'examid,semisterid',
                }),
                rest('questions_exams_employee_subjects_sections_tbl', {
                    employeeid: `eq.${user.employeeid}`, classid: `eq.${selClass}`,
                    sectionid: `eq.${selSection}`, subjectid: `eq.${selSubject}`,
                    status: 'in.(new,marked)', select: 'examid',
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
            if (exOpts.length === 1) setSelExam(String(exOpts[0].examid));
            const semIds = [...new Set(unique.map(r => r.semisterid).filter(Boolean))];
            const semOpts = semIds.map(id => ({
                semisterid: id,
                semistername_en: semestersData.find(s => s.semisterid === id)?.semistername_en || `Semester ${id}`,
                semistername: semestersData.find(s => s.semisterid === id)?.semistername || semestersData.find(s => s.semisterid === id)?.semistername_en || `Semester ${id}`,
            }));
            setSemesterOptions(semOpts);
            if (semOpts.length === 1) setSelSemester(String(semOpts[0].semisterid));
        })();
    }, [selSubject, selSection, selClass, user, examsData, semestersData, lang]);

    const loadQuestions = useCallback(async () => {
        setLoading(true);
        try {
            const params = {
                employeeid: `eq.${user.employeeid}`, classid: `eq.${selClass}`,
                sectionid: `eq.${selSection}`, subjectid: `eq.${selSubject}`,
                examid: `eq.${selExam}`, select: '*',
                order: 'questionid.asc',
            };
            const [qs, examTbl, clTbl, secRows, subTbl] = await Promise.all([
                rest('questions_exams_employee_subjects_sections_tbl', params),
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
    }, [user, selClass, selSection, selSubject, selExam, answeredKeys, addToast, lang]);

    useEffect(() => {
        if (!searched || !selClass || !selSection || !selSubject || !selExam) return;
        loadQuestions();
    }, [lang, searched, selClass, selSection, selSubject, selExam, loadQuestions]);

    // Change 11: ALL fields required
    const handleSearch = async () => {
        const errors = {};
        if (!selClass)    errors.classid    = true;
        if (!selSection)  errors.sectionid  = true;
        if (!selSubject)  errors.subjectid  = true;
        if (!selExam)     errors.examid     = true;
        if (!selSemester) errors.semisterid = true;
        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
            addToast(t('fillRequired', lang) || 'All filter fields are required on the Videos page.', 'error');
            return;
        }
        setFieldErrors({});
        setSearched(true);
        await loadQuestions();
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

    const errBorder = (key) => fieldErrors[key] ? 'border-red-400 bg-red-50' : 'border-[#e2e8f0] bg-white';

    useEffect(() => {
        if (!searched || !selClass || !selSection || !selSubject || !selExam || !selSemester) return;
        loadQuestions();
    }, [searched, selClass, selSection, selSubject, selExam, selSemester, loadQuestions]);

    useEffect(() => {
        const handler = () => {
            if (!searched || !selClass || !selSection || !selSubject || !selExam || !selSemester) return;
            loadQuestions();
        };
        window.addEventListener('langChanged', handler);
        return () => window.removeEventListener('langChanged', handler);
    }, [searched, selClass, selSection, selSubject, selExam, selSemester, loadQuestions]);

    // Change 5: dep = disabled flag. false = always enabled; !selX = disabled until parent selected
    const filterDefs = [
        { key: 'classid',    label: t('class', lang),  sel: selClass,    set: setSelClass,    opts: classOptions.map(a => ({ value: String(a.classid),   label: getClassName(lookupRef.current.cl.find(c=>String(c.classid)===String(a.classid)), lang) || String(a.classid) })),   dep: false },
        { key: 'sectionid',  label: t('section', lang),  sel: selSection,  set: setSelSection,  opts: sectionOptions.map(a => ({ value: String(a.sectionid),  label: getSectionName(lookupRef.current.sec.find(s=>String(s.sectionid)===String(a.sectionid)), lang) || String(a.sectionid) })), dep: !selClass },
        { key: 'subjectid',  label: t('subject', lang),  sel: selSubject,  set: setSelSubject,  opts: subjectOptions.map(a => ({ value: String(a.subjectid),  label: getSubjectName(lookupRef.current.sub.find(s=>String(s.subjectid)===String(a.subjectid)), lang) || String(a.subjectid) })), dep: !selSection },
        { key: 'examid',     label: t('exam', lang),     sel: selExam,     set: setSelExam,     opts: examOptions.map(e => ({ value: String(e.examid), label: t(e.name, lang) })),              dep: !selSubject },
        { key: 'semisterid', label: t('semester', lang), sel: selSemester, set: setSelSemester, opts: semesterOptions.map(s => ({ value: String(s.semisterid), label: lang === 'ar' ? (s.semistername || s.semistername_en) : s.semistername_en })), dep: !selSubject },
    ];


    return (
        <div className="space-y-6 pb-12">
            <div>
                <h1 className="text-xl sm:text-2xl font-bold text-[#0f172a]">{t('videos', lang)}</h1>
                <p className="text-[#64748b] text-sm">{t('manageVideosDesc', lang) || 'Manage videos attached to exam questions.'}</p>
                <Breadcrumb />
            </div>

            {/* Change 11: all required; Change 2: correct order */}
            <div className="bg-white rounded-xl border border-[#e2e8f0] p-4">
                <div className="flex items-center gap-2 mb-3">
                    <AlertCircle className="h-3.5 w-3.5 text-red-400" />
                    <span className="text-xs text-[#94a3b8]">{t('allFieldsRequired', lang) || 'All fields are required'} <span className="text-red-500 font-bold">*</span></span>
                </div>
                <div className="flex flex-wrap gap-3 items-end">
                    {filterDefs.map(fd => (
                        <div key={fd.key} className="flex flex-col gap-1">
                            <label className={`text-[10px] font-bold uppercase tracking-wider ${fieldErrors[fd.key] ? 'text-red-500' : 'text-[#64748b]'}`}>
                                {fd.label} <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={fd.sel} disabled={fd.dep}
                                onChange={e => { fd.set(e.target.value); setFieldErrors(p => ({...p, [fd.key]: false})); }}
                                className={`h-9 pl-3 rounded-lg border text-sm font-medium min-w-[140px] disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#1d4ed8]/20 ${errBorder(fd.key)}`}
                                style={selStyle}>
                                <option value="">{t('choose', lang) || '-- Choose --'}</option>
                                {fd.opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                            {fieldErrors[fd.key] && (
                                <span className="text-[10px] text-red-500 font-medium">{t('required', lang)}</span>
                            )}
                        </div>
                    ))}
                        <button onClick={handleSearch}
                        className="h-9 px-5 bg-[#1d4ed8] hover:bg-[#1e40af] text-white text-sm font-bold rounded-lg transition-all shadow-sm flex items-center gap-2">
                        <Search className="h-4 w-4" /> {t('showVideos', lang)}
                    </button>
                    <button onClick={() => { setSelClass(''); setSelSection(''); setSelSubject(''); setSelExam(''); setSelSemester(''); setQuestions([]); setSearched(false); setFieldErrors({}); }}
                        className="h-9 px-5 rounded-lg border border-[#e2e8f0] font-semibold text-[#64748b] bg-white hover:bg-slate-50 flex items-center gap-2 text-sm">
                        <X className="h-3.5 w-3.5" /> {t('reset', lang)}
                    </button>
                </div>
            </div>

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
                                        <motion.tr key={q.questionid} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
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
                                                            <button onClick={() => handleSaveUrl(q)} disabled={saving}
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
        </div>
    );
}
