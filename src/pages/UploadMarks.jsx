import { t, getField, getStudentName as _getStudentName } from '../lib/langHelper';
import { useLang } from '../context/LanguageContext';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, Loader2, Save, Upload, Download, FileSpreadsheet } from 'lucide-react';
import Breadcrumb from '../components/Breadcrumb';
import ConfirmDialog from '../components/ConfirmDialog';
import { useNavigate, useParams } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { insert, rest, dbQuery } from '../lib/supabaseClient';
import { parseCsvText } from '../lib/adminCsv';




async function deleteAnswers(filters) {
    const params = Object.entries(filters)
        .map(([key, value]) => `${key}=eq.${value}`)
        .join('&');

    const response = await dbQuery(`studentanswers_tbl?${params}`, 'DELETE');

    if (!response.ok) {
        let message = 'Failed to clear previous grades';
        try {
            const data = await response.json();
            message = data.message || message;
        } catch {
            // ignore json parse errors
        }
        throw new Error(message);
    }
}

export default function UploadMarks() {
    const { lang, isAr } = useLang();

    const navigate = useNavigate();
    const { addToast } = useToast();
    const { user } = useAuth();
    const { examid, classid, sectionid, subjectid } = useParams();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [fileName, setFileName] = useState('');
    const [meta, setMeta] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [students, setStudents] = useState([]);
    const [marks, setMarks] = useState({});
    const [markErrors, setMarkErrors] = useState({});
    const [hasExistingMarks, setHasExistingMarks] = useState(false);
    const [nameSort, setNameSort] = useState('asc');
    const sortedStudents = [...(students || [])].sort((a, b) => {
        const an = (_getStudentName(a, lang) || '').toLowerCase();
        const bn = (_getStudentName(b, lang) || '').toLowerCase();
        return nameSort === 'asc' ? an.localeCompare(bn) : bn.localeCompare(an);
    });
    const [csvErrors, setCsvErrors] = useState([]);
    const [preview, setPreview] = useState(null);
    const [confirm, setConfirm] = useState({ open: false });

    const activeTab = 'upload';

    const loadData = useCallback(async () => {
        if (!user) return;

        setLoading(true);
        try {
            const [examRows, classRows, sectionRows, subjectRows, questionRows, sectionStudentRows, studentRows, existingAnswers, assignmentRows] = await Promise.all([
                rest('exams_tbl', { examid: `eq.${examid}`, select: '*' }),
                rest('classes_tbl', { classid: `eq.${classid}`, select: '*' }),
                rest('sections_tbl', { sectionid: `eq.${sectionid}`, select: '*' }),
                rest('subjects_tbl', { subjectid: `eq.${subjectid}`, select: 'subjectid,subjectname,Subjectname_en' }),
                rest('questions_exams_employee_subjects_sections_tbl', {
                    examid: `eq.${examid}`,
                    employeeid: `eq.${user.employeeid}`,
                    classid: `eq.${classid}`,
                    sectionid: `eq.${sectionid}`,
                    subjectid: `eq.${subjectid}`,
                    select: 'questionid,question_marks,status',
                    order: 'questionid.asc',
                }),
                rest('students_sections_classes_tbl', {
                    classid: `eq.${classid}`,
                    sectionid: `eq.${sectionid}`,
                    schoolid: `eq.${user.schoolid}`,
                    select: 'studentid',
                }),
                rest('students_tbl', { select: '*' }),
                rest('studentanswers_tbl', {
                    examid: `eq.${examid}`,
                    employeeid: `eq.${user.employeeid}`,
                    classid: `eq.${classid}`,
                    sectionid: `eq.${sectionid}`,
                    subjectid: `eq.${subjectid}`,
                    select: 'studentid,questionid,studentmark',
                }),
                rest('employees_sections_subjects_classes_semisters_curriculums_tbl', {
                    employeeid: `eq.${user.employeeid}`,
                    classid: `eq.${classid}`,
                    sectionid: `eq.${sectionid}`,
                    subjectid: `eq.${subjectid}`,
                    select: 'stageid,curriculumid,divisionid,semisterid,yearid',
                }),
            ]);

            const exam = examRows[0];
            const cls = classRows[0];
            const section = sectionRows[0];
            const subject = subjectRows[0];
            const assignment = assignmentRows?.[0];

            const examStatusFromQ = (questionRows?.[0]?.status || '').toLowerCase();
            const isFinalized = ['marked', 'completed', 'inprogress', 'submitted'].includes(examStatusFromQ);

            let enrolledStudents;
            if (isFinalized) {
                const examEnrolledRows = await rest('students_exams_employees_section_subjects_classes_semisters_cur', {
                    examid: `eq.${examid}`,
                    employeeid: `eq.${user.employeeid}`,
                    classid: `eq.${classid}`,
                    sectionid: `eq.${sectionid}`,
                    subjectid: `eq.${subjectid}`,
                    select: 'studentid',
                });
                enrolledStudents = [...new Map(
                    examEnrolledRows
                        .map((row) => studentRows.find((student) => student.studentid === row.studentid))
                        .filter(Boolean)
                        .map(s => [s.studentid, s])
                ).values()];
            } else {
                enrolledStudents = [...new Map(
                    sectionStudentRows
                        .map((row) => studentRows.find((student) => student.studentid === row.studentid))
                        .filter(Boolean)
                        .map(s => [s.studentid, s])
                ).values()];
            }
            // Deduplicate by questionid (DB may return duplicate rows)
            const questionObjs = [...new Map(questionRows.map(r => [r.questionid, {
                questionid: r.questionid,
                question_marks: parseFloat(r.question_marks) || 1,
            }])).values()];

            const nextMarks = {};
            enrolledStudents.forEach((student) => {
                nextMarks[student.studentid] = {};
                questionObjs.forEach((q) => {
                    nextMarks[student.studentid][q.questionid] = '';
                });
            });

            existingAnswers.forEach((answer) => {
                if (!nextMarks[answer.studentid]) nextMarks[answer.studentid] = {};
                nextMarks[answer.studentid][answer.questionid] = answer.studentmark ?? '';
            });

            setMeta({
                examid: Number(examid),
                classid: Number(classid),
                sectionid: Number(sectionid),
                subjectid: Number(subjectid),
                examname: getField(exam, 'examname', 'examname_en', lang) || exam?.examname || `Exam ${examid}`,
                classname: cls?.classname || classid,
                sectionname: section?.sectionname || sectionid,
                subjectname: getField(subject, 'subjectname', 'Subjectname_en', lang) || subject?.subjectname || subjectid,
                stageid: assignment?.stageid || 1,
                curriculumid: assignment?.curriculumid || user.curriculumid || 1,
                divisionid: assignment?.divisionid || user.divisionid || 1,
                semisterid: assignment?.semisterid || 1,
                yearid: assignment?.yearid || 2026,
            });
            setQuestions(questionObjs);
            setStudents(enrolledStudents);
            setMarks(nextMarks);
            setHasExistingMarks((existingAnswers || []).length > 0);
        } catch (error) {
            addToast(error.message || 'Failed to load exam page', 'error');
        } finally {
            setLoading(false);
        }
    }, [addToast, classid, examid, sectionid, subjectid, user, lang]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const tabs = [
        { id: 'upload', label: 'Upload Grades' },
    ];

    const totalStudents = students.length;

    const handleMarkChange = (studentid, questionid, value, inputEl) => {
        const qObj = questions.find(q => q.questionid === questionid);
        const maxMark = qObj ? qObj.question_marks : 100;
        const errKey = `${studentid}-${questionid}`;
        if (value !== '') {
            const num = parseFloat(value);
            if (isNaN(num) || num < 0) return; // silently ignore non-numeric/negative
            if (num > maxMark) {
                setMarkErrors(prev => ({ ...prev, [errKey]: `Max is ${maxMark}` }));
                // Keep the previous value — select all so next keystroke replaces
                if (inputEl) setTimeout(() => inputEl.select(), 0);
                return;
            }
        }
        setMarkErrors(prev => { const n = { ...prev }; delete n[errKey]; return n; });
        setMarks(prev => ({ ...prev, [studentid]: { ...(prev[studentid] || {}), [questionid]: value } }));
    };

    const saveRows = useCallback(async (sourceMarks) => {
        if (!meta) return;

        let saved = 0;

        // FK Validation: verify all question IDs being saved actually exist in the questions table
        const questionIds = questions.map(q => q.questionid);
        if (questionIds.length > 0) {
            const validQuestions = await rest('questions_exams_employee_subjects_sections_tbl', {
                examid: `eq.${meta.examid}`,
                employeeid: `eq.${user.employeeid}`,
                classid: `eq.${meta.classid}`,
                sectionid: `eq.${meta.sectionid}`,
                subjectid: `eq.${meta.subjectid}`,
                select: 'questionid',
            });
            const validIds = new Set((validQuestions || []).map(q => String(q.questionid)));
            const invalidIds = questionIds.filter(id => !validIds.has(String(id)));
            if (invalidIds.length > 0) {
                throw new Error(`Cannot save: Question ID(s) ${invalidIds.join(', ')} do not exist in the exam questions table. Please recreate the exam questions before saving marks.`);
            }
        }

        // Step 1: Ensure every student is enrolled in the exam before inserting answers.
        // This satisfies the FK constraint fk_studentmark_studexam on studentanswers_tbl.
        const examStatusRow = await rest('questions_exams_employee_subjects_sections_tbl', {
            examid: `eq.${meta.examid}`,
            employeeid: `eq.${user.employeeid}`,
            classid: `eq.${meta.classid}`,
            sectionid: `eq.${meta.sectionid}`,
            subjectid: `eq.${meta.subjectid}`,
            select: 'status',
            limit: 1,
        }).catch(() => []);
        const examStatus = (examStatusRow?.[0]?.status || '').toLowerCase();
        const examIsFinalized = ['marked', 'completed', 'inprogress', 'submitted'].includes(examStatus);

        for (const student of students) {
            const existing = await rest('students_exams_employees_section_subjects_classes_semisters_cur', {
                studentid: `eq.${student.studentid}`,
                examid: `eq.${meta.examid}`,
                employeeid: `eq.${user.employeeid}`,
                classid: `eq.${meta.classid}`,
                sectionid: `eq.${meta.sectionid}`,
                subjectid: `eq.${meta.subjectid}`,
                select: 'studentid',
            });
            if (!existing?.length && !examIsFinalized) {
                await insert('students_exams_employees_section_subjects_classes_semisters_cur', {
                    studentid: student.studentid,
                    examid: meta.examid,
                    employeeid: user.employeeid,
                    subjectid: meta.subjectid,
                    sectionid: meta.sectionid,
                    classid: meta.classid,
                    semisterid: meta.semisterid,
                    yearid: meta.yearid,
                    stageid: meta.stageid,
                    curriculumid: meta.curriculumid,
                    divisionid: meta.divisionid,
                    branchid: user.branchid,
                    schoolid: user.schoolid,
                });
            }
        }

        // Step 2: Delete all existing answers for this teacher+exam+class+section+subject,
        // then insert fresh. This prevents duplicate rows on repeated saves.
        await deleteAnswers({
            examid: meta.examid,
            employeeid: user.employeeid,
            subjectid: meta.subjectid,
            sectionid: meta.sectionid,
            classid: meta.classid,
        });

        // Step 3: Insert answers
        for (const student of students) {
            for (const qObj of questions) {
                const questionid = qObj.questionid;
                const value = sourceMarks?.[student.studentid]?.[questionid];
                const markValue = (value === '' || value === undefined || value === null) ? null : String(value);

                await insert('studentanswers_tbl', {
                    questionid,
                    studentid: student.studentid,
                    examid: meta.examid,
                    employeeid: user.employeeid,
                    subjectid: meta.subjectid,
                    sectionid: meta.sectionid,
                    classid: meta.classid,
                    semisterid: meta.semisterid,
                    yearid: meta.yearid,
                    stageid: meta.stageid,
                    curriculumid: meta.curriculumid,
                    divisionid: meta.divisionid,
                    branchid: user.branchid,
                    schoolid: user.schoolid,
                    typeid: 1,
                    studentmark: markValue,
                });
                saved += 1;
            }
        }

        if (saved > 0) {
            const markParams = `examid=eq.${meta.examid}&employeeid=eq.${user.employeeid}&classid=eq.${meta.classid}&sectionid=eq.${meta.sectionid}&subjectid=eq.${meta.subjectid}&schoolid=eq.${user.schoolid}&branchid=eq.${user.branchid}`;
            await dbQuery(
                `questions_exams_employee_subjects_sections_tbl?${markParams}`,
                'PATCH',
                { status: 'marked' },
                'return=minimal'
            );
        }

        return saved;
    }, [meta, questions, students, user]);

    const handleSaveManual = async () => {
        if (!meta) return;
        setSaving(true);
        try {
            const saved = await saveRows(marks);
            addToast(`Saved ${saved || 0} mark record(s) to studentanswers_tbl.`, 'success');
            await loadData();
            // Navigate back after successful save
            setTimeout(() => {
                navigate('/exams');
            }, 1500);
        } catch (error) {
            addToast(error.message || 'Failed to save grades', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleTemplateDownload = () => {
        if (!students.length) {
            addToast('No students found for this exam.', 'warning');
            return;
        }

        const headers = ['student_id', 'student_name', ...questions.map((q, index) => `q${index + 1}(max:${q.question_marks})`)];
        const rows = students.map((student) => [
            student.studentid,
            _getStudentName(student, lang) || '',
            ...questions.map(() => ''),
        ]);
        const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${meta?.examname || 'exam'}-grades-template.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const previewRows = useMemo(() => preview?.rows?.slice(0, 5) || [], [preview]);

    const handleFileChange = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setFileName(file.name);
        try {
            const rows = await parseCsvText(await file.text());
            if (!rows.length) {
                addToast('The CSV file is empty or invalid.', 'error');
                setPreview(null);
                return;
            }
            const headers = Object.keys(rows[0]);
            setPreview({ headers, rows });
        } catch {
            addToast('Failed to read CSV file.', 'error');
            setPreview(null);
        }
    };

    const handleUpload = async () => {
        if (!preview) {
            addToast('Choose a CSV file first.', 'warning');
            return;
        }
        if (!questions.length) {
            addToast('This exam has no questions yet.', 'warning');
            return;
        }

        const studentIdHeader = preview.headers.find((header) => ['student_id', 'studentid', 'id'].includes(header));
        if (!studentIdHeader) {
            addToast('The file must include a student_id column.', 'error');
            return;
        }

        setUploading(true);
        try {
            const uploadedMarks = {};

            preview.rows.forEach((row) => {
                const studentid = Number(row[studentIdHeader]);
                if (!studentid) return;
                if (!uploadedMarks[studentid]) uploadedMarks[studentid] = {};

                questions.forEach((qObj, index) => {
                    const questionid = qObj.questionid;
                    const maxMark = qObj.question_marks;
                    const colKey = Object.keys(row).find(k => k.toLowerCase().startsWith(`q${index + 1}`));
                    const rawValue = colKey ? row[colKey] : (row[`question${index + 1}`] ?? row[String(questionid)] ?? '');
                    const numVal = rawValue === '' ? '' : Number(rawValue);
                    const value = (rawValue !== '' && !isNaN(numVal) && numVal > maxMark)
                        ? String(maxMark)
                        : rawValue;
                    uploadedMarks[studentid][questionid] = value;
                });
            });

            setMarks((prev) => ({ ...prev, ...uploadedMarks }));
            const saved = await saveRows({ ...marks, ...uploadedMarks });
            addToast(`Uploaded ${saved || 0} mark record(s) to studentanswers_tbl.`, 'success');
            setPreview(null);
            setFileName('');
            await loadData();
            // Navigate back after successful upload
            setTimeout(() => {
                navigate('/exams');
            }, 1500);
        } catch (error) {
            addToast(error.message || 'Upload failed', 'error');
        } finally {
            setUploading(false);
        }
    };

    if (loading) {

  return (
            <div className="flex items-center justify-center py-16 text-[#94a3b8]">
                <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading exam page...
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-12">
            <div className="flex items-center gap-4">
                <button
                    title="Back to Exams"
                    onClick={() => navigate('/exams')}
                    className="h-9 w-9 rounded-full flex items-center justify-center border border-[#e2e8f0] hover:bg-slate-100 transition-all"
                >
                    <ChevronLeft className="h-5 w-5 text-[#475569]" />
                </button>
                <div>
                    <h1 className="text-xl font-bold text-[#0f172a] flex items-center gap-2">
                        Classes {meta?.classname}
                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded bg-[#eff6ff] text-[#1d4ed8] text-sm font-bold border border-blue-100">
                            Section {meta?.sectionname}
                        </span>
                    </h1>
                    <p className="text-[#64748b] text-sm">{meta?.subjectname} • {totalStudents} Students • {meta?.examname}</p>
                </div>
            </div>

            {/* Dashboard Cards */}
            <div className="grid grid-cols-4 gap-4">
                {/* Students Card */}
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200 p-6">
                    <p className="text-xs font-bold text-blue-600 uppercase tracking-wide">{t('students', lang)}</p>
                    <p className="text-3xl font-bold text-blue-900 mt-3">{totalStudents}</p>
                    <p className="text-xs text-blue-700 mt-2">{isAr ? "الإجمالي في الصف" : "Total in class"}</p>
                </div>

                {/* Questions Card */}
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200 p-6">
                    <p className="text-xs font-bold text-purple-600 uppercase tracking-wide">{isAr ? "الأسئلة" : "Questions"}</p>
                    <p className="text-3xl font-bold text-purple-900 mt-3">{questions.length}</p>
                    <p className="text-xs text-purple-700 mt-2">{isAr ? "في هذا الامتحان" : "In this exam"}</p>
                </div>

                {/* Marks Entered Card */}
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200 p-6">
                    <p className="text-xs font-bold text-green-600 uppercase tracking-wide">{isAr ? "الدرجات المدخلة" : "Marks Entered"}</p>
                    <p className="text-3xl font-bold text-green-900 mt-3">
                        {Object.keys(marks).length}/{totalStudents}
                    </p>
                    <p className="text-xs text-green-700 mt-2">{isAr ? "التقدم" : "Progress"}</p>
                </div>

                {/* Status Card */}
                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl border border-emerald-200 p-6">
                    <p className="text-xs font-bold text-emerald-600 uppercase tracking-wide">{t('status', lang)}</p>
                    <p className="text-3xl font-bold text-emerald-900 mt-3">{isAr ? "جاهز" : "Ready"}</p>
                    <p className="text-xs text-emerald-700 mt-2">{isAr ? "رفع الدرجات" : "Upload marks"}</p>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden">
                <div className="flex border-b border-[#e2e8f0] gap-1 px-4">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            className={`px-5 py-4 text-sm font-bold border-b-2 transition-all ${activeTab === tab.id ? 'border-[#1d4ed8] text-[#1d4ed8]' : 'border-transparent text-[#64748b]'}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="p-6 space-y-6">
                    <div className="border-2 border-dashed border-[#dbe4f0] rounded-2xl p-8 text-center bg-slate-50">
                        <div className="mx-auto h-14 w-14 rounded-full bg-white border border-[#e2e8f0] flex items-center justify-center mb-4">
                            <FileSpreadsheet className="h-7 w-7 text-[#94a3b8]" />
                        </div>
                        <p className="text-lg font-bold text-[#0f172a] mb-1">Drag and drop file here or click to browse</p>
                        <p className="text-sm text-[#64748b] mb-5">Supported format: .csv</p>
                        <div className="flex items-center justify-center gap-3 flex-wrap">
                            <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#dbe4f0] bg-white text-sm font-bold text-[#1d4ed8] cursor-pointer hover:bg-blue-50 transition-all">
                                <Upload className="h-4 w-4" /> Choose CSV
                                <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileChange} />
                            </label>
                            <button
                                type="button"
                                onClick={handleTemplateDownload}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#1d4ed8] bg-white text-sm font-bold text-[#1d4ed8] hover:bg-blue-50 transition-all"
                            >
                                <Download className="h-4 w-4" /> Download Template
                            </button>
                        </div>
                        {fileName && <p className="mt-4 text-sm text-[#475569]">Selected file: <span className="font-bold">{fileName}</span></p>}
                    </div>

                    {preview && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                                <h2 className="text-base font-bold text-[#0f172a]">Preview</h2>
                                <button
                                    type="button"
                                    onClick={() => setConfirm({ open: true, action: 'upload' })}
                                    disabled={uploading}
                                    className="px-5 py-2 bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-lg text-sm font-bold flex items-center gap-2 disabled:opacity-60"
                                >
                                    {uploading ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading...</> : <><Upload className="h-4 w-4" /> Upload Grades</>}
                                </button>
                            </div>
                            <div className="overflow-x-auto border border-[#e2e8f0] rounded-xl">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 border-b border-[#e2e8f0]">
                                        <tr>
                                            {preview.headers.map((header) => (
                                                <th key={header} className="py-3 px-4 text-xs font-black text-[#64748b] uppercase tracking-wider">{header}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#e2e8f0]">
                                        {previewRows.map((row, index) => (
                                            <tr key={index}>
                                                {preview.headers.map((header) => (
                                                    <td key={header} className="py-3 px-4 text-[#475569]">{row[header]}</td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    <div className="border-t border-[#e2e8f0] pt-6">
                        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                            <h2 className="text-lg font-bold text-[#0f172a]">Manual Entry</h2>
                        </div>

                        {hasExistingMarks && (
                            <div className="mb-4 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                                <svg className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                                <div>
                                    <p className="font-bold mb-0.5">{isAr ? "الدرجات مُدخَلة مسبقاً" : "Marks already entered"}</p>
                                    <p className="text-amber-700">Manual entry is disabled because marks have already been saved for this exam. To edit marks, use the <strong>Edit Marks</strong> page from the Exams table.</p>
                                </div>
                            </div>
                        )}

                        {!students.length ? (
                            <div className="py-12 text-center text-[#94a3b8]">No students were found for this class and section.</div>
                        ) : !questions.length ? (
                            <div className="py-12 text-center text-[#94a3b8]">No exam questions were found. Create questions first, then upload grades.</div>
                        ) : (
                            <div className="space-y-4">
                                <div className="overflow-x-auto border border-[#e2e8f0] rounded-xl">
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-50 border-b border-[#e2e8f0]">
                                            <tr>
                                                <th className="py-4 px-4 text-xs font-black text-[#64748b] uppercase tracking-wider">{isAr ? "رقم الطالب" : "Student ID"}</th>
                                                <th className="py-4 px-4 text-xs font-black text-[#64748b] uppercase tracking-wider cursor-pointer select-none" onClick={() => setNameSort(s => s === 'asc' ? 'desc' : 'asc')}>
                                                    Name <span className="text-[#1d4ed8]">{nameSort === 'asc' ? '▲' : '▼'}</span>
                                                </th>
                                                {questions.map((q, index) => (
                                                    <th key={q.questionid} className="py-4 px-4 text-xs font-black text-[#64748b] uppercase tracking-wider text-center">
                                                        <div>Q{index + 1}</div>
                                                        <div className="text-[10px] font-normal text-[#94a3b8] normal-case">max: {q.question_marks}</div>
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[#e2e8f0] bg-white">
                                            {sortedStudents.map((student) => (
                                                <motion.tr key={student.studentid} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                                    <td className="py-3 px-4 text-sm text-[#475569]">{student.studentid}</td>
                                                    <td className="py-3 px-4 text-sm font-bold text-[#0f172a]">{_getStudentName(student, lang)}</td>
                                                    {questions.map((q) => {
                                                        const qErr = markErrors[`${student.studentid}-${q.questionid}`];
                                                        return (
                                                        <td key={q.questionid} className="py-3 px-4 text-center">
                                                            <input
                                                                type="text"
                                                                inputMode="decimal"
                                                                value={marks?.[student.studentid]?.[q.questionid] ?? ''}
                                                                onChange={(event) => handleMarkChange(student.studentid, q.questionid, event.target.value, event.target)}
                                                                onFocus={e => e.target.select()}
                                                                onClick={e => e.target.select()}
                                                                onKeyDown={e => { if (e.key >= '0' && e.key <= '9') e.target.select(); }}
                                                                disabled={hasExistingMarks}
                                                                className={`w-20 h-10 text-center font-bold border rounded-lg outline-none focus:ring-2 ${hasExistingMarks ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' : qErr ? 'border-red-400 bg-red-50 focus:ring-red-200 text-[#0f172a]' : 'border-[#dbe4f0] focus:border-[#1d4ed8] focus:ring-blue-100 text-[#0f172a]'}`}
                                                            />
                                                            {qErr && <div className="text-[10px] text-red-500 font-bold mt-0.5">{qErr}</div>}
                                                        </td>
                                                        );
                                                    })}
                                                </motion.tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {!hasExistingMarks && (
                                    <div className="flex justify-end">
                                        <button
                                            type="button"
                                            onClick={() => setConfirm({ open: true, action: 'save' })}
                                            disabled={saving}
                                            className="px-6 py-2.5 bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-lg text-sm font-bold flex items-center gap-2 disabled:opacity-60"
                                        >
                                            {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : <><Save className="h-4 w-4" /> Save Changes</>}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        <ConfirmDialog
            open={confirm.open}
            title={confirm.action === 'upload' ? 'Upload Grades?' : 'Save Marks?'}
            message={confirm.action === 'upload'
                ? 'The uploaded file will be processed and all marks saved to the database.'
                : 'All entered marks will be saved to the database.'}
            confirmLabel={confirm.action === 'upload' ? 'Upload' : 'Save'}
            cancelLabel="Cancel"
            variant="primary"
            loading={confirm.action === 'upload' ? uploading : saving}
            onConfirm={() => { setConfirm({ open: false }); confirm.action === 'upload' ? handleUpload() : handleSaveManual(); }}
            onCancel={() => setConfirm({ open: false })}
        />
        </div>
    );
}
