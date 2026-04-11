import { t, getField, getStudentName as _getStudentName } from '../../lib/langHelper';
import { useLang } from '../../context/LanguageContext';
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, BookOpen, GraduationCap } from 'lucide-react';
import Breadcrumb from '../../components/Breadcrumb';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { rest } from '../../lib/supabaseClient';
import { useSortable } from '../../lib/useSortable';
import { useColumnSearch } from '../../lib/useColumnSearch';
import SortableTh from '../../components/SortableTh';

export default function SubjectDetail() {
    const { lang, isAr } = useLang();

    const { id } = useParams(); // subjectid
    const navigate = useNavigate();
    const { user } = useAuth();
    const { addToast } = useToast();

    const [subject, setSubject] = useState(null);
    const [teachers, setTeachers] = useState([]);   // [{name, classes: 'Classes 1-A, Grade 1-B'}]
    const [classes, setClasses] = useState([]);     // [{classname, sectionname, stageName, studentCount, teacherName}]
    const [loading, setLoading] = useState(true);
    const { sorted: sortedTeachers, sortCol: sortColT, sortDir: sortDirT, handleSort: handleSortT } = useSortable(teachers, 'name');
    const { sorted: sortedClasses, sortCol: sortColC, sortDir: sortDirC, handleSort: handleSortC } = useSortable(classes, 'classname');
    const { columnSearch, activeSearch, setActiveSearch, setColumnSearch, applyColumnSearch } = useColumnSearch();

    const fetchData = useCallback(async () => {
        if (!user || !id) return;
        try {
            setLoading(true);
            const subjectId = parseInt(id);

            const [subList, tchAssign, empList, clTbl, secRows, stgRows, stuScRows] = await Promise.all([
                rest('subjects_tbl', { subjectid: `eq.${subjectId}`, select: '*' }),
                rest('employees_sections_subjects_classes_semisters_curriculums_tbl', { subjectid: `eq.${subjectId}`, select: '*' }),
                rest('employee_tbl', { schoolid: `eq.${user.schoolid}`, branchid: `eq.${user.branchid}`, select: '*' }),
                rest('classes_tbl', { select: '*' }),
                rest('sections_tbl', { select: '*' }),
                rest('stages_tbl', { schoolid: `eq.${user.schoolid}`, branchid: `eq.${user.branchid}`, select: '*' }),
                rest('students_sections_classes_tbl', { schoolid: `eq.${user.schoolid}`, branchid: `eq.${user.branchid}`, select: '*' }),
            ]);

            if (!subList.length) { addToast(t('subjectNotFound', lang), 'error'); navigate('/admin/subjects'); return; }
            setSubject(subList[0]);

            // Build teachers list — unique teachers for this subject, with their classes listed
            const teacherMap = new Map();
            tchAssign.forEach(row => {
                const emp = empList.find(e => e.employeeid === row.employeeid);
                if (!emp) return;
                const cl = clTbl.find(c => c.classid === row.classid);
                const sec = secRows.find(s => s.sectionid === row.sectionid);
                const label = cl ? `${t('class', lang)} ${getField(cl, 'classname', 'classname_en', lang) || cl.classname}${sec ? '-' + getField(sec, 'sectionname', 'sectionname_en', lang) || sec.sectionname : ''}` : '';
                if (!teacherMap.has(row.employeeid)) {
                    teacherMap.set(row.employeeid, { employeeid: row.employeeid, name: getField(emp, 'employeename', 'employeename_en', lang) || emp.employeename, classLabels: [] });
                }
                if (label) teacherMap.get(row.employeeid).classLabels.push(label);
            });
            setTeachers([...teacherMap.values()]);

            // Build class rows — each unique class-section for this subject
            const uniquePairs = new Map();
            tchAssign.forEach(row => {
                const key = `${row.classid}-${row.sectionid}`;
                if (!uniquePairs.has(key)) {
                    const cl = clTbl.find(c => c.classid === row.classid);
                    const sec = secRows.find(s => s.sectionid === row.sectionid);
                    const stg = stgRows.find(s => s.stageid === row.stageid);
                    const stuCount = stuScRows.filter(s => s.classid === row.classid && s.sectionid === row.sectionid).length;
                    const emp = empList.find(e => e.employeeid === row.employeeid);
                    uniquePairs.set(key, {
                        classname: getField(cl, 'classname', 'classname_en', lang) || cl?.classname || '?',
                        sectionname: getField(sec, 'sectionname', 'sectionname_en', lang) || sec?.sectionname || '?',
                        stageName: getField(stg, 'stagename', 'stagename_en', lang) || '—',
                        studentCount: stuCount,
                        teacherName: getField(emp, 'employeename', 'employeename_en', lang) || emp?.employeename || '—',
                        teacherId: row.employeeid,
                    });
                }
            });
            setClasses([...uniquePairs.values()]);

        } catch (e) { addToast(e.message, 'error'); }
        finally { setLoading(false); }
    }, [user, id, lang]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const totalStudents = classes.reduce((sum, c) => sum + c.studentCount, 0);

    // Performance data: studentCount used as a proxy until real marks are available
    // Each bar shows how many students are in that class-section
    const performanceData = classes.map(c => ({
        name: `${t('class', lang)} ${c.classname}-${c.sectionname}`,
        students: c.studentCount,
    }));

    if (loading) return (
        <div className="flex items-center justify-center h-64 text-[#94a3b8]">{t('loadingSubjectDetails', lang)}</div>
    );

  
    // Re-fetch when language changes
    useEffect(() => {
        const handler = () => { fetchData(); };
        window.addEventListener('langChanged', handler);
        return () => window.removeEventListener('langChanged', handler);
    }, [fetchData]);

  return (
        <div className="space-y-6 animate-fade-in pb-12">
            {/* Header */}
            <div className="flex flex-col gap-1">
                <button onClick={() => navigate('/admin/subjects')} className="flex items-center gap-2 text-[#64748b] hover:text-[#1d4ed8] transition-colors w-fit mb-2">
                    <ArrowLeft size={16} />
                    <span className="text-sm font-medium">{t('backToSubjects', lang)}</span>
                </button>
                <h1 className="text-xl sm:text-2xl font-bold text-[#0f172a]">{getField(subject, 'subjectname', 'Subjectname_en', lang)}</h1>
                <p className="text-[#94a3b8] text-sm font-medium" dir="rtl">{subject?.subjectname}</p>
                <Breadcrumb />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                    { label: t('totalTeachers', lang), value: teachers.length, icon: Users, color: 'text-blue-600 bg-blue-100' },
                    { label: t('totalClasses', lang), value: classes.length, icon: BookOpen, color: 'text-purple-600 bg-purple-100' },
                    { label: t('totalStudents', lang), value: totalStudents, icon: GraduationCap, color: 'text-green-600 bg-green-100' },
                ].map((stat, idx) => (
                    <motion.div key={idx} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.08 }}
                        className="card p-6 bg-white rounded-xl flex items-center gap-4">
                        <div className={`p-3 rounded-xl ${stat.color}`}>
                            <stat.icon className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-[#94a3b8] uppercase tracking-wider">{stat.label}</p>
                            <p className="text-xl sm:text-2xl font-bold text-[#0f172a]">{stat.value}</p>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Assigned Teachers */}
            <div className="card bg-white rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-[#e2e8f0]">
                    <h2 className="font-bold text-[#0f172a]">{t('assignedTeachers', lang)}</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                            <tr>
                                <SortableTh col="name" sortCol={sortColT} sortDir={sortDirT} onSort={handleSortT} className="px-6" searchValue={columnSearch['tname']} isSearchOpen={activeSearch==='tname'} onSearchOpen={()=>setActiveSearch('tname')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('tname','');}} onSearchChange={v=>setColumnSearch('tname',v)}>{t('name', lang)}</SortableTh>
                                <th className="px-6 py-3 text-xs font-bold text-[#64748b] uppercase tracking-wider">{t('classes', lang)}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#f1f5f9]">
                            {teachers.length === 0 ? (
                                <tr><td colSpan={2} className="px-6 py-10 text-center text-[#94a3b8] text-sm">{t('noTeachersAssigned', lang)}</td></tr>
                            ) : teachers.map((t, i) => (
                                <tr key={i} className="hover:bg-[#f8fafc] transition-colors">
                                    <td className="px-4 py-3 text-center">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-bold text-[10px] uppercase">
                                                {t.name?.split(' ').map(n => n[0]).join('').slice(0,2)}
                                            </div>
                                            <span className="text-sm font-bold text-[#0f172a]">{t.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <div className="flex flex-wrap gap-1.5">
                                            {t.classLabels.map((lbl, j) => (
                                                <span key={j} className="inline-flex items-center px-2 py-0.5 rounded bg-[#eff6ff] text-[#1d4ed8] text-xs font-bold border border-blue-100">{lbl}</span>
                                            ))}
                                            {t.classLabels.length === 0 && <span className="text-[#94a3b8] text-xs">—</span>}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Assigned Classes */}
            <div className="card bg-white rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-[#e2e8f0]">
                    <h2 className="font-bold text-[#0f172a]">{t('assignedClasses', lang)}</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                            <tr>
                                <SortableTh col="classname" sortCol={sortColC} sortDir={sortDirC} onSort={handleSortC} className="px-6" searchValue={columnSearch['classname']} isSearchOpen={activeSearch==='classname'} onSearchOpen={()=>setActiveSearch('classname')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('classname','');}} onSearchChange={v=>setColumnSearch('classname',v)}>{t('class', lang)}</SortableTh>
                                <SortableTh col="sectionname" sortCol={sortColC} sortDir={sortDirC} onSort={handleSortC} className="px-6" searchValue={columnSearch['sectionname']} isSearchOpen={activeSearch==='sectionname'} onSearchOpen={()=>setActiveSearch('sectionname')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('sectionname','');}} onSearchChange={v=>setColumnSearch('sectionname',v)}>{t('section', lang)}</SortableTh>
                                <SortableTh col="stageName" sortCol={sortColC} sortDir={sortDirC} onSort={handleSortC} className="px-6">{t('stage', lang)}</SortableTh>
                                <SortableTh col="studentCount" sortCol={sortColC} sortDir={sortDirC} onSort={handleSortC} className="px-6">{t('students', lang)}</SortableTh>
                                <SortableTh col="teacherName" sortCol={sortColC} sortDir={sortDirC} onSort={handleSortC} className="px-6" searchValue={columnSearch['teacherName']} isSearchOpen={activeSearch==='teacherName'} onSearchOpen={()=>setActiveSearch('teacherName')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('teacherName','');}} onSearchChange={v=>setColumnSearch('teacherName',v)}>{t('teacher', lang)}</SortableTh>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#f1f5f9]">
                            {classes.length === 0 ? (
                                <tr><td colSpan={5} className="px-6 py-10 text-center text-[#94a3b8] text-sm">{t('noClassesAssigned', lang)}</td></tr>
                            ) : classes.map((c, i) => (
                                <tr key={i} className="hover:bg-[#f8fafc] transition-colors">
                                    <td className="px-4 py-3 text-center text-sm font-bold text-[#0f172a]">{t('class', lang)} {c.classname}</td>
                                    <td className="px-4 py-3 text-center">
                                        <span className="inline-flex items-center justify-center w-8 h-8 bg-slate-100 rounded-lg text-xs font-black text-[#475569] border border-slate-200">{c.sectionname}</span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded uppercase tracking-tight">{c.stageName}</span>
                                    </td>
                                    <td className="px-4 py-3 text-center text-sm font-bold text-[#0f172a]">{c.studentCount}</td>
                                    <td className="px-4 py-3 text-center">
                                        <span className="text-sm font-medium text-[#1d4ed8]">{c.teacherName}</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Performance Chart */}
            <div className="card bg-white rounded-xl p-6">
                <h2 className="font-bold text-[#0f172a] mb-1">{t('performanceByClass', lang)}</h2>
                <p className="text-xs text-[#94a3b8] mb-6">
                    {classes.length === 0 ? t('noData', lang) : t('showingEnrollment', lang)}
                </p>
                {classes.length === 0 ? (
                    <div className="flex items-center justify-center h-40 text-[#94a3b8] text-sm">{t('noDataToDisplay', lang)}</div>
                ) : (
                    <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={performanceData} layout="vertical" margin={{ top: 0, right: 24, left: 16, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} width={80} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: 12 }}
                                    formatter={(v) => [v, t('students', lang)]}
                                />
                                <Bar dataKey="students" radius={[0, 6, 6, 0]}>
                                    {performanceData.map((_, idx) => (
                                        <Cell key={idx} fill="#1d4ed8" fillOpacity={0.85 - idx * 0.04} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>
        </div>
    );
}
