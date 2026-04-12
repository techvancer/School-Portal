import { t, getField, getStudentName as _getStudentName } from '../../lib/langHelper';
import { useLang } from '../../context/LanguageContext';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, ArrowLeft, UserPlus } from 'lucide-react';
import Breadcrumb from '../../components/Breadcrumb';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { rest, insert, nextId } from '../../lib/supabaseClient';
import { useSortable } from '../../lib/useSortable';
import { useColumnSearch } from '../../lib/useColumnSearch';
import SortableTh from '../../components/SortableTh';

const EMPTY = {
  studentfirstname_ar: '', studentfirstname_en: '',
  studentfathersname_ar: '', studentfathersname_en: '',
  studentgrandfathersname_ar: '', studentgrandfathersname_en: '',
  studentsurname_ar: '', studentsurname_en: '',
  studentemail: '', studentmobile: '',
  parentname_ar: '', parentname_en: '',
  parentemail: '', parentmobile: '', parent_position: '',
  classid: '', sectionid: '', stageid: '', divisionid: '', curriculumid: '',
};
const sanitizePhone = (value = '') => String(value).replace(/\D/g, '').slice(0, 10);
const isTenDigitPhone = (value = '') => /^\d{10}$/.test(String(value || '').trim());
const toEn = (v) => v.replace(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g, '');
const toAr = (v) => v.replace(/[a-zA-Z]/g, '');

