import { t, getField, getStudentName as _getStudentName } from '../../lib/langHelper';
import { useLang } from '../../context/LanguageContext';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, GraduationCap, ClipboardList, BookOpen, Layers, CheckCircle, GitBranch, Shield } from 'lucide-react';
import Breadcrumb from '../../components/Breadcrumb';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LabelList } from 'recharts';
import StatCard from '../../components/StatCard';
import FilterBar from '../../components/FilterBar';
import { fetchGradeDistribution } from '../../lib/gradeUtils';
import { useAuth } from '../../context/AuthContext';
import { rest } from '../../lib/supabaseClient';
import { useFilterData } from '../../lib/useFilterData';
import { buildFilters, EMPTY_FILTER } from '../../lib/helpers';
import { useSortable } from '../../lib/useSortable';
import { useColumnSearch } from '../../lib/useColumnSearch';
import SortableTh from '../../components/SortableTh';

export default function AdminDashboard() {
    const { lang, isAr } = useLang();

    const { user } = useAuth();
    const filterData = useFilterData(user, lang);
    const navigate = useNavigate();

    const [loading, setLoading] = useState(false);
    const [hasApplied, setHasApplied] = useState(() => {
        try { return JSON.parse(sessionStorage.getItem('adminDash_hasApplied') || 'true'); } catch { return true; }
    });
    const [stats, setStats] = useState(() => {
        try { return JSON.parse(sessionStorage.getItem('adminDash_stats') || 'null') || { teachers: 0, supervisors: 0, students: 0, classes: 0, sections: 0, subjects: 0, examsThisSemester: 0 }; } catch { return { teachers: 0, supervisors: 0, students: 0, classes: 0, sections: 0, subjects: 0, examsThisSemester: 0 }; }
    });
    const [gradeData, setGradeData] = useState(() => {
        try { return JSON.parse(sessionStorage.getItem('adminDash_gradeData') || '[]'); } catch { return []; }
    });
    const [studentsPerClass, setStudentsPerClass] = useState(() => {
        try { return JSON.parse(sessionStorage.getItem('adminDash_topClasses') || '[]'); } catch { return []; }
    });
    const [applied, setApplied] = useState(() => {
        try { return JSON.parse(sessionStorage.getItem('adminDash_applied') || 'null') || { ...EMPTY_FILTER, employeeid: 'All' }; } catch { return { ...EMPTY_FILTER, employeeid: 'All' }; }
    });
    const [draftFilters, setDraftFilters] = useState(() => {
        try { return JSON.parse(sessionStorage.getItem('adminDash_applied') || 'null') || { ...EMPTY_FILTER, employeeid: 'All' }; } catch { return { ...EMPTY_FILTER, employeeid: 'All' }; }
    });

    const fetchStats = useCallback(async (filters = {}) => {
        if (!user) return;
        try {
            setLoading(true);
            const sid = user.schoolid;
            const bid = (filters.branchid && filters.branchid !== 'All') ? filters.branchid : user.branchid;
            const scope = (extra = {}) => ({ schoolid: `eq.${sid}`, branchid: `eq.${bid}`, ...extra });
            const f = (key, col) => filters[key] && filters[key] !== 'All' ? { [col || key]: `eq.${filters[key]}` } : {};

            const stuParams  = { ...scope(), select: 'studentid,classid,sectionid', ...f('stageid'), ...f('classid'), ...f('sectionid'), ...f('divisionid'), ...f('curriculumid') };
            const scParams   = { ...scope(), select: 'classid,sectionid', ...f('stageid'), ...f('classid'), ...f('sectionid'), ...f('divisionid'), ...f('curriculumid') };
            const examParams = {
                ...scope(), select: 'examid,classid,sectionid,subjectid,employeeid,semisterid,yearid',
                ...f('stageid'), ...f('classid'), ...f('sectionid'), ...f('subjectid'), ...f('divisionid'), ...f('curriculumid'), ...f('semisterid'), ...f('examid'),
                ...(filters.employeeid && filters.employeeid !== 'All' ? { employeeid: `eq.${filters.employeeid}` } : {}),
            };

            // Scope teacher/supervisor counts to division/curriculum/stage filters if set
            const empAssignParams = { schoolid: `eq.${sid}`, branchid: `eq.${bid}`, select: 'employeeid', ...f('divisionid'), ...f('curriculumid'), ...f('stageid'), ...f('classid'), ...f('sectionid') };
            const supAssignParams = { schoolid: `eq.${sid}`, branchid: `eq.${bid}`, select: 'employeeid', ...f('divisionid'), ...f('curriculumid'), ...f('stageid') };
            const [stuScRows, secClassRows, subjectRows, examEnrollRows, allTeacherTypes, allSupervisorTypes, empAssignRows, supAssignRows, clTbl, secTbl] = await Promise.all([
                rest('students_sections_classes_tbl', stuParams),
                rest('sections_classes_tbl', scParams),
                rest('sections_subjects_classes_tbl', { ...scope(), select: 'subjectid', ...f('stageid'), ...f('classid'), ...f('sectionid'), ...f('subjectid'), ...f('divisionid'), ...f('curriculumid') }),
                rest('students_exams_employees_section_subjects_classes_semisters_cur', examParams),
                rest('employees_types_tbl', { typeid: 'eq.1', select: 'employeeid' }),
                rest('employees_types_tbl', { typeid: 'eq.2', select: 'employeeid' }),
                rest('employees_sections_subjects_classes_semisters_curriculums_tbl', empAssignParams),
                rest('employees_types_stages_tbl', supAssignParams),
                rest('classes_tbl', { select: 'classid,classname_en,classname' }),
                rest('sections_tbl', { select: 'sectionid,sectionname_en,sectionname' }),
            ]);
            const hasEmpFilter = ['divisionid','curriculumid','stageid','classid','sectionid'].some(k => filters[k] && filters[k] !== 'All');
            const filteredTeacherIds = hasEmpFilter ? new Set((empAssignRows || []).map(r => r.employeeid)) : null;
            // Always scope supervisors to school via supAssignRows (employees_types_stages_tbl has schoolid)
            const supIds = new Set((supAssignRows || []).map(r => r.employeeid));
            const filteredSupIds = hasEmpFilter ? new Set((supAssignRows || []).map(r => r.employeeid)) : supIds;
            const teacherTypes    = hasEmpFilter ? (allTeacherTypes    || []).filter(t => filteredTeacherIds.has(t.employeeid)) : allTeacherTypes;
            const supervisorTypes = (allSupervisorTypes || []).filter(t => filteredSupIds.has(t.employeeid));

            const totalStudents = new Set((stuScRows || []).map(r => r.studentid)).size;
            const enrollArr = examEnrollRows || [];
            let examPool = enrollArr;
            if (!filters.semisterid || filters.semisterid === 'All') {
                const latestYear = Math.max(...enrollArr.map(r => Number(r.yearid) || 0), 0);
                const latestSem  = Math.max(...enrollArr.filter(r => Number(r.yearid) === latestYear).map(r => Number(r.semisterid) || 0), 0);
                examPool = enrollArr.filter(r => Number(r.yearid) === latestYear && Number(r.semisterid) === latestSem);
            }

            const newStats = {
                teachers:   (teacherTypes || []).length,
                supervisors:(supervisorTypes || []).length,
                students:   totalStudents,
                classes:    new Set((secClassRows || []).map(r => r.classid)).size,
                sections:   (secClassRows || []).length,
                subjects:   new Set((subjectRows || []).map(r => r.subjectid)).size,
                examsThisSemester: new Set(examPool.map(r => `${r.examid}-${r.classid}-${r.sectionid}-${r.subjectid}-${r.employeeid}`)).size,
            };
            setStats(newStats);
            try { sessionStorage.setItem('adminDash_stats', JSON.stringify(newStats)); } catch {}

            // Top Performing Classes — avg mark % per class-section from studentanswers_tbl
            try {
                const ansParams2 = { schoolid: `eq.${sid}`, branchid: `eq.${bid}`, select: 'studentid,studentmark,questionid,classid,sectionid,examid' };
                const qParams2   = { schoolid: `eq.${sid}`, branchid: `eq.${bid}`, select: 'questionid,question_marks,classid,sectionid,examid' };
                // Apply active filters so chart updates when filters are applied
                if (filters.classid      && filters.classid      !== 'All') { ansParams2.classid      = `eq.${filters.classid}`;      qParams2.classid      = `eq.${filters.classid}`; }
                if (filters.sectionid    && filters.sectionid    !== 'All') { ansParams2.sectionid    = `eq.${filters.sectionid}`;    qParams2.sectionid    = `eq.${filters.sectionid}`; }
                if (filters.examid       && filters.examid       !== 'All') { ansParams2.examid       = `eq.${filters.examid}`;       qParams2.examid       = `eq.${filters.examid}`; }
                if (filters.employeeid   && filters.employeeid   !== 'All') { ansParams2.employeeid   = `eq.${filters.employeeid}`;   qParams2.employeeid   = `eq.${filters.employeeid}`; }
                if (filters.curriculumid && filters.curriculumid !== 'All') { ansParams2.curriculumid = `eq.${filters.curriculumid}`; qParams2.curriculumid = `eq.${filters.curriculumid}`; }
                if (filters.divisionid   && filters.divisionid   !== 'All') { ansParams2.divisionid   = `eq.${filters.divisionid}`;   qParams2.divisionid   = `eq.${filters.divisionid}`; }
                if (filters.stageid      && filters.stageid      !== 'All') { ansParams2.stageid      = `eq.${filters.stageid}`;      qParams2.stageid      = `eq.${filters.stageid}`; }
                const [ansRows, qRows] = await Promise.all([
                    rest('studentanswers_tbl', ansParams2).catch(() => []),
                    rest('questions_exams_employee_subjects_sections_tbl', qParams2).catch(() => []),
                ]);
                const qMaxMap = {};
                (qRows || []).forEach(q => { qMaxMap[`${q.examid}-${q.classid}-${q.sectionid}-${q.questionid}`] = parseFloat(q.question_marks) || 1; });
                // Per class-section: per student per exam → avg pct
                const classStudentExam = {};
                (ansRows || []).forEach(a => {
                    const csKey = `${a.classid}-${a.sectionid}`;
                    const sid2 = String(a.studentid);
                    const eid = String(a.examid);
                    if (!classStudentExam[csKey]) classStudentExam[csKey] = {};
                    if (!classStudentExam[csKey][sid2]) classStudentExam[csKey][sid2] = {};
                    if (!classStudentExam[csKey][sid2][eid]) classStudentExam[csKey][sid2][eid] = { earned: 0, possible: 0 };
                    classStudentExam[csKey][sid2][eid].earned   += parseFloat(a.studentmark) || 0;
                    classStudentExam[csKey][sid2][eid].possible += qMaxMap[`${a.examid}-${a.classid}-${a.sectionid}-${a.questionid}`] || 1;
                });
                const topClasses = Object.entries(classStudentExam).map(([csKey, students]) => {
                    const [cid, secid] = csKey.split('-');
                    const cl = (clTbl || []).find(c => String(c.classid) === cid);
                    const sec = (secTbl || []).find(s => String(s.sectionid) === secid);
                    const label = `${getField(cl, 'classname', 'classname_en', lang) || cl?.classname || cid}-${getField(sec, 'sectionname', 'sectionname_en', lang) || sec?.sectionname || secid}`;
                    const stuPcts = Object.values(students).map(examMap => {
                        const eps = Object.values(examMap).filter(e => e.possible > 0).map(e => (e.earned / e.possible) * 100);
                        return eps.length ? eps.reduce((a, b) => a + b, 0) / eps.length : null;
                    }).filter(p => p !== null);
                    const avg = stuPcts.length ? Math.round(stuPcts.reduce((a, b) => a + b, 0) / stuPcts.length) : 0;
                    return { name: label, avg };
                }).filter(d => d.avg > 0).sort((a, b) => b.avg - a.avg).slice(0, 8);
                const BAR_COLORS = ['#1d4ed8','#7c3aed','#0891b2','#059669','#d97706','#dc2626','#db2777','#65a30d'];
                topClasses.forEach((d, i) => { d.fill = BAR_COLORS[i % BAR_COLORS.length]; });
                const effectiveTop = totalStudents === 0 && Object.values(filters).some(v => v && v !== 'All') ? [] : topClasses;
                setStudentsPerClass(effectiveTop);
                try { sessionStorage.setItem('adminDash_topClasses', JSON.stringify(effectiveTop)); } catch {}
            } catch { setStudentsPerClass([]); }

            const gd = await fetchGradeDistribution({
                schoolid:      sid, branchid: bid,
                curriculumid:  filters.curriculumid && filters.curriculumid !== 'All' ? filters.curriculumid : undefined,
                divisionid:    filters.divisionid   && filters.divisionid   !== 'All' ? filters.divisionid   : undefined,
                stageid:       filters.stageid      && filters.stageid      !== 'All' ? filters.stageid      : undefined,
                classid:       filters.classid      && filters.classid      !== 'All' ? filters.classid      : undefined,
                sectionid:     filters.sectionid    && filters.sectionid    !== 'All' ? filters.sectionid    : undefined,
                subjectid:     filters.subjectid    && filters.subjectid    !== 'All' ? filters.subjectid    : undefined,
                examid:        filters.examid       && filters.examid       !== 'All' ? filters.examid       : undefined,
                semisterid:    filters.semisterid   && filters.semisterid   !== 'All' ? filters.semisterid   : undefined,
            });
            // If no students match the current filters, clear charts
            const effectiveGd = totalStudents === 0 && Object.values(filters).some(v => v && v !== 'All') ? [] : (gd || []);
            setGradeData(effectiveGd);
            try { sessionStorage.setItem('adminDash_gradeData', JSON.stringify(effectiveGd)); } catch {}
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [user, lang]);


    const appliedRef = useRef(applied);
    appliedRef.current = applied;
    useEffect(() => {
        if (!hasApplied) return;
        fetchStats(appliedRef.current);
    }, [lang, hasApplied, fetchStats]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleApply = (vals) => { setApplied(vals); setDraftFilters(vals); setHasApplied(true); try { sessionStorage.setItem('adminDash_applied', JSON.stringify(vals)); sessionStorage.setItem('adminDash_hasApplied', 'true'); } catch {} fetchStats(vals); };
    const handleReset = () => { const r = { ...EMPTY_FILTER, employeeid: 'All' }; setApplied(r); setDraftFilters(r); setHasApplied(false); try { sessionStorage.removeItem('adminDash_applied'); sessionStorage.removeItem('adminDash_stats'); sessionStorage.removeItem('adminDash_gradeData'); sessionStorage.removeItem('adminDash_topClasses'); sessionStorage.setItem('adminDash_hasApplied', 'false'); } catch {} };

    // Auto-load on mount with current applied filters
    useEffect(() => {
        if (user) { setHasApplied(true); fetchStats(applied); }
    }, [user]);

    // Cards in exact order: Supervisor, Teacher, Students, Classes, Sections, Subjects, Exams, Attendance
    const buildState = (keys) => {
        const s = {};
        keys.forEach(k => { if (draftFilters[k] && draftFilters[k] !== 'All') s[k] = draftFilters[k]; });
        return Object.keys(s).length > 0 ? s : null;
    };

    const statCards = [
        { title: t('supervisors', lang),    value: stats.supervisors,       icon: Shield,        color: 'bg-rose-100 text-rose-600',     delay: 0,    path: () => ({ to: '/admin/employees', state: { ...buildState(['stageid','curriculumid','divisionid']), typeFilter: 'supervisor' } }) },
        { title: t('teachers', lang),       value: stats.teachers,          icon: Users,         color: 'bg-blue-100 text-blue-600',     delay: 0.05, path: () => ({ to: '/admin/employees', state: { ...buildState(['curriculumid','divisionid','stageid','classid','sectionid','subjectid','employeeid']), typeFilter: 'teacher' } }) },
        { title: t('totalStudents', lang), value: stats.students,          icon: GraduationCap, color: 'bg-indigo-100 text-indigo-600', delay: 0.1,  path: () => ({ to: '/admin/students', state: buildState(['curriculumid','divisionid','stageid','classid','sectionid']) }) },
        { title: t('totalClasses', lang),  value: stats.classes,           icon: BookOpen,      color: 'bg-violet-100 text-violet-600', delay: 0.15, path: () => ({ to: '/admin/classes', state: buildState(['curriculumid','divisionid','stageid','classid','sectionid']) }) },
        { title: t('totalSections', lang), value: stats.sections,          icon: Layers,        color: 'bg-teal-100 text-teal-600',     delay: 0.2,  path: () => ({ to: '/admin/classes', state: buildState(['curriculumid','divisionid','stageid','classid','sectionid']) }) },
        { title: t('totalSubjects', lang), value: stats.subjects,          icon: GitBranch,     color: 'bg-cyan-100 text-cyan-600',     delay: 0.25, path: () => ({ to: '/admin/subjects', state: buildState(['curriculumid','divisionid','stageid','classid','subjectid']) }) },
        { title: t('exams', lang),          value: stats.examsThisSemester, icon: ClipboardList, color: 'bg-purple-100 text-purple-600', delay: 0.3,  path: () => ({ to: '/admin/exams', state: buildState(['curriculumid','divisionid','stageid','classid','sectionid','subjectid','examid','employeeid']) }) },
        { title: t('attendance', lang),     value: t('comingSoon', lang),           icon: CheckCircle,   color: 'bg-green-100 text-green-600',   delay: 0.35, path: () => ({ to: '/admin/attendance', state: null }) },
    ];

    const CustomTooltip = ({ active, payload }) => active && payload?.length ? (
        <div className="bg-white border border-[#e2e8f0] rounded-lg px-3 py-2 shadow text-xs font-semibold text-[#0f172a]">
            {payload[0].name}: <span className="font-bold">{payload[0].value}</span>
        </div>
    ) : null;

    const totalStudsAdmin = gradeData.reduce((a, c) => a + c.value, 0);

    const renderAdminPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, value, index }) => {
        if (!value || totalStudsAdmin === 0) return null;
        const pct = totalStudsAdmin > 0 ? parseFloat((value / totalStudsAdmin * 100).toFixed(1)) : 0;
        if (pct < 8) return null;
        const RADIAN = Math.PI / 180;
        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
        const x = cx + radius * Math.cos(-midAngle * RADIAN);
        const y = cy + radius * Math.sin(-midAngle * RADIAN);
        const gradeLetter = gradeData[index]?.name?.charAt(0) || '';
        return (
            <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={800}>
                <tspan x={x} dy="-7" fontSize={15} fontWeight={900}>{gradeLetter}</tspan>
                <tspan x={x} dy="16" fontSize={11} fontWeight={700}>{pct}%</tspan>
            </text>
        );
    };

    const AdminPieTooltip = ({ active, payload }) => {
        if (!active || !payload?.length) return null;
        const d = payload[0].payload;
        const pct = totalStudsAdmin > 0 ? parseFloat((d.value / totalStudsAdmin * 100).toFixed(1)) : 0;
        return (
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', minWidth: 140 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{d.name}</span>
                </div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{d.value} {t('student', lang)} · <strong>{pct}%</strong></div>
            </div>
        );
    };

    return (
        <div className="space-y-6 animate-fade-in pb-12">
            <div>
                <h1 className="text-xl sm:text-2xl font-bold text-[#0f172a]">{t('dashboard', lang)}</h1>
                <p className="text-[#64748b] text-sm">{t('welcomeBack', lang)}, {isAr ? (user?.name_ar || user?.name) : user?.name}. {user?.schoolName && `${isAr ? (user.schoolName_ar || user.schoolName) : user.schoolName} · ${isAr ? (user.branchName_ar || user.branchName) : user.branchName}`}</p>
                <Breadcrumb />
            </div>

            <FilterBar
                filters={[
                    ...buildFilters(applied, filterData, {}, lang),
                    { key: 'employeeid', label: t('teacher', lang), value: applied.employeeid ?? 'All', options: filterData.employees || [] },
                ]}
                
                appliedFilters={applied}onApply={handleApply}
                onReset={handleReset}
                onChange={setDraftFilters}
            />

            {hasApplied && loading && (
                <div className="flex items-center justify-center py-16 text-[#94a3b8]">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600 mr-2" /> {t('loading', lang)}
                </div>
            )}
            {hasApplied && !loading && (
                <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
                        {statCards.map((stat, idx) => (
                            <div key={idx} onClick={() => { const p = stat.path(); navigate(p.to, p.state ? { state: p.state } : {}); }} className="cursor-pointer">
                                <StatCard {...stat} />
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                        {/* Top Performing Classes — real avg mark % per class-section */}
                        <div className="card p-6 bg-white rounded-xl border border-[#e2e8f0]">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-[#0f172a]">{t('topPerformingClasses', lang)}</h3>
                                {studentsPerClass.length > 0 && (
                                    <span className="text-xs font-bold text-[#64748b] bg-slate-100 px-2 py-1 rounded-lg">{studentsPerClass.length} {t('class', lang)}</span>
                                )}
                            </div>
                            {studentsPerClass.length === 0 ? (
                                <div style={{height:'280px'}} className="flex flex-col items-center justify-center text-[#94a3b8] gap-2">
                                    <span className="text-4xl">🏫</span>
                                    <p className="text-sm font-medium">{t('noExamData', lang)}</p>
                                </div>
                            ) : (
                                <div style={{height:'280px'}}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={studentsPerClass} margin={{ top: 20, right: 10, left: 10, bottom: 30 }} barCategoryGap="5%" barGap={2}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis
                                                dataKey="name"
                                                tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                                                tickLine={false} axisLine={false}
                                                interval={0} angle={-20} textAnchor="end" height={50}
                                            />
                                            <YAxis
                                                domain={[0, 100]}
                                                tickFormatter={v => `${v}%`}
                                                tick={{ fill: '#94a3b8', fontSize: 11 }}
                                                tickLine={false} axisLine={false}
                                            />
                                            <Tooltip
                                                formatter={v => [`${v}%`, t('avgMarks', lang)]}
                                                contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                                                cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                                            />
                                            <Bar dataKey="avg" radius={[6, 6, 0, 0]} barSize={28} animationDuration={1000}>
                                                {studentsPerClass.map((entry, index) => (
                                                    <Cell key={index} fill={entry.fill} />
                                                ))}
                                                <LabelList
                                                    dataKey="avg"
                                                    position="top"
                                                    formatter={v => `${v}%`}
                                                    style={{ fontWeight: 700, fontSize: 12, fill: '#0f172a' }}
                                                />
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </div>

                        {/* Mark Distribution */}
                        <div className="card p-6 bg-white rounded-xl border border-[#e2e8f0]">
                            <div className="flex items-center justify-between mb-1">
                                <h3 className="font-bold text-[#0f172a]">{t('markDistribution', lang)}</h3>
                                {totalStudsAdmin > 0 && (
                                    <span className="text-xs font-bold text-[#64748b] bg-slate-100 px-2 py-1 rounded-lg">{totalStudsAdmin} {t('student', lang)}</span>
                                )}
                            </div>
                            {gradeData.length === 0 ? (
                                <div style={{height:'260px'}} className="flex flex-col items-center justify-center text-[#94a3b8] gap-2">
                                    <span className="text-4xl">📊</span>
                                    <p className="text-sm font-medium">{t('noMarksRecorded', lang)}</p>
                                </div>
                            ) : (
                                <div>
                                    <div style={{height:'220px'}}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={gradeData}
                                                    cx="50%" cy="50%"
                                                    outerRadius={95}
                                                    paddingAngle={2}
                                                    dataKey="value"
                                                    labelLine={false}
                                                    label={renderAdminPieLabel}
                                                    animationBegin={0}
                                                    animationDuration={900}
                                                >
                                                    {gradeData.map((entry, i) => (
                                                        <Cell key={i} fill={entry.color} stroke="#fff" strokeWidth={2} />
                                                    ))}
                                                </Pie>
                                                <Tooltip content={<AdminPieTooltip />} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 mt-3">
                                        {gradeData.map((entry, i) => {
                                            const pct = totalStudsAdmin > 0 ? parseFloat((entry.value / totalStudsAdmin * 100).toFixed(1)) : 0;
                                            return (
                                                <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-[#e2e8f0]">
                                                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: entry.color, flexShrink: 0 }} />
                                                    <div className="min-w-0">
                                                        <p className="text-[11px] font-bold text-[#0f172a] truncate">{entry.name}</p>
                                                        <p className="text-[10px] text-[#64748b]">{entry.value} · <strong>{pct}%</strong></p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
