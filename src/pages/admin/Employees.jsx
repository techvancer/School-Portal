import { t, getField, getStudentName as _getStudentName, getErrorMessage } from '../../lib/langHelper';
import { getCached, setCached, clearCacheByPrefix } from '../../lib/apiCache';
import { useLang } from '../../context/LanguageContext';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Search, Plus, Edit2, Trash2, Loader2, Upload, Download, X } from 'lucide-react';
import Breadcrumb from '../../components/Breadcrumb';
import FilterBar from '../../components/FilterBar';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { rest, update, remove, dbQuery, EDGE_FUNCTION_URL } from '../../lib/supabaseClient';
import { readCsvFile, pick } from '../../lib/adminCsv';
import { useSortable } from '../../lib/useSortable';
import { useColumnSearch } from '../../lib/useColumnSearch';
import SortableTh from '../../components/SortableTh';

const TYPE_MAP = { 1: 'Teacher', 2: 'Supervisor', 3: 'GM', 4: 'Administration', 5: 'IT', 6: 'Admin' };
const EMPTY_FORM = { employeename: '', employeename_en: '', employeeemail: '', employeemobile: '', typeid: '', divisionid: '', curriculumid: '', notes: '' };
const sanitizePhone = (value = '') => String(value).replace(/\D/g, '').slice(0, 10);
const toEn = (v) => v.replace(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g, '');
const toAr = (v) => v.replace(/[a-zA-Z]/g, '');
const isTenDigitPhone = (value = '') => /^\d{10}$/.test(String(value || '').trim());

