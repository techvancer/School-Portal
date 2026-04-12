import { t, getField, getStudentName as _getStudentName } from '../lib/langHelper';
import { useLang } from '../context/LanguageContext';
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Plus, Trash2, Video, Save } from 'lucide-react';
import Breadcrumb from '../components/Breadcrumb';
import ConfirmDialog from '../components/ConfirmDialog';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { classesData, examsData } from '../data/mockData';

export default function EditExam() {
    const { lang, isAr } = useLang();

    const { id } = useParams();
    const navigate = useNavigate();
    const { addToast } = useToast();
    const { user } = useAuth();
    const backPath = user?.role === 'Admin' ? '/admin/exams' : '/exams';

    const [shake, setShake] = useState(false);
    const [formData, setFormData] = useState(null);
    const [errors, setErrors] = useState({});
    const [confirm, setConfirm] = useState({ open: false });

    useEffect(() => {
        const savedExams = JSON.parse(localStorage.getItem('exams')) || examsData;
        const exam = savedExams.find(e => e.id === id);

        if (exam) {
            const [className, sectionName] = exam.classSection.split('-');
            setFormData({
                ...exam,
                class: className,
                section: sectionName,
                questions: exam.questions || [{ id: Date.now(), text: '', videoUrl: '' }]
            });
        } else {
            addToast('Exam not found', 'error');
            navigate(backPath);
        }
    }, [id, navigate, addToast, backPath, lang]);

    if (!formData) return <div className="p-8 text-center text-slate-500 font-medium">Loading exam data...</div>;

    const classes = [...new Set(classesData.map(c => c.name))];
    const sections = classesData
        .filter(c => c.name === formData.class)
        .map(c => c.section);

    const handleAddQuestion = () => {
        setFormData(prev => ({
            ...prev,
            questions: [...prev.questions, { id: Date.now(), text: '', videoUrl: '' }]
        }));
    };

    const handleRemoveQuestion = (qId) => {
        if (formData.questions.length > 1) {
            setFormData(prev => ({
                ...prev,
                questions: prev.questions.filter(q => q.id !== qId)
            }));
        }
    };

    const handleQuestionChange = (qId, field, value) => {
        setFormData(prev => ({
            ...prev,
            questions: prev.questions.map(q => q.id === qId ? { ...q, [field]: value } : q)
        }));
    };

    const validateYouTubeUrl = (url) => {
        if (!url) return true;
        return url.startsWith('https://www.youtube.com') || url.startsWith('https://youtu.be');
    };

    const validate = () => {
        const newErrors = {};
        if (!formData.name) newErrors.name = 'Exam name is required';
        if (!formData.date) newErrors.date = 'Exam date is required';
        if (!formData.class) newErrors.class = 'Class is required';
        if (!formData.section) newErrors.section = 'Section is required';
        if (!formData.type) newErrors.type = 'Exam type is required';

        formData.questions.forEach((q) => {
            if (!q.text) newErrors[`q_${q.id}_text`] = 'Question text is required';
            if (q.videoUrl && !validateYouTubeUrl(q.videoUrl)) {
                newErrors[`q_${q.id}_url`] = 'Invalid YouTube URL';
            }
        });

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = () => {
        if (validate()) {
            const savedExams = JSON.parse(localStorage.getItem('exams')) || examsData;
            const updatedExam = {
                ...formData,
                classSection: `${formData.class}-${formData.section}`,
                questions: formData.questions
            };

            const updatedExams = savedExams.map(e => e.id === id ? updatedExam : e);
            localStorage.setItem('exams', JSON.stringify(updatedExams));

            addToast('Exam updated successfully!', 'success');
            navigate(backPath);
        } else {
            setShake(true);
            setTimeout(() => setShake(false), 500);
            addToast('Please fix the errors before saving', 'error');
        }
    };

  return (
        <div className={`space-y-6 pb-12 ${shake ? 'animate-shake' : ''}`}>
            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigate(backPath)}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
                >
                    <ArrowLeft className="h-6 w-6 text-[#0f172a]" />
                </button>
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-[#0f172a]">{isAr ? "تعديل الامتحان" : "Edit Exam"}</h1>
                    <p className="text-[#64748b] text-sm font-medium">{isAr ? "تعديل تفاصيل الامتحان والأسئلة وحلول الفيديو" : "Modify exam details and questions with video solutions"}</p>
                    <Breadcrumb />
                </div>
            </div>

            {/* Section 1: Exam Details */}
            <div className="card p-6 bg-white space-y-6">
                <h2 className="text-lg font-bold text-[#0f172a] border-b border-[#e2e8f0] pb-4">{isAr ? "تفاصيل الامتحان" : "Exam Details"}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-[#334155]">Exam Name *</label>
                        <input
                            type="text"
                            className={`input-field ${errors.name ? 'border-red-500 bg-red-50/30' : ''}`}
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />
                        {errors.name && <p className="text-xs text-red-500 font-medium">{errors.name}</p>}
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-[#334155]">Exam Date *</label>
                        <input
                            type="date"
                            className={`input-field ${errors.date ? 'border-red-500 bg-red-50/30' : ''}`}
                            value={formData.date}
                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        />
                        {errors.date && <p className="text-xs text-red-500 font-medium">{errors.date}</p>}
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-[#334155]">Class *</label>
                        <select
                            className={`input-field ${errors.class ? 'border-red-500 bg-red-50/30' : ''}`}
                            value={formData.class}
                            onChange={(e) => setFormData({ ...formData, class: e.target.value, section: '' })}
                        >
                            <option value="">Select Class</option>
                            {classes.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        {errors.class && <p className="text-xs text-red-500 font-medium">{errors.class}</p>}
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-[#334155]">Section *</label>
                        <select
                            className={`input-field ${errors.section ? 'border-red-500 bg-red-50/30' : ''}`}
                            value={formData.section}
                            onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                            disabled={!formData.class}
                        >
                            <option value="">Select Section</option>
                            {sections.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        {errors.section && <p className="text-xs text-red-500 font-medium">{errors.section}</p>}
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-[#334155]">Exam Type *</label>
                        <select
                            className={`input-field ${errors.type ? 'border-red-500 bg-red-50/30' : ''}`}
                            value={formData.type}
                            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                        >
                            <option value="">Select Type</option>
                            <option value="Quiz">Quiz</option>
                            <option value="Monthly Test">Monthly Test</option>
                            <option value="Midterm">Midterm</option>
                            <option value="Final">Final</option>
                            <option value="Assignment">Assignment</option>
                        </select>
                        {errors.type && <p className="text-xs text-red-500 font-medium">{errors.type}</p>}
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-[#334155]">{isAr ? "إجمالي الأسئلة" : "Total Questions"}</label>
                        <input
                            type="number"
                            readOnly
                            className="input-field bg-slate-50 text-slate-500 font-medium"
                            value={formData.questions.length}
                        />
                    </div>
                </div>
            </div>

            {/* Section 2: Questions */}
            <div className="card p-6 bg-white space-y-6">
                <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-4">
                    <h2 className="text-lg font-bold text-[#0f172a]">Questions & Video Solutions</h2>
                    <button
                        onClick={handleAddQuestion}
                        className="flex items-center gap-2 border-2 border-[#1d4ed8] text-[#1d4ed8] hover:bg-blue-50 px-4 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer"
                    >
                        <Plus className="h-4 w-4" />
                        Add Question
                    </button>
                </div>

                <div className="space-y-6">
                    <AnimatePresence>
                        {formData.questions.map((q, index) => (
                            <motion.div
                                key={q.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="p-5 border border-[#e2e8f0] rounded-xl bg-slate-50/50 space-y-4 relative group"
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-md font-bold text-[#0f172a]">Question {index + 1}</span>
                                    {formData.questions.length > 1 && (
                                        <button
                                            onClick={() => handleRemoveQuestion(q.id)}
                                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                                        >
                                            <Trash2 className="h-5 w-5" />
                                        </button>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-[#64748b] uppercase tracking-wider">Question Text *</label>
                                    <textarea
                                        className={`input-field min-h-[100px] resize-y py-3 ${errors[`q_${q.id}_text`] ? 'border-red-500 bg-red-50/30' : ''}`}
                                        value={q.text}
                                        onChange={(e) => handleQuestionChange(q.id, 'text', e.target.value)}
                                    />
                                    {errors[`q_${q.id}_text`] && <p className="text-xs text-red-500 font-medium">{errors[`q_${q.id}_text`]}</p>}
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-[#64748b] uppercase tracking-wider">YouTube Video URL (Solution)</label>
                                    <div className="relative">
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                            <Video className="h-4 w-4" />
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="https://www.youtube.com/watch?v=..."
                                            className={`input-field pl-10 ${errors[`q_${q.id}_url`] ? 'border-red-500 bg-red-50/30' : ''}`}
                                            value={q.videoUrl}
                                            onChange={(e) => handleQuestionChange(q.id, 'videoUrl', e.target.value)}
                                        />
                                    </div>
                                    <p className="text-[12px] text-[#1d4ed8] font-medium pl-1">
                                        This video will be sent to students who answer this question incorrectly
                                    </p>
                                    {errors[`q_${q.id}_url`] && <p className="text-xs text-red-500 font-medium">{errors[`q_${q.id}_url`]}</p>}
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-end gap-3 pt-4">
                <button
                    onClick={() => navigate(backPath)}
                    className="px-6 py-2.5 border-2 border-slate-200 text-slate-600 hover:bg-slate-50 font-bold rounded-lg transition-all cursor-pointer"
                >
                    Cancel
                </button>
                <button
                    onClick={() => setConfirm({ open: true })}
                    className="flex items-center gap-2 bg-[#1d4ed8] hover:bg-[#1e40af] text-white px-8 py-2.5 rounded-lg font-bold transition-all shadow-md hover:shadow-xl hover:-translate-y-0.5 cursor-pointer"
                >
                    <Save className="h-5 w-5" />
                    Save Changes
                </button>
            </div>

            <ConfirmDialog
                open={confirm.open}
                title="Save Changes?"
                message="Your edits to this exam will be saved."
                confirmLabel="Save"
                cancelLabel="Cancel"
                variant="primary"
                onConfirm={() => { setConfirm({ open: false }); handleSubmit(); }}
                onCancel={() => setConfirm({ open: false })}
            />
        </div>
    );
}
