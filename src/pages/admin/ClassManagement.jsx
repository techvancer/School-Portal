import { t, getField, getStudentName as _getStudentName } from '../../lib/langHelper';
import { useLang } from '../../context/LanguageContext';
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Users, BookOpen, GraduationCap, Layout, Plus, Search, Filter, Shield, MoreVertical } from 'lucide-react';
import Breadcrumb from '../../components/Breadcrumb';
import { useToast } from '../../context/ToastContext';
import { useSortable } from '../../lib/useSortable';
import { useColumnSearch } from '../../lib/useColumnSearch';
import SortableTh from '../../components/SortableTh';

const getClassMockData = (lang) => ({
    '1': {
        name: 'Grade 7',
        stage: 'Middle School',
        stats: [
            { label: t('totalStudents', lang), value: 54, icon: GraduationCap, color: 'text-blue-600 bg-blue-100' },
            { label: t('totalTeachers', lang), value: 4, icon: Users, color: 'text-purple-600 bg-purple-100' },
            { label: t('totalSubjects', lang), value: 4, icon: BookOpen, color: 'text-green-600 bg-green-100' },
            { label: t('sections', lang), value: 2, icon: Layout, color: 'text-orange-600 bg-orange-100' }
        ],
        sections: [
            { name: 'Section A', count: 27, teacher: 'Ahmed Mahmoud' },
            { name: 'Section B', count: 27, teacher: 'Ahmed Mahmoud' }
        ],
        students: [
            { name: 'Ali Youssef', id: 'S1001', section: 'A', avg: 88, attendance: 95 },
            { name: 'Sara Kamel', id: 'S1002', section: 'A', avg: 92, attendance: 98 },
            { name: 'Omar Said', id: 'S1003', section: 'A', avg: 58, attendance: 82 },
            { name: 'Laila Mahmoud', id: 'S1004', section: 'B', avg: 95, attendance: 100 },
            { name: 'Yusuf Nasser', id: 'S1005', section: 'B', avg: 62, attendance: 75 }
        ],
        teachers: [
            { name: 'Ahmed Mahmoud', subject: 'Mathematics' },
            { name: 'Sara Ali', subject: 'Science' },
            { name: 'Nour Khalid', subject: 'English' },
            { name: 'Faris Nour', subject: 'History' }
        ],
        subjects: [
            { name: 'Mathematics', code: 'MATH101' },
            { name: 'Science', code: 'SCI201' },
            { name: 'English', code: 'ENG301' },
            { name: 'History', code: 'HIST401' }
        ]
    },
    '2': {
        name: 'Grade 8',
        stage: 'Middle School',
        stats: [
            { label: t('totalStudents', lang), value: 60, icon: GraduationCap, color: 'text-blue-600 bg-blue-100' },
            { label: t('totalTeachers', lang), value: 4, icon: Users, color: 'text-purple-600 bg-purple-100' },
            { label: t('totalSubjects', lang), value: 4, icon: BookOpen, color: 'text-green-600 bg-green-100' },
            { label: t('sections', lang), value: 2, icon: Layout, color: 'text-orange-600 bg-orange-100' }
        ],
        sections: [
            { name: 'Section A', count: 30, teacher: 'Rami Hasan' },
            { name: 'Section B', count: 30, teacher: 'Heba Ziad' }
        ],
        students: [
            { name: 'Rana Khalil', id: 'S1006', section: 'A', avg: 65, attendance: 80 },
            { name: 'Hana Samir', id: 'S1007', section: 'A', avg: 78, attendance: 68 },
            { name: 'Tariq Mansour', id: 'S1008', section: 'B', avg: 71, attendance: 71 }
        ],
        teachers: [
            { name: 'Rami Hasan', subject: 'Physics' },
            { name: 'Dalia Saad', subject: 'Chemistry' },
            { name: 'Heba Ziad', subject: 'Geography' },
            { name: 'Ahmed Mahmoud', subject: 'Mathematics' }
        ],
        subjects: [
            { name: 'Mathematics', code: 'MATH101' },
            { name: 'Physics', code: 'PHY401' },
            { name: 'Chemistry', code: 'CHEM501' },
            { name: 'Geography', code: 'GEO601' }
        ]
    },
    '3': {
        name: 'Grade 9',
        stage: 'High School',
        stats: [
            { label: t('totalStudents', lang), value: 32, icon: GraduationCap, color: 'text-blue-600 bg-blue-100' },
            { label: t('totalTeachers', lang), value: 3, icon: Users, color: 'text-purple-600 bg-purple-100' },
            { label: t('totalSubjects', lang), value: 4, icon: BookOpen, color: 'text-green-600 bg-green-100' },
            { label: t('sections', lang), value: 1, icon: Layout, color: 'text-orange-600 bg-orange-100' }
        ],
        sections: [
            { name: 'Section B', count: 32, teacher: 'Karim Adel' }
        ],
        students: [
            { name: 'Dina Rashid', id: 'S1009', section: 'B', avg: 82, attendance: 70 },
            { name: 'Ahmad Faris', id: 'S1010', section: 'B', avg: 60, attendance: 78 }
        ],
        teachers: [
            { name: 'Karim Adel', subject: 'Biology' },
            { name: 'Nour Khalid', subject: 'English' },
            { name: 'Sara Ali', subject: 'Science' }
        ],
        subjects: [
            { name: 'Biology', code: 'BIO701' },
            { name: 'English', code: 'ENG301' },
            { name: 'Science', code: 'SCI201' },
            { name: 'Mathematics', code: 'MATH101' }
        ]
    }
});

