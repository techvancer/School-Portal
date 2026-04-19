import { t, getField, getStudentName as _getStudentName } from '../../lib/langHelper';
import { useLang } from '../../context/LanguageContext';
import { useState } from 'react';
import { ChevronLeft, Plus, Save, Trash2, HelpCircle, List, CheckSquare, Type, ChevronRight } from 'lucide-react';
import Breadcrumb from '../../components/Breadcrumb';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '../../context/ToastContext';
import { useSortable } from '../../lib/useSortable';
import { useColumnSearch } from '../../lib/useColumnSearch';
import SortableTh from '../../components/SortableTh';

export default function DefineQuestions() {
    const { lang, isAr } = useLang();

    const navigate = useNavigate();
    const { addToast } = useToast();
    const [questions, setQuestions] = useState([
        { id: 1, text: 'What is the capital of France?', type: 'Multiple Choice', options: ['Paris', 'London', 'Berlin', 'Madrid'], correct: 'Paris' },
        { id: 2, text: 'The earth is flat.', type: 'True/False', correct: 'False' }
    ]);

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newQ, setNewQ] = useState({ text: '', type: 'Multiple Choice', options: ['', '', '', ''], correct: '' });

    const handleAdd = () => {
        setQuestions([...questions, { ...newQ, id: Date.now() }]);
        setIsAddModalOpen(false);
        setNewQ({ text: '', type: 'Multiple Choice', options: ['', '', '', ''], correct: '' });
        addToast("Question added to exam bank", "success");
    };

    const removeQ = (id) => {
        setQuestions(questions.filter(q => q.id !== id));
        addToast("Question removed", "error");
    };

    return (
        <div className="space-y-6 animate-fade-in pb-12">
            <div className="flex items-center gap-4">
                <button title="Go Back" onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                    <ChevronLeft className="h-6 w-6 text-[#64748b]" />
                </button>
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-[#0f172a]">{isAr ? "تحديد الأسئلة" : "Define Questions"}</h1>
                    <p className="text-[#64748b] text-sm italic">Designing assessment for Grade 7 - Math Quiz</p>
                    <Breadcrumb />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                    {questions.map((q, idx) => (
                        <motion.div key={q.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.1 }} className="card p-6 bg-white border-[#e2e8f0] hover:border-blue-200 transition-all group relative">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm">
                                        {idx + 1}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-[#0f172a] pr-8">{q.text}</p>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded border mt-1 inline-block">
                                            {q.type}
                                        </span>
                                    </div>
                                </div>
                                <button title="Delete Question" onClick={() => removeQ(q.id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>

                            {q.type === 'Multiple Choice' && (
                                <div className="grid grid-cols-2 gap-3 pl-11">
                                    {q.options.map((opt, i) => (
                                        <div key={i} className={`p-3 rounded-xl border text-xs font-semibold ${opt === q.correct ? 'bg-green-50 border-green-200 text-green-700' : 'bg-slate-50 border-slate-100 text-slate-500'}`}>
                                            {String.fromCharCode(65 + i)}) {opt}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {q.type === 'True/False' && (
                                <div className="flex gap-3 pl-11">
                                    <div className={`px-4 py-2 rounded-xl border text-xs font-bold ${q.correct === 'True' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-slate-50 border-slate-100 text-slate-500'}`}>True</div>
                                    <div className={`px-4 py-2 rounded-xl border text-xs font-bold ${q.correct === 'False' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-slate-50 border-slate-100 text-slate-500'}`}>False</div>
                                </div>
                            )}
                        </motion.div>
                    ))}

                    <button onClick={() => setIsAddModalOpen(true)} className="w-full py-8 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 hover:text-blue-500 hover:border-blue-200 hover:bg-blue-50/30 transition-all flex flex-col items-center justify-center gap-2 font-bold text-sm">
                        <Plus className="h-6 w-6" /> Add Question
                    </button>
                </div>

                <div className="space-y-6">
                    <div className="card p-6 bg-[#0f172a] text-white rounded-2xl shadow-xl">
                        <h3 className="font-bold mb-4 flex items-center gap-2"><List className="h-5 w-5 text-blue-400" /> Exam Summary</h3>
                        <div className="space-y-4">
                            <div className="flex justify-between border-b border-white/10 pb-3">
                                <span className="text-white/60 text-xs">{isAr ? "إجمالي الأسئلة" : "Total Questions"}</span>
                                <span className="font-bold">{questions.length}</span>
                            </div>
                            <div className="flex justify-between border-b border-white/10 pb-3">
                                <span className="text-white/60 text-xs">{isAr ? "مجموع الدرجات" : "Total Marks"}</span>
                                <span className="font-bold text-blue-400">100 pts</span>
                            </div>
                            <div className="flex justify-between border-b border-white/10 pb-3">
                                <span className="text-white/60 text-xs">{isAr ? "المدة" : "Duration"}</span>
                                <span className="font-bold uppercase">60 mins</span>
                            </div>
                        </div>
                        <button onClick={() => { addToast("Exam bank saved!", "success"); navigate(-1); }} className="w-full btn-primary !bg-blue-500 !text-white h-11 mt-6 shadow-blue-900 shadow-xl font-bold flex items-center justify-center gap-2">
                            Update Exam <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>

                    <div className="card p-6 bg-amber-50 border-amber-100 rounded-2xl">
                        <div className="flex items-center gap-2 text-amber-700 font-bold mb-2">
                            <HelpCircle className="h-4 w-4" /> Tips
                        </div>
                        <p className="text-xs text-amber-800/80 leading-relaxed font-medium">Use a variety of question types to better assess student understanding. Ensure each question has a clear correct answer defined.</p>
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {isAddModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsAddModalOpen(false)} className="absolute inset-0 bg-[#0f172a]/40 backdrop-blur-md" />
                        <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden p-8">
                            <h2 className="text-xl font-bold text-[#0f172a] mb-6">{isAr ? "سؤال جديد" : "New Question"}</h2>
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-[#64748b] uppercase tracking-wider">{isAr ? "نص السؤال" : "Question Text"}</label>
                                    <textarea rows={3} className="input-field py-3" placeholder={isAr ? "أدخل نص السؤال..." : "Enter question description..."} value={newQ.text} onChange={e => setNewQ({ ...newQ, text: e.target.value })} />
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    {[
                                        { id: 'Multiple Choice', icon: CheckSquare },
                                        { id: 'True/False', icon: Type },
                                        { id: 'Essay', icon: List }
                                    ].map(type => (
                                        <button key={type.id} onClick={() => setNewQ({ ...newQ, type: type.id })} className={`flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all ${newQ.type === type.id ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-100' : 'bg-slate-50 text-slate-600 border-slate-100 hover:border-blue-200'}`}>
                                            <type.icon className="h-5 w-5" />
                                            <span className="text-[10px] font-bold uppercase">{type.id}</span>
                                        </button>
                                    ))}
                                </div>
                                {newQ.type === 'Multiple Choice' && (
                                    <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-2xl">
                                        {newQ.options.map((opt, i) => (
                                            <input key={i} className="input-field h-10 text-xs bg-white" placeholder={`Option ${i + 1}`} value={opt} onChange={e => {
                                                const opts = [...newQ.options];
                                                opts[i] = e.target.value;
                                                setNewQ({ ...newQ, options: opts });
                                            }} />
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-3 mt-8">
                                <button onClick={() => setIsAddModalOpen(false)} className="flex-1 font-bold text-[#64748b]">{isAr ? "تجاهل" : "Discard"}</button>
                                <button onClick={handleAdd} className="flex-1 btn-primary !bg-black !text-white h-12 shadow-lg shadow-slate-200">{isAr ? "تأكيد السؤال" : "Confirm Question"}</button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
