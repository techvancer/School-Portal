import { t, getField, getStudentName as _getStudentName, CHOICE_LETTERS, letterToPosition } from '../lib/langHelper';
import { useLang } from '../context/LanguageContext';
import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Save, Loader2 } from 'lucide-react';
import Breadcrumb from '../components/Breadcrumb';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { rest, insert, dbQuery } from '../lib/supabaseClient';





export default function CreateExam() {
    const { lang, isAr } = useLang();

  const navigate = useNavigate();
  const location = useLocation();
  const { addToast } = useToast();
  const { user } = useAuth();
  const backPath = user?.role === 'Admin' ? '/admin/exams' : '/exams';
  const prefill = location.state?.prefill || {};

  const [mySections, setMySections] = useState([]);
  const [examTypes, setExamTypes] = useState([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [duplicateWarning, setDuplicateWarning] = useState(false);
  const [examMode, setExamMode] = useState('normal'); // 'normal' | 'auto_graded'

  const [formData, setFormData] = useState({
    classid: prefill.classid && prefill.classid !== 'All' ? String(prefill.classid) : '',
    sectionid: prefill.sectionid && prefill.sectionid !== 'All' ? String(prefill.sectionid) : '',
    subjectid: prefill.subjectid && prefill.subjectid !== 'All' ? String(prefill.subjectid) : '',
    examid: prefill.examid && prefill.examid !== 'All' ? String(prefill.examid) : '',
    questionCount: '',
    questions: []
  });

  useEffect(() => {
    if (!user?.employeeid || !user?.schoolid || !user?.branchid) return;

    let ignore = false;

    const loadTeacherAssignments = async () => {
      try {
        const [empSecSub, clTbl, secTbl, subTbl, examTbl] = await Promise.all([
          rest('employees_sections_subjects_classes_semisters_curriculums_tbl', {
            employeeid: `eq.${user.employeeid}`,
            schoolid: `eq.${user.schoolid}`,
            branchid: `eq.${user.branchid}`,
            select: '*'
          }),
          rest('classes_tbl', { select: '*' }),
          rest('sections_tbl', { select: '*' }),
          rest('subjects_tbl', { select: '*' }),
          rest('exams_tbl', { select: '*' })
        ]);

        const assignmentRows = Array.isArray(empSecSub) ? empSecSub : [];
        const classesRows = Array.isArray(clTbl) ? clTbl : [];
        const sectionsRows = Array.isArray(secTbl) ? secTbl : [];
        const subjectsRows = Array.isArray(subTbl) ? subTbl : [];
        const examsRows = Array.isArray(examTbl) ? examTbl : [];

        const unique = [];
        const seen = new Set();

        for (const r of assignmentRows) {
          const key = [
            r.employeeid,
            r.schoolid,
            r.branchid,
            r.classid,
            r.sectionid,
            r.subjectid,
            r.semisterid,
            r.curriculumid,
            r.divisionid,
            r.stageid,
            r.yearid
          ].join('-');

          if (seen.has(key)) continue;
          seen.add(key);

          const cl = classesRows.find(c => String(c.classid) === String(r.classid));
          const sec = sectionsRows.find(s => String(s.sectionid) === String(r.sectionid));
          const sub = subjectsRows.find(s => String(s.subjectid) === String(r.subjectid));

          const rawClassName = getField(cl, 'classname', 'classname_en', lang) || cl?.classname || '';
          const classLabel = rawClassName && /^\d+$/.test(String(rawClassName))
            ? `Classes ${rawClassName}`
            : (rawClassName || `Classes ${r.classid}`);

          unique.push({
            ...r,
            classname: classLabel,
            sectionname: getField(sec, 'sectionname', 'sectionname_en', lang) || sec?.sectionname || `Section ${r.sectionid}`,
            subjectname: getField(sub, 'subjectname', 'Subjectname_en', lang) || sub?.subjectname_en || getField(sub, 'subjectname', 'Subjectname_en', lang) || sub?.subjectname || `Subject ${r.subjectid}`
          });
        }

        if (!ignore) {
          setMySections(unique);
          setExamTypes(examsRows);

          // Auto-select if only one option available (and not already prefilled)
          setFormData(prev => {
            const next = { ...prev };
            // Auto-select class if only one
            const classIds = [...new Set(unique.map(r => String(r.classid)))];
            if (classIds.length === 1 && !next.classid) next.classid = classIds[0];

            // Auto-select section if only one for the class
            const secIds = [...new Set(unique.filter(r => String(r.classid) === next.classid).map(r => String(r.sectionid)))];
            if (secIds.length === 1 && !next.sectionid) next.sectionid = secIds[0];

            // Auto-select subject if only one for class+section
            const subIds = [...new Set(unique.filter(r => String(r.classid) === next.classid && String(r.sectionid) === next.sectionid).map(r => String(r.subjectid)))];
            if (subIds.length === 1 && !next.subjectid) next.subjectid = subIds[0];

            // Auto-select exam if only one
            if (examsRows.length === 1 && !next.examid) next.examid = String(examsRows[0].examid);

            return next;
          });
        }
      } catch (err) {
        console.error('CreateExam loadTeacherAssignments error:', err);
        if (!ignore) {
          setMySections([]);
          setExamTypes([]);
        }
      }
    };

    loadTeacherAssignments();

  return () => {
      ignore = true;
    };
  }, [user, lang]);

  const classOptions = useMemo(() => {
    const map = new Map();
    mySections.forEach(r => {
      if (!map.has(String(r.classid))) {
        map.set(String(r.classid), { value: String(r.classid), label: r.classname || '' });
      }
    });
    return Array.from(map.values());
  }, [mySections]);

  const sectionOptions = useMemo(() => {
    const map = new Map();
    mySections
      .filter(r => !formData.classid || String(r.classid) === String(formData.classid))
      .forEach(r => {
        if (!map.has(String(r.sectionid))) {
          map.set(String(r.sectionid), { value: String(r.sectionid), label: r.sectionname });
        }
      });
    return Array.from(map.values());
  }, [mySections, formData.classid]);

  const subjectOptions = useMemo(() => {
    const map = new Map();
    mySections
      .filter(r => (!formData.classid || String(r.classid) === String(formData.classid)) &&
                   (!formData.sectionid || String(r.sectionid) === String(formData.sectionid)))
      .forEach(r => {
        if (!map.has(String(r.subjectid))) {
          map.set(String(r.subjectid), { value: String(r.subjectid), label: r.subjectname });
        }
      });
    return Array.from(map.values());
  }, [mySections, formData.classid, formData.sectionid]);

  const selectedAssignment = useMemo(() => (
    mySections.find(r =>
      String(r.classid) === String(formData.classid) &&
      String(r.sectionid) === String(formData.sectionid) &&
      String(r.subjectid) === String(formData.subjectid)
    ) || null
  ), [mySections, formData.classid, formData.sectionid, formData.subjectid]);

  const checkDuplicate = async (classid, sectionid, subjectid, examid) => {
    if (!classid || !sectionid || !subjectid || !examid || !user) {
      setDuplicateWarning(false);
      return;
    }
    const assignment = mySections.find(r =>
      String(r.classid) === String(classid) &&
      String(r.sectionid) === String(sectionid) &&
      String(r.subjectid) === String(subjectid)
    );
    if (!assignment) { setDuplicateWarning(false); return; }
    try {
      const rows = await dbQuery(
        `questions_exams_employee_subjects_sections_tbl?examid=eq.${examid}&employeeid=eq.${user.employeeid}&classid=eq.${assignment.classid}&sectionid=eq.${assignment.sectionid}&subjectid=eq.${assignment.subjectid}&status=in.(new,marked,submitted,inprogress,completed)&select=questionid&limit=1`
      );
      setDuplicateWarning(Array.isArray(rows) && rows.length > 0);
    } catch { setDuplicateWarning(false); }
  };

  const setField = (field, value) => {
    setFormData(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'classid') {
        next.sectionid = '';
        next.subjectid = '';
        next.examid = '';
      }
      if (field === 'sectionid') {
        next.subjectid = '';
        next.examid = '';
      }
      if (field === 'subjectid') {
        next.examid = '';
      }
      // Run duplicate check after state update
      const newClassid  = next.classid;
      const newSection  = next.sectionid;
      const newSubject  = next.subjectid;
      const newExam     = next.examid;
      setTimeout(() => checkDuplicate(newClassid, newSection, newSubject, newExam), 0);
      return next;
    });
    setDuplicateWarning(false);
  };

  const handleGenerateQuestions = () => {
    const count = parseInt(formData.questionCount, 10);
    const nextErrors = {};
    if (!formData.classid) nextErrors.classid = isAr ? 'اختر الصف' : 'Select a class';
    if (!formData.sectionid) nextErrors.sectionid = isAr ? 'اختر الشعبة' : 'Select a section';
    if (!formData.subjectid) nextErrors.subjectid = isAr ? 'اختر المادة' : 'Select a subject';
    if (!formData.examid) nextErrors.examid = isAr ? 'اختر نوع الامتحان' : 'Select an exam type';
    if (!count || count < 1) nextErrors.questionCount = 'Enter a valid number of questions';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setFormData(prev => ({
      ...prev,
      questions: Array.from({ length: count }, (_, i) => ({
        id: i + 1,
        questionMark: prev.questions[i]?.questionMark || '',
        videoUrl: prev.questions[i]?.videoUrl || '',
        questionType: prev.questions[i]?.questionType || 'multiple_choice',
        correctAnswer: prev.questions[i]?.correctAnswer || '',
        numChoices: prev.questions[i]?.numChoices || 4,
      }))
    }));
  };

  const updateQuestion = (idx, value) => {
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) => i === idx ? { ...q, videoUrl: value } : q)
    }));
  };

  const updateQuestionMark = (idx, value) => {
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) => i === idx ? { ...q, questionMark: value } : q)
    }));
  };

  const updateQuestionType = (idx, value) => {
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) => i === idx ? { ...q, questionType: value } : q)
    }));
  };

  const updateCorrectAnswer = (idx, value) => {
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) => i === idx ? { ...q, correctAnswer: value } : q)
    }));
  };

  const updateNumChoices = (idx, value) => {
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) => i === idx ? { ...q, numChoices: parseInt(value, 10) || 4, correctAnswer: '' } : q)
    }));
  };

  const validateBeforeSave = () => {
    const e = {};
    if (!formData.classid) e.classid = 'Select a class';
    if (!formData.sectionid) e.sectionid = 'Select a section';
    if (!formData.subjectid) e.subjectid = 'Select a subject';
    if (!formData.examid) e.examid = 'Select an exam type';
    if (!formData.questions.length) e.questions = 'Press Add to generate the questions table';
    // Validate every question mark is filled and > 0
    const missingMarks = formData.questions
        .map((q, i) => ({ idx: i, val: q.questionMark }))
        .filter(({ val }) => val === '' || val === undefined || val === null || parseFloat(val) <= 0);
    if (missingMarks.length > 0) {
        e.questionMarks = missingMarks.map(m => m.idx);
    }
    if (examMode === 'auto_graded') {
        const missingAnswers = formData.questions
            .map((q, i) => ({ idx: i, val: q.correctAnswer }))
            .filter(({ val }) => !val || !String(val).trim());
        if (missingAnswers.length > 0) {
            e.correctAnswers = missingAnswers.map(m => m.idx);
        }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateBeforeSave() || !selectedAssignment) return;
    setSaving(true);
    try {
      // ── Check for duplicate: same teacher + exam + class + section + subject ──
      const dupRows = await dbQuery(
        `questions_exams_employee_subjects_sections_tbl?examid=eq.${formData.examid}&employeeid=eq.${user.employeeid}&classid=eq.${selectedAssignment.classid}&sectionid=eq.${selectedAssignment.sectionid}&subjectid=eq.${selectedAssignment.subjectid}&status=in.(new,marked,submitted,inprogress,completed)&select=questionid&limit=1`
      );
      if (dupRows?.length > 0) {
        addToast('You have already created this exam for this class, section and subject. You cannot add it again.', 'error');
        setSaving(false);
        return;
      }

      // Find the highest attempt_number for this teacher+exam+class+section+subject
      // so the new attempt is always max + 1 (preserving all old attempts in the DB)
      const attemptRows = await dbQuery(
        `questions_exams_employee_subjects_sections_tbl?examid=eq.${formData.examid}&employeeid=eq.${user.employeeid}&classid=eq.${selectedAssignment.classid}&sectionid=eq.${selectedAssignment.sectionid}&subjectid=eq.${selectedAssignment.subjectid}&select=attempt_number&order=attempt_number.desc&limit=1`
      );
      const nextAttempt = attemptRows?.length > 0 ? (parseInt(attemptRows[0].attempt_number, 10) || 1) + 1 : 1;

      const base = {
        examid: parseInt(formData.examid, 10),
        employeeid: user.employeeid,
        subjectid: selectedAssignment.subjectid,
        sectionid: selectedAssignment.sectionid,
        classid: selectedAssignment.classid,
        semisterid: selectedAssignment.semisterid || 1,
        yearid: selectedAssignment.yearid || 2026,
        stageid: selectedAssignment.stageid,
        curriculumid: selectedAssignment.curriculumid || 1,
        divisionid: selectedAssignment.divisionid || 1,
        branchid: user.branchid,
        schoolid: user.schoolid,
        attempt_number: nextAttempt,
      };

      let nextQid = 1;

      for (const q of formData.questions) {
        // Upsert into questions_tbl first to satisfy FK constraint
        await dbQuery(
          `questions_tbl?on_conflict=questionid,examid`,
          'POST',
          { questionid: nextQid, questionname: `Q${nextQid}`, notes: null, examid: base.examid },
          'resolution=ignore-duplicates,return=minimal'
        );
        // Plain insert — attempt_number makes this a unique new row
        await dbQuery(
          `questions_exams_employee_subjects_sections_tbl`,
          'POST',
          {
            ...base,
            questionid: nextQid,
            typeid: 1,
            question_marks: parseFloat(q.questionMark),
            video_url: q.videoUrl || null,
            question_type: q.questionType || 'multiple_choice',
            notes: null,
            status: 'new',
            exam_type: examMode,
            num_choices: examMode === 'auto_graded' && q.questionType === 'multiple_choice' ? (q.numChoices || 4) : null,
            question_answer: examMode === 'auto_graded'
              ? (q.questionType === 'multiple_choice'
                  ? (letterToPosition(q.correctAnswer, lang) || null)
                  : (String(q.correctAnswer || '').trim() || null))
              : null,
          },
          'return=minimal'
        );
        nextQid++;
      }

      const students = await rest('students_sections_classes_tbl', {
        classid: `eq.${selectedAssignment.classid}`,
        sectionid: `eq.${selectedAssignment.sectionid}`,
        schoolid: `eq.${user.schoolid}`,
        branchid: `eq.${user.branchid}`,
        select: 'studentid',
      });

      for (const stu of students || []) {
        const existing = await rest('students_exams_employees_section_subjects_classes_semisters_cur', {
          studentid: `eq.${stu.studentid}`,
          examid: `eq.${base.examid}`,
          employeeid: `eq.${user.employeeid}`,
          classid: `eq.${selectedAssignment.classid}`,
          sectionid: `eq.${selectedAssignment.sectionid}`,
          subjectid: `eq.${selectedAssignment.subjectid}`,
          select: 'studentid',
        });
        if (!existing?.length) {
          const { attempt_number: _a, ...baseWithoutAttempt } = base;
          await insert('students_exams_employees_section_subjects_classes_semisters_cur', {
            ...baseWithoutAttempt,
            studentid: stu.studentid,
          });
        }
      }

      addToast(`Exam created with ${formData.questions.length} question(s).`, 'success');
      navigate(backPath, { replace: true });
    } catch (e) {
      addToast(e.message || 'Failed to create exam', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-5xl">
      <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#0f172a]">{isAr ? 'إنشاء امتحان جديد' : 'Create New Exam'}</h1>
          <p className="text-[#64748b] text-sm">{isAr ? 'حدد تفاصيل الامتحان واختر عدد الأسئلة ثم أضف روابط الفيديو الاختيارية.' : 'Set the exam details, choose how many questions it has, then add optional video URLs.'}</p>
          <Breadcrumb />
      </div>

      {/* Exam Mode Toggle */}
      <div className="bg-white rounded-xl border border-[#e2e8f0] p-5 flex items-center gap-8">
        <span className="text-xs font-bold text-[#64748b] uppercase tracking-wide shrink-0">{isAr ? 'نمط الامتحان' : 'Exam Mode'}</span>
        <div className="flex gap-6">
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input type="radio" name="examMode" value="normal" checked={examMode === 'normal'} onChange={() => { setExamMode('normal'); setFormData(p => ({ ...p, questions: p.questions.map(q => ({ ...q, correctAnswer: '' })) })); }} className="accent-blue-600 h-4 w-4" />
            <span className="text-sm font-semibold text-[#0f172a]">{isAr ? 'عادي' : 'Normal'}</span>
            <span className="text-xs text-[#64748b]">{isAr ? '— كل أنواع الأسئلة' : '— all question types, manual grading'}</span>
          </label>
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input type="radio" name="examMode" value="auto_graded" checked={examMode === 'auto_graded'} onChange={() => { setExamMode('auto_graded'); setFormData(p => ({ ...p, questions: p.questions.map(q => ({ ...q, questionType: q.questionType === 'essay' ? 'multiple_choice' : q.questionType })) })); }} className="accent-blue-600 h-4 w-4" />
            <span className="text-sm font-semibold text-[#0f172a]">{isAr ? 'تصحيح تلقائي' : 'Auto-Graded'}</span>
            <span className="text-xs text-[#64748b]">{isAr ? '— MCQ / صح-خطأ / مطابقة' : '— MCQ / True-False / Matching, auto-scored'}</span>
          </label>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-bold text-[#64748b] uppercase mb-1.5">{isAr ? 'الصف' : 'Class'}</label>
            <select
              className={`input-field h-10 w-full ${errors.classid ? 'border-red-400' : ''}`}
              value={formData.classid}
              onChange={e => setField('classid', e.target.value)}
            >
              <option value="">{t('selectClass', lang)}</option>
              {classOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {errors.classid && <p className="text-xs text-red-500 mt-1">{errors.classid}</p>}
          </div>

          <div>
            <label className="block text-xs font-bold text-[#64748b] uppercase mb-1.5">{isAr ? 'الشعبة' : 'Section'}</label>
            <select
              className={`input-field h-10 w-full ${errors.sectionid ? 'border-red-400' : ''}`}
              value={formData.sectionid}
              onChange={e => setField('sectionid', e.target.value)}
              disabled={!formData.classid}
            >
              <option value="">{t('selectSection', lang)}</option>
              {sectionOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {errors.sectionid && <p className="text-xs text-red-500 mt-1">{errors.sectionid}</p>}
          </div>

          <div>
            <label className="block text-xs font-bold text-[#64748b] uppercase mb-1.5">{isAr ? 'المادة' : 'Subject'}</label>
            <select
              className={`input-field h-10 w-full ${errors.subjectid ? 'border-red-400' : ''}`}
              value={formData.subjectid}
              onChange={e => setField('subjectid', e.target.value)}
              disabled={!formData.sectionid}
            >
              <option value="">{t('selectSubject', lang)}</option>
              {subjectOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {errors.subjectid && <p className="text-xs text-red-500 mt-1">{errors.subjectid}</p>}
          </div>

          <div>
            <label className="block text-xs font-bold text-[#64748b] uppercase mb-1.5">{isAr ? 'نوع الامتحان' : 'Exam Type'}</label>
            <select
              className={`input-field h-10 w-full ${errors.examid ? 'border-red-400' : duplicateWarning ? 'border-amber-400' : ''}`}
              value={formData.examid}
              onChange={e => setField('examid', e.target.value)}
              disabled={!formData.subjectid}
            >
              <option value="">{t('selectExam', lang)}</option>
              {examTypes.map(ex => (
                <option key={ex.examid} value={ex.examid}>{getField(ex, 'examname', 'examname_en', lang) || ex.examname || `Exam ${ex.examid}`}</option>
              ))}
            </select>
            {errors.examid && <p className="text-xs text-red-500 mt-1">{errors.examid}</p>}
            {duplicateWarning && !errors.examid && (
              <p className="text-xs text-amber-600 mt-1 font-medium">{isAr ? '⚠ لقد قمت بإنشاء هذا الامتحان مسبقاً للصف والشعبة والمادة المحددة.' : '⚠ You have already created this exam for the selected class, section and subject.'}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-end">
          <div>
            <label className="block text-xs font-bold text-[#64748b] uppercase mb-1.5">{isAr ? 'كم عدد أسئلة هذا الامتحان؟' : 'How many questions for this exam?'}</label>
            <input
              type="number"
              min="1"
              value={formData.questionCount}
              onChange={e => setField('questionCount', e.target.value)}
              className={`input-field h-10 w-full ${errors.questionCount ? 'border-red-400' : ''}`}
              placeholder={isAr ? 'أدخل العدد هنا' : 'Answer here'}
            />
            {errors.questionCount && <p className="text-xs text-red-500 mt-1">{errors.questionCount}</p>}
          </div>

          <button
            type="button"
            onClick={handleGenerateQuestions}
            className="px-6 h-10 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors"
          >
            {isAr ? 'إضافة' : 'Add'}
          </button>
        </div>

        {selectedAssignment && (
          <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-[#1d4ed8] font-medium">
            {selectedAssignment.classname} · {isAr ? 'الشعبة' : 'Section'} {selectedAssignment.sectionname} · {selectedAssignment.subjectname}
          </div>
        )}
      </div>

      {formData.questions.length > 0 && (
        <div className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between">
            <div>
              <h2 className="font-bold text-[#0f172a] text-base">{isAr ? 'جدول الأسئلة' : 'Questions Table'}</h2>
              <p className="text-sm text-[#64748b]">{isAr ? 'أدخل رابط فيديو يوتيوب لأي سؤال إذا لزم الأمر.' : 'Enter a YouTube video URL for any question if needed.'}</p>
            </div>
            <span className="text-sm font-semibold text-[#1d4ed8]">{formData.questions.length} {isAr ? 'أسئلة' : 'Questions'}</span>
          </div>

          {errors.questions && <p className="text-sm text-red-500 px-6 pt-4">{errors.questions}</p>}

          <div className="overflow-x-auto" dir={isAr ? 'rtl' : 'ltr'}>
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 uppercase text-xs tracking-wide">
                <tr>
                  <th className="text-left px-6 py-3 w-32">{isAr ? 'السؤال' : 'Question'}</th>
                  <th className="text-left px-6 py-3 w-40 whitespace-nowrap">{isAr ? 'درجة السؤال' : 'Question Mark'} <span className="text-red-500">*</span></th>
                  <th className="text-left px-6 py-3 w-44 whitespace-nowrap">{isAr ? 'نوع السؤال' : 'Question Type'}</th>
                  {examMode === 'auto_graded' && (
                    <>
                      <th className="text-left px-6 py-3 w-32 whitespace-nowrap">{isAr ? 'عدد الخيارات' : 'No. of Choices'}</th>
                      <th className="text-left px-6 py-3 w-44 whitespace-nowrap">{isAr ? 'الإجابة الصحيحة' : 'Correct Answer'} <span className="text-red-500">*</span></th>
                    </>
                  )}
                  <th className="text-left px-6 py-3">{isAr ? 'رابط يوتيوب (اختياري)' : 'YouTube Video URL (Optional)'}</th>
                </tr>
              </thead>
              <tbody>
                {formData.questions.map((q, idx) => (
                  <tr key={q.id} className="border-t border-[#e2e8f0]">
                    <td className="px-6 py-3 font-bold text-[#0f172a]">{isAr ? `س${idx + 1}` : `Q${idx + 1}`}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0.25"
                          step="0.25"
                          value={q.questionMark}
                          onChange={e => updateQuestionMark(idx, e.target.value)}
                          placeholder="e.g. 5"
                          className={`input-field h-10 w-full text-sm ${errors.questionMarks?.includes(idx) ? 'border-red-400 bg-red-50' : ''}`}
                        />
                        {errors.questionMarks?.includes(idx) && (
                          <span className="text-red-500 font-bold text-sm shrink-0">*</span>
                        )}
                      </div>
                      {errors.questionMarks?.includes(idx) && (
                        <p className="text-xs text-red-500 mt-1 font-medium">{isAr ? 'مطلوب' : 'Required'}</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={q.questionType || 'multiple_choice'}
                        onChange={e => updateQuestionType(idx, e.target.value)}
                        className="input-field h-10 w-full text-sm"
                      >
                        {examMode === 'auto_graded' ? (
                          <>
                            <option value="multiple_choice">{isAr ? 'اختيار من متعدد' : 'MCQ'}</option>
                            <option value="true_false">{isAr ? 'صح / خطأ' : 'True / False'}</option>
                            <option value="matching">{isAr ? 'مطابقة' : 'Matching'}</option>
                          </>
                        ) : (
                          <>
                            <option value="multiple_choice">{isAr ? 'اختيار من متعدد' : 'Multiple Choice'}</option>
                            <option value="essay">{isAr ? 'مقالي' : 'Essay'}</option>
                            <option value="true_false">{isAr ? 'صح/خطأ' : 'True/False'}</option>
                          </>
                        )}
                      </select>
                    </td>
                    {examMode === 'auto_graded' && (
                      <>
                        <td className="px-6 py-4">
                          {q.questionType === 'multiple_choice' ? (
                            <select
                              value={q.numChoices || 4}
                              onChange={e => updateNumChoices(idx, e.target.value)}
                              className="input-field h-10 w-full text-sm"
                            >
                              {[2, 3, 4, 5, 6].map(n => (
                                <option key={n} value={n}>{n}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-sm text-[#94a3b8]">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1">
                            {q.questionType === 'multiple_choice' ? (
                              <select
                                value={q.correctAnswer}
                                onChange={e => updateCorrectAnswer(idx, e.target.value)}
                                className={`input-field h-10 w-full text-sm ${errors.correctAnswers?.includes(idx) ? 'border-red-400 bg-red-50' : ''}`}
                              >
                                <option value="">—</option>
                                {Array.from({ length: q.numChoices || 4 }, (_, ci) => {
                                  const letter = CHOICE_LETTERS[lang]?.[ci] ?? CHOICE_LETTERS.en[ci];
                                  return <option key={ci} value={letter}>{letter}</option>;
                                })}
                              </select>
                            ) : q.questionType === 'true_false' ? (
                              <select
                                value={q.correctAnswer}
                                onChange={e => updateCorrectAnswer(idx, e.target.value)}
                                className={`input-field h-10 w-full text-sm ${errors.correctAnswers?.includes(idx) ? 'border-red-400 bg-red-50' : ''}`}
                              >
                                <option value="">—</option>
                                <option value="True">{isAr ? 'صح' : 'True'}</option>
                                <option value="False">{isAr ? 'خطأ' : 'False'}</option>
                              </select>
                            ) : (
                              <input
                                type="text"
                                value={q.correctAnswer}
                                onChange={e => updateCorrectAnswer(idx, e.target.value)}
                                placeholder={isAr ? 'الإجابة الصحيحة' : 'Correct match'}
                                className={`input-field h-10 w-full text-sm ${errors.correctAnswers?.includes(idx) ? 'border-red-400 bg-red-50' : ''}`}
                              />
                            )}
                            {errors.correctAnswers?.includes(idx) && (
                              <span className="text-red-500 font-bold text-sm shrink-0">*</span>
                            )}
                          </div>
                          {errors.correctAnswers?.includes(idx) && (
                            <p className="text-xs text-red-500 mt-1 font-medium">{isAr ? 'مطلوب' : 'Required'}</p>
                          )}
                        </td>
                      </>
                    )}
                    <td className="px-6 py-4">
                      <input
                        type="url"
                        value={q.videoUrl}
                        onChange={e => updateQuestion(idx, e.target.value)}
                        placeholder="https://www.youtube.com/watch?v=..."
                        className="input-field h-10 w-full font-mono text-sm"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3">
        <button
          onClick={() => navigate(backPath)}
          className="px-6 py-2.5 border border-[#e2e8f0] rounded-lg text-sm font-bold text-[#475569] hover:bg-slate-50"
        >
          {isAr ? 'إلغاء' : 'Cancel'}
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="btn-primary px-8 py-2.5 flex items-center gap-2 shadow-md disabled:opacity-60"
        >
          {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> {isAr ? 'جاري الحفظ...' : 'Saving...'}</> : <><Save className="h-4 w-4" /> {isAr ? 'حفظ الامتحان' : 'Save Exam'}</>}
        </button>
      </div>
    </div>
  );
}