export default function ClassManagement() {
    const { lang, isAr } = useLang();

    const { id } = useParams();
    const navigate = useNavigate();
    const { addToast } = useToast();
    const [activeTab, setActiveTab] = useState('Sections');
    const [searchQuery, setSearchQuery] = useState('');

    const classData = getClassMockData(lang)[id] || getClassMockData(lang)['1'];

    const tabs = [t('sections', lang), t('students', lang), t('teachers', lang), t('subjects', lang)];

    return (
        <div className="space-y-6 animate-fade-in pb-12">
            <div className="flex flex-col gap-1">
                <button
                    onClick={() => navigate('/admin/classes')}
                    className="flex items-center gap-2 text-[#64748b] hover:text-[#1d4ed8] transition-colors w-fit mb-2"
                >
                    <ArrowLeft size={18} />
                    <span className="text-sm font-medium">{t('backToClasses', lang)}</span>
                </button>
                <h1 className="text-2xl font-bold text-[#0f172a] uppercase tracking-tight">{classData.name} — {classData.stage}</h1>
                <p className="text-[#64748b] text-sm">{t('manageClassDetails', lang)}</p>
                <Breadcrumb />
            </div>

            {/* Top Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {classData.stats.map((stat, idx) => (
                    <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="card p-6 bg-white rounded-xl flex items-center gap-4"
                    >
                        <div className={`p-3 rounded-xl ${stat.color}`}>
                            <stat.icon className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-[#94a3b8] uppercase tracking-wider">{stat.label}</p>
                            <p className="text-xl font-bold text-[#0f172a]">{stat.value}</p>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Custom Tabs */}
            <div className="relative border-b border-[#e2e8f0]">
                <div className="flex gap-8">
                    {tabs.map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`pb-4 text-sm font-bold transition-all relative ${activeTab === tab ? 'text-[#1d4ed8]' : 'text-[#94a3b8] hover:text-[#64748b]'
                                }`}
                        >
                            {tab}
                            {activeTab === tab && (
                                <motion.div
                                    layoutId="tabUnderline"
                                    className="absolute bottom-0 left-0 right-0 h-1 bg-[#1d4ed8] rounded-t-full"
                                />
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tab Content */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                >
                    {activeTab === t('sections', lang) && (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center">
                                <h3 className="font-bold text-[#0f172a] text-lg">{t('classSections', lang)}</h3>
                                <button className="btn-primary flex items-center gap-2 text-sm px-4 h-10" onClick={() => addToast("Add Section modal would open", "success")}>
                                    <Plus className="h-4 w-4" /> {t('addSection', lang)}
                                </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {classData.sections.map((sec, i) => (
                                    <div key={i} className="card p-6 bg-white rounded-xl border-[#e2e8f0] flex flex-col gap-4 group">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h4 className="font-bold text-[#0f172a] text-lg">{sec.name}</h4>
                                                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase bg-blue-50 text-blue-600">
                                                    {sec.count} {t('students', lang)}
                                                </span>
                                            </div>
                                            <button className="p-2 hover:bg-slate-50 rounded-lg text-slate-400"><MoreVertical size={16} /></button>
                                        </div>
                                        <div className="flex-1 py-1" />
                                        <button
                                            onClick={() => setActiveTab(t('students', lang))}
                                            className="w-full h-10 border border-[#e2e8f0] rounded-lg text-sm font-bold text-[#1d4ed8] hover:bg-[#eff6ff] transition-all"
                                        >
                                            {t('viewStudents', lang)}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === t('students', lang) && (
                        <div className="space-y-6">
                            <div className="flex flex-col sm:flex-row gap-4 justify-between">
                                <h3 className="font-bold text-[#0f172a] text-lg shrink-0">{t('students', lang)} {t('in', lang)} {classData.name}</h3>
                                <div className="flex gap-2 flex-1 max-w-md">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                                        <input
                                            type="text"
                                            placeholder={t('searchStudent', lang)}
                                            className="input-field pl-10 h-10 text-sm"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                        />
                                    </div>
                                    <select className="input-field h-10 text-sm max-w-[120px]">
                                        <option>{t('allSections', lang)}</option>
                                        {classData.sections.map(s => <option key={s.name}>{s.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="card bg-white rounded-xl overflow-hidden border-[#e2e8f0]">
                                <div className="overflow-x-auto"><table className="w-full text-left min-w-[600px]">
                                    <thead className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                                        <tr>
                                            <th className="px-6 py-4 text-[10px] font-bold text-[#64748b] uppercase tracking-wider">{t('name', lang)}</th>
                                            <th className="px-6 py-4 text-[10px] font-bold text-[#64748b] uppercase tracking-wider">{t('studentId', lang)}</th>
                                            <th className="px-6 py-4 text-[10px] font-bold text-[#64748b] uppercase tracking-wider">{t('section', lang)}</th>
                                            <th className="px-6 py-4 text-[10px] font-bold text-[#64748b] uppercase tracking-wider">{t('average', lang)}</th>
                                            <th className="px-6 py-4 text-[10px] font-bold text-[#64748b] uppercase tracking-wider">{t('attendance', lang)}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#e2e8f0]">
                                        {classData.students.map((s, i) => (
                                            <tr key={i} className="hover:bg-[#eff6ff] transition-colors group">
                                                <td className="px-4 py-3 text-center text-sm font-bold text-[#0f172a]">{s.name}</td>
                                                <td className="px-4 py-3 text-center text-sm text-[#475569] font-mono">{s.id}</td>
                                                <td className="px-4 py-3 text-center text-sm text-[#475569]">{s.section}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`text-sm font-bold ${s.avg >= 85 ? 'text-green-600' : 'text-orange-600'}`}>{s.avg}%</span>
                                                </td>
                                                <td className="px-4 py-3 text-center text-sm text-[#475569] font-medium">{s.attendance}%</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === t('teachers', lang) && (
                        <div className="space-y-6">
                            <h3 className="font-bold text-[#0f172a] text-lg">{t('teachers', lang)} {t('assignedTo', lang)} {classData.name}</h3>
                            <div className="card bg-white rounded-xl overflow-hidden border-[#e2e8f0]">
                                <div className="overflow-x-auto"><table className="w-full text-left min-w-[600px]">
                                    <thead className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                                        <tr>
                                            <th className="px-6 py-4 text-[10px] font-bold text-[#64748b] uppercase tracking-wider">{t('name', lang)}</th>
                                            <th className="px-6 py-4 text-[10px] font-bold text-[#64748b] uppercase tracking-wider">{t('subject', lang)}</th>
                                            <th className="px-6 py-4 text-[10px] font-bold text-[#64748b] uppercase tracking-wider">{t('sections', lang)}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#e2e8f0]">
                                        {classData.teachers.map((t, i) => (
                                            <tr key={i} className="hover:bg-[#eff6ff] transition-colors cursor-pointer group">
                                                <td className="px-4 py-3 text-center">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs uppercase">
                                                            {t.name.charAt(0)}
                                                        </div>
                                                        <span className="text-sm font-bold text-[#0f172a]">{t.name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-center text-sm text-[#475569] font-medium">{t.subject}</td>
                                                <td className="px-4 py-3 text-center text-sm text-[#475569]">{t.sections}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === t('subjects', lang) && (
                        <div className="space-y-6">
                            <h3 className="font-bold text-[#0f172a] text-lg">{t('curriculumForClass', lang)} {classData.name}</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                {classData.subjects.map((sub, i) => (
                                    <motion.div
                                        key={i}
                                        whileHover={{ y: -5 }}
                                        onClick={() => navigate(`/admin/subjects/${sub.name}`)}
                                        className="card p-6 bg-white rounded-xl border-[#e2e8f0] cursor-pointer hover:shadow-lg transition-all"
                                    >
                                        <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center mb-4 text-slate-600">
                                            <BookOpen size={20} />
                                        </div>
                                        <h4 className="font-bold text-[#0f172a] mb-1">{sub.name}</h4>
                                        <p className="text-[10px] text-[#94a3b8] font-mono mb-4">{sub.code}</p>
                                        <div className="pt-4 border-t border-slate-50">
                                            <p className="text-xs text-[#64748b]">{t('assignedTeacher', lang)}</p>
                                            <p className="text-sm font-bold text-blue-600 truncate">{sub.teacher}</p>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    )}
                </motion.div>
            </AnimatePresence>
        </div>
    );
}
