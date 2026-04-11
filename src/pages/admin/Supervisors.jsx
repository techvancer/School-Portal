import { getErrorMessage } from '../../lib/langHelper';
import { t, getField, getStudentName as _getStudentName } from '../../lib/langHelper';
import { useLang } from '../../context/LanguageContext';
import { useLocation } from 'react-router-dom';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Mail, Shield, Edit2, Trash2, X, Loader2, Download, Upload, Plus, Hash } from 'lucide-react';
import Breadcrumb from '../../components/Breadcrumb';
import FilterBar from '../../components/FilterBar';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { rest, update, remove, dbQuery, EDGE_FUNCTION_URL } from '../../lib/supabaseClient';
import { readCsvFile, pick } from '../../lib/adminCsv';
import { useSortable } from '../../lib/useSortable';
import { useColumnSearch } from '../../lib/useColumnSearch';
import SortableTh from '../../components/SortableTh';

const EMPTY_FORM = { employeename: '', employeename_en: '', employeeemail: '', employeemobile: '', stageid: '' };
const toEn = (v) => v.replace(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g, '');
const toAr = (v) => v.replace(/[a-zA-Z]/g, '');

export default function AdminSupervisors() {
    const { lang, isAr } = useLang();

    const { addToast } = useToast();
    const { user } = useAuth();
    const location = useLocation();
    const hasRunFromState = useRef(false);
    const [supervisors, setSupervisors] = useState([]);
    const [stages, setStages] = useState([]);
    const [divisions, setDivisions] = useState([]);
    const [curriculums, setCurriculums] = useState([]);
    const [loading, setLoading] = useState(false);
    const [hasApplied, setHasApplied] = useState(false);
    const [search, setSearch] = useState('');
    const [stageFilter, setStageFilter] = useState('All');
    const [showAddRow, setShowAddRow] = useState(false);
    const [formData, setFormData] = useState(EMPTY_FORM);
    const [selectedSup, setSelectedSup] = useState(null);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editData, setEditData] = useState(EMPTY_FORM);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const { sorted: sortedSupervisors, sortCol, sortDir, handleSort } = useSortable(supervisors, 'employeeid');
    const { columnSearch, activeSearch, setActiveSearch, setColumnSearch, applyColumnSearch } = useColumnSearch();
    const [isLoading, setIsLoading] = useState(false);
    const [csvErrors, setCsvErrors] = useState([]);

    // Load stages on mount so dropdown is populated before Apply Filter
    useEffect(() => {
        if (!user) return;
        (async () => {
            try {
                const stgList = await rest('stages_tbl', { schoolid: `eq.${user.schoolid}`, branchid: `eq.${user.branchid}`, select: '*' });
                setStages([...new Map(stgList.map(s => [s.stageid, s])).values()]);
            } catch {}
        })();
    }, [user, lang]);

    const fetchData = useCallback(async () => {
        if (!user) return;
        try {
            setLoading(true);
            const [empTypes, empList, stgList, supStages, divList, curList, empAssign] = await Promise.all([
                rest('employees_types_tbl', { typeid: 'eq.2', select: 'employeeid' }),
                rest('employee_tbl', { schoolid: `eq.${user.schoolid}`, branchid: `eq.${user.branchid}`, select: '*' }),
                rest('stages_tbl', { schoolid: `eq.${user.schoolid}`, branchid: `eq.${user.branchid}`, select: '*' }),
                rest('employees_types_stages_tbl', { schoolid: `eq.${user.schoolid}`, branchid: `eq.${user.branchid}`, select: '*' }),
                rest('divisions_tbl', { schoolid: `eq.${user.schoolid}`, branchid: `eq.${user.branchid}`, select: '*' }).catch(() => []),
                rest('curriculums_tbl', { schoolid: `eq.${user.schoolid}`, branchid: `eq.${user.branchid}`, select: '*' }).catch(() => []),
                rest('employees_sections_subjects_classes_semisters_curriculums_tbl', { schoolid: `eq.${user.schoolid}`, branchid: `eq.${user.branchid}`, select: 'employeeid,divisionid,curriculumid' }).catch(() => []),
            ]);
            const supIds = new Set(empTypes.map(e => e.employeeid));
            const uniqueStages = [...new Map(stgList.map(s => [s.stageid, s])).values()];
            const supList = empList
                .filter(e => supIds.has(e.employeeid))
                .map(e => {
                    const stgRow = supStages.find(s => s.employeeid === e.employeeid);
                    const stg = uniqueStages.find(s => s.stageid === stgRow?.stageid);
                    const a = (empAssign || []).find(x => x.employeeid === e.employeeid);
                    const d = a ? (divList || []).find(d => d.divisionid === a.divisionid) : null;
                    const cv = a ? (curList || []).find(c => c.curriculumid === a.curriculumid) : null;
                    return {
                        ...e,
                        stageid: stgRow?.stageid ?? null,
                        stageName: getField(stg, 'stagename', 'stagename_en', lang) || stg?.stagename || '—',
                        divisionname: getField(d, 'divisionname', 'divisionname_en', lang) || d?.divisionname || '—',
                        curriculumname: getField(cv, 'curriculumname', 'curriculumname_en', lang) || cv?.curriculumname || '—',
                    };
                })
                .sort((a, b) => a.employeeid - b.employeeid);
            setSupervisors(supList);
            setStages(uniqueStages);
            setDivisions(divList || []);
            setCurriculums(curList || []);
        } catch (e) { addToast(getErrorMessage(e, 'general'), 'error'); }
        finally { setLoading(false); }
    }, [user, addToast, lang]);

    // Read URL params from dashboard card click and auto-apply
    useEffect(() => {
        if (!user || hasRunFromState.current) return;
        hasRunFromState.current = true;
        const stage = (location.state || {}).stageid;
        if (stage) setStageFilter(stage);
        setHasApplied(true);
        fetchData();
    }, [fetchData, user]);

    const filtered = applyColumnSearch([...sortedSupervisors].filter(s => {
        const q = search.toLowerCase();
        const ms = !search || (getField(s, 'employeename', 'employeename_en', lang) || s.employeename || '').toLowerCase().includes(q) || (s.employeeemail || '').toLowerCase().includes(q) || String(s.employeeid).includes(q);
        const mst = stageFilter === 'All' || String(s.stageid) === stageFilter;
        return ms && mst;
    }));

    const handleCreate = async () => {
        if (!formData.employeename.trim() || !formData.employeeemail.trim()) {
            addToast(`${t('arabicName', lang)} ${t('and', lang)} ${t('email', lang)} ${t('areRequired', lang)}`, 'warning'); return;
        }
        setIsLoading(true);
        try {
            const res = await fetch(EDGE_FUNCTION_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ employeename: formData.employeename, employeename_en: getField(formData, 'employeename', 'employeename_en', lang) || formData.employeename, employeeemail: formData.employeeemail, typeid: 2, schoolid: user.schoolid, branchid: user.branchid }),
            });
            if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed'); }
            const data = await res.json();
            const newId = data.employee?.employeeid || data.employeeid;
            if (newId) {
                await dbQuery(`employees_types_tbl`, 'POST',
                    { employeeid: newId, typeid: 2 },
                    'return=minimal'
                );
                if (formData.employeemobile) {
                    await dbQuery(`employee_tbl?employeeid=eq.${newId}`, 'PATCH',
                        { employeemobile: formData.employeemobile }
                    );
                }
            }
            addToast(t('supervisorCreated', lang), 'success');
            setFormData(EMPTY_FORM);
            setShowAddRow(false);
            fetchData();
        } catch (err) { addToast(getErrorMessage(err, 'general'), 'error'); }
        finally { setIsLoading(false); }
    };

    const handleUpdate = async () => {
        if (!selectedSup) return;
        setIsLoading(true);
        try {
            await update('employee_tbl', selectedSup.employeeid, 'employeeid', {
                employeename: editData.employeename,
                employeename_en: getField(editData, 'employeename', 'employeename_en', lang) || null,
                employeeemail: editData.employeeemail,
                employeemobile: editData.employeemobile || null,
            });
            addToast(t('supervisorUpdated', lang), 'success');
            setSelectedSup(null); setIsEditOpen(false);
            fetchData();
        } catch (err) { addToast(getErrorMessage(err, 'general'), 'error'); }
        finally { setIsLoading(false); }
    };

    const handleDelete = async () => {
        try {
            await dbQuery(`employees_types_tbl?employeeid=eq.${selectedSup.employeeid}`, 'DELETE');
            await remove('employee_tbl', selectedSup.employeeid, 'employeeid');
            setIsDeleteModalOpen(false);
            addToast(t('supervisorDeleted', lang), 'success');
            fetchData();
        } catch (err) { addToast(getErrorMessage(err, 'general'), 'error'); }
    };

    const handleDownloadTemplate = () => {
        const headers = ['employeename', 'employeename_en', 'employeeemail', 'employeemobile', 'stage Name'];
        const empty   = ['', '', '', '', ''];
        const csv = [headers.join(','), empty.join(',')].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'supervisors_template.csv';
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    };

    const handleCsvUpload = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setCsvErrors([]);
        setIsLoading(true);
        try {
            const rows = await readCsvFile(file);
            const errors = [];
            const validRows = [];
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                const rowNum = i + 2;
                const getCol = (keys) => {
                    for (const k of keys) {
                        const found = Object.keys(row).find(rk => rk.toLowerCase().replace(/\s+/g, '') === k.toLowerCase().replace(/\s+/g, ''));
                        if (found && row[found]?.trim()) return row[found].trim();
                    }
                    return '';
                };
                const empname    = getCol(['employeename']);
                const empname_en = getCol(['employeename_en']);
                const empemail   = getCol(['employeeemail', 'email']);
                const empmobile  = getCol(['employeemobile', 'mobile']);
                const stageRaw   = getCol(['stagename', 'stage name', 'stage']);
                const rowErrors = [];
                if (!empname)  rowErrors.push('employeename is required');
                if (!empemail) rowErrors.push('employeeemail is required');
                if (empmobile && !/^\d{10}$/.test(empmobile)) rowErrors.push(`mobile must be 10 digits`);
                let stageid = null;
                if (stageRaw) {
                    const stg = stages.find(s => (getField(s, 'stagename', 'stagename_en', lang) || s.stagename || '').toLowerCase() === stageRaw.toLowerCase());
                    if (!stg) rowErrors.push(`stage "${stageRaw}" not found`);
                    else stageid = stg.stageid;
                }
                if (rowErrors.length > 0) errors.push({ rowNum, name: empname || `Row ${rowNum}`, errors: rowErrors });
                else validRows.push({ empname, empname_en, empemail, empmobile, stageid });
            }
            if (errors.length > 0) {
                setCsvErrors(errors);
                addToast(`${errors.length} invalid row(s). Fix errors and re-upload.`, 'error');
                return;
            }
            let count = 0;
            for (const row of validRows) {
                const res = await fetch(EDGE_FUNCTION_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ employeename: row.empname, employeename_en: row.empname_en || row.empname, employeeemail: row.empemail, typeid: 2, schoolid: user.schoolid, branchid: user.branchid }),
                });
                if (res.ok) {
                    const data = await res.json();
                    const newId = data.employee?.employeeid || data.employeeid;
                    if (newId) {
                        await dbQuery(`employees_types_tbl`, 'POST',
                            { employeeid: newId, typeid: 2 },
                            'return=minimal'
                        );
                        if (row.empmobile) await dbQuery(`employee_tbl?employeeid=eq.${newId}`, 'PATCH',
                            { employeemobile: row.empmobile }
                        );
                    }
                    count++;
                }
            }
            setCsvErrors([]);
            addToast(`${count} supervisor(s) uploaded.`, 'success');
            fetchData();
        } catch (err) { addToast(getErrorMessage(err, 'general'), 'error'); }
        finally { setIsLoading(false); event.target.value = ''; }
    };

  
    // Re-fetch when language changes
    useEffect(() => {
        const handler = () => { fetchData(); };
        window.addEventListener('langChanged', handler);
        return () => window.removeEventListener('langChanged', handler);
    }, [fetchData]);

  return (
        <div className="space-y-6 animate-fade-in pb-12">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-[#0f172a]">{t('supervisors', lang)}</h1>
                    <p className="text-[#64748b] text-sm">{t('manageSupervisorsDesc', lang)}</p>
                    <Breadcrumb />
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={handleDownloadTemplate} className="h-11 px-4 border border-[#e2e8f0] rounded-xl bg-white font-semibold text-sm text-[#334155] flex items-center gap-2">
                        <Download className="h-4 w-4" /> {t('downloadTemplate', lang)}
                    </button>
                    <label className="h-11 px-4 border border-[#e2e8f0] rounded-xl bg-white font-semibold text-sm text-[#334155] flex items-center gap-2 cursor-pointer">
                        <Upload className="h-4 w-4" /> {t('uploadCsv', lang)}
                        <input type="file" accept=".csv" className="hidden" onChange={handleCsvUpload} />
                    </label>
                    <button onClick={() => { setShowAddRow(true); setSelectedSup(null); }} className="btn-primary flex items-center gap-2 h-11 px-6">
                        <Plus className="h-5 w-5" /> {t('addSupervisor', lang)}
                    </button>
                </div>
            </div>

            <FilterBar
                filters={[
                    { key: 'stageid', label: t('stage', lang), value: stageFilter, options: [{ value: 'All', label: t('allStages', lang) }, ...stages.map(s => ({ value: String(s.stageid), label: getField(s, 'stagename', 'stagename_en', lang) || s.stagename }))] },
                ]}
                appliedFilters={{ stageid: stageFilter }}
                onApply={(vals) => { setStageFilter(vals.stageid); setHasApplied(true); fetchData(); }}
                onReset={() => { setStageFilter('All'); setHasApplied(false); }}
            />

            {csvErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 bg-red-100 border-b border-red-200 flex items-center justify-between">
                        <span className="text-sm font-bold text-red-700">⚠ {csvErrors.length} Invalid Row(s) — Nothing uploaded. Fix and re-upload.</span>
                        <button onClick={() => setCsvErrors([])} className="text-red-500 hover:text-red-700 text-xs font-bold px-2 py-1 rounded">{isAr ? "تجاهل" : "Dismiss"}</button>
                    </div>
                    <table className="w-full text-left text-sm">
                        <thead className="bg-red-100"><tr><th className="px-4 py-2 text-xs font-bold text-red-700">Row</th><th className="px-4 py-2 text-xs font-bold text-red-700">{isAr ? "الاسم" : "Name"}</th><th className="px-4 py-2 text-xs font-bold text-red-700">{isAr ? "أخطاء" : "Errors"}</th></tr></thead>
                        <tbody className="divide-y divide-red-100 bg-white">{csvErrors.map((e, i) => (<tr key={i}><td className="px-4 py-3 text-center font-bold text-[#1d4ed8]">Row {e.rowNum}</td><td className="px-4 py-3 text-center font-semibold">{e.name}</td><td className="px-4 py-3 text-center text-red-600">{e.errors.join(' · ')}</td></tr>))}</tbody>
                    </table>
                </div>
            )}

            <div className="bg-white rounded-xl border border-[#e2e8f0] p-4 flex items-center gap-3">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94a3b8]" />
                    <input type="text" placeholder={t('searchSupervisorsPlaceholder', lang)} className="input-field pl-10 h-10 w-full" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
            </div>

            <div className="card bg-white overflow-hidden rounded-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                            <tr>
                                <SortableTh col="employeeid" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-4" searchValue={columnSearch['employeeid']} isSearchOpen={activeSearch==='employeeid'} onSearchOpen={()=>setActiveSearch('employeeid')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('employeeid','');}} onSearchChange={v=>setColumnSearch('employeeid',v)}>{t('id', lang)}</SortableTh>
                                <SortableTh col="employeename_en" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-4" searchValue={columnSearch['employeename_en']} isSearchOpen={activeSearch==='employeename_en'} onSearchOpen={()=>setActiveSearch('employeename_en')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('employeename_en','');}} onSearchChange={v=>setColumnSearch('employeename_en',v)}>{t('name', lang)}</SortableTh>
                                <SortableTh col="employeeemail" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-4" searchValue={columnSearch['employeeemail']} isSearchOpen={activeSearch==='employeeemail'} onSearchOpen={()=>setActiveSearch('employeeemail')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('employeeemail','');}} onSearchChange={v=>setColumnSearch('employeeemail',v)}>{t('email', lang)}</SortableTh>
                                <SortableTh col="employeemobile" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-4" searchValue={columnSearch['employeemobile']} isSearchOpen={activeSearch==='employeemobile'} onSearchOpen={()=>setActiveSearch('employeemobile')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('employeemobile','');}} onSearchChange={v=>setColumnSearch('employeemobile',v)}>{t('mobile', lang)}</SortableTh>
                                <SortableTh col="divisionname" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-4" searchValue={columnSearch['divisionname']} isSearchOpen={activeSearch==='divisionname'} onSearchOpen={()=>setActiveSearch('divisionname')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('divisionname','');}} onSearchChange={v=>setColumnSearch('divisionname',v)}>{t('division', lang)}</SortableTh>
                                <SortableTh col="curriculumname" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-4" searchValue={columnSearch['curriculumname']} isSearchOpen={activeSearch==='curriculumname'} onSearchOpen={()=>setActiveSearch('curriculumname')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('curriculumname','');}} onSearchChange={v=>setColumnSearch('curriculumname',v)}>{t('curriculum', lang)}</SortableTh>
                                <SortableTh col="stagename" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-4" searchValue={columnSearch['stagename']} isSearchOpen={activeSearch==='stagename'} onSearchOpen={()=>setActiveSearch('stagename')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('stagename','');}} onSearchChange={v=>setColumnSearch('stagename',v)}>{t('assignedStage', lang)}</SortableTh>
                                <th className="px-4 py-4 text-xs font-bold text-[#64748b] uppercase tracking-wider whitespace-nowrap">{t('actions', lang)}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#e2e8f0]">
                            {showAddRow && (
                                <tr className="bg-blue-50/40">
                                    <td className="px-4 py-3 text-center text-sm font-bold text-[#64748b]">{t('new', lang)}</td>
                                    <td className="px-4 py-3 text-center"><div className="flex flex-col gap-1"><input className="input-field h-9" placeholder={t('arabicName', lang)} value={formData.employeename} onChange={e => setFormData(p => ({ ...p, employeename: toAr(e.target.value) }))} /><input className="input-field h-9" placeholder={t('englishName', lang)} value={getField(formData, 'employeename', 'employeename_en', lang)} onChange={e => setFormData(p => ({ ...p, employeename_en: toEn(e.target.value) }))} /></div></td>
                                    <td className="px-4 py-3 text-center"><input className="input-field h-9" placeholder={t('email', lang)} value={formData.employeeemail} onChange={e => setFormData(p => ({ ...p, employeeemail: e.target.value }))} /></td>
                                    <td className="px-4 py-3 text-center"><input className="input-field h-9" placeholder={t('mobile', lang)} value={formData.employeemobile} onChange={e => setFormData(p => ({ ...p, employeemobile: e.target.value }))} /></td>
                                    <td className="px-4 py-3 text-center text-xs text-[#94a3b8] italic" colSpan={3}>{t('fromAssignments', lang)}</td>
                                    <td className="px-4 py-3 text-center"><div className="flex gap-2"><button onClick={handleCreate} className="px-3 py-2 rounded-lg bg-[#1d4ed8] text-white text-xs font-bold">{isLoading ? '...' : t('save', lang)}</button><button onClick={() => { setShowAddRow(false); setFormData(EMPTY_FORM); }} className="px-3 py-2 rounded-lg border text-xs font-bold">{t('cancel', lang)}</button></div></td>
                                </tr>
                            )}
                            {!hasApplied ? (
                                <tr><td colSpan={8} className="px-6 py-16 text-center text-[#94a3b8] font-medium">{t('pressApplyToFilter', lang)} {t('toLoadSupervisors', lang)}</td></tr>
                            ) : loading ? (
                                <tr><td colSpan={8} className="px-6 py-12 text-center text-[#94a3b8]"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></td></tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={8} className="px-6 py-12 text-center text-[#94a3b8]">{t('noData', lang)}</td></tr>
                            ) : filtered.map(s => (
                                selectedSup?.employeeid === s.employeeid && isEditOpen ? (
                                    <tr key={s.employeeid} className="bg-amber-50/50">
                                        <td className="px-4 py-3 text-center text-sm font-bold">#{s.employeeid}</td>
                                        <td className="px-4 py-3 text-center"><input className="input-field h-9 w-full" placeholder={t('englishName', lang)} value={getField(editData, 'employeename', 'employeename_en', lang)} onChange={e => setEditData(p => ({ ...p, employeename_en: toEn(e.target.value) }))} /></td>
                                        <td className="px-4 py-3 text-center"><input className="input-field h-9 w-full" placeholder={t('email', lang)} value={editData.employeeemail} onChange={e => setEditData(p => ({ ...p, employeeemail: e.target.value }))} /></td>
                                        <td className="px-4 py-3 text-center"><input className="input-field h-9 w-full" placeholder={t('mobile', lang)} value={editData.employeemobile} onChange={e => setEditData(p => ({ ...p, employeemobile: e.target.value }))} /></td>
                                        <td className="px-4 py-3 text-center text-xs text-[#94a3b8]">{s.divisionname}</td>
                                        <td className="px-4 py-3 text-center text-xs text-[#94a3b8]">{s.curriculumname}</td>
                                        <td className="px-4 py-3 text-center text-xs text-[#94a3b8]">{s.stageName}</td>
                                        <td className="px-4 py-3 text-center"><div className="flex gap-2"><button onClick={handleUpdate} className="px-3 py-2 rounded-lg bg-[#1d4ed8] text-white text-xs font-bold">{t('save', lang)}</button><button onClick={() => { setSelectedSup(null); setIsEditOpen(false); }} className="px-3 py-2 rounded-lg border text-xs font-bold">{t('cancel', lang)}</button></div></td>
                                    </tr>
                                ) : (
                                    <tr key={s.employeeid} className="hover:bg-[#f8fafc] transition-colors">
                                        <td className="px-4 py-3 text-center"><span className="text-xs font-mono font-bold text-[#94a3b8] bg-slate-100 px-2 py-1 rounded">#{s.employeeid}</span></td>
                                        <td className="px-4 py-3 text-center text-sm font-bold text-[#0f172a]">{getField(s, 'employeename', 'employeename_en', lang) || s.employeename || '—'}</td>
                                        <td className="px-4 py-3 text-center text-sm text-[#475569]">{s.employeeemail || '—'}</td>
                                        <td className="px-4 py-3 text-center text-sm text-[#475569]">{s.employeemobile || '—'}</td>
                                        <td className="px-4 py-3 text-center text-sm text-[#475569]">{s.divisionname}</td>
                                        <td className="px-4 py-3 text-center text-sm text-[#475569]">{s.curriculumname}</td>
                                        <td className="px-4 py-3 text-center"><span className="text-[10px] font-bold text-teal-600 bg-teal-50 px-2 py-1 rounded-full uppercase">{s.stageName}</span></td>
                                        <td className="px-4 py-3 text-center"><div className="flex items-center gap-2">
                                            <button onClick={() => { setSelectedSup(s); setEditData({ employeename: s.employeename || '', employeename_en: getField(s, 'employeename', 'employeename_en', lang) || '', employeeemail: s.employeeemail || '', employeemobile: s.employeemobile || '', stageid: String(s.stageid || '') }); setIsEditOpen(true); }} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg border border-blue-100"><Edit2 className="h-4 w-4" /></button>
                                            <button onClick={() => { setSelectedSup(s); setIsDeleteModalOpen(true); }} className="p-2 text-red-500 hover:bg-red-50 rounded-lg border border-red-100"><Trash2 className="h-4 w-4" /></button>
                                        </div></td>
                                    </tr>
                                )
                            ))}
                        </tbody>
                            </div>
        <div className="p-4 bg-slate-50/50 border-t border-[#e2e8f0] flex items-center">
          <span className="text-xs font-bold text-[#64748b] uppercase tracking-wider mr-3">{t('total', lang)}</span>
          <div className="px-3 py-1 bg-white rounded-lg border border-[#e2e8f0] text-xs font-black text-[#0f172a] shadow-sm">{{filtered}}.length} {t('rows', lang)}</div>
        </div>
      </div>


            <AnimatePresence>
                {isDeleteModalOpen && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                        <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl text-center">
                            <h3 className="text-xl font-bold text-[#0f172a] mb-2">{t('deleteSupervisorTitle', lang)}</h3>
                            <p className="text-[#64748b] text-sm mb-6">{t('deleteSupervisorConfirm', lang)} <span className="font-bold text-[#0f172a]">{getField(selectedSup, 'employeename', 'employeename_en', lang) || selectedSup?.employeename}</span>?</p>
                            <div className="flex gap-4">
                                <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 px-6 py-3 font-bold text-[#64748b] hover:bg-slate-50 rounded-xl">{t('cancel', lang)}</button>
                                <button onClick={handleDelete} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl">{t('delete', lang)}</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