export default function AdminEnrollStudent() {
    const { lang, isAr } = useLang();

  const { addToast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY);
  const [isLoading, setIsLoading] = useState(false);
  const [confirm, setConfirm] = useState({ open: false });
  const [loadingDropdowns, setLoadingDropdowns] = useState(true);

  const [classes, setClasses]           = useState([]);
  const [sections, setSections]         = useState([]);
  const [stages, setStages]             = useState([]);
  const [divisions, setDivisions]       = useState([]);
  const [curriculums, setCurriculums]   = useState([]);
  const [validCombos, setValidCombos]   = useState([]);

  const set = (k, v) => setForm(p => {
    const update = { ...p, [k]: v };
    // Reset dependent class fields when parent changes
    if (k === 'classid') { update.sectionid = ''; update.stageid = ''; update.divisionid = ''; update.curriculumid = ''; }
    if (k === 'sectionid') { update.stageid = ''; update.divisionid = ''; update.curriculumid = ''; }
    if (k === 'stageid') { update.divisionid = ''; update.curriculumid = ''; }
    if (k === 'divisionid') { update.curriculumid = ''; }
    // Auto-populate parent name from father + grandfather + surname
    const fatherAr = k === 'studentfathersname_ar' ? v : p.studentfathersname_ar;
    const grandfatherAr = k === 'studentgrandfathersname_ar' ? v : p.studentgrandfathersname_ar;
    const surnameAr = k === 'studentsurname_ar' ? v : p.studentsurname_ar;
    const fatherEn = k === 'studentfathersname_en' ? v : p.studentfathersname_en;
    const grandfatherEn = k === 'studentgrandfathersname_en' ? v : p.studentgrandfathersname_en;
    const surnameEn = k === 'studentsurname_en' ? v : p.studentsurname_en;
    update.parentname_ar = [fatherAr, grandfatherAr, surnameAr].filter(Boolean).join(' ');
    update.parentname_en = [fatherEn, grandfatherEn, surnameEn].filter(Boolean).join(' ');
    return update;
  });

  // Load all dropdown data on mount — independent of student filter
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const [clTbl, secRows, stgRows, divRows, curRows, combos] = await Promise.all([
          rest('classes_tbl', { select: '*' }),
          rest('sections_tbl', { select: '*' }),
          rest('stages_tbl', { schoolid: `eq.${user.schoolid}`, branchid: `eq.${user.branchid}`, select: '*' }),
          rest('divisions_tbl', { select: '*' }).catch(() => []),
          rest('curriculums_tbl', { select: '*' }).catch(() => []),
          rest('sections_classes_tbl', { schoolid: `eq.${user.schoolid}`, branchid: `eq.${user.branchid}`, select: 'classid,sectionid,stageid,divisionid,curriculumid' }),
        ]);
        setClasses(clTbl || []);
        setSections(secRows || []);
        setStages([...new Map((stgRows || []).map(s => [s.stageid, s])).values()]);
        setDivisions(divRows || []);
        setCurriculums(curRows || []);
        setValidCombos(combos || []);
      } catch (e) {
        addToast(t('failedToLoadForms', lang), 'error');
      } finally {
        setLoadingDropdowns(false);
      }
    })();
  }, [user, lang]);

  const handleSave = async () => {
    if ((!form.studentfirstname_en && !form.studentfirstname_ar) || !form.classid || !form.sectionid || !form.stageid) {
      addToast(t('studentFirstNameReq', lang), 'warning');
      return;
    }
    if ((form.studentmobile && !isTenDigitPhone(form.studentmobile)) || (form.parentmobile && !isTenDigitPhone(form.parentmobile))) {
      addToast('Phone numbers must be exactly 10 digits.', 'warning');
      return;
    }
    setIsLoading(true);
    try {
      const newStudentId = await nextId('students_tbl', 'studentid');
      const fullNameAr = [form.studentfirstname_ar, form.studentfathersname_ar, form.studentsurname_ar].filter(Boolean).join(' ');
      const fullNameEn = [form.studentfirstname_en, form.studentfathersname_en, form.studentsurname_en].filter(Boolean).join(' ');
      const [newStu] = await insert('students_tbl', {
        studentid:                  newStudentId,
        studentfirstname_ar:        form.studentfirstname_ar        || null,
        studentfirstname_en:        form.studentfirstname_en        || null,
        studentfathersname_ar:      form.studentfathersname_ar      || null,
        studentfathersname_en:      form.studentfathersname_en      || null,
        studentgrandfathersname_ar: form.studentgrandfathersname_ar || null,
        studentgrandfathersname_en: form.studentgrandfathersname_en || null,
        studentsurname_ar:          form.studentsurname_ar          || null,
        studentsurname_en:          form.studentsurname_en          || null,
        studentemail:               form.studentemail               || null,
        studentmobile:              form.studentmobile              || null,
        parentname_ar:              form.parentname_ar              || null,
        parentname_en:              form.parentname_en              || null,
        parentemail:                form.parentemail                || null,
        parentmobile:               form.parentmobile               || null,
        parent_position:            form.parent_position            || null,
      });
      await insert('students_sections_classes_tbl', {
        studentid:    newStu.studentid,
        classid:      parseInt(form.classid,      10),
        sectionid:    parseInt(form.sectionid,    10),
        stageid:      parseInt(form.stageid,      10),
        schoolid:     user.schoolid,
        branchid:     user.branchid,
        divisionid:   parseInt(form.divisionid   || user.divisionid   || 1, 10),
        curriculumid: parseInt(form.curriculumid || user.curriculumid || 1, 10),
      });
      addToast(t('studentEnrolledSuccess', lang), 'success');
      navigate('/admin/students');
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const inp  = 'input-field h-10 w-full text-sm';
  const sel  = 'input-field h-10 w-full text-sm';
  const lbl  = 'text-xs font-bold text-[#64748b] mb-1 block';
  const sect = 'text-xs font-black text-[#0f172a] uppercase tracking-wider pb-2 border-b border-[#e2e8f0] mb-4';

  if (loadingDropdowns) return (
    <div className="flex items-center justify-center py-32 text-[#94a3b8]">
      <Loader2 className="h-6 w-6 animate-spin mr-2" /> {t('loadingFormData', lang)}
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#0f172a]">{t('enrollNewStudent', lang)}</h1>
          <p className="text-[#64748b] text-sm">{t('fillStudentDetails', lang)}</p>
          <Breadcrumb />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-sm p-6 sm:p-8 space-y-8">

        {/* Student Name */}
        <div>
          <p className={sect}>{t('studentNameFields', lang)}</p>
          {/* English row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div><label className={lbl}>{t('firstNameEn', lang)} *</label><input className={inp} placeholder="First name" value={form.studentfirstname_en} onChange={e => set('studentfirstname_en', toEn(e.target.value))} /></div>
            <div><label className={lbl}>{t('fatherNameEn', lang)}</label><input className={inp} placeholder="Father's name" value={form.studentfathersname_en} onChange={e => set('studentfathersname_en', toEn(e.target.value))} /></div>
            <div><label className={lbl}>{t('grandfatherNameEn', lang)}</label><input className={inp} placeholder="Grandfather's name" value={form.studentgrandfathersname_en} onChange={e => set('studentgrandfathersname_en', toEn(e.target.value))} /></div>
            <div><label className={lbl}>{t('surnameEn', lang)}</label><input className={inp} placeholder="Surname" value={form.studentsurname_en} onChange={e => set('studentsurname_en', toEn(e.target.value))} /></div>
          </div>
          {/* Arabic row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
            <div><label className={lbl}>{t('firstNameAr', lang)}</label><input className={inp} dir="rtl" placeholder="الاسم الأول" value={form.studentfirstname_ar} onChange={e => set('studentfirstname_ar', toAr(e.target.value))} /></div>
            <div><label className={lbl}>{t('fatherNameAr', lang)}</label><input className={inp} dir="rtl" placeholder="اسم الأب" value={form.studentfathersname_ar} onChange={e => set('studentfathersname_ar', toAr(e.target.value))} /></div>
            <div><label className={lbl}>{t('grandfatherNameAr', lang)}</label><input className={inp} dir="rtl" placeholder="اسم الجد" value={form.studentgrandfathersname_ar} onChange={e => set('studentgrandfathersname_ar', toAr(e.target.value))} /></div>
            <div><label className={lbl}>{t('surnameAr', lang)}</label><input className={inp} dir="rtl" placeholder="اسم العائلة" value={form.studentsurname_ar} onChange={e => set('studentsurname_ar', toAr(e.target.value))} /></div>
          </div>
        </div>

        {/* Student Contact */}
        <div>
          <p className={sect}>{t('studentContact', lang)}</p>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>{t('email', lang)}</label><input className={inp} type="email" placeholder={isAr ? "بريد_الطالب@example.com" : "student@email.com"} value={form.studentemail} onChange={e => set('studentemail', e.target.value)} /></div>
            <div><label className={lbl}>{t('mobile', lang)}</label><input className={inp} placeholder="0791000001" type="tel" maxLength={10} minLength={10} pattern="\d{10}" inputMode="numeric" value={form.studentmobile} onChange={e => set('studentmobile', sanitizePhone(e.target.value))} onInput={(e) => { e.target.value = sanitizePhone(e.target.value); }} /></div>
          </div>
        </div>

        {/* Parent / Guardian */}
        <div>
          <p className={sect}>{t('parentGuardian', lang)}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div><label className={lbl}>{t('parentNameAr', lang)}</label><input className={`${inp} bg-slate-50 cursor-not-allowed`} dir="rtl" readOnly value={form.parentname_ar} /></div>
            <div><label className={lbl}>{t('parentNameEn', lang)}</label><input className={`${inp} bg-slate-50 cursor-not-allowed`} readOnly value={form.parentname_en} /></div>
            <div><label className={lbl}>{t('occupation', lang)}</label><input className={inp} placeholder="e.g. Government Employee" value={form.parent_position} onChange={e => set('parent_position', e.target.value)} /></div>
            <div><label className={lbl}>{t('parentEmail', lang)}</label><input className={inp} type="email" placeholder="parent@email.com" value={form.parentemail} onChange={e => set('parentemail', e.target.value)} /></div>
            <div><label className={lbl}>{t('parentMobile', lang)}</label><input className={inp} placeholder="0791100001" type="tel" maxLength={10} minLength={10} pattern="\d{10}" inputMode="numeric" value={form.parentmobile} onChange={e => set('parentmobile', sanitizePhone(e.target.value))} onInput={(e) => { e.target.value = sanitizePhone(e.target.value); }} /></div>
          </div>
        </div>

        {/* Class Assignment */}
        <div>
          <p className={sect}>{t('classAssignment', lang)} *</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <label className={lbl}>{t('class', lang)} *</label>
              <select className={sel} value={form.classid} onChange={e => set('classid', e.target.value)}>
                <option value="">{t('selectClass', lang)}</option>
                {[...new Map(validCombos.map(c => [c.classid, c])).values()].map(c => {
                  const cl = classes.find(x => x.classid === c.classid);
                  return <option key={c.classid} value={c.classid}>{t('class', lang)} {getField(cl, 'classname', 'classname_en', lang) || cl?.classname || c.classid}</option>;
                })}
              </select>
            </div>
            <div>
              <label className={lbl}>{t('section', lang)} *</label>
              <select className={sel} value={form.sectionid} onChange={e => set('sectionid', e.target.value)} disabled={!form.classid}>
                <option value="">{t('selectSection', lang)}</option>
                {[...new Map(validCombos.filter(c => String(c.classid) === String(form.classid)).map(c => [c.sectionid, c])).values()].map(c => {
                  const sec = sections.find(x => x.sectionid === c.sectionid);
                  return <option key={c.sectionid} value={c.sectionid}>{getField(sec, 'sectionname', 'sectionname_en', lang) || sec?.sectionname || c.sectionid}</option>;
                })}
              </select>
            </div>
            <div>
              <label className={lbl}>{t('stage', lang)} *</label>
              <select className={sel} value={form.stageid} onChange={e => set('stageid', e.target.value)} disabled={!form.sectionid}>
                <option value="">{t('selectStage', lang)}</option>
                {[...new Map(validCombos.filter(c => String(c.classid) === String(form.classid) && String(c.sectionid) === String(form.sectionid)).map(c => [c.stageid, c])).values()].map(c => {
                  const stg = stages.find(x => x.stageid === c.stageid);
                  return <option key={c.stageid} value={c.stageid}>{getField(stg, 'stagename', 'stagename_en', lang) || stg?.stagename || c.stageid}</option>;
                })}
              </select>
            </div>
            <div>
              <label className={lbl}>{t('division', lang)}</label>
              <select className={sel} value={form.divisionid} onChange={e => set('divisionid', e.target.value)} disabled={!form.stageid}>
                <option value="">{t('selectDivision', lang) || 'Select division'}</option>
                {[...new Map(validCombos.filter(c => String(c.classid) === String(form.classid) && String(c.sectionid) === String(form.sectionid) && String(c.stageid) === String(form.stageid)).map(c => [c.divisionid, c])).values()].map(c => {
                  const div = divisions.find(x => x.divisionid === c.divisionid);
                  return <option key={c.divisionid} value={c.divisionid}>{getField(div, 'divisionname', 'divisionname_en', lang) || div?.divisionname || c.divisionid}</option>;
                })}
              </select>
            </div>
            <div>
              <label className={lbl}>{t('curriculum', lang)}</label>
              <select className={sel} value={form.curriculumid} onChange={e => set('curriculumid', e.target.value)} disabled={!form.divisionid}>
                <option value="">{t('selectCurriculum', lang) || 'Select curriculum'}</option>
                {validCombos.filter(c => String(c.classid) === String(form.classid) && String(c.sectionid) === String(form.sectionid) && String(c.stageid) === String(form.stageid) && String(c.divisionid) === String(form.divisionid)).map(c => {
                  const cur = curriculums.find(x => x.curriculumid === c.curriculumid);
                  return <option key={c.curriculumid} value={c.curriculumid}>{getField(cur, 'curriculumname', 'curriculumname_en', lang) || cur?.curriculumname || c.curriculumid}</option>;
                })}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <button onClick={() => navigate('/admin/students')}
          className="px-6 py-2.5 font-bold text-[#64748b] border border-[#e2e8f0] rounded-xl hover:bg-slate-50 transition-colors">
          {t('cancel', lang)}
        </button>
        <button onClick={() => setConfirm({ open: true })} disabled={isLoading}
          className="btn-primary h-11 px-8 flex items-center gap-2 disabled:opacity-60">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          {t('enrollStudent', lang)}
        </button>
      </div>

      <ConfirmDialog
        open={confirm.open}
        title={lang === 'ar' ? 'تأكيد التسجيل' : 'Confirm Enrollment'}
        message={lang === 'ar' ? 'هل تريد تسجيل هذا الطالب في النظام؟' : 'Enroll this student in the system?'}
        confirmLabel={lang === 'ar' ? 'تسجيل' : 'Enroll'}
        variant="primary"
        loading={isLoading}
        onCancel={() => setConfirm({ open: false })}
        onConfirm={() => { setConfirm({ open: false }); handleSave(); }}
      />
    </div>
  );
}
