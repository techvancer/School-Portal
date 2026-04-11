import { getErrorMessage } from '../../lib/langHelper';
import { getCached, setCached, clearCacheByPrefix } from '../../lib/apiCache';
import { t, getField, getStudentName as _getStudentName } from '../../lib/langHelper';
import { useLang } from '../../context/LanguageContext';
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, Edit2, Trash2, Loader2, Upload, Download, X } from 'lucide-react';
import Breadcrumb from '../../components/Breadcrumb';
import FilterBar from '../../components/FilterBar';
import { useFilterData } from '../../lib/useFilterData';
import { buildFilters, EMPTY_FILTER } from '../../lib/helpers';
import { useNavigate, useLocation } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { rest, insert, update, remove, nextId, dbQuery } from '../../lib/supabaseClient';
import { readCsvFile, pick, asInt } from '../../lib/adminCsv';
import { generateStyledTemplate } from '../../lib/csvTemplate';
import { useSortable } from '../../lib/useSortable';
import { useColumnSearch } from '../../lib/useColumnSearch';
import SortableTh from '../../components/SortableTh';

const EMPTY_FORM = {
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

export default function AdminStudents() {
    const { lang, isAr } = useLang();

  const { addToast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const hasRunFromState = useRef(false);
  const filterData = useFilterData(user, lang);
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [stages, setStages] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [curriculums, setCurriculums] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);
  const [search, setSearch] = useState('');
  const [applied, setApplied] = useState({ classid: 'All', sectionid: 'All', stageid: 'All', divisionid: 'All', curriculumid: 'All' });
  const [showAddRow, setShowAddRow] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [isLoading, setIsLoading] = useState(false);
  const [csvErrorModal, setCsvErrorModal] = useState({ show: false, errors: [] });
  const { sorted: sortedStudents, sortCol, sortDir, handleSort } = useSortable(students, 'studentid');
  const { columnSearch, activeSearch, setActiveSearch, setColumnSearch, applyColumnSearch } = useColumnSearch();

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);

      const cachedCl = getCached(`lookup:classes_tbl`);
      const cachedSec = getCached(`lookup:sections_tbl`);
      const cachedStg = getCached(`lookup:stages_tbl:${user.schoolid}:${user.branchid}`);
      const cachedDiv = getCached(`lookup:divisions_tbl`);
      const cachedCur = getCached(`lookup:curriculums_tbl`);

      const [stuList, stuScRows, clTbl, secRows, stgRows, divRows, curRows] = await Promise.all([
        rest('students_tbl', { select: 'studentid,studentfirstname_ar,studentfirstname_en,studentfathersname_ar,studentfathersname_en,studentgrandfathersname_ar,studentgrandfathersname_en,studentsurname_ar,studentsurname_en,studentemail,studentmobile' }),
        rest('students_sections_classes_tbl', { schoolid: `eq.${user.schoolid}`, branchid: `eq.${user.branchid}`, select: 'studentid,classid,sectionid,stageid,divisionid,curriculumid' }),
        cachedCl  ? Promise.resolve(cachedCl)  : rest('classes_tbl', { select: 'classid,classname,classname_en' }),
        cachedSec ? Promise.resolve(cachedSec) : rest('sections_tbl', { select: 'sectionid,sectionname,sectionname_en' }),
        cachedStg ? Promise.resolve(cachedStg) : rest('stages_tbl', { schoolid: `eq.${user.schoolid}`, branchid: `eq.${user.branchid}`, select: 'stageid,stagename,stagename_en' }),
        cachedDiv ? Promise.resolve(cachedDiv) : rest('divisions_tbl', { select: 'divisionid,divisionname,divisionname_en' }).catch(() => []),
        cachedCur ? Promise.resolve(cachedCur) : rest('curriculums_tbl', { select: 'curriculumid,curriculumname,curriculumname_en' }).catch(() => []),
      ]);

      if (!cachedCl) setCached(`lookup:classes_tbl`, clTbl);
      if (!cachedSec) setCached(`lookup:sections_tbl`, secRows);
      if (!cachedStg) setCached(`lookup:stages_tbl:${user.schoolid}:${user.branchid}`, stgRows);
      if (!cachedDiv) setCached(`lookup:divisions_tbl`, divRows);
      if (!cachedCur) setCached(`lookup:curriculums_tbl`, curRows);
      const merged = stuList.map((s) => {
        const sc = stuScRows.find((x) => x.studentid === s.studentid);
        if (!sc) return null;
        const cl = clTbl.find((c) => c.classid === sc.classid);
        const sec = secRows.find((x) => x.sectionid === sc.sectionid);
        const stg = stgRows.find((x) => x.stageid === sc.stageid);
        const div = divRows.find((x) => x.divisionid === sc.divisionid);
        const cur = curRows.find((x) => x.curriculumid === sc.curriculumid);
        return {
          ...s,
          classid: sc.classid,
          sectionid: sc.sectionid,
          stageid: sc.stageid,
          curriculumid: sc.curriculumid,
          divisionid: sc.divisionid,
          classname: getField(cl, 'classname', 'classname_en', lang) || cl?.classname || '?',
          sectionname: getField(sec, 'sectionname', 'sectionname_en', lang) || sec?.sectionname || '?',
          fullName: _getStudentName(s, lang) || '—',
          stageName: getField(stg, 'stagename', 'stagename_en', lang) || '—',
          stagename: getField(stg, 'stagename', 'stagename_en', lang) || '—',
          divisionname: getField(div, 'divisionname', 'divisionname_en', lang) || div?.divisionname || sc.divisionid || '—',
          curriculumname: getField(cur, 'curriculumname', 'curriculumname_en', lang) || cur?.curriculumname || sc.curriculumid || '—',
        };
      }).filter(Boolean);
      setStudents(merged);
      setClasses(clTbl);
      setSections(secRows);
      setStages([...new Map(stgRows.map((s) => [s.stageid, s])).values()]);
      setDivisions(divRows);
      setCurriculums(curRows);
    } catch (e) {
      addToast(getErrorMessage(e, 'general'), 'error');
    } finally {
      setLoading(false);
    }
  }, [user, addToast, lang]);

  // Read URL params from dashboard card click and auto-apply
  useEffect(() => {
    if (!user || hasRunFromState.current) return;
    hasRunFromState.current = true;
    const keys = ['curriculumid', 'divisionid', 'stageid', 'classid', 'sectionid'];
    const fromUrl = {};
    const state = location.state || {};
    keys.forEach(k => { if (state[k]) fromUrl[k] = state[k]; });
    // Only auto-apply if navigated here with filter state from another page
    if (Object.keys(fromUrl).length > 0) {
      setApplied(prev => ({ ...prev, ...fromUrl }));
      setHasApplied(true);
      fetchData();
    }
  }, [fetchData, user]);



  const filtered = applyColumnSearch(sortedStudents.filter((s) => {
    const q = search.toLowerCase();
    const stuFullName = _getStudentName(s, lang) || ''; const ms = !search || stuFullName.toLowerCase().includes(q) || _getStudentName(s, lang)?.toLowerCase().includes(q) || String(s.studentid).includes(q);
    const mc = applied.classid === 'All' || String(s.classid) === applied.classid;
    const msec = applied.sectionid === 'All' || String(s.sectionid) === applied.sectionid;
    const mst = applied.stageid === 'All' || String(s.stageid) === applied.stageid;
    const md = applied.divisionid === 'All' || String(s.divisionid) === applied.divisionid;
    const mcur = applied.curriculumid === 'All' || String(s.curriculumid) === applied.curriculumid;
    return ms && mc && msec && mst && md && mcur;
  }));

  async function createStudent(payload) {
    const newStudentId = await nextId('students_tbl', 'studentid');
    const fullNameEn = [payload.studentfirstname_en, payload.studentfathersname_en, payload.studentsurname_en].filter(Boolean).join(' ') || _getStudentName(payload, lang) || '';
    const [newStu] = await insert('students_tbl', {
      studentid: newStudentId,
      studentfirstname_ar: payload.studentfirstname_ar || null,
      studentfirstname_en: payload.studentfirstname_en || null,
      studentfathersname_ar: payload.studentfathersname_ar || null,
      studentfathersname_en: payload.studentfathersname_en || null,
      studentgrandfathersname_ar: payload.studentgrandfathersname_ar || null,
      studentgrandfathersname_en: payload.studentgrandfathersname_en || null,
      studentsurname_ar: payload.studentsurname_ar || null,
      studentsurname_en: payload.studentsurname_en || null,
      studentemail: payload.studentemail || null,
      studentmobile: payload.studentmobile || null,
      parentname_ar: payload.parentname_ar || null,
      parentname_en: payload.parentname_en || null,
      parentemail: payload.parentemail || null,
      parentmobile: payload.parentmobile || null,
      parent_position: payload.parent_position || null,
    });
    await insert('students_sections_classes_tbl', {
      studentid: newStu.studentid,
      classid: Number.parseInt(payload.classid, 10),
      sectionid: Number.parseInt(payload.sectionid, 10),
      stageid: Number.parseInt(payload.stageid, 10),
      schoolid: user.schoolid,
      branchid: user.branchid,
      divisionid: Number.parseInt(payload.divisionid || user.divisionid || 1, 10),
      curriculumid: Number.parseInt(payload.curriculumid || user.curriculumid || 1, 10),
    });
  }

  const handleCreate = async () => {
    if ((!formData.studentfirstname_en && !formData.studentfirstname_ar) || !formData.classid || !formData.sectionid || !formData.stageid) {
      addToast(t('studentNameClassReq', lang), 'warning');
      return;
    }
    if ((formData.studentmobile && !isTenDigitPhone(formData.studentmobile)) || (formData.parentmobile && !isTenDigitPhone(formData.parentmobile))) {
      addToast('Phone numbers must be exactly 10 digits.', 'warning');
      return;
    }
    setIsLoading(true);
    try {
      await createStudent(formData);
      addToast(t('studentEnrolled', lang), 'success');
      setShowAddRow(false);
      setFormData(EMPTY_FORM);
      fetchData();
    } catch (err) {
      addToast(getErrorMessage(err, 'general'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCsvUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsLoading(true);
    try {
      let rows;
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs');
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array', cellText: true, raw: false });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
      } else {
        rows = await readCsvFile(file);
      }

      // Fetch valid class combinations for validation
      const scCombos = await rest('sections_classes_tbl', {
        schoolid: `eq.${user.schoolid}`, branchid: `eq.${user.branchid}`,
        select: 'classid,sectionid,stageid,divisionid,curriculumid',
      }).catch(() => []);

      const validationErrors = [];
      const validRows = [];
      const seenEmails = new Set();

      const dataRows = rows.filter(row => {
        const firstVal = String(Object.values(row)[0] || '').toLowerCase();
        return !firstVal.includes('e.g.') && !firstVal.includes('example') &&
               Object.values(row).some(v => String(v || '').trim() !== '');
      });

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const rowNum = i + 2;
        const rowErrors = [];

        const payload = {
          studentfirstname_en:        pick(row, ['studentfirstname_en', 'first_name_en', 'firstname_en', 'first name en']),
          studentfirstname_ar:        pick(row, ['studentfirstname_ar', 'first_name_ar', 'firstname_ar', 'first name ar']),
          studentfathersname_en:      pick(row, ['studentfathersname_en', 'father_name_en', 'fathername_en', 'father name en']),
          studentfathersname_ar:      pick(row, ['studentfathersname_ar', 'father_name_ar', 'fathername_ar', 'father name ar']),
          studentgrandfathersname_en: pick(row, ['studentgrandfathersname_en', 'grandfather_name_en', 'grandfathername_en']),
          studentgrandfathersname_ar: pick(row, ['studentgrandfathersname_ar', 'grandfather_name_ar', 'grandfathername_ar']),
          studentsurname_en:          pick(row, ['studentsurname_en', 'surname_en', 'last_name_en']),
          studentsurname_ar:          pick(row, ['studentsurname_ar', 'surname_ar', 'last_name_ar']),
          studentemail:               pick(row, ['studentemail', 'email']),
          studentmobile:              pick(row, ['studentmobile', 'mobile']),
          parentname_ar:              pick(row, ['parentname_ar']),
          parentname_en:              pick(row, ['parentname_en', 'parentname', 'parent']),
          parentemail:                pick(row, ['parentemail']),
          parentmobile:               pick(row, ['parentmobile']),
          parent_position:            pick(row, ['parent_position', 'parentposition']),
          classid:                    pick(row, ['classid']),
          sectionid:                  pick(row, ['sectionid']),
          stageid:                    pick(row, ['stageid']),
          divisionid:                 pick(row, ['divisionid'], String(user.divisionid || 1)),
          curriculumid:               pick(row, ['curriculumid'], String(user.curriculumid || 1)),
        };

        const nameEn = [payload.studentfirstname_en, payload.studentfathersname_en, payload.studentsurname_en].filter(Boolean).join(' ');
        const nameAr = [payload.studentfirstname_ar, payload.studentfathersname_ar, payload.studentsurname_ar].filter(Boolean).join(' ');
        const displayName = nameEn || nameAr || 'No Name';

        // ── Name ──────────────────────────────────────────────
        if (!payload.studentfirstname_en && !payload.studentfirstname_ar) {
          rowErrors.push('Student first name is required (English or Arabic)');
        }

        // ── Class assignment ───────────────────────────────────
        if (!payload.classid) {
          const validIds = [...new Set(scCombos.map(c => c.classid))].sort((a, b) => a - b).join(', ');
          rowErrors.push(`Class ID is missing — valid IDs: ${validIds || 'none'}`);
        }
        if (!payload.sectionid) {
          rowErrors.push('Section ID is missing');
        }
        if (!payload.stageid) {
          rowErrors.push('Stage ID is missing');
        }
        if (payload.classid && payload.sectionid && payload.stageid) {
          const comboExists = scCombos.some(c =>
            String(c.classid) === String(payload.classid) &&
            String(c.sectionid) === String(payload.sectionid) &&
            String(c.stageid) === String(payload.stageid) &&
            String(c.divisionid) === String(payload.divisionid) &&
            String(c.curriculumid) === String(payload.curriculumid)
          );
          if (!comboExists) {
            const validForClass = scCombos.filter(c => String(c.classid) === String(payload.classid));
            if (validForClass.length > 0) {
              const combosStr = validForClass.map(c => `Section ${c.sectionid} / Stage ${c.stageid} / Div ${c.divisionid} / Cur ${c.curriculumid}`).join(' | ');
              rowErrors.push(`Class ${payload.classid} — Section/Stage/Division/Curriculum combination is invalid. Valid options: ${combosStr}`);
            } else {
              const validClassIds = [...new Set(scCombos.map(c => c.classid))].sort((a, b) => a - b).join(', ');
              rowErrors.push(`Class ID ${payload.classid} does not exist — valid IDs: ${validClassIds || 'none'}`);
            }
          }
        }

        // ── Duplicate email ────────────────────────────────────
        if (payload.studentemail) {
          if (seenEmails.has(payload.studentemail.toLowerCase())) {
            rowErrors.push(`Email "${payload.studentemail}" is duplicated in this file — each student must have a unique email`);
          } else {
            seenEmails.add(payload.studentemail.toLowerCase());
          }
        }

        // ── Phone numbers ──────────────────────────────────────
        // Auto-pad 9-digit numbers with a leading 0 (Excel strips it on save)
        if (payload.studentmobile && String(payload.studentmobile).length === 9) {
          payload.studentmobile = '0' + payload.studentmobile;
        }
        if (payload.parentmobile && String(payload.parentmobile).length === 9) {
          payload.parentmobile = '0' + payload.parentmobile;
        }
        if (payload.studentmobile && !isTenDigitPhone(payload.studentmobile)) {
          rowErrors.push(`Student mobile "${payload.studentmobile}" must be exactly 10 digits`);
        }
        if (payload.parentmobile && !isTenDigitPhone(payload.parentmobile)) {
          rowErrors.push(`Parent mobile "${payload.parentmobile}" must be exactly 10 digits`);
        }

        if (rowErrors.length > 0) {
          validationErrors.push({ rowNum, name: displayName, errors: rowErrors });
        } else {
          validRows.push(payload);
        }
      }

      // ── PHASE 2: errors found ──────────────────────────────────────────────
      if (validationErrors.length > 0) {
        setCsvErrorModal({ show: false, errors: validationErrors });
        addToast(
          `${validationErrors.length} invalid row(s) found. Nothing was uploaded.`,
          'error',
          { label: 'View Details', onClick: () => setCsvErrorModal(p => ({ ...p, show: true })) }
        );
        return;
      }

      // ── PHASE 3: all valid — upload ────────────────────────────────────────
      for (const payload of validRows) {
        await createStudent(payload);
      }
      setCsvErrorModal({ show: false, errors: [] });
      addToast(t('studentsCsvUploaded', lang), 'success');
      fetchData();
    } catch (err) {
      addToast(err.message || getErrorMessage(err, 'general'), 'error');
    } finally {
      setIsLoading(false);
      event.target.value = '';
    }
  };
;
;

  const handleDelete = async (student) => {
    try {
      await dbQuery(`students_sections_classes_tbl?studentid=eq.${student.studentid}`, 'DELETE');
      await remove('students_tbl', student.studentid, 'studentid');
      addToast(t('deleteSuccess', lang), 'success');
      fetchData();
    } catch (err) {
      addToast(getErrorMessage(err, 'general'), 'error');
    }
  };

  const divisionOptions = [{ value: 'All', label: t('allDivisions', lang) }, ...divisions.map((d) => ({ value: String(d.divisionid), label: getField(d, 'divisionname', 'divisionname_en', lang) || d.divisionname || `Division ${d.divisionid}` }))];
  const curriculumOptions = [{ value: 'All', label: t('allCurriculums', lang) }, ...curriculums.map((c) => ({ value: String(c.curriculumid), label: getField(c, 'curriculumname', 'curriculumname_en', lang) || c.curriculumname || `Curriculum ${c.curriculumid}` }))];


    useEffect(() => {
        if (!hasApplied) return;
        fetchData();
    }, [lang, hasApplied, fetchData]);

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#0f172a]">{t('students', lang)}</h1>
          <p className="text-[#64748b] text-sm">{t('manageStudentsDesc', lang)}</p>
          <Breadcrumb />
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => generateStyledTemplate({
              headers:   ['studentfirstname_ar','studentfirstname_en','studentfathersname_ar','studentfathersname_en','studentgrandfathersname_ar','studentgrandfathersname_en','studentsurname_ar','studentsurname_en','studentemail','studentmobile','parentname_ar','parentname_en','parentemail','parentmobile','parent_position','classid','sectionid','stageid','divisionid','curriculumid'],
              example:   ['e.g. يوسف','Yousef','محمد','Mohammad','أحمد','Ahmad','حسن','Hassan','yousef@school.com','0791234567','والد الطالب',"Student's Father",'parent@school.com','0791234568','Father','1','1','1','1','1'],
              colWidths: [18,18,18,18,22,22,16,16,28,16,18,18,28,16,14,10,10,10,10,12],
              sheetName: 'Students',
              fileName:  'students_template.xlsx',
            }).catch((err) => addToast(getErrorMessage(err, 'general'), 'error'))} className="h-11 px-4 border border-[#e2e8f0] rounded-xl bg-white font-semibold text-sm text-[#334155] flex items-center gap-2">
            <Download className="h-4 w-4" /> {t('downloadTemplate', lang)}
          </button>
          <label className="h-11 px-4 border border-[#e2e8f0] rounded-xl bg-white font-semibold text-sm text-[#334155] flex items-center gap-2 cursor-pointer">
            <Upload className="h-4 w-4" /> {t('uploadCsv', lang)}
            <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleCsvUpload} />
          </label>
          <button onClick={() => navigate('/admin/students/enroll')} className="btn-primary flex items-center gap-2 h-11 px-6 !bg-[#4f46e5] hover:!bg-[#4338ca]">
            <Plus className="h-5 w-5" /> {t('enrollStudent', lang)}
          </button>
        </div>
      </div>

      <FilterBar
        filters={buildFilters(applied, filterData, {}, lang).filter(f => f.key !== 'examid' && f.key !== 'semisterid')}
        appliedFilters={applied}

        onApply={(vals) => { setApplied(vals); setHasApplied(true); fetchData(); }}
        onReset={(vals) => { setApplied(vals); setHasApplied(false); setStudents([]); }}
      />
      <div className="bg-white rounded-xl border border-[#e2e8f0] p-4 flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94a3b8]" />
          <input type="text" placeholder={t('searchStudentsAdminPlaceholder', lang)} className="input-field pl-10 h-10 w-full" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="card bg-white overflow-hidden rounded-xl border border-[#e2e8f0]">
        <div className="overflow-x-auto" dir={isAr ? 'rtl' : 'ltr'}>
          <table className={`w-full ${isAr ? 'text-right' : 'text-left'}`}>
            <thead className="bg-[#f8fafc] border-b border-[#e2e8f0]">
              <tr>
                <SortableTh col="studentid" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-4" searchValue={columnSearch['studentid']} isSearchOpen={activeSearch==='studentid'} onSearchOpen={()=>setActiveSearch('studentid')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('studentid','');}} onSearchChange={v=>setColumnSearch('studentid',v)}>{t('id', lang)}</SortableTh>
                <SortableTh col="fullName" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-4" searchValue={columnSearch['fullName']} isSearchOpen={activeSearch==='fullName'} onSearchOpen={()=>setActiveSearch('fullName')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('fullName','');}} onSearchChange={v=>setColumnSearch('fullName',v)}>{t('name', lang)}</SortableTh>
                <SortableTh col="classname" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-4" searchValue={columnSearch['classname']} isSearchOpen={activeSearch==='classname'} onSearchOpen={()=>setActiveSearch('classname')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('classname','');}} onSearchChange={v=>setColumnSearch('classname',v)}>{t('class', lang)}</SortableTh>
                <SortableTh col="sectionname" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-4" searchValue={columnSearch['sectionname']} isSearchOpen={activeSearch==='sectionname'} onSearchOpen={()=>setActiveSearch('sectionname')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('sectionname','');}} onSearchChange={v=>setColumnSearch('sectionname',v)}>{t('section', lang)}</SortableTh>
                <SortableTh col="stagename" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-4" searchValue={columnSearch['stagename']} isSearchOpen={activeSearch==='stagename'} onSearchOpen={()=>setActiveSearch('stagename')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('stagename','');}} onSearchChange={v=>setColumnSearch('stagename',v)}>{t('stage', lang)}</SortableTh>
                <SortableTh col="divisionname" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-4" searchValue={columnSearch['divisionname']} isSearchOpen={activeSearch==='divisionname'} onSearchOpen={()=>setActiveSearch('divisionname')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('divisionname','');}} onSearchChange={v=>setColumnSearch('divisionname',v)}>{t('division', lang)}</SortableTh>
                <SortableTh col="curriculumname" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-4" searchValue={columnSearch['curriculumname']} isSearchOpen={activeSearch==='curriculumname'} onSearchOpen={()=>setActiveSearch('curriculumname')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('curriculumname','');}} onSearchChange={v=>setColumnSearch('curriculumname',v)}>{t('curriculum', lang)}</SortableTh>
                <SortableTh col="studentemail" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-4" searchValue={columnSearch['studentemail']} isSearchOpen={activeSearch==='studentemail'} onSearchOpen={()=>setActiveSearch('studentemail')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('studentemail','');}} onSearchChange={v=>setColumnSearch('studentemail',v)}>{t('email', lang)}</SortableTh>
                <SortableTh col="studentmobile" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-4" searchValue={columnSearch['studentmobile']} isSearchOpen={activeSearch==='studentmobile'} onSearchOpen={()=>setActiveSearch('studentmobile')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('studentmobile','');}} onSearchChange={v=>setColumnSearch('studentmobile',v)}>{t('mobile', lang)}</SortableTh>
                <th className="px-4 py-4 text-xs font-bold text-[#64748b] uppercase tracking-wider whitespace-nowrap">{t('actions', lang)}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2e8f0]">
              {!hasApplied ? (
                <tr><td colSpan={10} className="px-6 py-16 text-center text-[#94a3b8] font-medium">{t('pressApplyToLoad', lang)}</td></tr>
              ) : loading ? (

                <tr><td colSpan={10} className="px-6 py-12 text-center text-[#94a3b8]"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={10} className="px-6 py-12 text-center text-[#94a3b8]">{t('noData', lang)}</td></tr>
              ) : filtered.map((s) => (
(
                  <tr key={s.studentid} className="hover:bg-[#f8fafc] transition-colors">
                    <td className="px-4 py-3 text-center"><span className="text-xs font-mono font-bold text-[#94a3b8] bg-slate-100 px-2 py-1 rounded">#{s.studentid}</span></td>
                    <td className="px-4 py-3 text-center"><div className="flex items-center gap-3"><div className="h-9 w-9 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-[10px] uppercase">{(getField(s, 'studentfirstname_ar', 'studentfirstname_en', lang) || '').charAt(0)}</div><p className="text-sm font-bold text-[#0f172a]">{_getStudentName(s, lang)}</p></div></td>
                    <td className="px-4 py-3 text-center text-sm font-medium text-[#0f172a]">{t('class', lang)} {s.classname}</td>
                    <td className="px-4 py-3 text-center"><span className="inline-flex items-center justify-center px-2 py-0.5 rounded bg-[#eff6ff] text-[#1d4ed8] text-xs font-bold border border-blue-100 min-w-[28px]">{s.sectionname}</span></td>
                    <td className="px-4 py-3 text-center text-xs text-[#64748b] font-medium whitespace-nowrap">{s.stageName}</td>
                    <td className="px-4 py-3 text-center text-xs text-[#475569]">{s.divisionname}</td>
                    <td className="px-4 py-3 text-center text-xs text-[#475569]">{s.curriculumname}</td>
                    <td className="px-4 py-3 text-center text-sm text-[#475569]">{s.studentemail || '—'}</td>
                    <td className="px-4 py-3 text-center text-sm text-[#475569]">{s.studentmobile || '—'}</td>
                    <td className="px-4 py-3 text-center"><div className="flex items-center gap-2"><button onClick={() => navigate(`/admin/students/edit/${s.studentid}`, { state: { student: s } })} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg border border-blue-50"><Edit2 className="h-4 w-4" /></button><button onClick={() => handleDelete(s)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg border border-red-50"><Trash2 className="h-4 w-4" /></button></div></td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 bg-slate-50/50 border-t border-[#e2e8f0] flex items-center">
          <span className="text-xs font-bold text-[#64748b] uppercase tracking-wider mr-3">{t('total', lang)}</span>
          <div className="px-3 py-1 bg-white rounded-lg border border-[#e2e8f0] text-xs font-black text-[#0f172a] shadow-sm">{filtered.length} {t('rows', lang)}</div>
        </div>
      </div>

      {isLoading && <div className="text-sm text-[#64748b]">{t('savingChanges', lang)}...</div>}

      {csvErrorModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setCsvErrorModal(p => ({ ...p, show: false }))} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 overflow-hidden flex flex-col" style={{ maxHeight: '80vh' }}>
            <div className="flex items-center justify-between px-6 py-4 bg-red-50 border-b border-red-200">
              <div>
                <h3 className="text-base font-bold text-red-700">{csvErrorModal.errors.length} Invalid Row{csvErrorModal.errors.length !== 1 ? 's' : ''} — Nothing was uploaded</h3>
                <p className="text-xs text-red-500 mt-0.5">Fix the errors below and re-upload the file.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    const XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs');
                    const errorRows = csvErrorModal.errors.map(e => ({ 'Row #': e.rowNum, 'Student Name': e.name, 'Error Reason': e.errors.join(' | ') }));
                    const ws = XLSX.utils.json_to_sheet(errorRows);
                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, ws, 'Upload Errors');
                    XLSX.writeFile(wb, 'student_upload_errors.xlsx');
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
                    <th className="px-4 py-3 text-xs font-bold text-red-700 uppercase w-20">Row</th>
                    <th className="px-4 py-3 text-xs font-bold text-red-700 uppercase w-44">Student Name</th>
                    <th className="px-4 py-3 text-xs font-bold text-red-700 uppercase">Errors</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-red-100">
                  {csvErrorModal.errors.map((e, i) => (
                    <tr key={i} className="hover:bg-red-50">
                      <td className="px-4 py-3 font-bold text-[#1d4ed8]">Row {e.rowNum}</td>
                      <td className="px-4 py-3 font-semibold text-[#0f172a]">{e.name}</td>
                      <td className="px-4 py-3 text-red-600">{e.errors.join(' · ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