export default function AdminEmployees() {
    const { lang, isAr } = useLang();
    const location = useLocation();

  const { addToast } = useToast();
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [types, setTypes] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [curriculums, setCurriculums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const initTypeFilter = () => {
    const tf = location.state?.typeFilter;
    if (tf === 'teacher') return '1';
    if (tf === 'supervisor') return '2';
    return 'All';
  };
  const [applied, setApplied] = useState(() => ({ typeid: initTypeFilter(), divisionid: 'All', curriculumid: 'All' }));
  const [draftFilters, setDraftFilters] = useState(() => ({ typeid: initTypeFilter(), divisionid: 'All', curriculumid: 'All' }));
  const [showAddRow, setShowAddRow] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [editData, setEditData] = useState(EMPTY_FORM);
  const [isLoading, setIsLoading] = useState(false);
  const [editingCell, setEditingCell] = useState(null);
  const [deleteModal, setDeleteModal] = useState({ show: false, employee: null });
  const { sorted: sortedEmployees, sortCol, sortDir, handleSort } = useSortable(employees, 'employeeid');
  const { columnSearch, activeSearch, setActiveSearch, setColumnSearch, applyColumnSearch } = useColumnSearch(); // { employeeid, field, value }
  const [csvErrorModal, setCsvErrorModal] = useState({ show: false, errors: [] });
  const [csvConfirmModal, setCsvConfirmModal] = useState({ show: false, rows: [], fileName: '' });
  const [confirm, setConfirm] = useState({ open: false, action: null });

  useEffect(() => {
    const handler = () => { fetchData(); };
    window.addEventListener('langChanged', handler);
    return () => window.removeEventListener('langChanged', handler);
  }, []);

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const cachedTypes = getCached(`lookup:types_tbl`);
      const cachedDiv = getCached(`lookup:divisions_tbl`);
      const cachedCur = getCached(`lookup:curriculums_tbl`);

      const [empList, empTypes, typeList, divisionsList, curriculumsList, teacherAssigns, supervisorAssigns] = await Promise.all([
        rest('employee_tbl', { schoolid: `eq.${user.schoolid}`, branchid: `eq.${user.branchid}`, select: 'employeeid,employeename,employeename_en,employeeemail,employeemobile,divisionid,curriculumid,notes' }),
        rest('employees_types_tbl', { select: 'employeeid,typeid' }),
        cachedTypes ? Promise.resolve(cachedTypes) : rest('types_tbl', { select: 'typeid,typename,typename_en' }),
        cachedDiv ? Promise.resolve(cachedDiv) : rest('divisions_tbl', { schoolid: `eq.${user.schoolid}`, branchid: `eq.${user.branchid}`, select: 'divisionid,divisionname,divisionname_en' }),
        cachedCur ? Promise.resolve(cachedCur) : rest('curriculums_tbl', { schoolid: `eq.${user.schoolid}`, branchid: `eq.${user.branchid}`, select: 'curriculumid,curriculumname,curriculumname_en' }),
        rest('employees_sections_subjects_classes_semisters_curriculums_tbl', { schoolid: `eq.${user.schoolid}`, branchid: `eq.${user.branchid}`, select: 'employeeid,divisionid,curriculumid' }),
        rest('employees_types_stages_tbl', { schoolid: `eq.${user.schoolid}`, branchid: `eq.${user.branchid}`, select: 'employeeid,divisionid,curriculumid' }),
      ]);

      if (!cachedTypes) setCached(`lookup:types_tbl`, typeList);
      if (!cachedDiv) setCached(`lookup:divisions_tbl`, divisionsList);
      if (!cachedCur) setCached(`lookup:curriculums_tbl`, curriculumsList);

      const merged = empList.map((e) => {
        const et = empTypes.find((t) => t.employeeid === e.employeeid);
        const t = typeList.find((x) => x.typeid === et?.typeid);
        const teacherAssign = teacherAssigns.find((row) => row.employeeid === e.employeeid);
        const supervisorAssign = supervisorAssigns.find((row) => row.employeeid === e.employeeid);
        // Collect ALL unique division+curriculum combos from both assignment tables
        const allAssignRows = [
          ...teacherAssigns.filter(r => r.employeeid === e.employeeid),
          ...supervisorAssigns.filter(r => r.employeeid === e.employeeid),
        ];
        // Also include employee_tbl divisionid/curriculumid if set
        if (e.divisionid && e.curriculumid) {
          allAssignRows.push({ divisionid: e.divisionid, curriculumid: e.curriculumid });
        }
        // Deduplicate by divisionid+curriculumid
        const seen = new Set();
        const uniqueCombos = allAssignRows.filter(r => {
          const key = `${r.divisionid}-${r.curriculumid}`;
          if (seen.has(key)) return false;
          seen.add(key); return true;
        });
        // Build display strings
        const uniqueDivIds = [...new Set(uniqueCombos.map(r => r.divisionid).filter(Boolean))];
        const uniqueCurIds = [...new Set(uniqueCombos.map(r => r.curriculumid).filter(Boolean))];
        const divisionnames = uniqueDivIds.map(id => {
          const d = divisionsList.find(d => String(d.divisionid) === String(id));
          return getField(d, 'divisionname', 'divisionname_en', lang) || d?.divisionname || String(id);
        }).join(', ') || '—';
        const curriculumnames = uniqueCurIds.map(id => {
          const cv = curriculumsList.find(c => String(c.curriculumid) === String(id));
          return getField(cv, 'curriculumname', 'curriculumname_en', lang) || cv?.curriculumname || String(id);
        }).join(', ') || '—';

        return {
          ...e,
          typeid: et?.typeid,
          typename: getField(t, 'typename', 'typename_en', lang) || t?.typename || 'Unknown',
          displayname: getField(e, 'employeename', 'employeename_en', lang) || e.employeename_en || e.employeename || '',
          employeename_en: e.employeename_en || e.employeename || '',
          divisionid: uniqueDivIds[0] ?? null,
          curriculumid: uniqueCurIds[0] ?? null,
          divisionname: divisionnames,
          curriculumname: curriculumnames,
        };
      });
      setEmployees(merged);
      setTypes(typeList);
      setDivisions(divisionsList);
      setCurriculums(curriculumsList);
    } catch (e) {
      addToast(getErrorMessage(e, 'deleteEmployee'), 'error');
    } finally {
      setLoading(false);
    }
  }, [user, addToast, lang]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const employeeSummary = useMemo(() => {
    const counts = employees.reduce((acc, employee) => {
      const label = employee.typename || 'Unknown';
      acc[label] = (acc[label] || 0) + 1;
      return acc;
    }, {});

    const dynamicTypes = types
      .map((type) => ({
        label: getField(type, 'typename', 'typename_en', lang) || type.typename || 'Unknown',
        count: counts[getField(type, 'typename', 'typename_en', lang) || type.typename || 'Unknown'] || 0,
      }))
      .filter((item) => item.count > 0);

    Object.entries(counts).forEach(([label, count]) => {
      if (!dynamicTypes.some((item) => item.label === label)) {
        dynamicTypes.push({ label, count });
      }
    });

    return [{ label: t('totalEmployees', lang), count: employees.length }, ...dynamicTypes];
  }, [employees, types, lang]);

  const filtered = applyColumnSearch(sortedEmployees
    .filter((e) => {
      const q = search.toLowerCase();
      const ms = !search || e.employeename?.toLowerCase().includes(q) || getField(e, 'employeename', 'employeename_en', lang)?.toLowerCase().includes(q) || e.employeeemail?.toLowerCase().includes(q) || String(e.employeeid).includes(q);
      const mt = applied.typeid === 'All' || String(e.typeid) === applied.typeid;
      const md = applied.divisionid === 'All' || String(e.divisionid) === applied.divisionid;
      const mc = applied.curriculumid === 'All' || String(e.curriculumid) === applied.curriculumid;
      return ms && mt && md && mc;
    }));

  async function createEmployee(payload) {
    const res = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employeename: payload.employeename,
        employeename_en: (payload.employeename_en || '').trim(),
        employeeemail: payload.employeeemail,
        typeid: Number.parseInt(payload.typeid, 10),
        schoolid: user.schoolid,
        branchid: user.branchid,
      }),
    });
    if (!res.ok) {
      const body = await res.json();
      const rawMsg = (body.error || body.message || '').toLowerCase();
      if (rawMsg.includes('already') || rawMsg.includes('exist') || rawMsg.includes('duplicate') || rawMsg.includes('unique')) {
        throw new Error(`An employee with the email "${payload.employeeemail}" is already registered. Please use a different email or update the existing employee.`);
      }
      if (rawMsg.includes('email') || rawMsg.includes('invalid')) {
        throw new Error(`The email address "${payload.employeeemail}" is not valid. Please check and try again.`);
      }
      throw new Error(body.error || body.message || 'Failed to create employee. Please try again.');
    }
    const data = await res.json();
    const newId = data.employee?.employeeid || data.employeeid;
    if (!newId) throw new Error('Employee ID was not returned');

    await dbQuery(`employees_types_tbl`, 'POST',
      { employeeid: newId, typeid: Number.parseInt(payload.typeid, 10) },
      'return=minimal'
    );

    const patchBody = {};
    if (payload.employeemobile) patchBody.employeemobile = payload.employeemobile;
    if (payload.employeename_en) patchBody.employeename_en = payload.employeename_en.trim();
    if (payload.divisionid) patchBody.divisionid = payload.divisionid;
    if (payload.curriculumid) patchBody.curriculumid = payload.curriculumid;

    if (Object.keys(patchBody).length > 0) {
      await dbQuery(`employee_tbl?employeeid=eq.${newId}`, 'PATCH', patchBody);
    }

    return newId;
  }

  const isEmployeeFormValid = Boolean(
    formData.employeename.trim() &&
    formData.employeename_en.trim() &&
    formData.employeeemail.trim() &&
    formData.typeid &&
    isTenDigitPhone(formData.employeemobile)
  );

  const handleCreate = async () => {
    if (
      !formData.employeename.trim() ||
      !formData.employeename_en.trim() ||
      !formData.employeeemail.trim() ||
      !formData.typeid
    ) {
      addToast('All fields are required.', 'warning');
      return;
    }
    if (!isTenDigitPhone(formData.employeemobile)) {
      addToast('Mobile number must be exactly 10 digits.', 'warning');
      return;
    }
    setIsLoading(true);
    try {
      const newId = await createEmployee(formData);
      // If division+curriculum were selected, store them on any existing assignment rows.
      // For brand-new employees with no assignments yet, they'll be set when first assigned.

      addToast(`${TYPE_MAP[formData.typeid] || 'Employee'} created.`, 'success');
      setFormData(EMPTY_FORM);
      setShowAddRow(false);
      fetchData();
    } catch (err) {
      addToast(err.message || 'Failed to create employee. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCsvUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setCsvErrorModal({ show: false, errors: [] });
    setIsLoading(true);
    try {
      // Support both CSV and XLSX
      let rows;
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs');
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array', cellText: true, raw: false });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        // Use raw:false so numbers stay as strings (preserves leading zeros)
        rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
      } else {
        rows = await readCsvFile(file);
      }
      // Build typeMap dynamically from loaded types (case-insensitive by EN name)
      const typeMap = {};
      types.forEach(tp => {
        const enName = (tp.typename_en || tp.typename || '').toLowerCase().trim();
        const arName = (tp.typename || '').toLowerCase().trim();
        if (enName) typeMap[enName] = String(tp.typeid);
        if (arName && arName !== enName) typeMap[arName] = String(tp.typeid);
      });
      // Fallback hardcoded mappings
      if (!typeMap['teacher']) typeMap['teacher'] = '1';
      if (!typeMap['supervisor']) typeMap['supervisor'] = '2';
      if (!typeMap['admin']) typeMap['admin'] = '6';
      const validTypeNames = types.map(tp => tp.typename_en || tp.typename).filter(Boolean).join(', ');

      const validationErrors = [];
      const validRows = [];
      const seenEmails = new Set();

      // ── PHASE 1: Validate ALL rows first ────────────────────────────────
      // Skip the hint/example row (first data row = yellow row in the xlsx template)
      const dataRows = rows.filter((row, i) => {
        const firstVal = Object.values(row)[0] || '';
        // Skip if the first cell looks like a hint (contains 'e.g.' or 'example' or 'Arabic name')
        return !String(firstVal).toLowerCase().includes('e.g.') &&
               !String(firstVal).toLowerCase().includes('arabic name') &&
               !String(firstVal).toLowerCase().includes('example') &&
               Object.values(row).some(v => String(v || '').trim() !== '');
      });
      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const rowNum = i + 2;
        const rowErrors = [];

        // Read columns — flexible case-insensitive key matching
        const getCol = (keys) => {
          for (const k of keys) {
            const found = Object.keys(row).find(rk => rk.toLowerCase().replace(/\s+/g,'') === k.toLowerCase().replace(/\s+/g,''));
            if (found && row[found]?.trim()) return row[found].trim();
          }
          return '';
        };

        const empname    = getCol(['employeename']);
        const empname_en = getCol(['employeename_en']);
        const empemail   = getCol(['employeeemail', 'email']);
        let empmobile  = getCol(['employeemobile', 'mobile']);
        const typeRaw    = getCol(['type']).toLowerCase();
        const divRaw     = getCol(['divisionname', 'division name', 'division']);
        const curRaw     = getCol(['curriculumname', 'curriculum name', 'curriculum']);

        if (!empname) {
          rowErrors.push('Arabic Name is missing');
        } else if (!/[\u0600-\u06FF]/.test(empname)) {
          rowErrors.push(`Arabic Name "${empname}" must contain Arabic characters`);
        } else if (/[a-zA-Z]/.test(empname)) {
          rowErrors.push(`Arabic Name "${empname}" must not contain English characters — use the Arabic name field for Arabic only`);
        }
        if (!empname_en) {
          rowErrors.push('English Name is missing');
        } else if (/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(empname_en)) {
          rowErrors.push(`English Name "${empname_en}" must not contain Arabic characters — use the English name field for English only`);
        } else if (!/[a-zA-Z]/.test(empname_en)) {
          rowErrors.push(`English Name "${empname_en}" must contain English characters`);
        }
        if (!empemail) {
          rowErrors.push('Email is missing');
        } else if (seenEmails.has(empemail.toLowerCase())) {
          rowErrors.push(`Email "${empemail}" is duplicated in this file — each employee must have a unique email`);
        } else {
          seenEmails.add(empemail.toLowerCase());
        }

        const typeid = typeMap[typeRaw];
        if (!typeRaw) rowErrors.push(`Employee type is missing — valid types: ${validTypeNames || 'Teacher, Supervisor, Admin'}`);
        else if (!typeid) rowErrors.push(`"${typeRaw}" is not a valid employee type — valid types: ${validTypeNames || 'Teacher, Supervisor, Admin'}`);

        // Auto-pad 9-digit numbers with a leading 0 (Excel strips it on save)
        if (empmobile && String(empmobile).length === 9) empmobile = '0' + empmobile;
        if (!empmobile) rowErrors.push('Mobile number is missing');
        else if (!/^\d{10}$/.test(empmobile)) rowErrors.push(`Mobile "${empmobile}" must be exactly 10 digits`);

        let divisionid = null;
        if (divRaw) {
          const divMatch = divisions.find(d => (getField(d, 'divisionname', 'divisionname_en', lang) || d.divisionname || '').toLowerCase() === divRaw.toLowerCase());
          if (!divMatch) {
            const validDivisions = divisions.map(d => getField(d, 'divisionname', 'divisionname_en', lang) || d.divisionname).join(', ');
            rowErrors.push(`Division "${divRaw}" not found — valid options: ${validDivisions || 'none'}`);
          } else divisionid = divMatch.divisionid;
        }

        let curriculumid = null;
        if (curRaw) {
          const curMatch = curriculums.find(c => (getField(c, 'curriculumname', 'curriculumname_en', lang) || c.curriculumname || '').toLowerCase() === curRaw.toLowerCase());
          if (!curMatch) {
            const validCurriculums = curriculums.map(c => getField(c, 'curriculumname', 'curriculumname_en', lang) || c.curriculumname).join(', ');
            rowErrors.push(`Curriculum "${curRaw}" not found — valid options: ${validCurriculums || 'none'}`);
          } else curriculumid = curMatch.curriculumid;
        }

        if (rowErrors.length > 0) {
          validationErrors.push({ rowNum, name: empname_en || empname || 'No Name', errors: rowErrors });
        } else {
          validRows.push({ empname, empname_en, empemail, empmobile, typeid, divisionid, curriculumid });
        }
      }

      // ── PHASE 2: If ANY errors, store them and prompt via toast ──────────
      if (validationErrors.length > 0) {
        setCsvErrorModal({ show: false, errors: validationErrors });
        addToast(
          `${validationErrors.length} invalid row(s) found. Nothing was uploaded.`,
          'error',
          {
            label: 'View Details',
            onClick: () => setCsvErrorModal(p => ({ ...p, show: true })),
          }
        );
        return;
      }

      // ── PHASE 3: All rows valid — show confirmation before uploading ─────
      setCsvConfirmModal({ show: true, rows: validRows, fileName: file.name });
    } catch (err) {
      addToast(err.message || 'Upload failed. Please check the file and try again.', 'error');
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
      let successCount = 0;
      for (const row of validRows) {
        await createEmployee({ employeename: row.empname, employeename_en: row.empname_en, employeeemail: row.empemail, employeemobile: row.empmobile, typeid: row.typeid, divisionid: row.divisionid, curriculumid: row.curriculumid });
        successCount++;
      }
      setCsvErrorModal({ show: false, errors: [] });
      addToast(`${successCount} employee(s) uploaded successfully.`, 'success');
      fetchData();
    } catch (err) {
      addToast(err.message || 'Upload failed. Please check the file and try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const openEdit = (employee) => {
    setSelectedEmp(employee);
    setEditData({
      employeename: employee.employeename || '',
      employeename_en: employee.employeename_en || '',
      employeeemail: employee.employeeemail || '',
      employeemobile: employee.employeemobile || '',
      typeid: String(employee.typeid || ''),
      divisionid: String(employee.divisionid || ''),
      curriculumid: String(employee.curriculumid || ''),
      notes: employee.notes || '',
    });
  };

  const handleUpdate = async () => {
    if (!selectedEmp) return;
    if (!editData.employeename.trim() || !editData.employeename_en.trim() || !editData.employeeemail.trim() || !editData.typeid) {
      addToast('Please fill in all required fields.', 'warning');
      return;
    }
    if (editData.employeemobile && !isTenDigitPhone(editData.employeemobile)) {
      addToast('Mobile number must be exactly 10 digits.', 'warning');
      return;
    }
    setIsLoading(true);
    try {
      await update('employee_tbl', selectedEmp.employeeid, 'employeeid', {
        employeename: editData.employeename.trim(),
        employeename_en: editData.employeename_en.trim(),
        employeeemail: editData.employeeemail.trim(),
        employeemobile: editData.employeemobile || null,
        divisionid: editData.divisionid ? Number.parseInt(editData.divisionid, 10) : null,
        curriculumid: editData.curriculumid ? Number.parseInt(editData.curriculumid, 10) : null,
        notes: editData.notes?.trim() || null,
      });
      await dbQuery(`employees_types_tbl?employeeid=eq.${selectedEmp.employeeid}`, 'PATCH',
        { typeid: Number.parseInt(editData.typeid, 10) }
      );

      addToast('Employee updated.', 'success');
      setSelectedEmp(null);
      fetchData();
    } catch (err) {
      addToast(getErrorMessage(err, 'general'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (employee) => {
    setDeleteModal({ show: false, employee: null });
    try {
      await dbQuery(`employees_types_tbl?employeeid=eq.${employee.employeeid}`, 'DELETE');
      await remove('employee_tbl', employee.employeeid, 'employeeid');

      // Also delete the Supabase Auth user so the email can be re-registered
      try {
        const users = await dbQuery(`auth/v1/admin/users?per_page=1000`);
        const authUser = (users?.users || []).find(u => u.email === employee.employeeemail);
        if (authUser?.id) {
          await dbQuery(`auth/v1/admin/users/${authUser.id}`, 'DELETE');
        }
      } catch (_) {
        // Auth deletion is best-effort — don't block the UI if it fails
      }

      addToast('Employee deleted.', 'success');
      fetchData();
    } catch (err) {
      addToast(getErrorMessage(err, 'deleteEmployee'), 'error');
    }
  };

  const saveCellEdit = () => {
    if (!editingCell) return;
    const { field, value } = editingCell;
    if (field === 'employeemobile' && value && !isTenDigitPhone(value)) {
      addToast('Mobile number must be exactly 10 digits.', 'warning');
      return;
    }
    setConfirm({ open: true, action: 'cell' });
  };

  const executeCellSave = async () => {
    if (!editingCell) return;
    const { employeeid, field, value } = editingCell;
    setEditingCell(null);
    try {
      await dbQuery(`employee_tbl?employeeid=eq.${employeeid}`, 'PATCH', { [field]: value || null });
      fetchData();
    } catch (err) {
      addToast(getErrorMessage(err, 'general'), 'error');
    }
  };

  const EditableCell = ({ employee, field, display }) => {
    const isEditing = editingCell?.employeeid === employee.employeeid && editingCell?.field === field;
    if (isEditing) {
    return (
        <input
          autoFocus
          className="input-field h-8 w-full min-w-[140px] text-sm"
          type={field === 'employeemobile' ? 'tel' : 'text'}
          maxLength={field === 'employeemobile' ? 10 : undefined}
          minLength={field === 'employeemobile' ? 10 : undefined}
          pattern={field === 'employeemobile' ? '\\d{10}' : undefined}
          inputMode={field === 'employeemobile' ? 'numeric' : undefined}
          value={editingCell.value}
          onChange={(e) => setEditingCell((p) => ({ ...p, value: field === 'employeemobile' ? sanitizePhone(e.target.value) : e.target.value }))}
          onInput={field === 'employeemobile' ? (e) => { e.target.value = sanitizePhone(e.target.value); } : undefined}
          onBlur={saveCellEdit}
          onKeyDown={(e) => { if (e.key === 'Enter') saveCellEdit(); if (e.key === 'Escape') setEditingCell(null); }}
        />
      );
    }
    return (
      <span
        className="cursor-pointer hover:bg-blue-50 hover:text-blue-700 px-1.5 py-0.5 rounded transition-colors group flex items-center gap-1"
        title={isAr ? "انقر للتعديل" : "Click to edit"}
        onClick={() => setEditingCell({ employeeid: employee.employeeid, field, value: display || '' })}
      >
        {display || <span className="text-[#94a3b8] italic">{t('clickToAdd', lang)}</span>}
      </span>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#0f172a]">{t('employees', lang)}</h1>
          <p className="text-[#64748b] text-sm">{t('manageStaffAccounts', lang)}</p>
          <Breadcrumb />
        </div>
        <div className="flex items-center gap-3">
          <a href="/employees_template.xlsx" download="employees_template.xlsx" className="h-11 px-4 border border-[#e2e8f0] rounded-xl bg-white font-semibold text-sm text-[#334155] flex items-center gap-2 cursor-pointer no-underline">
            <Download className="h-4 w-4" /> {t('downloadTemplate', lang)}
          </a>
          <label className="h-11 px-4 border border-[#e2e8f0] rounded-xl bg-white font-semibold text-sm text-[#334155] flex items-center gap-2 cursor-pointer">
            <Upload className="h-4 w-4" /> {t('uploadCsv', lang)}
            <input type="file" accept=".csv,.xlsx" className="hidden" onChange={handleCsvUpload} />
          </label>
          <button onClick={() => { setShowAddRow(true); setSelectedEmp(null); }} className="btn-primary flex items-center gap-2 h-11 px-6">
            <Plus className="h-5 w-5" /> {t('addEmployee', lang)}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {employeeSummary.map((item) => (
          <div key={item.label} className="bg-white rounded-xl border border-[#e2e8f0] px-4 py-3 min-h-[84px] flex flex-col justify-center">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748b]">{item.label}</span>
            <span className="mt-2 text-2xl font-bold text-[#0f172a] leading-none">{item.count}</span>
          </div>
        ))}
      </div>

      <FilterBar
        filters={[
          { key: 'divisionid', label: t('division', lang), value: applied.divisionid, options: [{ value: 'All', label: t('allDivisions', lang) }, ...Array.from(new Map(divisions.map(d => [String(d.divisionid), d])).values()).map(d => ({ value: String(d.divisionid), label: getField(d, 'divisionname', 'divisionname_en', lang) || d.divisionname }))] },
          { key: 'curriculumid', label: t('curriculum', lang), value: applied.curriculumid, options: [{ value: 'All', label: t('allCurriculums', lang) }, ...Array.from(new Map(curriculums.map(c => [`${c.divisionid}-${c.curriculumid}`, c])).values()).map(c => ({ value: String(c.curriculumid), label: getField(c, 'curriculumname', 'curriculumname_en', lang) || c.curriculumname }))] },
          { key: 'typeid', label: t('type', lang), value: applied.typeid, options: [{ value: 'All', label: t('allTypes', lang) }, ...types.map(tp => ({ value: String(tp.typeid), label: getField(tp, 'typename', 'typename_en', lang) || tp.typename }))] },
        ]}
        appliedFilters={applied}
        onApply={(vals) => setApplied(vals)}
        onReset={(vals) => setApplied(vals)}
      />


      <div className="bg-white rounded-xl border border-[#e2e8f0] p-4 flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94a3b8]" />
          <input type="text" placeholder={isAr ? t('searchByNameOrEmail', lang) : 'Search by name or email...'} className="input-field pl-10 h-10 w-full" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="card bg-white overflow-hidden rounded-xl">
        <div className="overflow-x-auto" dir={isAr ? 'rtl' : 'ltr'}>
          <table className={`w-full ${isAr ? 'text-right' : 'text-left'}`}>
            <thead className="bg-[#f8fafc] border-b border-[#e2e8f0]">
              <tr>
                <SortableTh col="employeeid" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-4" searchValue={columnSearch['employeeid']} isSearchOpen={activeSearch==='employeeid'} onSearchOpen={()=>setActiveSearch('employeeid')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('employeeid','');}} onSearchChange={v=>setColumnSearch('employeeid',v)}>{t('id', lang)}</SortableTh>
                <SortableTh col="displayname" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-4" searchValue={columnSearch['displayname']} isSearchOpen={activeSearch==='displayname'} onSearchOpen={()=>setActiveSearch('displayname')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('displayname','');}} onSearchChange={v=>setColumnSearch('displayname',v)}>{t('name', lang)}</SortableTh>
                <SortableTh col="typename" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-4" searchValue={columnSearch['typename']} isSearchOpen={activeSearch==='typename'} onSearchOpen={()=>setActiveSearch('typename')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('typename','');}} onSearchChange={v=>setColumnSearch('typename',v)}>{t('role', lang)}</SortableTh>
                <SortableTh col="employeeemail" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-4" searchValue={columnSearch['employeeemail']} isSearchOpen={activeSearch==='employeeemail'} onSearchOpen={()=>setActiveSearch('employeeemail')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('employeeemail','');}} onSearchChange={v=>setColumnSearch('employeeemail',v)}>{t('email', lang)}</SortableTh>
                <SortableTh col="employeemobile" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-4" searchValue={columnSearch['employeemobile']} isSearchOpen={activeSearch==='employeemobile'} onSearchOpen={()=>setActiveSearch('employeemobile')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('employeemobile','');}} onSearchChange={v=>setColumnSearch('employeemobile',v)}>{t('mobile', lang)}</SortableTh>
                <SortableTh col="divisionname" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-4" searchValue={columnSearch['divisionname']} isSearchOpen={activeSearch==='divisionname'} onSearchOpen={()=>setActiveSearch('divisionname')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('divisionname','');}} onSearchChange={v=>setColumnSearch('divisionname',v)}>{t('division', lang)}</SortableTh>
                <SortableTh col="curriculumname" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-4" searchValue={columnSearch['curriculumname']} isSearchOpen={activeSearch==='curriculumname'} onSearchOpen={()=>setActiveSearch('curriculumname')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('curriculumname','');}} onSearchChange={v=>setColumnSearch('curriculumname',v)}>{t('curriculum', lang)}</SortableTh>
                <th className="px-4 py-4 text-xs font-bold text-[#64748b] uppercase tracking-wider whitespace-nowrap">{t('actions', lang)}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2e8f0]">
              {showAddRow && (
                <tr className="bg-blue-50/40">
                  <td className="px-4 py-3 text-center text-sm font-bold text-[#64748b]">{t('new', lang)}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex flex-col gap-2">
                      <div>
                        <label className="text-[11px] font-bold text-[#64748b] mb-1 block">{t('arabicName', lang)} <span className="text-red-500">*</span></label>
                        <input required className="input-field h-9" placeholder={t('arabicName', lang)} value={formData.employeename} onChange={(e) => setFormData((p) => ({ ...p, employeename: toAr(e.target.value) }))} />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-[#64748b] mb-1 block">{t('englishName', lang)} <span className="text-red-500">*</span></label>
                        <input required className="input-field h-9" placeholder={t('englishName', lang)} value={formData.employeename_en || ''} onChange={(e) => setFormData((p) => ({ ...p, employeename_en: toEn(e.target.value) }))} />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <label className="text-[11px] font-bold text-[#64748b] mb-1 block">{t('role', lang)} <span className="text-red-500">*</span></label>
                    <select required className="input-field h-9" value={formData.typeid} onChange={(e) => setFormData((p) => ({ ...p, typeid: e.target.value }))}>
                      <option value="">{t('selectType', lang) || 'Select type'}</option>
                      {types.map((type) => <option key={type.typeid} value={type.typeid}>{getField(type, 'typename', 'typename_en', lang) || type.typename}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <label className="text-[11px] font-bold text-[#64748b] mb-1 block">{t('email', lang)} <span className="text-red-500">*</span></label>
                    <input required type="email" className="input-field h-9" placeholder={t('email', lang)} value={formData.employeeemail} onChange={(e) => setFormData((p) => ({ ...p, employeeemail: e.target.value }))} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <label className="text-[11px] font-bold text-[#64748b] mb-1 block">{t('mobile', lang)} <span className="text-red-500">*</span></label>
                    <input required type="tel" maxLength={10} minLength={10} pattern="\d{10}" inputMode="numeric" className="input-field h-9" placeholder={t('mobile', lang)} value={formData.employeemobile} onChange={(e) => setFormData((p) => ({ ...p, employeemobile: sanitizePhone(e.target.value) }))} onInput={(e) => { e.target.value = sanitizePhone(e.target.value); }} />
                  </td>
                  <td className="px-4 py-3 text-center text-xs text-[#94a3b8] italic">{t('fromAssignments', lang)}</td>
                  <td className="px-4 py-3 text-center text-xs text-[#94a3b8] italic">{t('fromAssignments', lang)}</td>
                  <td className="px-4 py-3 text-center"><div className="flex gap-2"><button onClick={() => setConfirm({ open: true, action: 'create' })} disabled={!isEmployeeFormValid || isLoading} className="px-3 py-2 rounded-lg bg-[#1d4ed8] text-white text-xs font-bold disabled:opacity-60 disabled:cursor-not-allowed">{t('save', lang)}</button><button onClick={() => { setShowAddRow(false); setFormData(EMPTY_FORM); }} className="px-3 py-2 rounded-lg border text-xs font-bold">{t('cancel', lang)}</button></div></td>
                </tr>
              )}

              {loading ? (
                <tr><td colSpan={8} className="px-6 py-12 text-center text-[#94a3b8]"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-6 py-12 text-center text-[#94a3b8]">No employees found.</td></tr>
              ) : filtered.map((employee) => (
                selectedEmp?.employeeid === employee.employeeid ? (
                  <tr key={employee.employeeid} className="bg-amber-50/50 align-top">
                    <td className="px-4 py-3 text-center text-sm font-bold">#{employee.employeeid}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="space-y-2 min-w-[280px]">
                        <div><label className="text-[11px] font-bold text-[#64748b] mb-1 block">{t('arabicName', lang)} <span className="text-red-500">*</span></label><input className="input-field h-9" value={editData.employeename} onChange={(e) => setEditData((p) => ({ ...p, employeename: toAr(e.target.value) }))} /></div>
                        <div><label className="text-[11px] font-bold text-[#64748b] mb-1 block">{t('englishName', lang)} <span className="text-red-500">*</span></label><input className="input-field h-9" value={editData.employeename_en || ''} onChange={(e) => setEditData((p) => ({ ...p, employeename_en: toEn(e.target.value) }))} /></div>
                        <div><label className="text-[11px] font-bold text-[#64748b] mb-1 block">{isAr ? "ملاحظات" : "Notes"}</label><textarea className="input-field min-h-[76px] w-full py-2" value={editData.notes || ''} onChange={(e) => setEditData((p) => ({ ...p, notes: e.target.value }))} /></div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="space-y-2 min-w-[180px]">
                        <div><label className="text-[11px] font-bold text-[#64748b] mb-1 block">{t('role', lang)} <span className="text-red-500">*</span></label><select className="input-field h-9" value={editData.typeid} onChange={(e) => setEditData((p) => ({ ...p, typeid: e.target.value }))}>{types.map((type) => <option key={type.typeid} value={type.typeid}>{getField(type, 'typename', 'typename_en', lang) || type.typename}</option>)}</select></div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <label className="text-[11px] font-bold text-[#64748b] mb-1 block">{t('email', lang)} <span className="text-red-500">*</span></label>
                      <input type="email" className="input-field h-9 min-w-[180px]" value={editData.employeeemail} onChange={(e) => setEditData((p) => ({ ...p, employeeemail: e.target.value }))} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <label className="text-[11px] font-bold text-[#64748b] mb-1 block">{t('mobile', lang)} <span className="text-red-500">*</span></label>
                      <input type="tel" maxLength={10} minLength={10} pattern="\d{10}" inputMode="numeric" className="input-field h-9 min-w-[150px]" value={editData.employeemobile} onChange={(e) => setEditData((p) => ({ ...p, employeemobile: sanitizePhone(e.target.value) }))} onInput={(e) => { e.target.value = sanitizePhone(e.target.value); }} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <label className="text-[11px] font-bold text-[#64748b] mb-1 block">{t('division', lang)}</label>
                      <select className="input-field h-9 min-w-[140px]" value={editData.divisionid} onChange={(e) => setEditData((p) => ({ ...p, divisionid: e.target.value }))}><option value="">—</option>{divisions.map((division) => <option key={division.divisionid} value={division.divisionid}>{getField(division, 'divisionname', 'divisionname_en', lang) || division.divisionname}</option>)}</select>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <label className="text-[11px] font-bold text-[#64748b] mb-1 block">{t('curriculum', lang)}</label>
                      <select className="input-field h-9 min-w-[140px]" value={editData.curriculumid} onChange={(e) => setEditData((p) => ({ ...p, curriculumid: e.target.value }))}><option value="">—</option>{curriculums.map((curriculum) => <option key={curriculum.curriculumid} value={curriculum.curriculumid}>{getField(curriculum, 'curriculumname', 'curriculumname_en', lang) || curriculum.curriculumname}</option>)}</select>
                    </td>
                    <td className="px-4 py-3 text-center"><div className="flex gap-2"><button onClick={() => setConfirm({ open: true, action: 'update' })} className="px-3 py-2 rounded-lg bg-[#1d4ed8] text-white text-xs font-bold">{isAr ? "حفظ" : "Save"}</button><button onClick={() => setSelectedEmp(null)} className="px-3 py-2 rounded-lg border text-xs font-bold">{isAr ? "إلغاء" : "Cancel"}</button></div></td>
                  </tr>
                ) : (
                  <tr key={employee.employeeid} className="hover:bg-[#f8fafc] transition-colors">
                    <td className="px-4 py-3 text-center text-sm font-bold text-[#0f172a]">#{employee.employeeid}</td>
                    <td className="px-4 py-3 text-center text-sm font-semibold text-[#0f172a]">{getField(employee, 'employeename', 'employeename_en', lang) || employee.employeename}</td>
                    <td className="px-4 py-3 text-center text-sm text-[#475569]">{employee.typename}</td>
                    <td className="px-4 py-3 text-center text-sm text-[#475569]"><EditableCell employee={employee} field="employeeemail" display={employee.employeeemail} /></td>
                    <td className="px-4 py-3 text-center text-sm text-[#475569]"><EditableCell employee={employee} field="employeemobile" display={employee.employeemobile} /></td>
                    <td className="px-4 py-3 text-center text-sm text-[#475569]">{employee.divisionname}</td>
                    <td className="px-4 py-3 text-center text-sm text-[#475569]">{employee.curriculumname}</td>
                    <td className="px-4 py-3 text-center"><div className="flex items-center gap-2"><button onClick={() => openEdit(employee)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg border border-blue-50"><Edit2 className="h-4 w-4" /></button><button onClick={() => setDeleteModal({ show: true, employee })} className="p-2 text-red-500 hover:bg-red-50 rounded-lg border border-red-50"><Trash2 className="h-4 w-4" /></button></div></td>
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

      {isLoading && <div className="text-sm text-[#64748b]">Saving changes...</div>}

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
                    const errorRows = csvErrorModal.errors.map(e => ({ 'Row #': e.rowNum, 'Employee Name': e.name, 'Error Reason': e.errors.join(' | ') }));
                    const ws = XLSX.utils.json_to_sheet(errorRows);
                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, ws, 'Upload Errors');
                    XLSX.writeFile(wb, 'employee_upload_errors.xlsx');
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
                    <th className="px-4 py-3 text-xs font-bold text-red-700 uppercase w-40">Name</th>
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
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteModal({ show: false, employee: null })} />
          <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-base font-bold text-[#0f172a] mb-2">{isAr ? 'تأكيد الحذف' : 'Confirm Delete'}</h3>
            <p className="text-sm text-[#64748b] mb-1">{isAr ? 'أنت على وشك حذف الموظف:' : 'You are about to delete employee:'}</p>
            <p className="text-sm font-bold text-[#0f172a] mb-5">{getField(deleteModal.employee, 'employeename', 'employeename_en', lang) || deleteModal.employee?.employeename}</p>
            <p className="text-sm text-[#64748b] mb-6">{isAr ? 'هل أنت متأكد؟ لا يمكن التراجع عن هذا الإجراء.' : 'Are you sure? This action cannot be undone.'}</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteModal({ show: false, employee: null })} className="px-4 py-2 rounded-lg border border-[#e2e8f0] text-sm font-semibold text-[#64748b] hover:bg-slate-50">{isAr ? 'لا' : 'No'}</button>
              <button onClick={() => handleDelete(deleteModal.employee)} className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-bold hover:bg-red-700">{isAr ? 'نعم، احذف' : 'Yes, Delete'}</button>
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
                ? `هل تريد رفع ${csvConfirmModal.rows.length} موظف من "${csvConfirmModal.fileName}"؟`
                : `You are about to upload ${csvConfirmModal.rows.length} employee(s) from "${csvConfirmModal.fileName}". This action cannot be undone.`}
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setCsvConfirmModal({ show: false, rows: [], fileName: '' })} className="px-4 py-2 rounded-lg border border-[#e2e8f0] text-sm font-semibold text-[#64748b] hover:bg-slate-50">{t('cancel', lang)}</button>
              <button onClick={confirmCsvUpload} disabled={isLoading} className="px-4 py-2 rounded-lg bg-[#1d4ed8] text-white text-sm font-bold hover:bg-[#1e40af] disabled:opacity-60">{isAr ? 'تأكيد الرفع' : 'Confirm Upload'}</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirm.open}
        title={confirm.action === 'create' ? (isAr ? 'تأكيد الإضافة' : 'Confirm Create') : confirm.action === 'update' ? (isAr ? 'تأكيد الحفظ' : 'Confirm Save') : (isAr ? 'تأكيد التعديل' : 'Confirm Edit')}
        message={confirm.action === 'create'
          ? (isAr ? 'هل تريد إضافة هذا الموظف؟' : 'Add this employee to the system?')
          : confirm.action === 'update'
          ? (isAr ? 'هل تريد حفظ التغييرات على هذا الموظف؟' : 'Save changes to this employee?')
          : (isAr ? 'هل تريد حفظ هذا التعديل؟' : 'Save this change?')}
        confirmLabel={confirm.action === 'create' ? (isAr ? 'إضافة' : 'Create') : (isAr ? 'حفظ' : 'Save')}
        variant="primary"
        loading={isLoading}
        onCancel={() => setConfirm({ open: false, action: null })}
        onConfirm={() => {
          const action = confirm.action;
          setConfirm({ open: false, action: null });
          if (action === 'create') handleCreate();
          else if (action === 'update') handleUpdate();
          else if (action === 'cell') executeCellSave();
        }}
      />
    </div>
  );
}
