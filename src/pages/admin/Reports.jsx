import { t, getField, getStudentName as _getStudentName } from '../../lib/langHelper';
import { useLang } from '../../context/LanguageContext';
import { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Legend } from 'recharts';
import { FileText, Download, BarChart2, TrendingUp } from 'lucide-react';
import Breadcrumb from '../../components/Breadcrumb';
import FilterBar from '../../components/FilterBar';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { rest } from '../../lib/supabaseClient';
import { useSortable } from '../../lib/useSortable';
import { useColumnSearch } from '../../lib/useColumnSearch';
import SortableTh from '../../components/SortableTh';

export default function AdminReports() {
    const { lang, isAr } = useLang();

    const { user } = useAuth();
    const { addToast } = useToast();
    const [loading, setLoading] = useState(true);

    // Enrollment per class-section (real)
    const [enrollmentData, setEnrollmentData] = useState([]);
    // Subject spread per class (real)
    const [subjectData, setSubjectData] = useState([]);
    // Comparison selectors
    const [sectionOptions, setSectionOptions] = useState([]);
    const [classA, setClassA] = useState('');
    const [classB, setClassB] = useState('');
    const [compareData, setCompareData] = useState([]);

    const fetchData = useCallback(async () => {
        if (!user) return;
        try {
            setLoading(true);
            const [stuScRows, clTbl, secRows, subClRows, subTbl] = await Promise.all([
                rest('students_sections_classes_tbl', { schoolid: `eq.${user.schoolid}`, branchid: `eq.${user.branchid}`, select: '*' }),
                rest('classes_tbl', { select: '*' }),
                rest('sections_tbl', { select: '*' }),
                rest('sections_subjects_classes_tbl', { schoolid: `eq.${user.schoolid}`, branchid: `eq.${user.branchid}`, select: '*' }),
                rest('subjects_tbl', { select: '*' }),
            ]);

            // Enrollment per class-section
            const pairMap = new Map();
            stuScRows.forEach(row => {
                const key = `${row.classid}-${row.sectionid}`;
                const cl = clTbl.find(c => c.classid === row.classid);
                const sec = secRows.find(s => s.sectionid === row.sectionid);
                const label = cl && sec ? `${t('class', lang)} ${getField(cl, 'classname', 'classname_en', lang) || cl.classname}-${getField(sec, 'sectionname', 'sectionname_en', lang) || sec.sectionname}` : key;
                pairMap.set(key, { name: label, students: (pairMap.get(key)?.students || 0) + 1 });
            });
            const enrolArr = [...pairMap.values()].sort((a, b) => a.name.localeCompare(b.name));
            setEnrollmentData(enrolArr);

            // Sections for comparison dropdowns
            const options = enrolArr.map(e => e.name);
            setSectionOptions(options);
            if (options.length >= 2) { setClassA(options[0]); setClassB(options[1]); }

            // Subject count per class-section
            const subPairMap = new Map();
            subClRows.forEach(row => {
                const key = `${row.classid}-${row.sectionid}`;
                const cl = clTbl.find(c => c.classid === row.classid);
                const sec = secRows.find(s => s.sectionid === row.sectionid);
                const label = cl && sec ? `${t('class', lang)} ${getField(cl, 'classname', 'classname_en', lang) || cl.classname}-${getField(sec, 'sectionname', 'sectionname_en', lang) || sec.sectionname}` : key;
                subPairMap.set(key, { name: label, subjects: (subPairMap.get(key)?.subjects || 0) + 1 });
            });
            setSubjectData([...subPairMap.values()].sort((a, b) => a.name.localeCompare(b.name)));

        } catch (e) { addToast(e.message, 'error'); }
        finally { setLoading(false); }
    }, [user, lang]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Refresh charts when language changes
    useEffect(() => {
        const handler = () => { fetchData(); };
        window.addEventListener('langChanged', handler);
        return () => window.removeEventListener('langChanged', handler);
    }, [fetchData]);

    // When classA/classB change, build comparison using subject count
    useEffect(() => {
        if (!classA || !classB) return;
        const getSubjects = (label) => subjectData.find(s => s.name === label)?.subjects || 0;
        const getStudents = (label) => enrollmentData.find(s => s.name === label)?.students || 0;
        setCompareData([
            { name: t('students', lang), [classA]: getStudents(classA), [classB]: getStudents(classB) },
            { name: t('subjects', lang), [classA]: getSubjects(classA), [classB]: getSubjects(classB) },
        ]);
    }, [classA, classB, subjectData, enrollmentData]);

    const EmptyChart = ({ message }) => (
        <div className="flex items-center justify-center h-40 text-[#94a3b8] text-sm">{message}</div>
    );

    return (
        <div className="space-y-8 animate-fade-in pb-12">
            <div>
                <h1 className="text-xl sm:text-2xl font-bold text-[#0f172a]">{t('reports', lang)}</h1>
                <p className="text-[#64748b] text-sm">{t('performAnalysis', lang)}</p>
                <Breadcrumb />
            </div>

            {/* Student Enrollment by Class */}
            <div className="card p-6 bg-white rounded-xl">
                <h3 className="font-bold text-[#0f172a] mb-1 flex items-center gap-2">
                    <BarChart2 className="h-5 w-5 text-blue-600" /> {t('studentEnrollmentByClass', lang)}
                </h3>
                <p className="text-xs text-[#94a3b8] mb-6">{t('numStudentsPerClass', lang)}</p>
                {loading ? <EmptyChart message={`${t('loading', lang)}...`} /> : enrollmentData.length === 0 ? (
                    <EmptyChart message={t('noEnrollmentData', lang)} />
                ) : (
                    <div style={{height:"300px",width:"100%"}}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={enrollmentData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                                <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: 12 }} formatter={v => [v, t('students', lang)]} />
                                <Bar dataKey="students" fill="#1d4ed8" radius={[4, 4, 0, 0]} barSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

            {/* Subjects Per Class */}
            <div className="card p-6 bg-white rounded-xl">
                <h3 className="font-bold text-[#0f172a] mb-1 flex items-center gap-2">
                    <BarChart2 className="h-5 w-5 text-green-600" /> {t('subjectsAssignedPerClass', lang)}
                </h3>
                <p className="text-xs text-[#94a3b8] mb-6">{t('numSubjectsLinked', lang)}</p>
                {loading ? <EmptyChart message={`${t('loading', lang)}...`} /> : subjectData.length === 0 ? (
                    <EmptyChart message={t('noSubjectData', lang)} />
                ) : (
                    <div style={{height:"300px",width:"100%"}}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={subjectData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                                <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: 12 }} formatter={v => [v, t('subjects', lang)]} />
                                <Bar dataKey="subjects" fill="#16a34a" radius={[4, 4, 0, 0]} barSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

            {/* Section Comparison */}
            <div className="card p-6 bg-white rounded-xl">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div>
                        <h3 className="font-bold text-[#0f172a] flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-blue-600" /> {t('sectionComparison', lang)}
                        </h3>
                        <p className="text-xs text-[#94a3b8] mt-1">{t('compareStudentsSubjects', lang)}</p>
                    </div>
                    {sectionOptions.length >= 2 && (
                        <FilterBar
                            filters={[
                                { key: 'classA', label: t('classA', lang) || 'Class A', value: classA, options: sectionOptions.map(o => ({ value: o, label: o })) },
                                { key: 'classB', label: t('classB', lang) || 'Class B', value: classB, options: sectionOptions.map(o => ({ value: o, label: o })) },
                            ]}
                            appliedFilters={{ classA, classB }}
                            onApply={(vals) => { setClassA(vals.classA); setClassB(vals.classB); }}
                            onReset={() => { if (sectionOptions.length >= 2) { setClassA(sectionOptions[0]); setClassB(sectionOptions[1]); } }}
                        />
                    )}
                </div>
                {loading ? <EmptyChart message={`${t('loading', lang)}...`} /> : sectionOptions.length < 2 ? (
                    <EmptyChart message={t('needAtLeastTwo', lang)} />
                ) : (
                    <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={compareData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                                <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: 12 }} />
                                <Legend verticalAlign="top" height={32} />
                                <Bar dataKey={classA} fill="#1d4ed8" radius={[4, 4, 0, 0]} barSize={36} />
                                <Bar dataKey={classB} fill="#94a3b8" radius={[4, 4, 0, 0]} barSize={36} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

            {/* Export */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <button onClick={() => addToast(t('comingSoon', lang), 'success')}
                    className="flex items-center gap-4 p-6 bg-white border border-[#e2e8f0] rounded-2xl hover:border-blue-400 hover:shadow-lg transition-all text-left shadow-sm group">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors"><FileText className="h-6 w-6" /></div>
                    <div>
                        <span className="block font-bold text-[#0f172a] mb-0.5">{t('exportEnrollmentReport', lang)}</span>
                        <span className="text-xs text-[#64748b]">{t('studentCountsPdf', lang)}</span>
                    </div>
                </button>
                <button onClick={() => addToast(t('comingSoon', lang), 'success')}
                    className="flex items-center gap-4 p-6 bg-[#f8fafc] border-2 border-dashed border-[#e2e8f0] rounded-2xl hover:border-blue-400 transition-all text-left group">
                    <div className="p-3 bg-white text-slate-500 rounded-xl border border-[#e2e8f0] group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 transition-all"><Download className="h-6 w-6" /></div>
                    <div>
                        <span className="block font-bold text-[#0f172a] mb-0.5">{t('exportSubjectReport', lang)}</span>
                        <span className="text-xs text-[#64748b]">{t('subjectAssignmentsPdf', lang)}</span>
                    </div>
                </button>
            </div>
        </div>
    );
}
