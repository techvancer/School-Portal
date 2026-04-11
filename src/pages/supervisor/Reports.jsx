import { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';
import { BarChart2, TrendingUp, Activity, CheckCircle2, Clock, AlertCircle, XCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../context/LanguageContext';
import { t, getField } from '../../lib/langHelper';
import { getClassName, getSectionName, getSubjectName } from '../../lib/helpers';
import { rest } from '../../lib/supabaseClient';
import { useToast } from '../../context/ToastContext';

export default function SupervisorReports() {
    const { user } = useAuth();
    const { addToast } = useToast();
    const { lang, isAr } = useLang();

    const [classPerformanceData, setClassPerformanceData] = useState([]);
    const [subjectPerformanceData, setSubjectPerformanceData] = useState([]);
    const [examStatusData, setExamStatusData] = useState([]);
    const [examStats, setExamStats] = useState({ new: 0, marked: 0, submitted: 0, cancelled: 0, total: 0 });
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        if (!user) return;
        try {
            setLoading(true);

            const [answersData, classesData, sectionsData, subjectsData, examsData, questionsData, employeesData] = await Promise.all([
                rest('studentanswers_tbl', { select: '*' }),
                rest('classes_tbl', { select: 'classid,classname_en,classname' }),
                rest('sections_tbl', { select: 'sectionid,sectionname_en,sectionname' }),
                rest('subjects_tbl', { select: 'subjectid,"Subjectname_en",subjectname' }),
                rest('exams_tbl', { select: 'examid,examname_en,examname' }),
                rest('questions_exams_employee_subjects_sections_tbl', { select: 'examid,classid,sectionid,subjectid,employeeid,questionid' }),
                rest('employee_tbl', { select: 'employeeid,employeename_en,employeename' })
            ]);

            const answers = answersData || [];
            const classes = classesData || [];
            const sections = sectionsData || [];
            const subjects = subjectsData || [];
            const exams = examsData || [];
            const questions = questionsData || [];
            const employees = employeesData || [];

            // ===== CLASS PERFORMANCE =====
            const classMap = {};
            answers.forEach(ans => {
                if (!ans.studentmark) return;
                const key = `${ans.classid}-${ans.sectionid}`;
                if (!classMap[key]) {
                    classMap[key] = { classid: ans.classid, sectionid: ans.sectionid, marks: [] };
                }
                classMap[key].marks.push(parseFloat(ans.studentmark) || 0);
            });

            const classPerf = Object.values(classMap).map(item => {
                const cl = classes.find(c => c.classid === item.classid);
                const sec = sections.find(s => s.sectionid === item.sectionid);
                const avg = Math.round((item.marks.reduce((a, b) => a + b, 0) / item.marks.length) * 100) / 100;
                const className = isAr ? (cl?.classname || cl?.classname_en || `الصف ${item.classid}`) : (cl?.classname_en || `Class ${item.classid}`);
                const sectionName = isAr ? (sec?.sectionname || sec?.sectionname_en || `الشعبة ${item.sectionid}`) : (sec?.sectionname_en || `Section ${item.sectionid}`);
                
                let fill = '#ef4444';
                if (avg >= 80) fill = '#059669';
                else if (avg >= 70) fill = '#22c55e';
                else if (avg >= 60) fill = '#fbbf24';
                
                return {
                    name: `${className}-${sectionName}`,
                    score: avg,
                    fill
                };
            });
            setClassPerformanceData(classPerf.sort((a, b) => b.score - a.score));

            // ===== SUBJECT PERFORMANCE =====
            const subjectMap = {};
            answers.forEach(ans => {
                if (!ans.studentmark) return;
                const key = String(ans.subjectid);
                if (!subjectMap[key]) {
                    subjectMap[key] = { subjectid: ans.subjectid, marks: [] };
                }
                subjectMap[key].marks.push(parseFloat(ans.studentmark) || 0);
            });

            const subjectPerf = Object.values(subjectMap).map(item => {
                const sub = subjects.find(s => s.subjectid === item.subjectid);
                const avg = Math.round((item.marks.reduce((a, b) => a + b, 0) / item.marks.length) * 100) / 100;
                const subName = getField(sub, 'subjectname', 'Subjectname_en', lang) || `${isAr ? 'المادة' : 'Subject'} ${item.subjectid}`;
                
                return { name: subName, avg };
            });
            setSubjectPerformanceData(subjectPerf.sort((a, b) => b.avg - a.avg));

            // ===== EXAM STATUS =====
            // Group questions by exam to get unique exams
            const examMap = new Map();
            questions.forEach(q => {
                const key = `${q.examid}-${q.classid}-${q.sectionid}`;
                if (!examMap.has(key)) {
                    examMap.set(key, q);
                }
            });

            const examsWithStatus = Array.from(examMap.values()).map(q => {
                const exam = exams.find(e => e.examid === q.examid);
                const cl = classes.find(c => c.classid === q.classid);
                const sec = sections.find(s => s.sectionid === q.sectionid);
                const emp = employees.find(e => e.employeeid === q.employeeid);
                
                // Check if teacher uploaded marks for this exam
                const answersForExam = answers.filter(a => 
                    a.examid === q.examid && 
                    a.classid === q.classid && 
                    a.sectionid === q.sectionid
                );
                
                const hasMarks = answersForExam.length > 0;
                const status = hasMarks ? 'marked' : 'new';
                
                return {
                    examid: q.examid,
                    examname: getField(exam, 'examname', 'examname_en', lang) || `${isAr ? 'الامتحان' : 'Exam'} ${q.examid}`,
                    classname: getField(cl, 'classname', 'classname_en', lang) || `${isAr ? 'الصف' : 'Class'} ${q.classid}`,
                    sectionname: getField(sec, 'sectionname', 'sectionname_en', lang) || `${isAr ? 'الشعبة' : 'Section'} ${q.sectionid}`,
                    teachername: getField(emp, 'employeename', 'employeename_en', lang) || (isAr ? 'معلم غير محدد' : 'Unknown Teacher'),
                    studentAnswers: new Set(answersForExam.map(a => a.studentid)).size,
                    totalMarks: answersForExam.length,
                    status,
                    classid: q.classid,
                    sectionid: q.sectionid,
                    employeeid: q.employeeid
                };
            });

            setExamStatusData(examsWithStatus);

            // Calculate summary stats
            const newCount = examsWithStatus.filter(e => e.status === 'new').length;
            const markedCount = examsWithStatus.filter(e => e.status === 'marked').length;
            setExamStats({
                new: newCount,
                marked: markedCount,
                submitted: 0,
                cancelled: 0,
                total: examsWithStatus.length
            });

        } catch (e) {
            console.error('Error:', e);
            addToast(t('errorLoadingReports', lang) || 'Unable to load report data. Please try again.', 'error');
        } finally {
            setLoading(false);
        }
    }, [user, lang]);

    useEffect(() => { 
        fetchData(); 
    }, [fetchData]);

    // Refresh charts when language changes
    useEffect(() => {
        const handler = () => { fetchData(); };
        window.addEventListener('langChanged', handler);
        return () => window.removeEventListener('langChanged', handler);
    }, [fetchData]);

    // Status card component with gradient and icon
    const StatusCard = ({ label, count, icon: Icon, bgGradient, iconColor, borderColor }) => (
        <div className={`${bgGradient} rounded-xl p-6 border-l-4 ${borderColor} shadow-md hover:shadow-lg transition-shadow`}>
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm font-semibold text-gray-600 mb-2">{label}</p>
                    <p className="text-4xl font-bold text-gray-900">{count}</p>
                </div>
                <div className={`${iconColor} rounded-full p-3 bg-white bg-opacity-50`}>
                    <Icon className="h-6 w-6" />
                </div>
            </div>
        </div>
    );

    // Enhanced exam detail card with teacher, grade, section
    const ExamDetailCard = ({ exam }) => {
        const gradeSection = `${exam.classname} ${exam.sectionname}`;
        
        return (
            <div className="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-gray-900 text-base mb-3">{exam.examname}</h4>
                        
                        <div className="space-y-2 mb-4">
                            {/* Grade and Section */}
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                                <span className="text-sm font-semibold text-gray-700">{gradeSection}</span>
                            </div>
                            
                            {/* Teacher Name */}
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-purple-500 flex-shrink-0" />
                                <span className="text-sm text-gray-600">{isAr ? 'المعلم: ' : 'Teacher: '}<span className="font-semibold text-gray-900">{exam.teachername}</span></span>
                            </div>
                            
                            {/* Students Answered */}
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                                <span className="text-sm text-gray-600">{exam.studentAnswers} {isAr ? 'طالب أجاب •' : 'students answered •'} {exam.totalMarks} {isAr ? 'درجة مسجلة' : 'marks recorded'}</span>
                            </div>
                        </div>
                    </div>
                    
                    {/* Status Badge */}
                    <div className="flex-shrink-0">
                        {exam.status === 'new' && (
                            <div className="flex flex-col items-center gap-2">
                                <AlertCircle className="h-5 w-5 text-slate-400" />
                                <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300 whitespace-nowrap">
                                    {isAr ? 'جديد' : 'New'}
                                </span>
                            </div>
                        )}
                        {exam.status === 'marked' && (
                            <div className="flex flex-col items-center gap-2">
                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                                <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200 whitespace-nowrap">
                                    {isAr ? 'مصحح' : 'Marked'}
                                </span>
                            </div>
                        )}
                        {exam.status === 'submitted' && (
                            <div className="flex flex-col items-center gap-2">
                                <CheckCircle2 className="h-5 w-5 text-blue-600" />
                                <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700 border border-blue-200 whitespace-nowrap">
                                    {isAr ? 'مُرسَل' : 'Submitted'}
                                </span>
                            </div>
                        )}
                        {exam.status === 'cancelled' && (
                            <div className="flex flex-col items-center gap-2">
                                <XCircle className="h-5 w-5 text-red-600" />
                                <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200 whitespace-nowrap">
                                    {isAr ? 'ملغي' : 'Cancelled'}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6 pb-12">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">{isAr ? 'التقارير' : 'Reports'}</h1>
                <p className="text-gray-600 text-sm">{isAr ? 'تحليل الأداء والمقارنات' : 'Performance analysis and comparisons'}</p>
            </div>

            {/* CLASS PERFORMANCE */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                    <BarChart2 className="h-5 w-5 text-blue-600" />
                    <h3 className="font-bold text-gray-900">{isAr ? 'نظرة عامة على أداء الصفوف' : 'Class Performance Overview'}</h3>
                </div>
                <p className="text-xs text-gray-500 mb-6">{isAr ? 'متوسط الدرجات لكل شعبة' : 'Average mark by class-section showing which classes excel'}</p>

                {loading ? (
                    <div className="h-80 flex items-center justify-center text-gray-400">{t('loading', lang)}</div>
                ) : classPerformanceData.length === 0 ? (
                    <div className="h-80 flex items-center justify-center text-gray-400">{isAr ? 'لا توجد بيانات' : 'No data available'}</div>
                ) : (
                    <div style={{ height: '280px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={classPerformanceData} layout="vertical" margin={{ left: 120, right: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                <XAxis type="number" domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 10 }} />
                                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} width={115} />
                                <RechartsTooltip formatter={(v) => `${v}%`} contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: 12 }} />
                                <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                                    {classPerformanceData.map((entry, index) => (
                                        <Cell key={index} fill={entry.fill} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

            {/* SUBJECT PERFORMANCE */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    <h3 className="font-bold text-gray-900">{isAr ? 'مقارنة أداء المواد' : 'Subject Performance Comparison'}</h3>
                </div>
                <p className="text-xs text-gray-500 mb-6">{isAr ? 'متوسط الدرجات لكل مادة' : 'Average mark by subject showing which need improvement'}</p>

                {loading ? (
                    <div className="h-80 flex items-center justify-center text-gray-400">{t('loading', lang)}</div>
                ) : subjectPerformanceData.length === 0 ? (
                    <div className="h-80 flex items-center justify-center text-gray-400">No data available</div>
                ) : (
                    <div style={{ height: '280px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={subjectPerformanceData} margin={{ bottom: 60, left: 10, right: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} />
                                <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 10 }} />
                                <RechartsTooltip formatter={(v) => `${v}%`} contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: 12 }} />
                                <Bar dataKey="avg" fill="#16a34a" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

            {/* EXAM STATUS SUMMARY */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-6">
                    <Activity className="h-5 w-5 text-purple-600" />
                    <h3 className="font-bold text-gray-900 text-lg">{isAr ? 'ملخص حالات الامتحانات' : 'Exam Status Summary'}</h3>
                </div>
                <p className="text-xs text-gray-500 mb-6">{isAr ? 'حالة اكتمال التقييم والتقدم الكلي' : 'Overall assessment completion status and progress'}</p>

                {loading ? (
                    <div className="h-40 flex items-center justify-center text-gray-400">{t('loading', lang)}</div>
                ) : (
                    <>
                        {/* Status Cards Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                            <StatusCard 
                                label={isAr ? 'امتحانات جديدة' : 'New Exams'} 
                                count={examStats.new}
                                icon={AlertCircle}
                                bgGradient="bg-gradient-to-br from-slate-50 to-slate-100"
                                iconColor="text-slate-500"
                                borderColor="border-slate-400"
                            />
                            <StatusCard 
                                label={isAr ? 'مصحح' : 'Marked'} 
                                count={examStats.marked}
                                icon={CheckCircle2}
                                bgGradient="bg-gradient-to-br from-green-50 to-green-100"
                                iconColor="text-green-600"
                                borderColor="border-green-500"
                            />
                            <StatusCard 
                                label={isAr ? 'مُرسَل' : 'Submitted'} 
                                count={examStats.submitted}
                                icon={Clock}
                                bgGradient="bg-gradient-to-br from-blue-50 to-blue-100"
                                iconColor="text-blue-600"
                                borderColor="border-blue-500"
                            />
                            <StatusCard 
                                label={isAr ? 'ملغي' : 'Cancelled'} 
                                count={examStats.cancelled}
                                icon={XCircle}
                                bgGradient="bg-gradient-to-br from-red-50 to-red-100"
                                iconColor="text-red-600"
                                borderColor="border-red-500"
                            />
                        </div>

                        {/* Progress Visualization */}
                        <div className="mb-8 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
                            <div className="flex justify-between items-center mb-3">
                                <div className="text-sm font-semibold text-gray-700">{isAr ? 'التقدم الكلي' : 'Overall Progress'}</div>
                                <div className="text-xl font-bold text-blue-600">
                                    {examStats.total > 0 ? Math.round((examStats.marked / examStats.total) * 100) : 0}%
                                </div>
                            </div>
                            <div className="w-full h-3 bg-blue-100 rounded-full overflow-hidden border border-blue-200">
                                <div
                                    style={{ width: `${examStats.total > 0 ? (examStats.marked / examStats.total) * 100 : 0}%` }}
                                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-500"
                                />
                            </div>
                            <p className="text-xs text-gray-600 mt-3 font-medium">
                                {examStats.total > 0 ? `${examStats.marked} of ${examStats.total} exams marked` : 'No exams found'}
                            </p>
                        </div>

                        {/* Exam Details List */}
                        <div>
                            <h4 className="font-bold text-gray-900 mb-4">{isAr ? 'تفاصيل الامتحانات' : 'Exam Details'}</h4>
                            <div className="space-y-3">
                                {examStatusData.length > 0 ? (
                                    examStatusData.map((exam, idx) => (
                                        <ExamDetailCard key={idx} exam={exam} />
                                    ))
                                ) : (
                                    <p className="text-center text-gray-500 py-8">{isAr ? 'لا توجد امتحانات' : 'No exams found'}</p>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
