import { t, getField, getStudentName as _getStudentName } from '../lib/langHelper';
import { useLang } from '../context/LanguageContext';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, BookOpen, CalendarDays, CheckCircle, ClipboardList, Loader2, Layers, GitBranch } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LabelList } from 'recharts';
import StatCard from '../components/StatCard';
import FilterBar from '../components/FilterBar';
import { useAuth } from '../context/AuthContext';
import { rest, supabase } from '../lib/supabaseClient';
import { fetchGradeDistribution } from '../lib/gradeUtils';
import { useFilterData } from '../lib/useFilterData';
import { buildFilters, EMPTY_FILTER, getClassName, getSectionName, getSubjectName } from '../lib/helpers';
import Breadcrumb from '../components/Breadcrumb';

export default function Dashboard() {
    const { lang, isAr } = useLang();

    const navigate = useNavigate();
    const { user } = useAuth();
    const filterData = useFilterData(user, lang);

    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ students: 0, sections: 0, classes: 0, subjects: 0, newExams: 0 });
    const [avgScoreByClass, setAvgScoreByClass] = useState([]);
    const [gradeDistribution, setGradeDistribution] = useState([]);
    // Change 2: full filter order
    const [applied, setApplied] = useState({ ...EMPTY_FILTER });
    const [draftFilters, setDraftFilters] = useState({ ...EMPTY_FILTER });

    const textColor = '#64748b';
    const gridColor = '#f1f5f9';
    const headingColor = '#0f172a';

    const fetchData = useCallback(async (filters = {}) => {
        if (!user) return;
        try {
            setLoading(true);

            // Change 1: Hierarchy — filter cascades Curriculum→Division→Branch→Stage→Class→Section
            const assignParams = {
                employeeid: `eq.${user.employeeid}`,
                schoolid: `eq.${user.schoolid}`,
                select: 'classid,sectionid,subjectid,stageid,semisterid,curriculumid,divisionid,employeeid,schoolid'
            };
            // Apply hierarchy filters in order
            if (filters.curriculumid && filters.curriculumid !== 'All') assignParams.curriculumid = `eq.${filters.curriculumid}`;
            if (filters.divisionid   && filters.divisionid   !== 'All') assignParams.divisionid   = `eq.${filters.divisionid}`;
            if (filters.stageid      && filters.stageid      !== 'All') assignParams.stageid       = `eq.${filters.stageid}`;
            if (filters.classid      && filters.classid      !== 'All') assignParams.classid       = `eq.${filters.classid}`;
            if (filters.sectionid    && filters.sectionid    !== 'All') assignParams.sectionid     = `eq.${filters.sectionid}`;
            if (filters.subjectid    && filters.subjectid    !== 'All') assignParams.subjectid     = `eq.${filters.subjectid}`;
            if (filters.semisterid   && filters.semisterid   !== 'All') assignParams.semisterid    = `eq.${filters.semisterid}`;

            const examParams = {
                employeeid: `eq.${user.employeeid}`,
                schoolid:   `eq.${user.schoolid}`,
                select: 'examid,classid,sectionid,subjectid,semisterid,yearid'
            };
            if (filters.stageid    && filters.stageid    !== 'All') examParams.stageid    = `eq.${filters.stageid}`;
            if (filters.classid    && filters.classid    !== 'All') examParams.classid    = `eq.${filters.classid}`;
            if (filters.sectionid  && filters.sectionid  !== 'All') examParams.sectionid  = `eq.${filters.sectionid}`;
            if (filters.subjectid  && filters.subjectid  !== 'All') examParams.subjectid  = `eq.${filters.subjectid}`;
            if (filters.semisterid && filters.semisterid !== 'All') examParams.semisterid = `eq.${filters.semisterid}`;
            // Change 4: also apply examid filter so card responds to exam filter selection
            if (filters.examid     && filters.examid     !== 'All') examParams.examid     = `eq.${filters.examid}`;
            if (filters.curriculumid && filters.curriculumid !== 'All') examParams.curriculumid = `eq.${filters.curriculumid}`;
            if (filters.divisionid   && filters.divisionid   !== 'All') examParams.divisionid   = `eq.${filters.divisionid}`;

            const stuParams = {
                schoolid: `eq.${user.schoolid}`,
                select: 'studentid,classid,sectionid',
                ...(filters.classid   && filters.classid   !== 'All' ? { classid:   `eq.${filters.classid}` }   : {}),
                ...(filters.sectionid && filters.sectionid !== 'All' ? { sectionid: `eq.${filters.sectionid}` } : {}),
                ...(filters.stageid   && filters.stageid   !== 'All' ? { stageid:   `eq.${filters.stageid}` }   : {}),
            };

            const qParams = {
                employeeid: `eq.${user.employeeid}`,
                schoolid: `eq.${user.schoolid}`,
                branchid: `eq.${user.branchid}`,
                select: 'examid,classid,sectionid,subjectid,status,questionid,question_marks',
                ...(filters.classid   && filters.classid   !== 'All' ? { classid:   `eq.${filters.classid}` }   : {}),
                ...(filters.sectionid && filters.sectionid !== 'All' ? { sectionid: `eq.${filters.sectionid}` } : {}),
                ...(filters.examid    && filters.examid    !== 'All' ? { examid:    `eq.${filters.examid}` }    : {})
            };

            const ansParams = {
                employeeid: `eq.${user.employeeid}`,
                schoolid: `eq.${user.schoolid}`,
                branchid: `eq.${user.branchid}`,
                select: 'examid,classid,sectionid,subjectid,studentid,studentmark,questionid',
                ...(filters.classid   && filters.classid   !== 'All' ? { classid:   `eq.${filters.classid}` }   : {}),
                ...(filters.sectionid && filters.sectionid !== 'All' ? { sectionid: `eq.${filters.sectionid}` } : {}),
                ...(filters.subjectid && filters.subjectid !== 'All' ? { subjectid: `eq.${filters.subjectid}` } : {}),
                ...(filters.examid    && filters.examid    !== 'All' ? { examid:    `eq.${filters.examid}` }    : {}),
            };

            const [empSec, clTbl, secRows, stuScRows, examEnrollRows, examMetaRows, answerRowsForStatus] = await Promise.all([
                rest('employees_sections_subjects_classes_semisters_curriculums_tbl', assignParams),
                rest('classes_tbl', { select: 'classid,classname_en,classname' }),
                rest('sections_tbl', { select: 'sectionid,sectionname_en,sectionname' }),
                rest('students_sections_classes_tbl', stuParams),
                rest('students_exams_employees_section_subjects_classes_semisters_cur', examParams),
                rest('questions_exams_employee_subjects_sections_tbl', qParams).catch(() => []),
                rest('studentanswers_tbl', ansParams).catch(() => []),
            ]);

            const assignmentRows = Array.isArray(empSec) ? empSec : [];
            const classRows      = Array.isArray(clTbl)  ? clTbl  : [];
            const sectionRows    = Array.isArray(secRows) ? secRows : [];
            const studentRows    = Array.isArray(stuScRows) ? stuScRows : [];
            const examRows       = Array.isArray(examEnrollRows) ? examEnrollRows : [];

            const seen = new Set();
            const sections = assignmentRows
                .filter(r => { const k = `${r.classid}-${r.sectionid}`; if (seen.has(k)) return false; seen.add(k); return true; })
                .map(r => {
                    const cl  = classRows.find(c => String(c.classid) === String(r.classid));
                    const sec = sectionRows.find(s => String(s.sectionid) === String(r.sectionid));
                    const className   = getClassName(cl, lang) || `${r.classid}`;
                    const sectionName = getSectionName(sec, lang) || `${r.sectionid}`;
                    const stuCount    = studentRows.filter(s => String(s.classid) === String(r.classid) && String(s.sectionid) === String(r.sectionid)).length;
                    return { ...r, classname: className, sectionname: sectionName, stuCount, label: `${className}-${sectionName}` };
                });

            const uniqueSubjects = new Set(assignmentRows.map(r => r.subjectid)).size;
            const totalStudents  = new Set(
                sections.flatMap(s => studentRows.filter(r => String(r.classid) === String(s.classid) && String(r.sectionid) === String(s.sectionid)).map(r => r.studentid))
            ).size;

            const examPool = examRows;
            const examMetaMap = new Map((Array.isArray(examMetaRows) ? examMetaRows : []).map(r => [`${r.examid}-${r.classid}-${r.sectionid}-${r.subjectid}`, r]));
            const answerRows = Array.isArray(answerRowsForStatus) ? answerRowsForStatus : [];

            const groupedExamPool = [...new Map(examPool.map(r => [`${r.examid}-${r.classid}-${r.sectionid}-${r.subjectid}`, r])).values()];
            const markedSubmittedExams = groupedExamPool.filter(r => {
                const comboRows = examPool.filter(x =>
                    String(x.examid) === String(r.examid) &&
                    String(x.classid) === String(r.classid) &&
                    String(x.sectionid) === String(r.sectionid) &&
                    String(x.subjectid) === String(r.subjectid)
                );
                const comboAnswers = answerRows.filter(x =>
                    String(x.examid) === String(r.examid) &&
                    String(x.classid) === String(r.classid) &&
                    String(x.sectionid) === String(r.sectionid) &&
                    String(x.subjectid) === String(r.subjectid)
                );
                const marksEntered = new Set(comboAnswers.map(x => x.studentid)).size;
                const totalExamStudents = new Set(comboRows.map(x => x.studentid)).size;
                const dbStatus = String(examMetaMap.get(`${r.examid}-${r.classid}-${r.sectionid}-${r.subjectid}`)?.status || '').toLowerCase();
                const status = dbStatus === 'cancelled'
                    ? 'cancelled'
                    : dbStatus === 'submitted'
                        ? 'submitted'
                        : ['marked', 'completed', 'inprogress'].includes(dbStatus) || marksEntered > 0
                            ? 'marked'
                            : 'new';
                return status === 'submitted' || status === 'marked';
            }).length;

            setStats({ students: totalStudents, sections: sections.length, classes: new Set(sections.map(s => s.classid)).size, subjects: uniqueSubjects, newExams: markedSubmittedExams });
            // Phase 1 fast loading stops here
            setLoading(false);

            try {
                const ansRows2 = answerRows;
                const qRows2 = examMetaRows || [];
                const qMaxMap2 = {};
                (qRows2 || []).forEach(q => { qMaxMap2[`${q.examid}-${q.classid}-${q.sectionid}-${q.questionid}`] = parseFloat(q.question_marks) || 1; });
                const csMap = {};
                (ansRows2 || []).forEach(a => {
                    const key = `${a.classid}-${a.sectionid}`;
                    if (!csMap[key]) csMap[key] = {};
                    const skey = String(a.studentid);
                    if (!csMap[key][skey]) csMap[key][skey] = { earned: 0, possible: 0 };
                    csMap[key][skey].earned   += parseFloat(a.studentmark) || 0;
                    csMap[key][skey].possible += qMaxMap2[`${a.examid}-${a.classid}-${a.sectionid}-${a.questionid}`] || 1;
                });
                const BAR_COLORS = ['#1d4ed8','#7c3aed','#0891b2','#059669','#d97706','#dc2626','#db2777','#65a30d'];
                const realAvg = sections.map((s, idx) => {
                    const key = `${s.classid}-${s.sectionid}`;
                    const stuData = csMap[key] || {};
                    const pcts = Object.values(stuData).filter(d => d.possible > 0).map(d => (d.earned / d.possible) * 100);
                    const avg = pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : 0;
                    return { name: s.label, score: avg, fill: BAR_COLORS[idx % BAR_COLORS.length] };
                }).filter(d => d.score > 0);
                setAvgScoreByClass(realAvg.length ? realAvg : sections.map((s, idx) => ({ name: s.label, score: 0, fill: BAR_COLORS[idx % BAR_COLORS.length] })));
            } catch { setAvgScoreByClass([]); }

            // Skip if the session was cleared during this async run (e.g. user logged out)
            const { data: { session: currentSession } } = await supabase.auth.getSession();
            if (!currentSession) { setGradeDistribution([]); return; }

            const gd = await fetchGradeDistribution({
                schoolid:     user.schoolid,
                branchid:     user.branchid,
                employeeid:   user.employeeid,
                curriculumid: filters.curriculumid && filters.curriculumid !== 'All' ? filters.curriculumid : undefined,
                divisionid:   filters.divisionid   && filters.divisionid   !== 'All' ? filters.divisionid   : undefined,
                stageid:      filters.stageid      && filters.stageid      !== 'All' ? filters.stageid      : undefined,
                classid:      filters.classid      && filters.classid      !== 'All' ? filters.classid      : undefined,
                sectionid:    filters.sectionid    && filters.sectionid    !== 'All' ? filters.sectionid    : undefined,
                subjectid:    filters.subjectid    && filters.subjectid    !== 'All' ? filters.subjectid    : undefined,
                examid:       filters.examid       && filters.examid       !== 'All' ? filters.examid       : undefined,
                semisterid:   filters.semisterid   && filters.semisterid   !== 'All' ? filters.semisterid   : undefined,
            });
            setGradeDistribution(Array.isArray(gd) ? gd : []);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [user, lang]);

    useEffect(() => { fetchData({}); }, [fetchData]);


    // Refresh charts when language changes
    useEffect(() => {
        const handler = () => { fetchData(applied); };
        window.addEventListener('langChanged', handler);
        return () => window.removeEventListener('langChanged', handler);
    }, [applied, fetchData]);

    const handleApply = (vals) => { setApplied(vals); fetchData(vals); };
    const handleReset = (vals) => { setApplied({ ...EMPTY_FILTER }); fetchData({}); };

    const totalStuds = gradeDistribution.reduce((a, c) => a + c.value, 0);

    // Custom label rendered on each pie slice
    const renderPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, value, index }) => {
        if (!value || value === 0 || totalStuds === 0) return null;
        const pct = totalStuds > 0 ? parseFloat((value / totalStuds * 100).toFixed(1)) : 0;
        if (pct < 8) return null; // skip tiny slices to avoid overlap
        const RADIAN = Math.PI / 180;
        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
        const x = cx + radius * Math.cos(-midAngle * RADIAN);
        const y = cy + radius * Math.sin(-midAngle * RADIAN);
        // Extract grade letter — first character of name e.g. "A (90–100%): ..."
        const gradeLetter = gradeDistribution[index]?.name?.charAt(0) || '';
        return (
            <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={800}>
                <tspan x={x} dy="-7" fontSize={15} fontWeight={900}>{gradeLetter}</tspan>
                <tspan x={x} dy="16" fontSize={11} fontWeight={700}>{pct}%</tspan>
            </text>
        );
    };

    // Custom tooltip for pie
    const PieTooltip = ({ active, payload }) => {
        if (!active || !payload?.length) return null;
        const d = payload[0].payload;
        const pct = totalStuds > 0 ? parseFloat((d.value / totalStuds * 100).toFixed(1)) : 0;
        return (
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', minWidth: 140 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: headingColor }}>{d.name}</span>
                </div>
                <div style={{ fontSize: 12, color: textColor }}>{d.value} student{d.value !== 1 ? 's' : ''} · <strong>{pct}%</strong></div>
            </div>
        );
    };

    // Change 3: 7 stat cards in correct order
    const buildState = (keys) => {
        const s = {};
        keys.forEach(k => { if (draftFilters[k] && draftFilters[k] !== 'All') s[k] = draftFilters[k]; });
        return Object.keys(s).length > 0 ? s : null;
    };

    const statsCards = [
        { title: t('Total Students', lang), value: stats.students,          icon: Users,         color: 'bg-blue-100 text-blue-600',     delay: 0,    path: () => ({ to: '/students', state: buildState(['curriculumid','divisionid','stageid','classid','sectionid']) }) },
        { title: t('My Classes', lang),     value: stats.classes,           icon: BookOpen,      color: 'bg-indigo-100 text-indigo-600', delay: 0.05, path: () => ({ to: '/classes', state: buildState(['curriculumid','divisionid','stageid','classid','sectionid']) }) },
        { title: t('My Sections', lang),    value: stats.sections,          icon: Layers,        color: 'bg-violet-100 text-violet-600', delay: 0.1,  path: () => ({ to: '/classes', state: buildState(['curriculumid','divisionid','stageid','classid','sectionid']) }) },
        { title: t('My Subjects', lang),    value: stats.subjects,          icon: GitBranch,     color: 'bg-teal-100 text-teal-600',     delay: 0.15, path: () => ({ to: '/classes', state: buildState(['curriculumid','divisionid','stageid','classid','sectionid','subjectid']) }) },
        { title: t('Exams', lang),          value: stats.newExams,        icon: ClipboardList, color: 'bg-purple-100 text-purple-600', delay: 0.2,  path: () => ({ to: '/exams',      state: buildState(['curriculumid','divisionid','stageid','classid','sectionid','subjectid','semisterid','examid']) }) },
        { title: t('Attendance', lang),     value: t('Coming Soon', lang),           icon: CheckCircle,   color: 'bg-green-100 text-green-600',   delay: 0.25, path: () => ({ to: '/attendance', state: buildState(['curriculumid','divisionid','stageid','classid','sectionid']) }) },
        { title: t('Schedule', lang),       value: t('Coming Soon', lang),           icon: CalendarDays,  color: 'bg-orange-100 text-orange-600', delay: 0.3,  path: () => ({ to: '/schedule',   state: buildState(['curriculumid','divisionid','stageid','classid','sectionid']) }) },
    ];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl sm:text-2xl font-bold text-[#0f172a]">{t('dashboard', lang)}</h1>
                <p className="text-[#64748b] text-sm">{t('welcomeBack', lang)}, {isAr ? (user?.name_ar || user?.name) : user?.name}. {t('dashboardOverview', lang) || 'Here is your overview.'}</p>
                <Breadcrumb />
            </div>

            {/* Change 2: Universal filter order */}
            <FilterBar
                filters={buildFilters(applied, filterData, {}, lang)}
                
                appliedFilters={applied}onApply={handleApply}
                onReset={handleReset}
                onChange={setDraftFilters}
            />

            {loading ? (
                <div className="flex items-center justify-center py-16 text-[#94a3b8]">
                    <Loader2 className="h-8 w-8 animate-spin mr-2" /> {t('loading', lang) || 'Loading...'}
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
                        {statsCards.map((stat, idx) => (
                            <div key={idx} onClick={() => { const p = stat.path(); navigate(p.to, p.state ? { state: p.state } : {}); }} className="cursor-pointer h-full block">
                                <StatCard {...stat} />
                            </div>
                        ))}
                    </div>

                    {/* Change 4: NO "My Sections" list below charts */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                        {/* Average Score by Classes */}
                        <div className="card p-6 bg-white rounded-xl border border-[#e2e8f0]">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-base text-[#0f172a]">{t('averageMarkByClasses', lang) || 'Average Mark by Classes'}</h3>
                                {avgScoreByClass.length > 0 && (
                                    <span className="text-xs font-bold text-[#64748b] bg-slate-100 px-2 py-1 rounded-lg">{avgScoreByClass.length} {t('classes', lang)}</span>
                                )}
                            </div>
                            {avgScoreByClass.length === 0 ? (
                                <div style={{ height: '280px' }} className="flex flex-col items-center justify-center text-[#94a3b8] gap-2">
                                    <span className="text-4xl">📊</span>
                                    <p className="text-sm font-medium">{t('No marks recorded yet', lang)}</p>
                                </div>
                            ) : (
                                <div style={{ height: 280, minWidth: 0, width: '100%' }}>
                                    <ResponsiveContainer width="100%" height={280}>
                                        <BarChart data={avgScoreByClass} margin={{ top: 20, right: 10, left: 10, bottom: 30 }} barCategoryGap="5%" barGap={2}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                                            <XAxis
                                                dataKey="name"
                                                tick={{ fill: textColor, fontSize: 11, fontWeight: 600 }}
                                                tickLine={false}
                                                axisLine={false}
                                                interval={0}
                                                angle={-20}
                                                textAnchor="end"
                                                height={50}
                                            />
                                            <YAxis
                                                domain={[0, 100]}
                                                tickFormatter={v => `${v}%`}
                                                tick={{ fill: textColor, fontSize: 11 }}
                                                tickLine={false}
                                                axisLine={false}
                                            />
                                            <RechartsTooltip
                                                formatter={(value) => [`${value}%`, t('avgMark', lang) || 'Avg Mark']}
                                                contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', borderRadius: '10px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                                                cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                                            />
                                            <Bar dataKey="score" radius={[6, 6, 0, 0]} barSize={28} animationDuration={1000} isAnimationActive={true}>
                                                {avgScoreByClass.map((entry, index) => (
                                                    <Cell key={index} fill={entry.fill} />
                                                ))}
                                                <LabelList
                                                    dataKey="score"
                                                    position="top"
                                                    formatter={v => `${v}%`}
                                                    style={{ fontWeight: 700, fontSize: 12, fill: headingColor }}
                                                />
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </div>

                        {/* Mark Distribution — Pie Chart */}
                        <div className="card p-6 bg-white rounded-xl border border-[#e2e8f0]">
                            <div className="flex items-center justify-between mb-1">
                                <h3 className="font-bold text-base text-[#0f172a]">{t('markDistribution', lang) || 'Marks Distribution'}</h3>
                                {totalStuds > 0 && (
                                    <span className="text-xs font-bold text-[#64748b] bg-slate-100 px-2 py-1 rounded-lg">{totalStuds} {t('students', lang)}</span>
                                )}
                            </div>
                            {gradeDistribution.length === 0 ? (
                                <div style={{ height: '300px' }} className="flex flex-col items-center justify-center text-[#94a3b8] gap-2">
                                    <span className="text-4xl">📊</span>
                                    <p className="text-sm font-medium">{t('No marks recorded yet', lang)}</p>
                                </div>
                            ) : (
                                <div>
                                    {/* Pie chart */}
                                    <div style={{ height: 220, minWidth: 0, width: '100%' }}>
                                        <ResponsiveContainer width="100%" height={220}>
                                            <PieChart>
                                                <Pie
                                                    data={gradeDistribution}
                                                    cx="50%"
                                                    cy="50%"
                                                    outerRadius={95}
                                                    paddingAngle={2}
                                                    dataKey="value"
                                                    labelLine={false}
                                                    label={renderPieLabel}
                                                    animationBegin={0}
                                                    animationDuration={900}
                                                >
                                                    {gradeDistribution.map((entry, i) => (
                                                        <Cell
                                                            key={i}
                                                            fill={entry.color}
                                                            stroke="#fff"
                                                            strokeWidth={2}
                                                        />
                                                    ))}
                                                </Pie>
                                                <RechartsTooltip content={<PieTooltip />} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                    {/* Custom legend as cards */}
                                    <div className="grid grid-cols-2 gap-2 mt-3">
                                        {gradeDistribution.map((entry, i) => {
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
                                </div>
                            )}
                        </div>

                        {/* Attendance – Coming Soon */}
                        <div className="card p-6 bg-white rounded-xl border border-[#e2e8f0]">
                            <h3 className="font-bold text-base text-[#0f172a] mb-4">{t('attendanceByClasses', lang) || 'Attendance by Classes'}</h3>
                            <div style={{ height: '220px' }} className="flex flex-col items-center justify-center text-[#94a3b8] gap-2">
                                <span className="text-5xl">🚧</span>
                                <p className="text-sm font-semibold text-[#64748b]">{t('Coming Soon', lang)}</p>
                            </div>
                        </div>

                        {/* Schedule – Coming Soon */}
                        <div className="card p-6 bg-white rounded-xl border border-[#e2e8f0]">
                            <h3 className="font-bold text-base text-[#0f172a] mb-4">{t('weeklySchedule', lang) || 'Weekly Schedule'}</h3>
                            <div style={{ height: '220px' }} className="flex flex-col items-center justify-center text-[#94a3b8] gap-2">
                                <span className="text-5xl">🚧</span>
                                <p className="text-sm font-semibold text-[#64748b]">{t('Coming Soon', lang)}</p>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
