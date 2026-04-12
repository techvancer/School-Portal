import { t, getField, getStudentName as _getStudentName, CHOICE_LETTERS, letterToPosition, positionToLetter } from '../lib/langHelper';
import { useLang } from '../context/LanguageContext';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Save, Upload, Download, FileSpreadsheet, X } from 'lucide-react';
import Breadcrumb from '../components/Breadcrumb';
import ConfirmDialog from '../components/ConfirmDialog';
import { useNavigate, useParams } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { insert, rest, update, dbQuery } from '../lib/supabaseClient';
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

export default function TeacherExamUpload() {
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
    const [studentAnswers, setStudentAnswers] = useState({}); // auto_graded mode: { studentid: { questionid: 'A' } }
    const [nameSort, setNameSort] = useState('asc');
    const sortedStudents = [...(students || [])].sort((a, b) => {
        const an = (_getStudentName(a, lang) || '').toLowerCase();
        const bn = (_getStudentName(b, lang) || '').toLowerCase();
        return nameSort === 'asc' ? an.localeCompare(bn) : bn.localeCompare(an);
    });
    const [csvErrorModal, setCsvErrorModal] = useState({ show: false, errors: [] }); // [{studentName, qLabel, entered, max, reason}]
    // Change 4: track count of students with real answers in DB
    const [dbAnsweredCount, setDbAnsweredCount] = useState(0);
    const [preview, setPreview] = useState(null);
    const [confirm, setConfirm] = useState({ open: false });

    const activeTab = 'upload';
    const rawExamStatus = String(meta?.status || '').toLowerCase();
    const effectiveExamStatus = rawExamStatus === 'cancelled'
        ? 'cancelled'
        : rawExamStatus === 'submitted'
            ? 'submitted'
            : ['marked', 'completed', 'inprogress'].includes(rawExamStatus) || dbAnsweredCount > 0
                ? 'marked'
                : 'new';
    const isManualEntryLocked = ['marked', 'submitted', 'cancelled'].includes(effectiveExamStatus);

    const loadData = useCallback(async () => {
        if (!user) return;

        setLoading(true);
        try {
            // Step 1: find the latest attempt_number for this teacher+exam+class+section+subject
            const latestAttemptRows = await rest('questions_exams_employee_subjects_sections_tbl', {
                examid: `eq.${examid}`,
                employeeid: `eq.${user.employeeid}`,
                classid: `eq.${classid}`,
                sectionid: `eq.${sectionid}`,
                subjectid: `eq.${subjectid}`,
                select: 'attempt_number',
                order: 'attempt_number.desc',
                limit: '1',
            });
            const latestAttempt = latestAttemptRows?.[0]?.attempt_number ?? 1;

            // Step 2: load everything in parallel, filtering questions by latest attempt
            const [examRows, classRows, sectionRows, subjectRows, questionRows, sectionStudentRows, existingAnswers, assignmentRows] = await Promise.all([
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
                    attempt_number: `eq.${latestAttempt}`,
                    select: 'questionid,question_marks,question_type,exam_type,question_answer,num_choices',
                    order: 'questionid.asc',
                }),
                rest('students_sections_classes_tbl', {
                    classid: `eq.${classid}`,
                    sectionid: `eq.${sectionid}`,
                    schoolid: `eq.${user.schoolid}`,
                    select: 'studentid',
                }),
                rest('studentanswers_tbl', {
                    examid: `eq.${examid}`,
                    employeeid: `eq.${user.employeeid}`,
                    classid: `eq.${classid}`,
                    sectionid: `eq.${sectionid}`,
                    subjectid: `eq.${subjectid}`,
                    attempt_number: `eq.${latestAttempt}`,
                    select: 'studentid,questionid,studentmark,student_answer',
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

            // Fetch actively enrolled students + ANY student who has historical answers for this exact exam attempt
            const enrolledIds = new Set(sectionStudentRows.map(r => r.studentid));
            existingAnswers.forEach(ans => enrolledIds.add(ans.studentid));
            
            const uniqueIds = Array.from(enrolledIds);
            const studentRows = uniqueIds.length
                ? await rest('students_tbl', { studentid: `in.(${uniqueIds.join(',')})`, select: '*' })
                : [];
            const enrolledStudents = studentRows;
            // Store full question objects
            const questionObjs = questionRows.map(r => ({
                questionid: r.questionid,
                question_marks: parseFloat(r.question_marks) || 1,
                question_type: r.question_type || 'multiple_choice',
                exam_type: r.exam_type || 'normal',
                question_answer: r.question_answer || '', // stored as position ("1","2",...) for MCQ
                num_choices: r.num_choices || 4,
            }));
            const isAG = questionObjs.length > 0 && questionObjs[0].exam_type === 'auto_graded';

            // marks holds numeric studentmark values (used in normal mode)
            // studentAnswers holds the raw answer text (used in auto_graded mode)
            const nextMarks = {};
            const nextAnswers = {};
            enrolledStudents.forEach((student) => {
                nextMarks[student.studentid] = {};
                nextAnswers[student.studentid] = {};
                questionObjs.forEach((q) => {
                    nextMarks[student.studentid][q.questionid] = '';
                    nextAnswers[student.studentid][q.questionid] = '';
                });
            });

            existingAnswers.forEach((answer) => {
                if (!nextMarks[answer.studentid]) nextMarks[answer.studentid] = {};
                if (!nextAnswers[answer.studentid]) nextAnswers[answer.studentid] = {};
                nextMarks[answer.studentid][answer.questionid] = answer.studentmark ?? '';
                // For MCQ: stored value is a position ("1","2",...) — convert back to letter for display
                const qObj = questionObjs.find(q => q.questionid === answer.questionid);
                const rawAnswer = answer.student_answer ?? '';
                if (qObj?.question_type === 'multiple_choice' && rawAnswer !== '') {
                    nextAnswers[answer.studentid][answer.questionid] = positionToLetter(rawAnswer, lang);
                } else {
                    nextAnswers[answer.studentid][answer.questionid] = rawAnswer;
                }
            });

            // Change 4: count students that ACTUALLY have answers in the DB
            const dbAnswered = new Set(existingAnswers.map(a => a.studentid)).size;
            setDbAnsweredCount(dbAnswered);

            setMeta({
                examid: Number(examid),
                classid: Number(classid),
                sectionid: Number(sectionid),
                subjectid: Number(subjectid),
                examname: getField(exam, 'examname', 'examname_en', lang) || exam?.examname || `Exam ${examid}`,
                classname: getField(cls, 'classname', 'classname_en', lang) || cls?.classname || classid,
                sectionname: getField(section, 'sectionname', 'sectionname_en', lang) || section?.sectionname || sectionid,
                subjectname: getField(subject, 'subjectname', 'Subjectname_en', lang) || subject?.subjectname || subjectid,
                stageid: assignment?.stageid || 1,
                curriculumid: assignment?.curriculumid || user.curriculumid || 1,
                divisionid: assignment?.divisionid || user.divisionid || 1,
                semisterid: assignment?.semisterid || 1,
                yearid: assignment?.yearid || 2026,
                status: String(exam?.status || '').toLowerCase(),
                isAutoGraded: isAG,
                attemptNumber: latestAttempt,
            });
            setQuestions(questionObjs);
            setStudents(enrolledStudents);
            setMarks(nextMarks);
            setStudentAnswers(nextAnswers);
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
        { id: 'upload', label: t('uploadGrades', lang) },
    ];

    const totalStudents = students.length;

    const handleMarkChange = (studentid, questionid, value) => {
        const qObj = questions.find(q => q.questionid === questionid);
        const maxMark = qObj ? qObj.question_marks : 100;
        const num = value === '' ? '' : Number(value);
        let error = '';
        if (value !== '' && (isNaN(num) || num < 0)) {
            error = t('mustBe0orAbove', lang);
        } else if (value !== '' && num > maxMark) {
            error = `${t('maxIs', lang)} ${maxMark}`;
        }
        const cleaned = value === '' ? '' : String(Math.max(0, Math.min(maxMark, Number(value) || 0)));
        setMarkErrors(prev => ({
            ...prev,
            [studentid]: { ...(prev[studentid] || {}), [questionid]: error },
        }));
        setMarks((prev) => ({
            ...prev,
            [studentid]: { ...(prev[studentid] || {}), [questionid]: cleaned },
        }));
    };

    const handleStudentAnswerChange = (studentid, questionid, value) => {
        setStudentAnswers(prev => ({
            ...prev,
            [studentid]: { ...(prev[studentid] || {}), [questionid]: value },
        }));
    };


    const saveRows = useCallback(async (sourceMarks, sourceAnswers) => {
        if (!meta) return;

        const isAG = meta.isAutoGraded;
        let saved = 0;

        // Step 1: Ensure every student is enrolled in the exam before inserting answers.
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
            if (!existing?.length) {
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

        // Step 2: Delete all existing answers for this attempt then insert fresh.
        await deleteAnswers({
            examid: meta.examid,
            employeeid: user.employeeid,
            subjectid: meta.subjectid,
            sectionid: meta.sectionid,
            classid: meta.classid,
            attempt_number: meta.attemptNumber ?? 1,
        });

        // Step 3: Insert answers
        for (const student of students) {
            for (const qObj of questions) {
                const questionid = qObj.questionid;

                if (isAG) {
                    // Auto-graded: save student_answer + auto-calculated studentmark
                    const answer = sourceAnswers?.[student.studentid]?.[questionid];
                    if (answer === '' || answer === undefined || answer === null) continue;

                    // For MCQ: convert displayed letter → position for storage and comparison
                    const isMCQ = qObj.question_type === 'multiple_choice';
                    const storedAnswer = isMCQ ? (letterToPosition(answer, lang) ?? String(answer)) : String(answer);
                    // Normalize question_answer: may be stored as letter (old exams) or position (new exams)
                    const rawCorrect = String(qObj.question_answer || '').trim();
                    const correct = isMCQ
                        ? (letterToPosition(rawCorrect, lang) ?? rawCorrect.toLowerCase())
                        : rawCorrect.toLowerCase();
                    const given = storedAnswer.trim().toLowerCase();
                    const computedMark = given === correct ? String(qObj.question_marks) : '0';

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
                        attempt_number: meta.attemptNumber ?? 1,
                        student_answer: storedAnswer,
                        studentmark: computedMark,
                    });
                } else {
                    // Normal: save numeric studentmark
                    const value = sourceMarks?.[student.studentid]?.[questionid];
                    if (value === '' || value === undefined || value === null) continue;
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
                        attempt_number: meta.attemptNumber ?? 1,
                        studentmark: String(value),
                    });
                }
                saved += 1;
            }
        }

        if (saved > 0) {
            const markParams = `examid=eq.${meta.examid}&employeeid=eq.${user.employeeid}&classid=eq.${meta.classid}&sectionid=eq.${meta.sectionid}&subjectid=eq.${meta.subjectid}&schoolid=eq.${user.schoolid}&branchid=eq.${user.branchid}&attempt_number=eq.${meta.attemptNumber ?? 1}`;
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
        if (isManualEntryLocked) {
            addToast('This exam can no longer be edited from Manual Entry. Please use Edit Marks.', 'warning');
            return;
        }
        if (meta?.isAutoGraded) {
            // Auto-graded: no numeric validation needed, just save answers
            setSaving(true);
            try {
                const saved = await saveRows(null, studentAnswers);
                addToast(`Saved ${saved || 0} answer record(s).`, 'success');
                await loadData();
            } catch (error) {
                addToast(error.message || 'Failed to save answers', 'error');
            } finally {
                setSaving(false);
            }
            return;
        }

        // Normal: block save if any mark errors exist
        const allErrors = [];
        students.forEach(student => {
            questions.forEach((q, idx) => {
                const err = markErrors?.[student.studentid]?.[q.questionid];
                if (err) {
                    const name = _getStudentName(student, lang) || `Student ${student.studentid}`;
                    allErrors.push({ studentName: name, qLabel: `Q${idx + 1}`, entered: marks?.[student.studentid]?.[q.questionid], max: q.question_marks });
                }
            });
        });
        if (allErrors.length > 0) {
            addToast(`Cannot save — ${allErrors.length} invalid mark(s). Fix the highlighted fields first.`, 'error');
            return;
        }
        setSaving(true);
        try {
            const saved = await saveRows(marks, null);
            addToast(`Saved ${saved || 0} mark record(s) to studentanswers_tbl.`, 'success');
            await loadData();
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

        const isAG = meta?.isAutoGraded;
        const qHeaders = isAG
            ? questions.map((q, i) => `q${i + 1}(${q.question_type || 'mcq'})`)
            : questions.map((q, i) => `q${i + 1}(max:${q.question_marks})`);

        const headers = ['student_id', 'student_name', ...qHeaders];
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
        link.download = `${meta?.examname || 'exam'}-${isAG ? 'answers' : 'grades'}-template.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const previewRows = useMemo(() => preview?.rows?.slice(0, 5) || [], [preview]);

    const handleFileChange = async (event) => {
        if (isManualEntryLocked) {
            addToast('This exam can no longer be edited from this page. Please use Edit Marks.', 'warning');
            event.target.value = '';
            return;
        }
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
        if (isManualEntryLocked) {
            addToast('This exam can no longer be edited from this page. Please use Edit Marks.', 'warning');
            return;
        }
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
        setCsvErrorModal({ show: false, errors: [] });
        const isAG = meta?.isAutoGraded;
        try {
            const studentNameMap = {};
            students.forEach(s => {
                studentNameMap[s.studentid] = _getStudentName(s, lang) || `Student ${s.studentid}`;
            });

            if (isAG) {
                // ── Auto-graded: read text answers, no numeric validation ──
                const uploadedAnswers = {};
                preview.rows.forEach((row) => {
                    const studentid = Number(row[studentIdHeader]);
                    if (!studentid) return;
                    if (!uploadedAnswers[studentid]) uploadedAnswers[studentid] = {};
                    questions.forEach((qObj, index) => {
                        const questionid = qObj.questionid;
                        const colKey = Object.keys(row).find(k => k.toLowerCase().startsWith(`q${index + 1}`));
                        const rawValue = (colKey ? row[colKey] : (row[`question${index + 1}`] ?? row[String(questionid)] ?? '')).trim();
                        uploadedAnswers[studentid][questionid] = rawValue;
                    });
                });
                setStudentAnswers(prev => ({ ...prev, ...uploadedAnswers }));
                const saved = await saveRows(null, { ...studentAnswers, ...uploadedAnswers });
                addToast(`Uploaded answers for ${saved || 0} question-student record(s). Marks auto-calculated.`, 'success');
                setCsvErrorModal({ show: false, errors: [] });
                setPreview(null);
                setFileName('');
                await loadData();
            } else {
                // ── Normal: read numeric marks, validate range ──
                const uploadedMarks = {};
                const validationErrors = [];

                preview.rows.forEach((row) => {
                    const studentid = Number(row[studentIdHeader]);
                    if (!studentid) return;
                    if (!uploadedMarks[studentid]) uploadedMarks[studentid] = {};

                    questions.forEach((qObj, index) => {
                        const questionid = qObj.questionid;
                        const maxMark = qObj.question_marks;
                        const colKey = Object.keys(row).find(k => k.toLowerCase().startsWith(`q${index + 1}`));
                        const rawValue = (colKey ? row[colKey] : (row[`question${index + 1}`] ?? row[String(questionid)] ?? '')).trim();
                        if (rawValue === '') {
                            uploadedMarks[studentid][questionid] = '';
                            return;
                        }
                        const numVal = Number(rawValue);
                        if (isNaN(numVal)) {
                            validationErrors.push({ studentName: studentNameMap[studentid] || `ID ${studentid}`, qLabel: `Q${index + 1}`, entered: rawValue, max: maxMark, reason: 'Not a number' });
                            uploadedMarks[studentid][questionid] = '';
                            return;
                        }
                        if (numVal < 0) {
                            validationErrors.push({ studentName: studentNameMap[studentid] || `ID ${studentid}`, qLabel: `Q${index + 1}`, entered: rawValue, max: maxMark, reason: 'Below 0' });
                            uploadedMarks[studentid][questionid] = '';
                            return;
                        }
                        if (numVal > maxMark) {
                            validationErrors.push({ studentName: studentNameMap[studentid] || `ID ${studentid}`, qLabel: `Q${index + 1}`, entered: rawValue, max: maxMark, reason: `Exceeds max (${maxMark})` });
                            uploadedMarks[studentid][questionid] = '';
                            return;
                        }
                        uploadedMarks[studentid][questionid] = String(numVal);
                    });
                });

                if (validationErrors.length > 0) {
                    setCsvErrorModal({ show: false, errors: validationErrors });
                    addToast(
                        `${validationErrors.length} invalid mark value(s) found. Nothing was uploaded.`,
                        'error',
                        { label: 'View Details', onClick: () => setCsvErrorModal(p => ({ ...p, show: true })) }
                    );
                    setUploading(false);
                    return;
                }

                setMarks((prev) => ({ ...prev, ...uploadedMarks }));
                const saved = await saveRows({ ...marks, ...uploadedMarks }, null);
                addToast(`Uploaded ${saved || 0} mark record(s) to studentanswers_tbl.`, 'success');
                setCsvErrorModal({ show: false, errors: [] });
                setPreview(null);
                setFileName('');
                await loadData();
            }
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
                <div>
                    <h1 className="text-xl font-bold text-[#0f172a] flex items-center gap-2">
                        {t('class', lang)} {meta?.classname}
                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded bg-[#eff6ff] text-[#1d4ed8] text-sm font-bold border border-blue-100">
                            {t('section', lang)} {meta?.sectionname}
                        </span>
                    </h1>
                    <p className="text-[#64748b] text-sm flex items-center gap-2">
                        {meta?.subjectname} • {totalStudents} {t('students', lang)} • {meta?.examname}
                        {meta?.isAutoGraded && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-xs font-bold border border-purple-200">Auto-Graded</span>
                        )}
                    </p>
                    <Breadcrumb />
                </div>
            </div>

            {/* Dashboard Cards - Show Progress */}
            <div className="grid grid-cols-4 gap-4">
                {/* Students Card */}
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200 p-6">
                    <p className="text-xs font-bold text-blue-600 uppercase tracking-wide">{t('students', lang)}</p>
                    <p className="text-3xl font-bold text-blue-900 mt-3">{totalStudents}</p>
                    <p className="text-xs text-blue-700 mt-2">{t('totalInClass', lang)}</p>
                </div>

                {/* Questions Card */}
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200 p-6">
                    <p className="text-xs font-bold text-purple-600 uppercase tracking-wide">{t('questions', lang)}</p>
                    <p className="text-3xl font-bold text-purple-900 mt-3">{questions.length}</p>
                    <p className="text-xs text-purple-700 mt-2">{t('inThisExam', lang)}</p>
                </div>

                {/* Marks Entered Card — Change 4: uses real DB answer count */}
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200 p-6">
                    <p className="text-xs font-bold text-green-600 uppercase tracking-wide">{t('marksEntered', lang)}</p>
                    <p className="text-3xl font-bold text-green-900 mt-3">
                        {dbAnsweredCount}/{totalStudents}
                    </p>
                    <p className="text-xs text-green-700 mt-2">{t('progress', lang)}</p>
                </div>

                {/* Status Card — Change 4: accurate status from DB data */}
                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl border border-emerald-200 p-6">
                    <p className="text-xs font-bold text-emerald-600 uppercase tracking-wide">{t('status', lang)}</p>
                    <p className="text-3xl font-bold text-emerald-900 mt-3">
                        {t(effectiveExamStatus, lang) || effectiveExamStatus}
                    </p>
                    <p className="text-xs text-emerald-700 mt-2">{t('uploadStatus', lang)}</p>
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
                        <p className="text-lg font-bold text-[#0f172a] mb-1">{t('dragAndDrop', lang)}</p>
                        <p className="text-sm text-[#64748b] mb-5">{t('supportedFormat', lang)}</p>
                        {isManualEntryLocked && (
                            <p className="text-sm font-semibold text-amber-700 mb-4">{t('examUploadLockedMsg', lang).replace('{status}', effectiveExamStatus)}</p>
                        )}
                        <div className="flex items-center justify-center gap-3 flex-wrap">
                            <label className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-bold transition-all ${isManualEntryLocked ? 'border-[#e2e8f0] bg-slate-100 text-[#94a3b8] cursor-not-allowed' : 'border-[#dbe4f0] bg-white text-[#1d4ed8] cursor-pointer hover:bg-blue-50'}`}>
                                <Upload className="h-4 w-4" /> {t('chooseCsv', lang)}
                                <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileChange} disabled={isManualEntryLocked} />
                            </label>
                            <button
                                type="button"
                                onClick={handleTemplateDownload}
                                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-bold transition-all ${isManualEntryLocked ? 'border-[#e2e8f0] bg-slate-100 text-[#94a3b8] cursor-not-allowed' : 'border-[#1d4ed8] bg-white text-[#1d4ed8] hover:bg-blue-50'}`}
                                disabled={isManualEntryLocked}
                            >
                                <Download className="h-4 w-4" /> {t('downloadTemplate', lang)}
                            </button>
                        </div>
                        {fileName && <p className="mt-4 text-sm text-[#475569]">Selected file: <span className="font-bold">{fileName}</span></p>}
                    </div>

                    {preview && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                                <h2 className="text-base font-bold text-[#0f172a]">{t('preview', lang)}</h2>
                                <button
                                    type="button"
                                    onClick={() => setConfirm({ open: true, action: 'upload' })}
                                    disabled={uploading || isManualEntryLocked}
                                    className="px-5 py-2 bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-lg text-sm font-bold flex items-center gap-2 disabled:opacity-60"
                                >
                                    {uploading ? <><Loader2 className="h-4 w-4 animate-spin" /> {t('uploading', lang)}</> : <><Upload className="h-4 w-4" /> {t('uploadGrades', lang)}</>}
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
                            <h2 className="text-lg font-bold text-[#0f172a]">{t('manualEntry', lang)}</h2>
                            {isManualEntryLocked && <p className="text-sm text-[#64748b]">{t('manualEntryLockedMsg', lang)}</p>}
                        </div>

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
                                                <th className="py-4 px-4 text-xs font-black text-[#64748b] uppercase tracking-wider">{t('studentId', lang)}</th>
                                                <th className="py-4 px-4 text-xs font-black text-[#64748b] uppercase tracking-wider cursor-pointer select-none" onClick={() => setNameSort(s => s === 'asc' ? 'desc' : 'asc')}>
                                                    {t('name', lang)} <span className="text-[#1d4ed8]">{nameSort === 'asc' ? '▲' : '▼'}</span>
                                                </th>
                                                {questions.map((q, index) => (
                                                    <th key={q.questionid} className="py-4 px-4 text-xs font-black text-[#64748b] uppercase tracking-wider text-center">
                                                        <div>Q{index + 1}</div>
                                                        {meta?.isAutoGraded ? (
                                                            <div className="text-[10px] font-normal text-[#94a3b8] normal-case">{q.question_type}</div>
                                                        ) : (
                                                            <div className="text-[10px] font-normal text-[#94a3b8] normal-case">max: {q.question_marks}</div>
                                                        )}
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
                                                        if (meta?.isAutoGraded) {
                                                            const currentAnswer = studentAnswers?.[student.studentid]?.[q.questionid] ?? '';
                                                            // Compare using positions for MCQ, direct comparison for others
                                                            const isMCQ = q.question_type === 'multiple_choice';
                                                            const givenPos = isMCQ ? (letterToPosition(currentAnswer, lang) ?? '') : String(currentAnswer).trim().toLowerCase();
                                                            // Normalize: question_answer may be letter (old) or position (new)
                                                            const rawCorrect = String(q.question_answer || '').trim();
                                                            const correctPos = isMCQ
                                                                ? (letterToPosition(rawCorrect, lang) ?? rawCorrect.toLowerCase())
                                                                : rawCorrect.toLowerCase();
                                                            const isCorrect = givenPos !== '' && givenPos === correctPos;
                                                            const isWrong = givenPos !== '' && givenPos !== correctPos;
                                                            const colorClass = isCorrect ? 'border-green-400 bg-green-50 focus:ring-green-200' : isWrong ? 'border-red-400 bg-red-50 focus:ring-red-200' : 'border-[#dbe4f0] focus:border-[#1d4ed8] focus:ring-blue-100';
                                                            const choiceLetters = CHOICE_LETTERS[lang] ?? CHOICE_LETTERS.en;
                                                            return (
                                                                <td key={q.questionid} className="py-3 px-4 text-center">
                                                                    {q.question_type === 'true_false' ? (
                                                                        <select
                                                                            value={currentAnswer}
                                                                            onChange={(e) => handleStudentAnswerChange(student.studentid, q.questionid, e.target.value)}
                                                                            disabled={isManualEntryLocked}
                                                                            className={`h-10 px-2 font-bold text-[#0f172a] border rounded-lg outline-none focus:ring-2 disabled:opacity-60 disabled:cursor-not-allowed ${colorClass}`}
                                                                        >
                                                                            <option value="">—</option>
                                                                            <option value="True">{isAr ? 'صح' : 'True'}</option>
                                                                            <option value="False">{isAr ? 'خطأ' : 'False'}</option>
                                                                        </select>
                                                                    ) : q.question_type === 'multiple_choice' ? (
                                                                        <select
                                                                            value={currentAnswer}
                                                                            onChange={(e) => handleStudentAnswerChange(student.studentid, q.questionid, e.target.value)}
                                                                            disabled={isManualEntryLocked}
                                                                            className={`h-10 px-2 font-bold text-[#0f172a] border rounded-lg outline-none focus:ring-2 disabled:opacity-60 disabled:cursor-not-allowed ${colorClass}`}
                                                                        >
                                                                            <option value="">—</option>
                                                                            {Array.from({ length: q.num_choices || 4 }, (_, ci) => {
                                                                                const letter = choiceLetters[ci] ?? CHOICE_LETTERS.en[ci];
                                                                                return <option key={ci} value={letter}>{letter}</option>;
                                                                            })}
                                                                        </select>
                                                                    ) : (
                                                                        <input
                                                                            type="text"
                                                                            value={currentAnswer}
                                                                            onChange={(e) => handleStudentAnswerChange(student.studentid, q.questionid, e.target.value)}
                                                                            disabled={isManualEntryLocked}
                                                                            placeholder={isAr ? 'المطابقة' : 'Match'}
                                                                            className={`w-24 h-10 text-center font-bold text-[#0f172a] border rounded-lg outline-none focus:ring-2 disabled:opacity-60 disabled:cursor-not-allowed ${colorClass}`}
                                                                        />
                                                                    )}
                                                                </td>
                                                            );
                                                        }
                                                        const qErr = markErrors?.[student.studentid]?.[q.questionid];
                                                        return (
                                                            <td key={q.questionid} className="py-3 px-4 text-center">
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    max={q.question_marks}
                                                                    step="0.25"
                                                                    value={marks?.[student.studentid]?.[q.questionid] ?? ''}
                                                                    onChange={(event) => handleMarkChange(student.studentid, q.questionid, event.target.value)}
                                                                    disabled={isManualEntryLocked}
                                                                    className={`w-20 h-10 text-center font-bold text-[#0f172a] border rounded-lg outline-none focus:ring-2 disabled:opacity-60 disabled:cursor-not-allowed ${qErr ? 'border-red-400 bg-red-50 focus:ring-red-200' : 'border-[#dbe4f0] focus:border-[#1d4ed8] focus:ring-blue-100'}`}
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

                                <div className="flex justify-end">
                                    <button
                                        type="button"
                                        onClick={() => setConfirm({ open: true, action: 'save' })}
                                        disabled={saving || isManualEntryLocked}
                                        className="px-6 py-2.5 bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-lg text-sm font-bold flex items-center gap-2 disabled:opacity-60"
                                    >
                                        {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> {t('saving', lang)}</> : <><Save className="h-4 w-4" /> {t('saveAllChanges', lang)}</>}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

        {csvErrorModal.show && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center">
                <div className="absolute inset-0 bg-black/40" onClick={() => setCsvErrorModal(p => ({ ...p, show: false }))} />
                <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-3xl mx-4 overflow-hidden flex flex-col" style={{ maxHeight: '80vh' }}>
                    <div className="flex items-center justify-between px-6 py-4 bg-red-50 border-b border-red-200">
                        <div>
                            <h3 className="text-base font-bold text-red-700">
                                {csvErrorModal.errors.length} Invalid Mark Value{csvErrorModal.errors.length !== 1 ? 's' : ''} — Nothing was uploaded
                            </h3>
                            <p className="text-xs text-red-500 mt-0.5">Fix the values below in your CSV file and re-upload.</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={async () => {
                                    const XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs');
                                    const errorRows = csvErrorModal.errors.map(e => ({
                                        'Student': e.studentName,
                                        'Question': e.qLabel,
                                        'Entered Value': e.entered,
                                        'Max Allowed': e.max,
                                        'Issue': e.reason,
                                    }));
                                    const ws = XLSX.utils.json_to_sheet(errorRows);
                                    const wb = XLSX.utils.book_new();
                                    XLSX.utils.book_append_sheet(wb, ws, 'Mark Errors');
                                    XLSX.writeFile(wb, 'marks_upload_errors.xlsx');
                                }}
                                className="px-3 py-1.5 rounded-lg bg-white border border-red-200 text-xs font-bold text-red-600 hover:bg-red-50"
                            >
                                Download Excel
                            </button>
                            <button onClick={() => setCsvErrorModal(p => ({ ...p, show: false }))} className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-100">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                    <div className="overflow-y-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-red-50 sticky top-0">
                                <tr>
                                    <th className="px-4 py-3 text-xs font-bold text-red-700 uppercase">Student</th>
                                    <th className="px-4 py-3 text-xs font-bold text-red-700 uppercase w-24">Question</th>
                                    <th className="px-4 py-3 text-xs font-bold text-red-700 uppercase w-28">Entered</th>
                                    <th className="px-4 py-3 text-xs font-bold text-red-700 uppercase w-28">Max Allowed</th>
                                    <th className="px-4 py-3 text-xs font-bold text-red-700 uppercase">Issue</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-red-100">
                                {csvErrorModal.errors.map((e, i) => (
                                    <tr key={i} className="hover:bg-red-50">
                                        <td className="px-4 py-3 font-semibold text-[#0f172a]">{e.studentName}</td>
                                        <td className="px-4 py-3 font-bold text-[#1d4ed8]">{e.qLabel}</td>
                                        <td className="px-4 py-3 text-red-600 font-mono">{e.entered}</td>
                                        <td className="px-4 py-3 text-[#475569]">{e.max}</td>
                                        <td className="px-4 py-3 text-red-600">{e.reason}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}

        <ConfirmDialog
            open={confirm.open}
            title={confirm.action === 'upload' ? (isAr ? 'رفع الدرجات؟' : 'Upload Grades?') : (isAr ? 'حفظ الدرجات؟' : 'Save Marks?')}
            message={confirm.action === 'upload'
                ? (isAr ? 'سيتم معالجة الملف المرفوع وحفظ جميع الدرجات في قاعدة البيانات.' : 'The uploaded file will be processed and all marks saved to the database.')
                : (isAr ? 'سيتم حفظ جميع الدرجات المدخلة في قاعدة البيانات.' : 'All entered marks will be saved to the database.')}
            confirmLabel={confirm.action === 'upload' ? (isAr ? 'رفع' : 'Upload') : (isAr ? 'حفظ' : 'Save')}
            cancelLabel={isAr ? 'إلغاء' : 'Cancel'}
            variant="primary"
            loading={confirm.action === 'upload' ? uploading : saving}
            onConfirm={() => { setConfirm({ open: false }); confirm.action === 'upload' ? handleUpload() : handleSaveManual(); }}
            onCancel={() => setConfirm({ open: false })}
        />
        </div>
    );
}