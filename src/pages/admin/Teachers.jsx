import { t, getField, getStudentName as _getStudentName, getErrorMessage } from '../../lib/langHelper';
import { useLang } from '../../context/LanguageContext';
import { useLocation } from 'react-router-dom';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Edit2, Trash2, X, Loader2, Mail, Hash } from 'lucide-react';
import Breadcrumb from '../../components/Breadcrumb';
import FilterBar from '../../components/FilterBar';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { rest, update, remove, dbQuery, EDGE_FUNCTION_URL } from '../../lib/supabaseClient';
import { useFilterData } from '../../lib/useFilterData';
import { buildFilters, EMPTY_FILTER } from '../../lib/helpers';
import { useSortable } from '../../lib/useSortable';
import { useColumnSearch } from '../../lib/useColumnSearch';
import SortableTh from '../../components/SortableTh';

const EMPTY_FORM = { employeename: '', employeename_en: '', employeeemail: '', employeemobile: '' };
const toEn = (v) => v.replace(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g, '');
const toAr = (v) => v.replace(/[a-zA-Z]/g, '');

export default function AdminTeachers() {
    const { lang, isAr } = useLang();

    const { addToast } = useToast();
    const { user } = useAuth();
  const location = useLocation();
  const hasRunFromState = useRef(false);
    const filterData = useFilterData(user, lang);
    const [teachers, setTeachers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [hasApplied, setHasApplied] = useState(false);
    const [search, setSearch] = useState('');
    const [applied, setApplied] = useState({ ...EMPTY_FILTER });
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedTeacher, setSelectedTeacher] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState(EMPTY_FORM);
    const { sorted: sortedTeachers, sortCol, sortDir, handleSort } = useSortable(teachers, 'employeeid');
    const { columnSearch, activeSearch, setActiveSearch, setColumnSearch, applyColumnSearch } = useColumnSearch();

    const fetchData = useCallback(async () => {
        if (!user) return;
        try {
            setLoading(true);
            const [empTypes, empList, tchAssign, clList, secList, subList, stageList, semList, divisionsList, curriculumsList] = await Promise.all([
                rest('employees_types_tbl', { typeid: 'eq.1', select: 'employeeid' }),
                rest('employee_tbl', { schoolid: `eq.${user.schoolid}`, branchid: `eq.${user.branchid}`, select: '*' }),
                rest('employees_sections_subjects_classes_semisters_curriculums_tbl', { schoolid: `eq.${user.schoolid}`, branchid: `eq.${user.branchid}`, select: '*' }),
                rest('classes_tbl', { select: '*' }),
                rest('sections_tbl', { select: '*' }),
                rest('subjects_tbl', { select: '*' }),
                rest('stages_tbl', { select: '*' }),
                rest('semisters_tbl', { select: '*' }),
                rest('divisions_tbl', { schoolid: `eq.${user.schoolid}`, branchid: `eq.${user.branchid}`, select: '*' }),
                rest('curriculums_tbl', { schoolid: `eq.${user.schoolid}`, branchid: `eq.${user.branchid}`, select: '*' }),
            ]);
            const tchIds = new Set(empTypes.map(e => e.employeeid));
            const tchList = empList.filter(e => tchIds.has(e.employeeid)).map(e => {
                const assign = tchAssign.find(a => a.employeeid === e.employeeid);
                const cl = clList.find(c => c.classid === assign?.classid);
                const sec = secList.find(s => s.sectionid === assign?.sectionid);
                const sub = subList.find(s => s.subjectid === assign?.subjectid || s.SubjectID === assign?.subjectid);
                const stage = stageList.find(s => s.stageid === assign?.stageid);
                const sem = semList.find(s => s.semisterid === assign?.semisterid);
                const division = divisionsList.find(d => String(d.divisionid) === String(assign?.divisionid));
                const curriculum = curriculumsList.find(c => String(c.curriculumid) === String(assign?.curriculumid) && String(c.divisionid) === String(assign?.divisionid));
                return {
                    ...e,
                    classid: assign?.classid ?? null,
                    sectionid: assign?.sectionid ?? null,
                    stageid: assign?.stageid ?? null,
                    subjectid: assign?.subjectid ?? null,
                    semisterid: assign?.semisterid ?? null,
                    classname: getField(cl, 'classname', 'classname_en', lang) || cl?.classname || (cl?.classid ? `${t('class', lang)} ${cl.classid}` : '—'),
                    sectionname: getField(sec, 'sectionname', 'sectionname_en', lang) || sec?.sectionname || '—',
                    subjectName: sub?.subjectname_en || getField(sub, 'subjectname', 'Subjectname_en', lang) || sub?.subjectname || sub?.Subjectname || '—',
                    stageName: getField(stage, 'stagename', 'stagename_en', lang) || stage?.stagename || '—',
                    semistername: getField(sem, 'semistername', 'semistername_en', lang) || sem?.semistername || '—',
                    divisionid: assign?.divisionid ?? null,
                    curriculumid: assign?.curriculumid ?? null,
                    divisionname: getField(division, 'divisionname', 'divisionname_en', lang) || division?.divisionname || '—',
                    curriculumname: getField(curriculum, 'curriculumname', 'curriculumname_en', lang) || curriculum?.curriculumname || '—',
                };
            });
            setTeachers(tchList);
        } catch (e) { addToast(e.message, 'error'); }
        finally { setLoading(false); }
    }, [user, addToast, lang]);

  // Read URL params from dashboard card click and auto-apply
  useEffect(() => {
    if (!user || hasRunFromState.current) return;
    hasRunFromState.current = true;
    const keys = ['curriculumid', 'divisionid', 'stageid', 'classid', 'sectionid', 'subjectid', 'employeeid'];
    const fromUrl = {};
    const state = location.state || {};
    keys.forEach(k => { if (state[k]) fromUrl[k] = state[k]; });
    const merged = Object.keys(fromUrl).length > 0 ? { ...applied, ...fromUrl } : applied;
    if (Object.keys(fromUrl).length > 0) setApplied(merged);
    setHasApplied(true);
    fetchData();
  }, [fetchData, user]);



    const filtered = applyColumnSearch(sortedTeachers.filter(t => {
        const ms = !search || teacher.employeename?.toLowerCase().includes(search.toLowerCase()) || getField(teacher, 'employeename', 'employeename_en', lang)?.toLowerCase().includes(search.toLowerCase()) || teacher.employeeemail?.toLowerCase().includes(search.toLowerCase()) || String(teacher.employeeid).includes(search);
        const mc   = applied.classid      === 'All' || String(teacher.classid)      === applied.classid;
        const msec = applied.sectionid    === 'All' || String(teacher.sectionid)    === applied.sectionid;
        const mst  = applied.stageid      === 'All' || String(teacher.stageid)      === applied.stageid;
        const msub = applied.subjectid    === 'All' || String(teacher.subjectid)    === applied.subjectid;
        const mdiv = applied.divisionid   === 'All' || String(teacher.divisionid)   === applied.divisionid;
        const mcur = applied.curriculumid === 'All' || String(teacher.curriculumid) === applied.curriculumid;
        return ms && mc && msec && mst && msub && mdiv && mcur;
    }));

    const closeModal = () => {
        setIsAddModalOpen(false);
        setIsEditModalOpen(false);
        setFormData(EMPTY_FORM);
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const res = await fetch(EDGE_FUNCTION_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ employeename: formData.employeename, employeename_en: getField(formData, 'employeename', 'employeename_en', lang) || formData.employeename, employeeemail: formData.employeeemail, typeid: 1, schoolid: user.schoolid, branchid: user.branchid }),
            });
            if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed'); }
            const data = await res.json();
            const newEmployeeid = data.employee?.employeeid || data.employeeid;
            if (newEmployeeid) {
                await dbQuery(`employees_types_tbl`, 'POST',
                    { employeeid: newEmployeeid, typeid: 1 },
                    'return=minimal'
                );
                if (formData.employeemobile) {
                    await dbQuery(`employee_tbl?employeeid=eq.${newEmployeeid}`, 'PATCH',
                        { employeemobile: formData.employeemobile }
                    );
                }
            }
            addToast(t('teacherCreated', lang), 'success');
            closeModal();
            fetchData();
        } catch (err) { addToast(err.message, 'error'); }
        finally { setIsLoading(false); }
    };

    const handleUpdate = async (e) => {
        if (e?.preventDefault) e.preventDefault();
        setIsLoading(true);
        try {
            await update('employee_tbl', selectedTeacher.employeeid, 'employeeid', { employeename: formData.employeename, employeename_en: getField(formData, 'employeename', 'employeename_en', lang) || null, employeeemail: formData.employeeemail, employeemobile: formData.employeemobile || null });
            addToast(t('teacherUpdated', lang), 'success');
            closeModal();
            fetchData();
        } catch (err) { addToast(err.message, 'error'); }
        finally { setIsLoading(false); }
    };

    const handleDelete = async () => {
        try {
            await dbQuery(`employees_types_tbl?employeeid=eq.${selectedTeacher.employeeid}`, 'DELETE');
            await remove('employee_tbl', selectedTeacher.employeeid, 'employeeid');
            setIsDeleteModalOpen(false);
            addToast(t('teacherDeleted', lang), 'success');
            fetchData();
        } catch (err) { addToast(getErrorMessage(err, 'deleteTeacher'), 'error'); }
    };

    const openEdit = (t) => {
        setSelectedTeacher(teacher);
        setFormData({ employeename: teacher.employeename || '', employeename_en: getField(teacher, 'employeename', 'employeename_en', lang) || '', employeeemail: teacher.employeeemail || '', employeemobile: teacher.employeemobile || '' });
        setIsEditModalOpen(true);
    };

    const openAdd = () => { setFormData(EMPTY_FORM); setIsAddModalOpen(true); };

  
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
                    <h1 className="text-xl sm:text-2xl font-bold text-[#0f172a]">{t('teachers', lang)}</h1>
                    <p className="text-[#64748b] text-sm">{t('manageTeachersDesc', lang)}</p>
                    <Breadcrumb />
                </div>
            </div>

            <FilterBar
                filters={buildFilters(applied, filterData, {}, lang).filter(f => f.key !== 'examid' && f.key !== 'semisterid')}
                onApply={vals => { setApplied(vals); setHasApplied(true); fetchData(); }}
                onReset={vals => { setApplied(vals); setHasApplied(false); setTeachers([]); }}
            />
            <div className="bg-white rounded-xl border border-[#e2e8f0] p-4 flex items-center gap-3">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94a3b8]" />
                    <input type="text" placeholder={t('searchTeachersAdminPlaceholder', lang)} className="input-field pl-10 h-10 w-full" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
            </div>

            <div className="card bg-white overflow-hidden rounded-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                            <tr>
                                <SortableTh col="employeeid" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-4" searchValue={columnSearch['employeeid']} isSearchOpen={activeSearch==='employeeid'} onSearchOpen={()=>setActiveSearch('employeeid')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('employeeid','');}} onSearchChange={v=>setColumnSearch('employeeid',v)}>{t('id', lang)}</SortableTh>
                                <SortableTh col="employeename_en" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-4" searchValue={columnSearch['employeename_en']} isSearchOpen={activeSearch==='employeename_en'} onSearchOpen={()=>setActiveSearch('employeename_en')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('employeename_en','');}} onSearchChange={v=>setColumnSearch('employeename_en',v)}>{t('name', lang)} (AR / EN)</SortableTh>
                                <SortableTh col="employeeemail" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-4" searchValue={columnSearch['employeeemail']} isSearchOpen={activeSearch==='employeeemail'} onSearchOpen={()=>setActiveSearch('employeeemail')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('employeeemail','');}} onSearchChange={v=>setColumnSearch('employeeemail',v)}>{t('email', lang)}</SortableTh>
                                <SortableTh col="employeemobile" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-4" searchValue={columnSearch['employeemobile']} isSearchOpen={activeSearch==='employeemobile'} onSearchOpen={()=>setActiveSearch('employeemobile')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('employeemobile','');}} onSearchChange={v=>setColumnSearch('employeemobile',v)}>{t('mobile', lang)}</SortableTh>
                                <SortableTh col="subjectname" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-4" searchValue={columnSearch['subjectname']} isSearchOpen={activeSearch==='subjectname'} onSearchOpen={()=>setActiveSearch('subjectname')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('subjectname','');}} onSearchChange={v=>setColumnSearch('subjectname',v)}>{t('subject', lang)}</SortableTh>
                                <SortableTh col="classname" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-4" searchValue={columnSearch['classname']} isSearchOpen={activeSearch==='classname'} onSearchOpen={()=>setActiveSearch('classname')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('classname','');}} onSearchChange={v=>setColumnSearch('classname',v)}>{t('class', lang)}</SortableTh>
                                <SortableTh col="sectionname" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-4" searchValue={columnSearch['sectionname']} isSearchOpen={activeSearch==='sectionname'} onSearchOpen={()=>setActiveSearch('sectionname')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('sectionname','');}} onSearchChange={v=>setColumnSearch('sectionname',v)}>{t('section', lang)}</SortableTh>
                                <th className="px-4 py-4 text-xs font-bold text-[#64748b] uppercase tracking-wider whitespace-nowrap">{t('actions', lang)}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#e2e8f0]">
                            {!hasApplied ? (
                                <tr><td colSpan={8} className="px-6 py-12 text-center text-[#94a3b8] font-medium">{t('pressApplyToLoad', lang)}</td></tr>
                            ) : loading ? (
                                <tr><td colSpan={8} className="px-6 py-12 text-center text-[#94a3b8]">{t('loading', lang)}</td></tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={8} className="px-6 py-12 text-center text-[#94a3b8]">{t('noData', lang)}</td></tr>
                            ) : filtered.map((teacher) => (
                                selectedTeacher?.employeeid === teacher.employeeid && isEditModalOpen ? (
                                    <tr key={teacher.employeeid} className="bg-amber-50/50">
                                        <td className="px-4 py-3 text-center text-sm font-bold">#{teacher.employeeid}</td>
                                        <td className="px-4 py-3 text-center"><input className="input-field h-9 w-full" placeholder={t('arabicName', lang)} value={formData.employeename} onChange={e => setFormData(f => ({ ...f, employeename: toAr(e.target.value) }))} /></td>
                                        <td className="px-4 py-3 text-center"><input className="input-field h-9 w-full" placeholder={t('englishName', lang)} value={getField(formData, 'employeename', 'employeename_en', lang)} onChange={e => setFormData(f => ({ ...f, employeename_en: toEn(e.target.value) }))} /></td>
                                        <td className="px-4 py-3 text-center"><input className="input-field h-9 w-full" placeholder={t('email', lang)} value={formData.employeeemail} onChange={e => setFormData(f => ({ ...f, employeeemail: e.target.value }))} /></td>
                                        <td className="px-4 py-3 text-center"><input className="input-field h-9 w-full" placeholder={t('mobile', lang)} value={formData.employeemobile} onChange={e => setFormData(f => ({ ...f, employeemobile: e.target.value }))} /></td>
                                        <td className="px-4 py-3 text-center text-xs text-[#94a3b8]">{teacher.subjectName}</td>
                                        <td className="px-4 py-3 text-center text-xs text-[#94a3b8]">{teacher.classname}</td>
                                        <td className="px-4 py-3 text-center text-xs text-[#94a3b8]">{teacher.sectionname}</td>
                                        <td className="px-4 py-3 text-center"><div className="flex gap-2"><button onClick={e => { e.preventDefault(); handleUpdate(e); }} className="px-3 py-2 rounded-lg bg-[#1d4ed8] text-white text-xs font-bold">{t('save', lang)}</button><button onClick={() => { setSelectedTeacher(null); setIsEditModalOpen(false); }} className="px-3 py-2 rounded-lg border text-xs font-bold">{t('cancel', lang)}</button></div></td>
                                    </tr>
                                ) : (
                                <tr key={teacher.employeeid} className="hover:bg-[#f8fafc] transition-colors">
                                    <td className="px-4 py-3 text-center"><span className="text-xs font-mono font-bold text-[#94a3b8] bg-slate-100 px-2 py-1 rounded">#{teacher.employeeid}</span></td>
                                    <td className="px-4 py-3 text-center">
                                        <div className="flex items-center gap-3">
                                            <div className="h-9 w-9 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xs uppercase">
                                                {(getField(teacher, 'employeename', 'employeename_en', lang) || teacher.employeename)?.split(' ').map(n => n[0]).join('').slice(0,2)}
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-[#0f172a]">{getField(teacher, 'employeename', 'employeename_en', lang) || teacher.employeename}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-center text-sm text-[#475569]">{teacher.employeeemail || '—'}</td>
                                    <td className="px-4 py-3 text-center text-sm text-[#475569]">{teacher.employeemobile || '—'}</td>
                                    <td className="px-4 py-3 text-center"><span className="text-xs font-bold text-blue-600">{teacher.subjectName}</span></td>
                                    <td className="px-4 py-3 text-center text-sm font-medium text-[#0f172a]">{teacher.classname !== '—' ? `${t('class', lang)} ${teacher.classname}` : '—'}</td>
                                    <td className="px-4 py-3 text-center">{teacher.sectionname !== '—' ? (<span className="inline-flex items-center justify-center px-2 py-0.5 rounded bg-[#eff6ff] text-[#1d4ed8] text-xs font-bold border border-blue-100 min-w-[28px]">{teacher.sectionname}</span>) : <span className="text-[#94a3b8] text-xs">—</span>}</td>
                                    <td className="px-4 py-3 text-center">
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => openEdit(teacher)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg border border-blue-100"><Edit2 className="h-4 w-4" /></button>
                                            <button onClick={() => { setSelectedTeacher(teacher); setIsDeleteModalOpen(true); }} className="p-2 text-red-500 hover:bg-red-50 rounded-lg border border-red-100"><Trash2 className="h-4 w-4" /></button>
                                        </div>
                                    </td>
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

            <AnimatePresence>
                {isAddModalOpen && (
                    <div className="fixed inset-0 z-[60] flex justify-end">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeModal} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
                        <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'tween', duration: 0.25 }} className="relative w-full max-w-lg bg-white shadow-2xl overflow-hidden h-full">
                            <form onSubmit={handleCreate}>
                                <div className="p-6 border-b border-[#e2e8f0] flex items-center justify-between bg-[#f8fafc]">
                                    <h2 className="text-xl font-bold text-[#0f172a]">{t('createNewTeacher', lang)}</h2>
                                    <button type="button" onClick={closeModal} className="p-2 hover:bg-white rounded-full text-[#64748b]"><X className="h-6 w-6" /></button>
                                </div>
                                <div className="p-8 space-y-5">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-[#0f172a]">{t('arabicNameLabel', lang)}</label>
                                        <input required type="text" className="input-field h-11" placeholder={isAr ? "مثال: أحمد محمود" : "e.g. أحمد محمود"} value={formData.employeename} onChange={e => setFormData(f => ({ ...f, employeename: toAr(e.target.value) }))} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-[#0f172a]">{t('englishNameLabel', lang)}</label>
                                        <input required type="text" className="input-field h-11" placeholder={isAr ? "مثال: Ahmed Mahmoud" : "e.g. Ahmed Mahmoud"} value={getField(formData, 'employeename', 'employeename_en', lang)} onChange={e => setFormData(f => ({ ...f, employeename_en: toEn(e.target.value) }))} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-[#0f172a]">{t('emailAddressLabel', lang)}</label>
                                        <div className="relative">
                                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94a3b8]" />
                                            <input required type="email" className="input-field pl-10 h-11" placeholder={isAr ? "معلم@مدرسة.edu" : "teacher@school.edu"} value={formData.employeeemail} onChange={e => setFormData(f => ({ ...f, employeeemail: e.target.value }))} />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-[#0f172a]">{t('mobileNumberLabel', lang)}</label>
                                        <div className="relative">
                                            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94a3b8]" />
                                            <input type="text" className="input-field pl-10 h-11" placeholder={isAr ? "مثال: 0791234567" : "e.g. 0791234567"} value={formData.employeemobile} onChange={e => setFormData(f => ({ ...f, employeemobile: e.target.value }))} />
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-[#64748b] bg-slate-50 p-3 rounded-lg border border-slate-100">{t('defaultPasswordNote', lang)}</p>
                                </div>
                                <div className="p-6 bg-[#f8fafc] border-t border-[#e2e8f0] flex justify-end gap-3">
                                    <button type="button" onClick={closeModal} className="px-6 py-2.5 font-bold text-[#64748b]">{t('cancel', lang)}</button>
                                    <button disabled={isLoading} type="submit" className="btn-primary h-11 px-8 flex items-center gap-2">
                                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {t('createTeacher', lang)}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
                {isDeleteModalOpen && (
                    <div className="fixed inset-0 z-[60] flex justify-end">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsDeleteModalOpen(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-md bg-white rounded-2xl shadow-xl p-8 text-center">
                            <h2 className="text-xl font-bold text-[#0f172a] mb-2">{t('deleteTeacherTitle', lang)}</h2>
                            <p className="text-[#64748b] text-sm mb-8">{t('deleteTeacherConfirm', lang)} <span className="font-bold text-[#0f172a]">{getField(selectedTeacher, 'employeename', 'employeename_en', lang) || selectedTeacher?.employeename}</span>?</p>
                            <div className="flex gap-4">
                                <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 px-6 py-3 font-bold text-[#64748b] hover:bg-slate-50 rounded-xl">{t('cancel', lang)}</button>
                                <button onClick={handleDelete} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl">{t('delete', lang)}</button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}