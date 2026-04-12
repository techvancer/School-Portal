import { t, getField, getStudentName as _getStudentName } from '../../lib/langHelper';
import { useLang } from '../../context/LanguageContext';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, GraduationCap, ClipboardList, Layers, BookOpen, CheckCircle, CalendarDays, GitBranch } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LabelList } from 'recharts';
import StatCard from '../../components/StatCard';
import FilterBar from '../../components/FilterBar';
import { useAuth } from '../../context/AuthContext';
import { rest } from '../../lib/supabaseClient';
import { fetchGradeDistribution } from '../../lib/gradeUtils';
import { useFilterData } from '../../lib/useFilterData';
import { buildFilters, EMPTY_FILTER, getClassName, getSectionName } from '../../lib/helpers';

const BAR_COLORS = ['#6366f1','#22c55e','#f59e0b','#ef4444','#3b82f6','#a855f7','#14b8a6','#f97316'];

export default function SupervisorDashboard() {
    const { lang, isAr } = useLang();

    const { user } = useAuth();
    const navigate = useNavigate();
    const filterData = useFilterData(user, lang);

    const [loading, setLoading] = useState(false);
    const [hasApplied, setHasApplied] = useState(false);
    const [stats, setStats] = useState({ teachers: 0, students: 0, exams: 0, sections: 0, classes: 0, subjects: 0 });
    const [classPerfData, setClassPerfData] = useState([]);
    const [gradeData, setGradeData] = useState([]);
    const [applied, setApplied] = useState({ ...EMPTY_FILTER });

    const fetchData = useCallback(async (filters = {}) => {
        if (!user) return;
        try {
            setLoading(true);
            const bid = user.branchid;
            const sid = user.schoolid;

            const f = (key) => filters[key] && filters[key] !== 'All' ? { [key]: `eq.${filters[key]}` } : {};

            const supStages = await rest('employees_types_stages_tbl', {
                employeeid: `eq.${user.employeeid}`, schoolid: `eq.${sid}`, branchid: `eq.${bid}`, select: 'stageid'
            });
            const stageIds = [...new Set((supStages || []).map(r => String(r.stageid)).filter(Boolean))];

            const classStages = stageIds.length
                ? await rest('classes_stages_tbl', { stageid: `in.(${stageIds})`, schoolid: `eq.${sid}`, branchid: `eq.${bid}`, select: 'classid,stageid' })
                : [];
            let supervisedClassIds = [...new Set((classStages || []).map(r => String(r.classid)))];

            if (filters.classid && filters.classid !== 'All') supervisedClassIds = supervisedClassIds.filter(id => id === filters.classid);
            if (filters.stageid && filters.stageid !== 'All') {
                const sc = (classStages || []).filter(r => String(r.stageid) === filters.stageid).map(r => String(r.classid));
                supervisedClassIds = supervisedClassIds.filter(id => sc.includes(id));
            }
            if (supervisedClassIds.length === 0) {
                setStats({ teachers: 0, students: 0, exams: 0, sections: 0, classes: 0, subjects: 0 });
                setStats({ teachers:0,students:0,exams:0,sections:0,classes:0,subjects:0 });
                setClassPerfData([]); setGradeData([]);
                return;
            }

            const assignParams = {
                schoolid: `eq.${sid}`, classid: `in.(${supervisedClassIds})`,
                select: 'employeeid,classid,sectionid,subjectid,semisterid,curriculumid,divisionid',
                ...f('sectionid'), ...f('subjectid'), ...f('semisterid'), ...f('curriculumid'), ...f('divisionid'),
            };
            const examParams = {
                schoolid: `eq.${sid}`, classid: `in.(${supervisedClassIds})`,
                select: 'examid,employeeid,classid,sectionid,subjectid,semisterid,yearid',
                ...f('sectionid'), ...f('subjectid'), ...f('semisterid'), ...f('examid'),
            };

            const [assignments, stuScRows, classRows, sectionRows, empTypesRows, examEnrollRows] = await Promise.all([
                rest('employees_sections_subjects_classes_semisters_curriculums_tbl', assignParams),
                rest('students_sections_classes_tbl', {
                    schoolid: `eq.${sid}`, classid: `in.(${supervisedClassIds})`,
                    ...f('sectionid'), select: 'studentid,classid,sectionid'
                }),
                rest('classes_tbl',  { select: 'classid,classname_en,classname' }),
                rest('sections_tbl', { select: 'sectionid,sectionname_en,sectionname' }),
                rest('employees_types_tbl', { select: 'employeeid,typeid' }),
                rest('students_exams_employees_section_subjects_classes_semisters_cur', examParams),
            ]);

            const assignArr = assignments || [];
            const stuArr    = stuScRows   || [];

            // If no assignments match the active filters, clear everything and return
            if (assignArr.length === 0) {
                setStats({ teachers: 0, students: 0, exams: 0, sections: 0, classes: 0, subjects: 0 });
                setClassPerfData([]);
                setGradeData([]);
                return;
            }

            // Top Performing Classes — students per class-section (vertical bars)
            const supervisedPairs = [...new Set(assignArr.map(r => `${r.classid}-${r.sectionid}`))];
            const perfData = supervisedPairs.map(key => {
                const [classid, sectionid] = key.split('-');
                const cl  = (classRows  || []).find(c => String(c.classid)   === classid);
                const sec = (sectionRows || []).find(s => String(s.sectionid) === sectionid);
                const total = stuArr.filter(s => String(s.classid) === classid && String(s.sectionid) === sectionid).length;
                return { name: `${getClassName(cl, lang) || classid}-${getSectionName(sec, lang) || sectionid}`, students: total };
            }).sort((a, b) => b.students - a.students);

            const teacherTypeIds = new Set((empTypesRows || []).filter(r => String(r.typeid) === '1').map(r => String(r.employeeid)));
            const teachersSupervised = new Set(assignArr.map(r => String(r.employeeid)).filter(id => teacherTypeIds.has(id)));
            const studentsSupervised = new Set(stuArr.map(r => String(r.studentid)));
            const uniqueSubjects = new Set(assignArr.map(r => r.subjectid)).size;

            const examArr = examEnrollRows || [];
            let examPool = examArr;
            if (!filters.semisterid || filters.semisterid === 'All') {
                const latestYear = Math.max(...examArr.map(r => Number(r.yearid) || 0), 0);
                const latestSem  = Math.max(...examArr.filter(r => Number(r.yearid) === latestYear).map(r => Number(r.semisterid) || 0), 0);
                examPool = examArr.filter(r => Number(r.yearid) === latestYear && Number(r.semisterid) === latestSem);
            }

            setStats({
                teachers: teachersSupervised.size,
                students: studentsSupervised.size,
                exams: new Set(examPool.map(r => `${r.examid}-${r.classid}-${r.sectionid}-${r.subjectid}-${r.employeeid}`)).size,
                sections: supervisedPairs.length,
                classes: new Set(supervisedPairs.map(p => p.split('-')[0])).size,
                subjects: uniqueSubjects,
            });
            setClassPerfData(perfData);

            // Use only classids actually returned in filtered assignments
            const filteredClassIds = [...new Set(assignArr.map(r => Number(r.classid)))];
            const gd = await fetchGradeDistribution({
                schoolid:  sid, branchid: bid,
                classids:  filteredClassIds,
                classid:   filters.classid    && filters.classid    !== 'All' ? filters.classid    : undefined,
                sectionid: filters.sectionid  && filters.sectionid  !== 'All' ? filters.sectionid  : undefined,
                subjectid: filters.subjectid  && filters.subjectid  !== 'All' ? filters.subjectid  : undefined,
                examid:    filters.examid     && filters.examid     !== 'All' ? filters.examid     : undefined,
                semisterid:filters.semisterid && filters.semisterid !== 'All' ? filters.semisterid : undefined,
            });
            setGradeData(gd || []);
        } catch (e) { 
            console.error(e);
            addToast(t('errorLoadingDashboard', lang) || 'Unable to load dashboard data. Please try again.', 'error');
        }
        finally { setLoading(false); }
    }, [user, lang]);

    // Auto-load data on mount with default (all) filters
    useEffect(() => {
        if (!user) return;
        fetchData({...EMPTY_FILTER});
        setApplied({...EMPTY_FILTER});
        setHasApplied(true);
    }, [user]);


    const appliedRef = useRef(applied);
    appliedRef.current = applied;
    useEffect(() => {
        if (!hasApplied) return;
        fetchData(appliedRef.current);
    }, [lang, hasApplied, fetchData]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleApply = (vals) => { setApplied(vals); setHasApplied(true); fetchData(vals); };
    const handleReset = () => { setApplied({ ...EMPTY_FILTER }); setHasApplied(true); fetchData({...EMPTY_FILTER}); };

    const buildState = (keys) => {
        const s = {};
        keys.forEach(k => { if (applied[k] && applied[k] !== 'All') s[k] = applied[k]; });
        return Object.keys(s).length > 0 ? s : null;
    };

    const statCards = [
        { title: t('totalStudents', lang), value: stats.students,  icon: GraduationCap, color: 'bg-blue-100 text-blue-600',     delay: 0,    path: () => ({ to: '/supervisor/students', state: buildState(['curriculumid','divisionid','stageid','classid','sectionid']) }) },
        { title: t('myClasses', lang),     value: stats.classes,   icon: BookOpen,      color: 'bg-indigo-100 text-indigo-600', delay: 0.05, path: () => ({ to: '/supervisor/students', state: buildState(['curriculumid','divisionid','stageid','classid','sectionid']) }) },
        { title: t('mySections', lang),    value: stats.sections,  icon: Layers,        color: 'bg-violet-100 text-violet-600', delay: 0.1,  path: () => ({ to: '/supervisor/students', state: buildState(['curriculumid','divisionid','stageid','classid','sectionid']) }) },
        { title: t('myTeachers', lang),    value: stats.teachers,  icon: Users,         color: 'bg-rose-100 text-rose-600',     delay: 0.15, path: () => ({ to: '/supervisor/teachers', state: buildState(['curriculumid','divisionid','stageid','classid','sectionid','subjectid']) }) },
        { title: t('mySubjects', lang),    value: stats.subjects,  icon: GitBranch,     color: 'bg-teal-100 text-teal-600',     delay: 0.2,  path: () => ({ to: '/supervisor/teachers', state: buildState(['curriculumid','divisionid','stageid','classid','sectionid','subjectid']) }) },
        { title: t('exams', lang),          value: stats.exams,     icon: ClipboardList, color: 'bg-purple-100 text-purple-600', delay: 0.25, path: () => ({ to: '/supervisor/exams',    state: null }) },
        { title: t('attendance', lang),     value: t('comingSoon', lang),   icon: CheckCircle,   color: 'bg-green-100 text-green-600',   delay: 0.3,  path: () => ({ to: '/supervisor/attendance', state: null }) },
    ];

    // Pie label with grade letter + pct
    const totalStuds = gradeData.reduce((a, c) => a + c.value, 0);
    const renderPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, value, index }) => {
        if (!value || totalStuds === 0) return null;
        const pct = parseFloat((value / totalStuds * 100).toFixed(1));
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

    const PieTooltip = ({ active, payload }) => {
        if (!active || !payload?.length) return null;
        const d = payload[0].payload;
        const pct = totalStuds > 0 ? parseFloat((d.value / totalStuds * 100).toFixed(1)) : 0;
        return (
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '8px 12px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: d.color, display: 'inline-block' }} />
                    <strong>{d.name}</strong>
                </div>
                <div style={{ color: '#64748b', marginTop: 2 }}>{d.value} {t('student', lang)} · {pct}%</div>
            </div>
        );
    };

    return (
        <div className="space-y-6 animate-fade-in pb-12">
            <div>
                <h1 className="text-xl sm:text-2xl font-bold text-[#0f172a]">{t('dashboard', lang)}</h1>
                <p className="text-[#64748b] text-sm">{t('welcomeBack', lang)}, {isAr ? (user?.name_ar || user?.name) : user?.name}. {t('dashboardOverview', lang)}</p>
            </div>

            <FilterBar
                filters={buildFilters(applied, filterData, {}, lang)}
                
                appliedFilters={applied}onApply={handleApply}
                onReset={handleReset}
            />

            {hasApplied && loading && (
                <div className="flex items-center justify-center py-16 text-[#94a3b8]">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600 mr-2" /> {t('loading', lang)}
                </div>
            )}

            {!hasApplied && !loading && (
                <div className="bg-white rounded-xl border border-[#e2e8f0] py-16 flex flex-col items-center justify-center gap-3 text-[#94a3b8]">
                    <p className="text-sm font-medium">{t('pressApplyToLoad', lang)}</p>
                </div>
            )}

            {hasApplied && !loading && (
                <>
                    {/* Stat Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
                        {statCards.map((stat, idx) => (
                            <div key={idx} onClick={() => { const p = stat.path(); navigate(p.to, p.state ? { state: p.state } : {}); }} className="cursor-pointer">
                                <StatCard {...stat} />
                            </div>
                        ))}
                    </div>

                    {/* Charts */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">

                        {/* Top Performing Classes — vertical bars with per-bar colors */}
                        <div className="bg-white rounded-xl border border-[#e2e8f0] p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="font-bold text-[#0f172a]">{t('studentsPerClass', lang)}</h2>
                                <span className="text-xs font-bold text-[#64748b] bg-slate-100 px-2 py-1 rounded-lg">{classPerfData.length} {t('class', lang)}</span>
                            </div>
                            {classPerfData.length === 0 ? (
                                <div className="h-[280px] flex items-center justify-center text-[#94a3b8] text-sm">{t('noClassData', lang)}</div>
                            ) : (
                                <div style={{ height: 280, minWidth: 0, width: '100%' }}>
                                    <ResponsiveContainer width="100%" height={280}>
                                        <BarChart data={classPerfData} margin={{ top: 16, right: 20, left: 0, bottom: 40 }} barCategoryGap="5%" barSize={28}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }} tickLine={false} axisLine={false} angle={-20} textAnchor="end" height={50} interval={0} />
                                            <YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} />
                                            <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: 12 }} formatter={(v) => [v, t('students', lang)]} />
                                            <Bar dataKey="students" radius={[5, 5, 0, 0]} animationDuration={900}>
                                                {classPerfData.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                                                <LabelList dataKey="students" position="top" style={{ fill: '#475569', fontSize: 12, fontWeight: 700 }} />
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </div>

                        {/* Mark Distribution — pie chart with grade letters */}
                        <div className="bg-white rounded-xl border border-[#e2e8f0] p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="font-bold text-[#0f172a]">{t('markDistribution', lang)}</h2>
                                {gradeData.length > 0 && (
                                    <span className="text-xs font-bold text-[#64748b] bg-slate-100 px-2 py-1 rounded-lg">{totalStuds} {t('student', lang)}</span>
                                )}
                            </div>
                            {gradeData.length === 0 ? (
                                <div style={{ height: 280 }} className="flex flex-col items-center justify-center text-[#94a3b8] gap-2">
                                    <span className="text-4xl">📊</span>
                                    <p className="text-sm font-medium">{t('noMarksRecorded', lang)}</p>
                                </div>
                            ) : (
                                <>
                                    <div style={{ height: 220, minWidth: 0, width: '100%' }}>
                                        <ResponsiveContainer width="100%" height={220}>
                                            <PieChart>
                                                <Pie
                                                    data={gradeData} cx="50%" cy="50%"
                                                    outerRadius={95} paddingAngle={2}
                                                    dataKey="value" label={renderPieLabel} labelLine={false}
                                                >
                                                    {gradeData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                                                </Pie>
                                                <Tooltip content={<PieTooltip />} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 mt-3">
                                        {gradeData.map((entry, i) => {
                                            const pct = totalStuds > 0 ? parseFloat((entry.value / totalStuds * 100).toFixed(1)) : 0;
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
                                </>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
