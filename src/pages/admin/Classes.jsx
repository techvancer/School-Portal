import { t, getField, getErrorMessage } from '../../lib/langHelper';
import { useLang } from '../../context/LanguageContext';
import { useLocation } from 'react-router-dom';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Trash2, Loader2, Search, Upload, Download, Edit2, X } from 'lucide-react';
import Breadcrumb from '../../components/Breadcrumb';
import FilterBar from '../../components/FilterBar';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { rest, insert, dbQuery } from '../../lib/supabaseClient';
import { generateStyledTemplate } from '../../lib/csvTemplate';
import { useFilterData } from '../../lib/useFilterData';
import { buildFilters } from '../../lib/helpers';
import { readCsvFile, pick } from '../../lib/adminCsv';
import { useSortable } from '../../lib/useSortable';
import { useColumnSearch } from '../../lib/useColumnSearch';
import SortableTh from '../../components/SortableTh';

const EMPTY_CLASS = { classid: '', sectionid: '', stageid: '', divisionid: '', curriculumid: '' };

export default function AdminClasses() {
  const { lang, isAr } = useLang();
  const { addToast } = useToast();
  const { user } = useAuth();
  const location = useLocation();
  const hasRunFromState = useRef(false);
  const filterData = useFilterData(user, lang);
  const [rows, setRows] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [stages, setStages] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [curriculums, setCurriculums] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);
  const [search, setSearch] = useState('');
  const [applied, setApplied] = useState({ classid: 'All', sectionid: 'All', stageid: 'All', curriculumid: 'All', divisionid: 'All' });
  const [showAddRow, setShowAddRow] = useState(false);
  const [classForm, setClassForm] = useState(EMPTY_CLASS);
  const [selectedRow, setSelectedRow] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_CLASS);
  const [deleteModal, setDeleteModal] = useState({ show: false, row: null });
  const [csvErrorModal, setCsvErrorModal] = useState({ show: false, errors: [] });
  const [isLoading, setIsLoading] = useState(false);
  const { sorted: sortedRows, sortCol, sortDir, handleSort } = useSortable(rows, 'classid');
  const { columnSearch, activeSearch, setActiveSearch, setColumnSearch, applyColumnSearch } = useColumnSearch();

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const [scRows, classRows, secRows, stageRows, stuScRows, divRows, curRows] = await Promise.all([
        rest('sections_classes_tbl', { schoolid: `eq.${user.schoolid}`, branchid: `eq.${user.branchid}`, select: '*' }),
        rest('classes_tbl', { select: '*' }),
        rest('sections_tbl', { select: '*' }),
        rest('stages_tbl', { schoolid: `eq.${user.schoolid}`, branchid: `eq.${user.branchid}`, select: '*' }),
        rest('students_sections_classes_tbl', { schoolid: `eq.${user.schoolid}`, branchid: `eq.${user.branchid}`, select: 'classid,sectionid,stageid,divisionid,curriculumid,studentid' }),
        rest('divisions_tbl', { schoolid: `eq.${user.schoolid}`, branchid: `eq.${user.branchid}`, select: '*' }).catch(() => []),
        rest('curriculums_tbl', { schoolid: `eq.${user.schoolid}`, branchid: `eq.${user.branchid}`, select: '*' }).catch(() => []),
      ]);
      const merged = scRows.map((sc) => {
        const cl = classRows.find((c) => c.classid === sc.classid);
        const sec = secRows.find((s) => s.sectionid === sc.sectionid);
        const stage = stageRows.find((s) => s.stageid === sc.stageid);
        const div = (divRows || []).find((d) => d.divisionid === sc.divisionid);
        const cur = (curRows || []).find((c) => c.curriculumid === sc.curriculumid);
        const studentCount = stuScRows.filter((row) => row.classid === sc.classid && row.sectionid === sc.sectionid && row.stageid === sc.stageid && row.divisionid === sc.divisionid && row.curriculumid === sc.curriculumid).length;
        return {
          ...sc,
          classDisplay: lang === 'ar' ? (cl?.classname || sc.classid) : (cl?.classname_en || cl?.classname || sc.classid),
          classname: cl?.classname || sc.classid,
          classname_en: cl?.classname_en || cl?.classname || sc.classid,
          sectionname: getField(sec, 'sectionname', 'sectionname_en', lang) || sec?.sectionname || String(sc.sectionid),
          stagename: lang === 'ar' ? (stage?.stagename || stage?.stagename_en || '—') : (stage?.stagename_en || stage?.stagename || '—'),
          divisionname: getField(div, 'divisionname', 'divisionname_en', lang) || '—',
          curriculumname: getField(cur, 'curriculumname', 'curriculumname_en', lang) || '—',
          studentCount,
        };
      });
      setRows(merged);
      setClasses(classRows);
      setSections(secRows);
      setStages([...new Map(stageRows.map((s) => [s.stageid, s])).values()]);
      setDivisions(divRows || []);
      setCurriculums(curRows || []);
    } catch (e) {
      addToast(getErrorMessage(e, 'general'), 'error');
    } finally {
      setLoading(false);
    }
  }, [user, addToast, lang]);

  useEffect(() => {
    if (!user || hasRunFromState.current) return;
    hasRunFromState.current = true;
    const keys = ['curriculumid', 'divisionid', 'stageid', 'classid', 'sectionid'];
    const fromUrl = {};
    const state = location.state || {};
    keys.forEach((k) => { if (state[k]) fromUrl[k] = state[k]; });
    const merged = Object.keys(fromUrl).length > 0 ? { ...applied, ...fromUrl } : applied;
    if (Object.keys(fromUrl).length > 0) setApplied(merged);
    setHasApplied(true);
    fetchData();
  }, [fetchData, user]);

  const filtered = applyColumnSearch(sortedRows.filter((row) => {
    const q = search.toLowerCase();
    const ms = !search || row.classDisplay.toLowerCase().includes(q) || String(row.sectionname).toLowerCase().includes(q);
    const mc = applied.classid === 'All' || String(row.classid) === applied.classid;
    const msec = applied.sectionid === 'All' || String(row.sectionid) === applied.sectionid;
    const mst = applied.stageid === 'All' || String(row.stageid) === applied.stageid;
    const mdiv = applied.divisionid === 'All' || String(row.divisionid) === applied.divisionid;
    const mcur = applied.curriculumid === 'All' || String(row.curriculumid) === applied.curriculumid;
    return ms && mc && msec && mst && mdiv && mcur;
  }));

  const isClassFormValid = Boolean(classForm.classid && classForm.sectionid && classForm.stageid && classForm.divisionid && classForm.curriculumid);

  async function createClassRow(payload) {
    await insert('sections_classes_tbl', {
      classid: Number.parseInt(payload.classid, 10),
      sectionid: Number.parseInt(payload.sectionid, 10),
      stageid: Number.parseInt(payload.stageid, 10),
      divisionid: Number.parseInt(payload.divisionid, 10),
      curriculumid: Number.parseInt(payload.curriculumid, 10),
      branchid: user.branchid,
      schoolid: user.schoolid,
    });
  }

  const handleCreate = async () => {
    if (!isClassFormValid) {
      addToast('All fields are required.', 'warning');
      return;
    }
    // Check for duplicate before attempting insert (prevents 409 Conflict)
    const alreadyExists = rows.some(r =>
      String(r.classid) === String(classForm.classid) &&
      String(r.sectionid) === String(classForm.sectionid) &&
      String(r.stageid) === String(classForm.stageid) &&
      String(r.divisionid) === String(classForm.divisionid) &&
      String(r.curriculumid) === String(classForm.curriculumid)
    );
    if (alreadyExists) {
      addToast('This class/section/stage/division/curriculum combination already exists.', 'error');
      return;
    }
    setIsLoading(true);
    try {
      await createClassRow(classForm);
      addToast(t('classAdded', lang), 'success');
      setShowAddRow(false);
      setClassForm(EMPTY_CLASS);
      fetchData();
    } catch (err) {
      if (err.message?.includes('409') || err.message?.includes('duplicate') || err.message?.includes('unique') || err.message?.includes('already exists')) {
        addToast('This class/section combination already exists.', 'error');
      } else {
        addToast(getErrorMessage(err, 'general'), 'error');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const [csvConfirmModal, setCsvConfirmModal] = useState({ show: false, rows: [], fileName: '' });

  const handleCsvUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsLoading(true);
    try {
      let csvRows;
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs');
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array', cellText: true, raw: false });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        csvRows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
      } else {
        csvRows = await readCsvFile(file);
      }
      const validationErrors = [];
      const validRows = [];
      const seenCombos = new Set();

      // Filter out empty rows and example/hint rows
      const dataRows = csvRows.filter(row => {
        const firstVal = String(Object.values(row)[0] || '').toLowerCase();
        return !firstVal.includes('e.g.') && !firstVal.includes('example') &&
               Object.values(row).some(v => String(v || '').trim() !== '');
      });

      const validClassNames  = classes.map(c => lang === 'ar' ? (c.classname || c.classname_en) : (c.classname_en || c.classname)).join(', ');
      const validSecNames    = sections.map(s => getField(s, 'sectionname', 'sectionname_en', lang) || s.sectionname).join(', ');
      const validStageNames  = stages.map(s => getField(s, 'stagename', 'stagename_en', lang) || s.stagename).join(', ');
      const validDivNames    = divisions.map(d => getField(d, 'divisionname', 'divisionname_en', lang) || d.divisionname).join(', ');
      const validCurNames    = curriculums.map(c => getField(c, 'curriculumname', 'curriculumname_en', lang) || c.curriculumname).join(', ');

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const rowNum = i + 2;
        const rowErrors = [];

        // Support both name-based columns (new template) and legacy ID columns
        const getCol = (keys) => {
          for (const k of keys) {
            const found = Object.keys(row).find(rk => rk.toLowerCase().replace(/\s+/g,'') === k.toLowerCase().replace(/\s+/g,''));
            if (found && String(row[found] || '').trim()) return String(row[found]).trim();
          }
          return '';
        };

        const classnameRaw    = getCol(['classname', 'class name', 'class']);
        const sectionnameRaw  = getCol(['sectionname', 'section name', 'section']);
        const stagenameRaw    = getCol(['stagename', 'stage name', 'stage']);
        const divisionnameRaw = getCol(['divisionname', 'division name', 'division']);
        const curriculumnameRaw = getCol(['curriculumname', 'curriculum name', 'curriculum']);

        // Legacy ID support (if user still uses old format)
        const rawClassId  = getCol(['classid']);
        const rawSecId    = getCol(['sectionid']);
        const rawStageId  = getCol(['stageid']);
        const rawDivId    = getCol(['divisionid']);
        const rawCurId    = getCol(['curriculumid']);

        // Resolve class
        let classObj = null;
        if (classnameRaw) {
          classObj = classes.find(c => {
            const name = lang === 'ar' ? (c.classname || c.classname_en) : (c.classname_en || c.classname);
            return name?.toLowerCase() === classnameRaw.toLowerCase();
          });
          if (!classObj) rowErrors.push(`Class "${classnameRaw}" not found — valid: ${validClassNames || 'none'}`);
        } else if (rawClassId) {
          classObj = classes.find(c => String(c.classid) === rawClassId);
          if (!classObj) rowErrors.push(`Class ID "${rawClassId}" not found — valid IDs: ${classes.map(c=>c.classid).join(', ')}`);
        } else rowErrors.push(`Class name is missing — valid: ${validClassNames || 'none'}`);

        // Resolve section
        let secObj = null;
        if (sectionnameRaw) {
          secObj = sections.find(s => (getField(s, 'sectionname', 'sectionname_en', lang) || s.sectionname)?.toLowerCase() === sectionnameRaw.toLowerCase());
          if (!secObj) rowErrors.push(`Section "${sectionnameRaw}" not found — valid: ${validSecNames || 'none'}`);
        } else if (rawSecId) {
          secObj = sections.find(s => String(s.sectionid) === rawSecId);
          if (!secObj) rowErrors.push(`Section ID "${rawSecId}" not found`);
        } else rowErrors.push(`Section name is missing — valid: ${validSecNames || 'none'}`);

        // Resolve stage
        let stageObj = null;
        if (stagenameRaw) {
          stageObj = stages.find(s => (getField(s, 'stagename', 'stagename_en', lang) || s.stagename)?.toLowerCase() === stagenameRaw.toLowerCase());
          if (!stageObj) rowErrors.push(`Stage "${stagenameRaw}" not found — valid: ${validStageNames || 'none'}`);
        } else if (rawStageId) {
          stageObj = stages.find(s => String(s.stageid) === rawStageId);
          if (!stageObj) rowErrors.push(`Stage ID "${rawStageId}" not found`);
        } else rowErrors.push(`Stage name is missing — valid: ${validStageNames || 'none'}`);

        // Resolve division
        let divObj = null;
        if (divisionnameRaw) {
          divObj = divisions.find(d => (getField(d, 'divisionname', 'divisionname_en', lang) || d.divisionname)?.toLowerCase() === divisionnameRaw.toLowerCase());
          if (!divObj) rowErrors.push(`Division "${divisionnameRaw}" not found — valid: ${validDivNames || 'none'}`);
        } else if (rawDivId) {
          divObj = divisions.find(d => String(d.divisionid) === rawDivId);
          if (!divObj) rowErrors.push(`Division ID "${rawDivId}" not found`);
        } else rowErrors.push(`Division name is missing — valid: ${validDivNames || 'none'}`);

        // Resolve curriculum
        let curObj = null;
        if (curriculumnameRaw) {
          curObj = curriculums.find(c => (getField(c, 'curriculumname', 'curriculumname_en', lang) || c.curriculumname)?.toLowerCase() === curriculumnameRaw.toLowerCase());
          if (!curObj) rowErrors.push(`Curriculum "${curriculumnameRaw}" not found — valid: ${validCurNames || 'none'}`);
        } else if (rawCurId) {
          curObj = curriculums.find(c => String(c.curriculumid) === rawCurId);
          if (!curObj) rowErrors.push(`Curriculum ID "${rawCurId}" not found`);
        } else rowErrors.push(`Curriculum name is missing — valid: ${validCurNames || 'none'}`);

        if (!rowErrors.length) {
          const payload = {
            classid:      classObj.classid,
            sectionid:    secObj.sectionid,
            stageid:      stageObj.stageid,
            divisionid:   divObj.divisionid,
            curriculumid: curObj.curriculumid,
          };

          const comboKey = `${payload.classid}-${payload.sectionid}-${payload.stageid}-${payload.divisionid}-${payload.curriculumid}`;
          if (seenCombos.has(comboKey)) {
            rowErrors.push('This Class/Section/Stage/Division/Curriculum combination is duplicated in this file');
          } else {
            seenCombos.add(comboKey);
            const alreadyExists = rows.some(r =>
              String(r.classid) === String(payload.classid) &&
              String(r.sectionid) === String(payload.sectionid) &&
              String(r.stageid) === String(payload.stageid) &&
              String(r.divisionid) === String(payload.divisionid) &&
              String(r.curriculumid) === String(payload.curriculumid)
            );
            if (alreadyExists) rowErrors.push('This Class/Section/Stage/Division/Curriculum combination already exists in the system');
            else validRows.push(payload);
          }
        }

        if (rowErrors.length > 0) {
          const rowLabel = classObj && secObj
            ? `${lang === 'ar' ? classObj.classname : classObj.classname_en || classObj.classname} / ${getField(secObj, 'sectionname', 'sectionname_en', lang) || secObj.sectionname}`
            : `Row ${rowNum}`;
          validationErrors.push({ rowNum, name: rowLabel, errors: rowErrors });
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

      // ── PHASE 3: all valid — show confirmation ─────────────────────────────
      setCsvConfirmModal({ show: true, rows: validRows, fileName: file.name });
    } catch (err) {
      addToast(getErrorMessage(err, 'general'), 'error');
    } finally {
      setIsLoading(false);
      event.target.value = '';
    }
  };

  const confirmCsvUpload = async () => {
    const { rows: validRows } = csvConfirmModal;
    setCsvConfirmModal({ show: false, rows: [], fileName: '' });
    setIsLoading(true);
    try {
      for (const payload of validRows) {
        await createClassRow(payload);
      }
      setCsvErrorModal({ show: false, errors: [] });
      addToast(t('classesCsvUploaded', lang), 'success');
      fetchData();
    } catch (err) {
      addToast(getErrorMessage(err, 'general'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const openEdit = (row) => {
    setSelectedRow(row);
    setEditForm({
      classid: String(row.classid || ''),
      sectionid: String(row.sectionid || ''),
      stageid: String(row.stageid || ''),
      divisionid: String(row.divisionid || ''),
      curriculumid: String(row.curriculumid || ''),
    });
  };

  const handleUpdate = async () => {
    if (!selectedRow) return;
    if (!editForm.classid || !editForm.sectionid || !editForm.stageid || !editForm.divisionid || !editForm.curriculumid) {
      addToast('Please fill in all required fields.', 'warning');
      return;
    }
    setIsLoading(true);
    try {
      await dbQuery(`sections_classes_tbl?classid=eq.${selectedRow.classid}&sectionid=eq.${selectedRow.sectionid}&stageid=eq.${selectedRow.stageid}&schoolid=eq.${user.schoolid}&branchid=eq.${user.branchid}`, 'DELETE');
      await createClassRow(editForm);
      addToast(t('savingChanges', lang), 'success');
      setSelectedRow(null);
      fetchData();
    } catch (err) {
      addToast(getErrorMessage(err, 'general'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (row) => {
    setDeleteModal({ show: false, row: null });
    if (row.studentCount > 0) {
      addToast(t('classHasStudents', lang), 'error');
      return;
    }
    try {
      const res = await dbQuery(`sections_classes_tbl?classid=eq.${row.classid}&sectionid=eq.${row.sectionid}&stageid=eq.${row.stageid}&schoolid=eq.${user.schoolid}&branchid=eq.${user.branchid}`, 'DELETE');
      if (!res.ok) {
        const body = {};
        const msg = '';
        if (msg.includes('foreign') || msg.includes('violat') || msg.includes('depend')) {
          addToast('This class cannot be deleted because it has students or active assignments. Please remove them first.', 'error');
        } else {
          addToast(getErrorMessage({ message: body?.message || 'Delete failed' }, 'deleteClass'), 'error');
        }
        return;
      }
      addToast(t('classRowDeleted', lang), 'success');
      fetchData();
    } catch (err) {
      addToast(getErrorMessage(err, 'deleteClass'), 'error');
    }
  };


    useEffect(() => {
        if (!hasApplied) return;
        fetchData();
    }, [lang, hasApplied, fetchData]);

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#0f172a]">{t('classes', lang)}</h1>
          <p className="text-[#64748b] text-sm">{t('allGradesInBranch', lang)}</p>
          <Breadcrumb />
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => {
              const exClass = classes[0]  ? (lang === 'ar' ? classes[0].classname  : classes[0].classname_en  || classes[0].classname)  : 'First Grade';
              const exSec   = sections[0] ? (getField(sections[0], 'sectionname', 'sectionname_en', lang) || sections[0].sectionname) : 'A';
              const exStage = stages[0]   ? (getField(stages[0],   'stagename',  'stagename_en',  lang) || stages[0].stagename)   : 'Primary';
              const exDiv   = divisions[0] ? (getField(divisions[0],'divisionname','divisionname_en',lang) || divisions[0].divisionname) : 'Boys';
              const exCur   = curriculums[0] ? (getField(curriculums[0],'curriculumname','curriculumname_en',lang) || curriculums[0].curriculumname) : 'National';
              generateStyledTemplate({
                headers:   ['classname','sectionname','stagename','divisionname','curriculumname'],
                example:   [`e.g. ${exClass}`,`e.g. ${exSec}`,`e.g. ${exStage}`,`e.g. ${exDiv}`,`e.g. ${exCur}`],
                colWidths: [20, 12, 16, 16, 16],
                sheetName: 'Classes',
                fileName:  'classes_template.xlsx',
              }).catch(() => addToast('Failed to generate template.', 'error'));
            }} className="h-11 px-4 border border-[#e2e8f0] rounded-xl bg-white font-semibold text-sm text-[#334155] flex items-center gap-2">
            <Download className="h-4 w-4" /> {t('downloadTemplate', lang)}
          </button>
          <label className="h-11 px-4 border border-[#e2e8f0] rounded-xl bg-white font-semibold text-sm text-[#334155] flex items-center gap-2 cursor-pointer">
            <Upload className="h-4 w-4" /> {t('uploadCsv', lang)}
            <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleCsvUpload} />
          </label>
          <button onClick={() => { setShowAddRow(true); setSelectedRow(null); }} className="btn-primary flex items-center gap-2 h-11 px-6"><Plus className="h-5 w-5" /> {t('newClass', lang)}</button>
        </div>
      </div>

      <FilterBar
        filters={buildFilters(applied, filterData, {
            classid: { options: [{ value: 'All', label: t('allClasses', lang) }, ...Array.from(new Map(classes.map(c => [c.classid, c])).values()).map(c => ({ value: String(c.classid), label: lang === 'ar' ? (c.classname || c.classname_en) : (c.classname_en || c.classname) }))] },
          }, lang).filter((f) => ['curriculumid','divisionid','stageid','classid','sectionid'].includes(f.key))}
        appliedFilters={applied}

        onApply={(vals) => { setApplied(vals); setHasApplied(true); fetchData(vals); }}
        onReset={(vals) => { setApplied({ classid: 'All', sectionid: 'All', stageid: 'All', curriculumid: 'All', divisionid: 'All' }); setHasApplied(false); setRows([]); }}
      />

      <div className="bg-white rounded-xl border border-[#e2e8f0] p-4 flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94a3b8]" />
          <input type="text" placeholder={t('searchClassesPlaceholder', lang)} className="input-field pl-10 h-10 w-full" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="bg-white overflow-hidden rounded-xl border border-[#e2e8f0]">
        <div className="overflow-x-auto" dir={isAr ? 'rtl' : 'ltr'}>
          <table className={`w-full ${isAr ? 'text-right' : 'text-left'}`}>
            <thead className="bg-[#f8fafc] border-b border-[#e2e8f0]"><tr>
                <SortableTh col="classname" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-4" searchValue={columnSearch['classname']} isSearchOpen={activeSearch==='classname'} onSearchOpen={()=>setActiveSearch('classname')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('classname','');}} onSearchChange={v=>setColumnSearch('classname',v)}>{t('classes', lang)}</SortableTh>
                <SortableTh col="sectionname" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-4" searchValue={columnSearch['sectionname']} isSearchOpen={activeSearch==='sectionname'} onSearchOpen={()=>setActiveSearch('sectionname')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('sectionname','');}} onSearchChange={v=>setColumnSearch('sectionname',v)}>{t('section', lang)}</SortableTh>
                <SortableTh col="stagename" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-4" searchValue={columnSearch['stagename']} isSearchOpen={activeSearch==='stagename'} onSearchOpen={()=>setActiveSearch('stagename')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('stagename','');}} onSearchChange={v=>setColumnSearch('stagename',v)}>{t('stage', lang)}</SortableTh>
                <SortableTh col="divisionname" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-4" searchValue={columnSearch['divisionname']} isSearchOpen={activeSearch==='divisionname'} onSearchOpen={()=>setActiveSearch('divisionname')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('divisionname','');}} onSearchChange={v=>setColumnSearch('divisionname',v)}>{t('division', lang)}</SortableTh>
                <SortableTh col="curriculumname" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-4" searchValue={columnSearch['curriculumname']} isSearchOpen={activeSearch==='curriculumname'} onSearchOpen={()=>setActiveSearch('curriculumname')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('curriculumname','');}} onSearchChange={v=>setColumnSearch('curriculumname',v)}>{t('curriculum', lang)}</SortableTh>
                <SortableTh col="studentCount" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-4">{t('studentsBadge', lang)}</SortableTh>
                <th className="px-4 py-4 text-xs font-bold text-[#64748b] uppercase tracking-wider">{t('actions', lang)}</th>
              </tr></thead>
            <tbody className="divide-y divide-[#e2e8f0]">
              {showAddRow && (
                <tr className="bg-blue-50/50 align-top">
                  <td className="px-4 py-3 text-center min-w-[220px]"><label className="text-xs font-bold text-[#64748b] mb-1 block">{t('class', lang)} <span className="text-red-500">*</span></label><select required className="input-field h-9" value={classForm.classid} onChange={(e) => setClassForm((p) => ({ ...p, classid: e.target.value }))}><option value="">{t('selectClass', lang)}</option>{classes.map((c) => <option key={c.classid} value={c.classid}>{lang === 'ar' ? (c.classname || c.classid) : (c.classname_en || c.classname || c.classid)}</option>)}</select></td>
                  <td className="px-4 py-3 text-center min-w-[170px]"><label className="text-xs font-bold text-[#64748b] mb-1 block">{t('section', lang)} <span className="text-red-500">*</span></label><select required className="input-field h-9" value={classForm.sectionid} onChange={(e) => setClassForm((p) => ({ ...p, sectionid: e.target.value }))}><option value="">{t('selectSection', lang)}</option>{sections.map((section) => <option key={section.sectionid} value={section.sectionid}>{getField(section, 'sectionname', 'sectionname_en', lang)}</option>)}</select></td>
                  <td className="px-4 py-3 text-center min-w-[170px]"><label className="text-xs font-bold text-[#64748b] mb-1 block">{t('stage', lang)} <span className="text-red-500">*</span></label><select required className="input-field h-9" value={classForm.stageid} onChange={(e) => setClassForm((p) => ({ ...p, stageid: e.target.value }))}><option value="">{t('selectStage', lang)}</option>{stages.map((stage) => <option key={stage.stageid} value={stage.stageid}>{getField(stage, 'stagename', 'stagename_en', lang)}</option>)}</select></td>
                  <td className="px-4 py-3 text-center min-w-[170px]"><label className="text-xs font-bold text-[#64748b] mb-1 block">{t('division', lang)} <span className="text-red-500">*</span></label><select required className="input-field h-9" value={classForm.divisionid} onChange={(e) => setClassForm((p) => ({ ...p, divisionid: e.target.value }))}><option value="">{t('selectDivision', lang) || 'Select division'}</option>{divisions.map((division) => <option key={division.divisionid} value={division.divisionid}>{getField(division, 'divisionname', 'divisionname_en', lang)}</option>)}</select></td>
                  <td className="px-4 py-3 text-center min-w-[170px]"><label className="text-xs font-bold text-[#64748b] mb-1 block">{t('curriculum', lang)} <span className="text-red-500">*</span></label><select required className="input-field h-9" value={classForm.curriculumid} onChange={(e) => setClassForm((p) => ({ ...p, curriculumid: e.target.value }))}><option value="">{t('selectCurriculum', lang) || 'Select curriculum'}</option>{curriculums.map((curriculum) => <option key={curriculum.curriculumid} value={curriculum.curriculumid}>{getField(curriculum, 'curriculumname', 'curriculumname_en', lang)}</option>)}</select></td>
                  <td className="px-4 py-3 text-center text-sm text-[#94a3b8]">—</td>
                  <td className="px-4 py-3 text-center"><div className="flex gap-2"><button onClick={handleCreate} disabled={!isClassFormValid || isLoading} className="px-3 py-2 rounded-lg bg-[#1d4ed8] text-white text-xs font-bold disabled:opacity-60 disabled:cursor-not-allowed">{t('save', lang)}</button><button onClick={() => { setShowAddRow(false); setClassForm(EMPTY_CLASS); }} className="px-3 py-2 rounded-lg border text-xs font-bold">{t('cancel', lang)}</button></div></td>
                </tr>
              )}
              {!hasApplied ? (
                <tr><td colSpan={7} className="px-6 py-16 text-center text-[#94a3b8] font-medium">{t('pressApplyToLoad', lang)}</td></tr>
              ) : loading ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-[#94a3b8]"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-[#94a3b8]">{t('noData', lang)}</td></tr>
              ) : filtered.map((row) => (
                selectedRow && selectedRow.classid === row.classid && selectedRow.sectionid === row.sectionid && selectedRow.stageid === row.stageid && selectedRow.divisionid === row.divisionid && selectedRow.curriculumid === row.curriculumid ? (
                  <tr key={`${row.classid}-${row.sectionid}-${row.stageid}-${row.divisionid}-${row.curriculumid}`} className="bg-amber-50/50 align-top">
                    <td className="px-4 py-3 text-center min-w-[220px]"><label className="text-xs font-bold text-[#64748b] mb-1 block">{t('class', lang)} <span className="text-red-500">*</span></label><select className="input-field h-9" value={editForm.classid} onChange={(e) => setEditForm((p) => ({ ...p, classid: e.target.value }))}>{classes.map((c) => <option key={c.classid} value={c.classid}>{lang === 'ar' ? (c.classname || c.classid) : (c.classname_en || c.classname || c.classid)}</option>)}</select></td>
                    <td className="px-4 py-3 text-center min-w-[170px]"><label className="text-xs font-bold text-[#64748b] mb-1 block">{t('section', lang)} <span className="text-red-500">*</span></label><select className="input-field h-9" value={editForm.sectionid} onChange={(e) => setEditForm((p) => ({ ...p, sectionid: e.target.value }))}>{sections.map((section) => <option key={section.sectionid} value={section.sectionid}>{getField(section, 'sectionname', 'sectionname_en', lang)}</option>)}</select></td>
                    <td className="px-4 py-3 text-center min-w-[170px]"><label className="text-xs font-bold text-[#64748b] mb-1 block">{t('stage', lang)} <span className="text-red-500">*</span></label><select className="input-field h-9" value={editForm.stageid} onChange={(e) => setEditForm((p) => ({ ...p, stageid: e.target.value }))}>{stages.map((stage) => <option key={stage.stageid} value={stage.stageid}>{getField(stage, 'stagename', 'stagename_en', lang)}</option>)}</select></td>
                    <td className="px-4 py-3 text-center min-w-[170px]"><label className="text-xs font-bold text-[#64748b] mb-1 block">{t('division', lang)} <span className="text-red-500">*</span></label><select className="input-field h-9" value={editForm.divisionid} onChange={(e) => setEditForm((p) => ({ ...p, divisionid: e.target.value }))}>{divisions.map((division) => <option key={division.divisionid} value={division.divisionid}>{getField(division, 'divisionname', 'divisionname_en', lang)}</option>)}</select></td>
                    <td className="px-4 py-3 text-center min-w-[170px]"><label className="text-xs font-bold text-[#64748b] mb-1 block">{t('curriculum', lang)} <span className="text-red-500">*</span></label><select className="input-field h-9" value={editForm.curriculumid} onChange={(e) => setEditForm((p) => ({ ...p, curriculumid: e.target.value }))}>{curriculums.map((curriculum) => <option key={curriculum.curriculumid} value={curriculum.curriculumid}>{getField(curriculum, 'curriculumname', 'curriculumname_en', lang)}</option>)}</select></td>
                    <td className="px-4 py-3 text-center text-sm">{row.studentCount}</td>
                    <td className="px-4 py-3 text-center"><div className="flex gap-2"><button onClick={handleUpdate} className="px-3 py-2 rounded-lg bg-[#1d4ed8] text-white text-xs font-bold">{t('save', lang)}</button><button onClick={() => setSelectedRow(null)} className="px-3 py-2 rounded-lg border text-xs font-bold">{t('cancel', lang)}</button></div></td>
                  </tr>
                ) : (
                  <tr key={`${row.classid}-${row.sectionid}-${row.stageid}-${row.divisionid}-${row.curriculumid}`} className="hover:bg-[#f8fafc]">
                    <td className="px-4 py-3 text-center text-sm font-semibold">{row.classDisplay}</td>
                    <td className="px-4 py-3 text-center text-sm">{row.sectionname}</td>
                    <td className="px-4 py-3 text-center text-sm">{row.stagename}</td>
                    <td className="px-4 py-3 text-center text-sm">{row.divisionname}</td>
                    <td className="px-4 py-3 text-center text-sm">{row.curriculumname}</td>
                    <td className="px-4 py-3 text-center text-sm">{row.studentCount}</td>
                    <td className="px-4 py-3 text-center"><div className="flex items-center gap-2"><button onClick={() => openEdit(row)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg border border-blue-50"><Edit2 className="h-4 w-4" /></button><button onClick={() => setDeleteModal({ show: true, row })} className="p-2 text-red-500 hover:bg-red-50 rounded-lg border border-red-50"><Trash2 className="h-4 w-4" /></button></div></td>
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
                    const errorRows = csvErrorModal.errors.map(e => ({ 'Row #': e.rowNum, 'Class / Section': e.name, 'Error Reason': e.errors.join(' | ') }));
                    const ws = XLSX.utils.json_to_sheet(errorRows);
                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, ws, 'Upload Errors');
                    XLSX.writeFile(wb, 'class_upload_errors.xlsx');
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
                    <th className="px-4 py-3 text-xs font-bold text-red-700 uppercase w-44">Class / Section</th>
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

      {deleteModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteModal({ show: false, row: null })} />
          <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-base font-bold text-[#0f172a] mb-2">{isAr ? 'تأكيد الحذف' : 'Confirm Delete'}</h3>
            <p className="text-sm text-[#64748b] mb-6">{isAr ? 'هل أنت متأكد من حذف هذا الصف؟ لا يمكن التراجع عن هذا الإجراء.' : 'Are you sure you want to delete this class? This action cannot be undone.'}</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteModal({ show: false, row: null })} className="px-4 py-2 rounded-lg border border-[#e2e8f0] text-sm font-semibold text-[#64748b] hover:bg-slate-50">{t('cancel', lang)}</button>
              <button onClick={() => handleDelete(deleteModal.row)} className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-bold hover:bg-red-700">{t('delete', lang)}</button>
            </div>
          </div>
        </div>
      )}

      {csvConfirmModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setCsvConfirmModal({ show: false, rows: [], fileName: '' })} />
          <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-base font-bold text-[#0f172a] mb-2">{isAr ? 'تأكيد الرفع' : 'Confirm Upload'}</h3>
            <p className="text-sm text-[#64748b] mb-6">
              {isAr
                ? `هل تريد رفع ${csvConfirmModal.rows.length} صف من "${csvConfirmModal.fileName}"؟`
                : `You are about to upload ${csvConfirmModal.rows.length} class row(s) from "${csvConfirmModal.fileName}". This action cannot be undone.`}
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setCsvConfirmModal({ show: false, rows: [], fileName: '' })} className="px-4 py-2 rounded-lg border border-[#e2e8f0] text-sm font-semibold text-[#64748b] hover:bg-slate-50">{t('cancel', lang)}</button>
              <button onClick={confirmCsvUpload} className="px-4 py-2 rounded-lg bg-[#1d4ed8] text-white text-sm font-bold hover:bg-[#1e40af]">{isAr ? 'تأكيد الرفع' : 'Confirm Upload'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}