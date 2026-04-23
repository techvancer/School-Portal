import { t, getField, getStudentName as _getStudentName } from '../../lib/langHelper';
import { useLang } from '../../context/LanguageContext';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Trash2, X, Loader2, User, BookOpen, Layers, Shield, Edit2 } from 'lucide-react';
import Breadcrumb from '../../components/Breadcrumb';
import ConfirmDialog from '../../components/ConfirmDialog';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { rest, insert, update, dbQuery } from '../../lib/supabaseClient';
import { useSortable } from '../../lib/useSortable';
import { useColumnSearch } from '../../lib/useColumnSearch';
import SortableTh from '../../components/SortableTh';

export default function AdminAssignments() {
    const { lang, isAr } = useLang();

    const { addToast } = useToast();
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('supervisors');
    const [loading, setLoading] = useState(true);
    const [addingNew, setAddingNew] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [editingRow, setEditingRow] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [deleteModal, setDeleteModal] = useState({ show: false, row: null });
    const [saveConfirm, setSaveConfirm] = useState({ open: false });

    const [students, setStudents] = useState([]);
    const [classes, setClasses] = useState([]);
    const [sectionClasses, setSectionClasses] = useState([]);
    const [sections, setSections] = useState([]);
    const [stages, setStages] = useState([]);
    const [curriculums, setCurriculums] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [employees, setEmployees] = useState({ all: [], teachers: [], supervisors: [] });
    const [assignments, setAssignments] = useState({ students: [], subjects: [], supervisors: [], teachers: [] });
    const [newRow, setNewRow] = useState({});

    const fetchData = useCallback(async () => {
        if (!user) return;
        try {
            setLoading(true);
            const [clRows, clTbl, secRows, stgRows, subRows, empRows, stuRows,
                stuScRows, subClRows, empStgRows, empTchRows, empTypesRows, curRows] = await Promise.all([
                rest('sections_classes_tbl', { schoolid: `eq.${user.schoolid}`, branchid: `eq.${user.branchid}`, select: '*' }),
                rest('classes_tbl', { select: '*' }),
                rest('sections_tbl', { select: '*' }),
                rest('stages_tbl', { schoolid: `eq.${user.schoolid}`, branchid: `eq.${user.branchid}`, select: '*' }),
                dbQuery('subjects_tbl?select=*&order=subjectid.asc'),
                rest('employee_tbl', { schoolid: `eq.${user.schoolid}`, branchid: `eq.${user.branchid}`, select: '*' }),
                rest('students_tbl', { select: '*' }),
                rest('students_sections_classes_tbl', { schoolid: `eq.${user.schoolid}`, branchid: `eq.${user.branchid}`, select: '*' }),
                rest('sections_subjects_classes_tbl', { schoolid: `eq.${user.schoolid}`, branchid: `eq.${user.branchid}`, select: '*' }),
                rest('employees_types_stages_tbl', { schoolid: `eq.${user.schoolid}`, branchid: `eq.${user.branchid}`, select: '*' }),
                rest('employees_sections_subjects_classes_semisters_curriculums_tbl', { select: '*' }),
                rest('employees_types_tbl', { select: '*' }),
                rest('curriculums_tbl', { schoolid: `eq.${user.schoolid}`, branchid: `eq.${user.branchid}`, select: '*' }).catch(() => []),
            ]);

            setStudents(stuRows);
            setClasses(clTbl);
            setSectionClasses(clRows);
            setSections(secRows);
            setStages([...new Map(stgRows.map(s => [s.stageid, s])).values()]);
            setCurriculums([...new Map((curRows || []).map(c => [c.curriculumid, c])).values()]);
            setSubjects(subRows);

            const teacherIds = new Set(empTypesRows.filter(t => t.typeid === 1).map(t => t.employeeid));
            const supervisorIds = new Set(empTypesRows.filter(t => t.typeid === 2).map(t => t.employeeid));
            setEmployees({ all: empRows, teachers: empRows.filter(e => teacherIds.has(e.employeeid)), supervisors: empRows.filter(e => supervisorIds.has(e.employeeid)) });

            const stuAssignments = stuScRows.map(sc => {
                const stu = stuRows.find(s => s.studentid === sc.studentid);
                const cl  = clTbl.find(c => c.classid === sc.classid);
                const sec = secRows.find(s => s.sectionid === sc.sectionid);
                const stg = stgRows.find(s => String(s.stageid) === String(sc.stageid));
                const cur = curRows.find(c => String(c.curriculumid) === String(sc.curriculumid));
                return { ...sc, studentname: _getStudentName(stu, lang), fullname: _getStudentName(stu, lang), classname: getField(cl, 'classname', 'classname_en', lang) || cl?.classname, sectionname: getField(sec, 'sectionname', 'sectionname_en', lang) || sec?.sectionname, stagename: getField(stg, 'stagename', 'stagename_en', lang), curriculumname: getField(cur, 'curriculumname', 'curriculumname_en', lang) || cur?.curriculumname };
            });

            const subAssignments = subClRows.map(sc => {
                const sub = subRows.find(s => s.subjectid === sc.subjectid);
                const cl = clTbl.find(c => c.classid === sc.classid);
                const sec = secRows.find(s => s.sectionid === sc.sectionid);
                const stg = stgRows.find(s => String(s.stageid) === String(sc.stageid));
                const cur = curRows.find(c => String(c.curriculumid) === String(sc.curriculumid));
                return { ...sc, subjectname: getField(sub, 'subjectname', 'Subjectname_en', lang), classname: getField(cl, 'classname', 'classname_en', lang) || cl?.classname, sectionname: getField(sec, 'sectionname', 'sectionname_en', lang) || sec?.sectionname, stagename: getField(stg, 'stagename', 'stagename_en', lang), curriculumname: getField(cur, 'curriculumname', 'curriculumname_en', lang) || cur?.curriculumname };
            });

            const supAssignments = empStgRows.map(row => {
                const emp = empRows.find(e => e.employeeid === row.employeeid);
                const stg = stgRows.find(s => String(s.stageid) === String(row.stageid));
                const cur = curRows.find(c => String(c.curriculumid) === String(row.curriculumid));
                return { ...row, supervisorname: getField(emp, 'employeename', 'employeename_en', lang) || emp?.employeename, stagename: getField(stg, 'stagename', 'stagename_en', lang), curriculumname: getField(cur, 'curriculumname', 'curriculumname_en', lang) || cur?.curriculumname };
            });

            const tchAssignments = empTchRows.map(row => {
                const emp = empRows.find(e => e.employeeid === row.employeeid);
                const sub = subRows.find(s => s.subjectid === row.subjectid);
                const cl = clTbl.find(c => c.classid === row.classid);
                const sec = secRows.find(s => s.sectionid === row.sectionid);
                const stg = stgRows.find(s => String(s.stageid) === String(row.stageid));
                const cur = curRows.find(c => String(c.curriculumid) === String(row.curriculumid));
                return { ...row, teachername: getField(emp, 'employeename', 'employeename_en', lang) || emp?.employeename, subjectname: getField(sub, 'subjectname', 'Subjectname_en', lang), classname: getField(cl, 'classname', 'classname_en', lang) || cl?.classname, sectionname: getField(sec, 'sectionname', 'sectionname_en', lang) || sec?.sectionname, stagename: getField(stg, 'stagename', 'stagename_en', lang), curriculumname: getField(cur, 'curriculumname', 'curriculumname_en', lang) || cur?.curriculumname };
            });

            setAssignments({ students: stuAssignments, subjects: subAssignments, supervisors: supAssignments, teachers: tchAssignments });
        } catch (e) { addToast(e.message, 'error'); }
        finally { setLoading(false); }
    }, [user, lang]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const tabs = [
        { id: 'supervisors', label: t('supervisorsToStages', lang), icon: Shield },
        { id: 'teachers', label: t('teachersToClasses', lang), icon: Layers },
        { id: 'subjects', label: t('subjectsToClasses', lang), icon: BookOpen },
        { id: 'students', label: t('studentsToClasses', lang), icon: User },
    ];

    // Subject → class assignment: must insert into 3 tables in order.
    // Returns { resolvedStageid, alreadyExisted } — alreadyExisted=true if subject was already fully assigned.
    const assignSubjectToClass = async (subjectid, classid, sectionid, stageid) => {
        const div = user.divisionid || 1, cur = user.curriculumid || 1;

        // Look up the correct stageid from classes_stages_tbl to satisfy FK fk_subjectclass_classstage.
        const classStageRows = await rest('classes_stages_tbl', {
            classid: `eq.${classid}`,
            schoolid: `eq.${user.schoolid}`,
            branchid: `eq.${user.branchid}`,
            select: 'stageid,curriculumid,divisionid',
        });
        if (!classStageRows.length) throw new Error('This class has no stage configured. Please set up the class first.');
        const classStage = classStageRows.find(r => r.stageid === stageid) || classStageRows[0];
        const resolvedStageid = classStage.stageid;
        const resolvedCur = classStage.curriculumid || cur;
        const resolvedDiv = classStage.divisionid || div;

        const sc = { subjectid, classid, stageid: resolvedStageid, curriculumid: resolvedCur, divisionid: resolvedDiv, branchid: user.branchid, schoolid: user.schoolid };

        // 1. subjects_classes_tbl
        const existsSC = await rest('subjects_classes_tbl', { subjectid: `eq.${subjectid}`, classid: `eq.${classid}`, schoolid: `eq.${user.schoolid}`, select: 'subjectid' });
        if (!existsSC.length) await insert('subjects_classes_tbl', sc);
        // 2. subjects_classes_semisters_curriculums_tbl
        const existsSCS = await rest('subjects_classes_semisters_curriculums_tbl', { subjectid: `eq.${subjectid}`, classid: `eq.${classid}`, schoolid: `eq.${user.schoolid}`, select: 'subjectid' });
        if (!existsSCS.length) await insert('subjects_classes_semisters_curriculums_tbl', { ...sc, semisterid: 1, yearid: 2026 });
        // 3. sections_subjects_classes_tbl
        const existsSSC = await rest('sections_subjects_classes_tbl', { subjectid: `eq.${subjectid}`, classid: `eq.${classid}`, sectionid: `eq.${sectionid}`, schoolid: `eq.${user.schoolid}`, select: 'subjectid' });
        const alreadyExisted = existsSSC.length > 0;
        if (!alreadyExisted) await insert('sections_subjects_classes_tbl', { subjectid, classid, sectionid, stageid: resolvedStageid, curriculumid: resolvedCur, divisionid: resolvedDiv, branchid: user.branchid, schoolid: user.schoolid });

        return { resolvedStageid, alreadyExisted };
    };

    // Teacher → class assignment: subjects must already be linked, then insert emp_sec_sub
    const assignTeacherToClass = async (employeeid, subjectid, classid, sectionid, stageid) => {
        const div = user.divisionid || 1, cur = user.curriculumid || 1;
        // Ensure subject is linked to class first (all 3 tables); get back the resolved stageid
        const { resolvedStageid } = await assignSubjectToClass(parseInt(subjectid), parseInt(classid), parseInt(sectionid), parseInt(stageid));
        // Check for duplicate: prevent any teacher being assigned the same subject+class+section
        const existsSubjectSection = await rest('employees_sections_subjects_classes_semisters_curriculums_tbl', { subjectid: `eq.${subjectid}`, classid: `eq.${classid}`, sectionid: `eq.${sectionid}`, select: 'employeeid' });
        if (existsSubjectSection.length) throw new Error('A teacher is already assigned to teach this subject in this class section. Only one teacher can teach a subject per class section.');
        // Insert teacher assignment
        await insert('employees_sections_subjects_classes_semisters_curriculums_tbl', {
            employeeid, subjectid, classid, sectionid, stageid: resolvedStageid, semisterid: 1, yearid: 2026,
            divisionid: div, curriculumid: cur, branchid: user.branchid, schoolid: user.schoolid
        });
    };

    const handleConfirmAdd = async () => {
        // Validate required fields per tab
        if (activeTab === 'subjects') {
            if (!newRow.subjectid || !newRow.classid || !newRow.sectionid || !newRow.stageid) {
                addToast('All fields are required: Subject, Class, Section, and Stage.', 'warning');
                return;
            }
        } else if (activeTab === 'supervisors') {
            if (!newRow.employeeid || !newRow.stageid) {
                addToast('All fields are required: Supervisor and Stage.', 'warning');
                return;
            }
        } else if (activeTab === 'teachers') {
            if (!newRow.employeeid || !newRow.subjectid || !newRow.classid || !newRow.sectionid || !newRow.stageid) {
                addToast('All fields are required: Teacher, Subject, Class, Section, and Stage.', 'warning');
                return;
            }
        }

        setIsLoading(true);
        try {
            if (activeTab === 'subjects') {
                const { alreadyExisted } = await assignSubjectToClass(
                    parseInt(newRow.subjectid), parseInt(newRow.classid),
                    parseInt(newRow.sectionid), parseInt(newRow.stageid)
                );
                if (alreadyExisted) {
                    addToast('This subject is already assigned to this class section.', 'warning');
                    setAddingNew(false);
                    setNewRow({});
                    return;
                }
            } else if (activeTab === 'supervisors') {
                await insert('employees_types_stages_tbl', { employeeid: parseInt(newRow.employeeid), typeid: 2, stageid: parseInt(newRow.stageid), schoolid: user.schoolid, branchid: user.branchid, divisionid: user.divisionid || 1, curriculumid: parseInt(newRow.curriculumid) || user.curriculumid || 1 });
            } else if (activeTab === 'teachers') {
                await assignTeacherToClass(
                    parseInt(newRow.employeeid), parseInt(newRow.subjectid),
                    parseInt(newRow.classid), parseInt(newRow.sectionid), parseInt(newRow.stageid)
                );
            }
            addToast(t('assignmentAdded', lang), 'success');
            setAddingNew(false);
            setNewRow({});
            fetchData();
        } catch (err) {
            const msg = err.message || '';
            if (msg.includes('duplicate') || msg.includes('unique') || msg.includes('already')) {
                addToast(msg.includes('teacher') ? 'This teacher is already assigned to this subject and class section.' : 'This assignment already exists.', 'error');
            } else if (msg.includes('foreign') || msg.includes('violates') || msg.includes('fk_')) {
                addToast('This assignment could not be saved. Please ensure the class is fully configured.', 'error');
            } else {
                addToast(msg || 'Failed to save assignment. Please try again.', 'error');
            }
        }
        finally { setIsLoading(false); }
    };

    const sanitizeAssignmentError = (err) => {
        const msg = err?.message || '';
        if (msg.includes('foreign') || msg.includes('violates') || msg.includes('fk_') || msg.includes('constraint')) {
            return 'This action could not be completed because a related record is missing. Please ensure the class is fully set up.';
        }
        if (msg.includes('duplicate') || msg.includes('unique') || msg.includes('already')) {
            return 'This record already exists.';
        }
        if (msg.includes('_tbl') || msg.includes('_semisters_') || msg.includes('pgsql') || msg.includes('ERROR:')) {
            return 'An error occurred. Please try again or contact support.';
        }
        return msg || 'An error occurred. Please try again.';
    };

    // Student: add new assignment
    const handleConfirmStudentAdd = async () => {
        if (!newRow.studentid || !newRow.classid || !newRow.sectionid || !newRow.stageid) {
            addToast('All fields are required: Student, Stage, Class, and Section.', 'warning'); return;
        }
        setIsLoading(true);
        try {
            const sc = assignments.students.find(a => String(a.studentid) === String(newRow.studentid));
            // INSERT first, then DELETE old row — prevents orphan if insert fails
            await insert('students_sections_classes_tbl', { studentid: parseInt(newRow.studentid), classid: parseInt(newRow.classid), sectionid: parseInt(newRow.sectionid), stageid: parseInt(newRow.stageid), schoolid: user.schoolid, branchid: user.branchid, divisionid: user.divisionid || 1, curriculumid: parseInt(newRow.curriculumid) || user.curriculumid || 1 });
            if (sc) {
                await dbQuery(`students_sections_classes_tbl?studentid=eq.${newRow.studentid}&classid=eq.${sc.classid}&sectionid=eq.${sc.sectionid}`, 'DELETE');
            }
            addToast(t('studentAssigned', lang), 'success');
            setAddingNew(false); setNewRow({});
            fetchData();
        } catch (err) { addToast(sanitizeAssignmentError(err), 'error'); }
        finally { setIsLoading(false); }
    };

    // Student: edit class/section
    const handleSaveEdit = async () => {
        if (editingRow === null || editingRow === undefined) return;
        const row = currentData[editingRow];
        setIsLoading(true);
        try {
            if (activeTab === 'students') {
                // INSERT first, then DELETE old row — prevents data loss if insert fails
                await insert('students_sections_classes_tbl', { studentid: row.studentid, classid: parseInt(editForm.classid), sectionid: parseInt(editForm.sectionid), stageid: parseInt(editForm.stageid), schoolid: user.schoolid, branchid: user.branchid, divisionid: user.divisionid || 1, curriculumid: parseInt(editForm.curriculumid) || row.curriculumid || 1 });
                await dbQuery(`students_sections_classes_tbl?studentid=eq.${row.studentid}&classid=eq.${row.classid}&sectionid=eq.${row.sectionid}`, 'DELETE');
            } else if (activeTab === 'subjects') {
                await dbQuery(`sections_subjects_classes_tbl?subjectid=eq.${row.subjectid}&classid=eq.${row.classid}&sectionid=eq.${row.sectionid}&schoolid=eq.${user.schoolid}`, 'DELETE');
                await insert('sections_subjects_classes_tbl', { subjectid: row.subjectid, classid: parseInt(editForm.classid), sectionid: parseInt(editForm.sectionid), schoolid: user.schoolid, branchid: user.branchid, stageid: parseInt(editForm.stageid) || row.stageid || 1, curriculumid: parseInt(editForm.curriculumid) || row.curriculumid || 1, divisionid: row.divisionid || 1 });
            } else if (activeTab === 'supervisors') {
                await dbQuery(`employees_types_stages_tbl?employeeid=eq.${row.employeeid}&stageid=eq.${row.stageid}`, 'DELETE');
                await insert('employees_types_stages_tbl', { employeeid: row.employeeid, typeid: 2, stageid: parseInt(editForm.stageid), schoolid: user.schoolid, branchid: user.branchid, divisionid: user.divisionid || 1, curriculumid: parseInt(editForm.curriculumid) || row.curriculumid || 1 });
            } else if (activeTab === 'teachers') {
                const newClassid = parseInt(editForm.classid);
                const newSectionid = parseInt(editForm.sectionid);
                // Check duplicate: if class or section changed, ensure no other teacher already has this subject+class+section
                if (newClassid !== row.classid || newSectionid !== row.sectionid) {
                    const existsCheck = await rest('employees_sections_subjects_classes_semisters_curriculums_tbl', { subjectid: `eq.${row.subjectid}`, classid: `eq.${newClassid}`, sectionid: `eq.${newSectionid}`, select: 'employeeid' });
                    if (existsCheck.length) throw new Error('A teacher is already assigned to teach this subject in this class section. Only one teacher can teach a subject per class section.');
                }
                await dbQuery(`employees_sections_subjects_classes_semisters_curriculums_tbl?employeeid=eq.${row.employeeid}&subjectid=eq.${row.subjectid}&classid=eq.${row.classid}&sectionid=eq.${row.sectionid}`, 'DELETE');
                await insert('employees_sections_subjects_classes_semisters_curriculums_tbl', { employeeid: row.employeeid, subjectid: row.subjectid, classid: newClassid, sectionid: newSectionid, stageid: parseInt(editForm.stageid) || row.stageid, semisterid: row.semisterid || 1, yearid: row.yearid || 2026, curriculumid: parseInt(editForm.curriculumid) || row.curriculumid || 1, divisionid: row.divisionid || 1, branchid: user.branchid, schoolid: user.schoolid });
            }
            addToast(t('assignmentUpdated', lang), 'success');
            setEditingRow(null);
            fetchData();
        } catch (err) { addToast(sanitizeAssignmentError(err), 'error'); }
        finally { setIsLoading(false); }
    };

    const handleDelete = (row) => {
        setDeleteModal({ show: true, row });
    };

    const confirmDelete = async () => {
        const row = deleteModal.row;
        setDeleteModal({ show: false, row: null });
        try {
            if (activeTab === 'students') {
                await dbQuery(`students_sections_classes_tbl?studentid=eq.${row.studentid}&classid=eq.${row.classid}&sectionid=eq.${row.sectionid}`, 'DELETE');
            } else if (activeTab === 'subjects') {
                await dbQuery(`sections_subjects_classes_tbl?subjectid=eq.${row.subjectid}&classid=eq.${row.classid}&sectionid=eq.${row.sectionid}&schoolid=eq.${user.schoolid}`, 'DELETE');
            } else if (activeTab === 'supervisors') {
                await dbQuery(`employees_types_stages_tbl?employeeid=eq.${row.employeeid}&stageid=eq.${row.stageid}`, 'DELETE');
            } else if (activeTab === 'teachers') {
                await dbQuery(`employees_sections_subjects_classes_semisters_curriculums_tbl?employeeid=eq.${row.employeeid}&subjectid=eq.${row.subjectid}&classid=eq.${row.classid}&sectionid=eq.${row.sectionid}`, 'DELETE');
            }
            addToast(t('removed', lang), 'success');
            fetchData();
        } catch (err) {
            const msg = err.message || '';
            if (msg.includes('foreign') || msg.includes('violates') || msg.includes('fk_')) {
                addToast('This assignment cannot be deleted because it has dependent records.', 'error');
            } else {
                addToast('Failed to delete assignment. Please try again.', 'error');
            }
        }
    };

        const { sorted: sortedAssignments, sortCol, sortDir, handleSort } = useSortable(assignments[activeTab] || [], 'studentname');
    const { columnSearch, activeSearch, setActiveSearch, setColumnSearch, applyColumnSearch } = useColumnSearch();
    const currentData = applyColumnSearch(sortedAssignments);
    const sel = "input-field h-9 text-xs px-2";

    // Only show classes that have been created in sections_classes_tbl
    const createdClasses = useMemo(() => {
        const ids = new Set(sectionClasses.map(r => r.classid));
        return classes.filter(c => ids.has(c.classid));
    }, [sectionClasses, classes]);

    // Return only sections valid for a given class + stage combination
    const filteredSectionsFor = (classid, stageid) => {
        if (!classid || !stageid) return sections;
        const validIds = new Set(
            sectionClasses
                .filter(sc => String(sc.classid) === String(classid) && String(sc.stageid) === String(stageid))
                .map(sc => sc.sectionid)
        );
        return validIds.size ? sections.filter(s => validIds.has(s.sectionid)) : sections;
    };


    // Re-fetch when language changes so all labels/names update without page refresh
    useEffect(() => {
        const handler = () => { fetchData(); };
        window.addEventListener('langChanged', handler);
        return () => window.removeEventListener('langChanged', handler);
    }, [fetchData]);

    return (
        <div className="space-y-6 animate-fade-in pb-12">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-[#0f172a]">{t('assignments', lang)}</h1>
                    <p className="text-[#64748b] text-sm">{t('manageSchoolAssignments', lang)}</p>
                    <Breadcrumb />
                </div>
                    <button onClick={() => { setAddingNew(true); setNewRow({}); }}
                        className="flex items-center gap-2 bg-[#1d4ed8] hover:bg-[#1e40af] text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-100">
                        <Plus className="h-4 w-4" /> {t('addAssignment', lang)}
                    </button>
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-1 p-1 bg-slate-50 rounded-xl border border-slate-100">
                {tabs.map((tab, index) => (
                    <button key={tab.id} onClick={() => { setActiveTab(tab.id); setAddingNew(false); setEditingRow(null); }}
                        className={`flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-lg transition-all ${activeTab === tab.id ? 'bg-white text-[#1d4ed8] shadow-md border border-blue-50' : 'text-[#64748b] hover:bg-white/50'}`}>
                        <div className="flex items-center justify-center h-5 w-5 rounded-full bg-slate-300 text-white text-[10px] font-bold">{index + 1}</div>
                        <tab.icon className={`h-4 w-4 ${activeTab === tab.id ? 'text-[#1d4ed8]' : 'text-slate-400'}`} />
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="card bg-white rounded-2xl border border-[#e2e8f0] overflow-hidden shadow-sm">
                <div className="overflow-x-auto" dir={isAr ? 'rtl' : 'ltr'}>
                    <table className={`w-full ${isAr ? 'text-right' : 'text-left'} border-collapse`}>
                        <thead className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                            <tr>
                                {activeTab === 'students' && <><SortableTh col="studentname" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} searchValue={columnSearch['studentname']} isSearchOpen={activeSearch==='studentname'} onSearchOpen={()=>setActiveSearch('studentname')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('studentname','');}} onSearchChange={v=>setColumnSearch('studentname',v)}>{t('student', lang)}{addingNew && <span className="text-red-500"> *</span>}</SortableTh><SortableTh col="stagename" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} searchValue={columnSearch['stagename']} isSearchOpen={activeSearch==='stagename'} onSearchOpen={()=>setActiveSearch('stagename')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('stagename','');}} onSearchChange={v=>setColumnSearch('stagename',v)}>{t('stage', lang)}{addingNew && <span className="text-red-500"> *</span>}</SortableTh><SortableTh col="classname" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} searchValue={columnSearch['classname']} isSearchOpen={activeSearch==='classname'} onSearchOpen={()=>setActiveSearch('classname')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('classname','');}} onSearchChange={v=>setColumnSearch('classname',v)}>{t('class', lang)}{addingNew && <span className="text-red-500"> *</span>}</SortableTh><SortableTh col="sectionname" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} searchValue={columnSearch['sectionname']} isSearchOpen={activeSearch==='sectionname'} onSearchOpen={()=>setActiveSearch('sectionname')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('sectionname','');}} onSearchChange={v=>setColumnSearch('sectionname',v)}>{t('section', lang)}{addingNew && <span className="text-red-500"> *</span>}</SortableTh><SortableTh col="curriculumname" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} searchValue={columnSearch['curriculumname']} isSearchOpen={activeSearch==='curriculumname'} onSearchOpen={()=>setActiveSearch('curriculumname')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('curriculumname','');}} onSearchChange={v=>setColumnSearch('curriculumname',v)}>{t('curriculum', lang)}</SortableTh><th className="px-6 py-4 text-[11px] font-black text-[#64748b] uppercase">{t('actions', lang)}</th></>}
                                {activeTab === 'subjects' && <><SortableTh col="subjectname" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} searchValue={columnSearch['subjectname']} isSearchOpen={activeSearch==='subjectname'} onSearchOpen={()=>setActiveSearch('subjectname')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('subjectname','');}} onSearchChange={v=>setColumnSearch('subjectname',v)}>{t('subject', lang)}{addingNew && <span className="text-red-500"> *</span>}</SortableTh><SortableTh col="stagename" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} searchValue={columnSearch['stagename']} isSearchOpen={activeSearch==='stagename'} onSearchOpen={()=>setActiveSearch('stagename')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('stagename','');}} onSearchChange={v=>setColumnSearch('stagename',v)}>{t('stage', lang)}{addingNew && <span className="text-red-500"> *</span>}</SortableTh><SortableTh col="classname" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} searchValue={columnSearch['classname']} isSearchOpen={activeSearch==='classname'} onSearchOpen={()=>setActiveSearch('classname')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('classname','');}} onSearchChange={v=>setColumnSearch('classname',v)}>{t('class', lang)}{addingNew && <span className="text-red-500"> *</span>}</SortableTh><SortableTh col="sectionname" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} searchValue={columnSearch['sectionname']} isSearchOpen={activeSearch==='sectionname'} onSearchOpen={()=>setActiveSearch('sectionname')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('sectionname','');}} onSearchChange={v=>setColumnSearch('sectionname',v)}>{t('section', lang)}{addingNew && <span className="text-red-500"> *</span>}</SortableTh><SortableTh col="curriculumname" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} searchValue={columnSearch['curriculumname']} isSearchOpen={activeSearch==='curriculumname'} onSearchOpen={()=>setActiveSearch('curriculumname')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('curriculumname','');}} onSearchChange={v=>setColumnSearch('curriculumname',v)}>{t('curriculum', lang)}</SortableTh><th className="px-6 py-4 text-[11px] font-black text-[#64748b] uppercase">{t('actions', lang)}</th></>}
                                {activeTab === 'supervisors' && <><SortableTh col="supervisorname" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} searchValue={columnSearch['supervisorname']} isSearchOpen={activeSearch==='supervisorname'} onSearchOpen={()=>setActiveSearch('supervisorname')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('supervisorname','');}} onSearchChange={v=>setColumnSearch('supervisorname',v)}>{t('supervisor', lang)}{addingNew && <span className="text-red-500"> *</span>}</SortableTh><SortableTh col="stagename" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} searchValue={columnSearch['stagename']} isSearchOpen={activeSearch==='stagename'} onSearchOpen={()=>setActiveSearch('stagename')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('stagename','');}} onSearchChange={v=>setColumnSearch('stagename',v)}>{t('stage', lang)}{addingNew && <span className="text-red-500"> *</span>}</SortableTh><SortableTh col="curriculumname" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} searchValue={columnSearch['curriculumname']} isSearchOpen={activeSearch==='curriculumname'} onSearchOpen={()=>setActiveSearch('curriculumname')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('curriculumname','');}} onSearchChange={v=>setColumnSearch('curriculumname',v)}>{t('curriculum', lang)}</SortableTh><th className="px-6 py-4 text-[11px] font-black text-[#64748b] uppercase">{t('actions', lang)}</th></>}
                                {activeTab === 'teachers' && <><SortableTh col="teachername" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} searchValue={columnSearch['teachername']} isSearchOpen={activeSearch==='teachername'} onSearchOpen={()=>setActiveSearch('teachername')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('teachername','');}} onSearchChange={v=>setColumnSearch('teachername',v)}>{t('teacher', lang)}{addingNew && <span className="text-red-500"> *</span>}</SortableTh><SortableTh col="subjectname" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} searchValue={columnSearch['subjectname']} isSearchOpen={activeSearch==='subjectname'} onSearchOpen={()=>setActiveSearch('subjectname')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('subjectname','');}} onSearchChange={v=>setColumnSearch('subjectname',v)}>{t('subject', lang)}{addingNew && <span className="text-red-500"> *</span>}</SortableTh><SortableTh col="stagename" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} searchValue={columnSearch['stagename']} isSearchOpen={activeSearch==='stagename'} onSearchOpen={()=>setActiveSearch('stagename')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('stagename','');}} onSearchChange={v=>setColumnSearch('stagename',v)}>{t('stage', lang)}{addingNew && <span className="text-red-500"> *</span>}</SortableTh><SortableTh col="classname" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} searchValue={columnSearch['classname']} isSearchOpen={activeSearch==='classname'} onSearchOpen={()=>setActiveSearch('classname')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('classname','');}} onSearchChange={v=>setColumnSearch('classname',v)}>{t('class', lang)}{addingNew && <span className="text-red-500"> *</span>}</SortableTh><SortableTh col="sectionname" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} searchValue={columnSearch['sectionname']} isSearchOpen={activeSearch==='sectionname'} onSearchOpen={()=>setActiveSearch('sectionname')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('sectionname','');}} onSearchChange={v=>setColumnSearch('sectionname',v)}>{t('section', lang)}{addingNew && <span className="text-red-500"> *</span>}</SortableTh><SortableTh col="curriculumname" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} searchValue={columnSearch['curriculumname']} isSearchOpen={activeSearch==='curriculumname'} onSearchOpen={()=>setActiveSearch('curriculumname')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('curriculumname','');}} onSearchChange={v=>setColumnSearch('curriculumname',v)}>{t('curriculum', lang)}</SortableTh><th className="px-6 py-4 text-[11px] font-black text-[#64748b] uppercase">{t('actions', lang)}</th></>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#f1f5f9]">
                            <AnimatePresence>
                                {addingNew && (
                                    <motion.tr initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="bg-blue-50/50 border-b-2 border-blue-200">
                                        {activeTab === 'students' && <>
                                            <td className="px-4 py-3 text-center">
                                                <select className={sel} value={newRow.studentid || ''} onChange={e => setNewRow({ ...newRow, studentid: e.target.value })}>
                                                    <option value="">{t('selectStudent', lang)}</option>
                                                    {students.filter(s => !assignments.students.some(a => String(a.studentid) === String(s.studentid))).map(s => <option key={s.studentid} value={s.studentid}>{_getStudentName(s, lang)}</option>)}
                                                </select>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <select className={sel} value={newRow.stageid || ''} onChange={e => setNewRow({ ...newRow, stageid: e.target.value, sectionid: '' })}>
                                                    <option value="">{t('selectStage', lang)}</option>
                                                    {stages.map(s => <option key={s.stageid} value={s.stageid}>{getField(s, 'stagename', 'stagename_en', lang)}</option>)}
                                                </select>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <select className={sel} value={newRow.classid || ''} onChange={e => setNewRow({ ...newRow, classid: e.target.value, sectionid: '' })}>
                                                    <option value="">{t('selectClass', lang)}</option>
                                                    {createdClasses.map(c => <option key={c.classid} value={c.classid}>{t('class', lang)} {getField(c, 'classname', 'classname_en', lang) || c.classname}</option>)}
                                                </select>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <select className={sel} value={newRow.sectionid || ''} onChange={e => setNewRow({ ...newRow, sectionid: e.target.value })}>
                                                    <option value="">{t('selectSection', lang)}</option>
                                                    {filteredSectionsFor(newRow.classid, newRow.stageid).map(s => <option key={s.sectionid} value={s.sectionid}>{getField(s, 'sectionname', 'sectionname_en', lang) || s.sectionname}</option>)}
                                                </select>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <select className={sel} value={newRow.curriculumid || ''} onChange={e => setNewRow({ ...newRow, curriculumid: e.target.value })}>
                                                    <option value="">{t('curriculum', lang)}</option>
                                                    {curriculums.map(c => <option key={c.curriculumid} value={c.curriculumid}>{getField(c, 'curriculumname', 'curriculumname_en', lang) || c.curriculumname}</option>)}
                                                </select>
                                            </td>
                                        </>}
                                        {activeTab === 'subjects' && <>
                                            <td className="px-4 py-3 text-center">
                                                <select className={sel} value={newRow.subjectid || ''} onChange={e => setNewRow({ ...newRow, subjectid: e.target.value })}>
                                                    <option value="">{t('subject', lang)}</option>
                                                    {subjects.map(s => <option key={s.subjectid} value={s.subjectid}>{getField(s, 'subjectname', 'Subjectname_en', lang)}</option>)}
                                                </select>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <select className={sel} value={newRow.stageid || ''} onChange={e => setNewRow({ ...newRow, stageid: e.target.value, sectionid: '' })}>
                                                    <option value="">{t('stage', lang)}</option>
                                                    {stages.map(s => <option key={s.stageid} value={s.stageid}>{getField(s, 'stagename', 'stagename_en', lang)}</option>)}
                                                </select>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <select className={sel} value={newRow.classid || ''} onChange={e => setNewRow({ ...newRow, classid: e.target.value, sectionid: '' })}>
                                                    <option value="">{t('class', lang)}</option>
                                                    {createdClasses.map(c => <option key={c.classid} value={c.classid}>{t('class', lang)} {getField(c, 'classname', 'classname_en', lang) || c.classname || ''}</option>)}
                                                </select>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <select className={sel} value={newRow.sectionid || ''} onChange={e => setNewRow({ ...newRow, sectionid: e.target.value })}>
                                                    <option value="">{t('section', lang)}</option>
                                                    {filteredSectionsFor(newRow.classid, newRow.stageid).map(s => <option key={s.sectionid} value={s.sectionid}>{getField(s, 'sectionname', 'sectionname_en', lang) || s.sectionname}</option>)}
                                                </select>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <select className={sel} value={newRow.curriculumid || ''} onChange={e => setNewRow({ ...newRow, curriculumid: e.target.value })}>
                                                    <option value="">{t('curriculum', lang)}</option>
                                                    {curriculums.map(c => <option key={c.curriculumid} value={c.curriculumid}>{getField(c, 'curriculumname', 'curriculumname_en', lang) || c.curriculumname}</option>)}
                                                </select>
                                            </td>
                                        </>}
                                        {activeTab === 'supervisors' && <>
                                            <td className="px-4 py-3 text-center">
                                                <select className={sel} value={newRow.employeeid || ''} onChange={e => setNewRow({ ...newRow, employeeid: e.target.value })}>
                                                    <option value="">{t('supervisor', lang)}</option>
                                                    {employees.supervisors.map(e => <option key={e.employeeid} value={e.employeeid}>{getField(e, 'employeename', 'employeename_en', lang) || e.employeename}</option>)}
                                                </select>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <select className={sel} value={newRow.stageid || ''} onChange={e => setNewRow({ ...newRow, stageid: e.target.value })}>
                                                    <option value="">{t('stage', lang)}</option>
                                                    {stages.map(s => <option key={s.stageid} value={s.stageid}>{getField(s, 'stagename', 'stagename_en', lang)}</option>)}
                                                </select>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <select className={sel} value={newRow.curriculumid || ''} onChange={e => setNewRow({ ...newRow, curriculumid: e.target.value })}>
                                                    <option value="">{t('curriculum', lang)}</option>
                                                    {curriculums.map(c => <option key={c.curriculumid} value={c.curriculumid}>{getField(c, 'curriculumname', 'curriculumname_en', lang) || c.curriculumname}</option>)}
                                                </select>
                                            </td>
                                        </>}
                                        {activeTab === 'teachers' && <>
                                            <td className="px-4 py-3 text-center">
                                                <select className={sel} value={newRow.employeeid || ''} onChange={e => setNewRow({ ...newRow, employeeid: e.target.value })}>
                                                    <option value="">{t('teacher', lang)}</option>
                                                    {employees.teachers.map(e => <option key={e.employeeid} value={e.employeeid}>{getField(e, 'employeename', 'employeename_en', lang) || e.employeename}</option>)}
                                                </select>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <select className={sel} value={newRow.subjectid || ''} onChange={e => setNewRow({ ...newRow, subjectid: e.target.value })}>
                                                    <option value="">{t('subject', lang)}</option>
                                                    {subjects.map(s => <option key={s.subjectid} value={s.subjectid}>{getField(s, 'subjectname', 'Subjectname_en', lang)}</option>)}
                                                </select>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <select className={sel} value={newRow.stageid || ''} onChange={e => setNewRow({ ...newRow, stageid: e.target.value, sectionid: '' })}>
                                                    <option value="">{t('stage', lang)}</option>
                                                    {stages.map(s => <option key={s.stageid} value={s.stageid}>{getField(s, 'stagename', 'stagename_en', lang)}</option>)}
                                                </select>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <select className={sel} value={newRow.classid || ''} onChange={e => setNewRow({ ...newRow, classid: e.target.value, sectionid: '' })}>
                                                    <option value="">{t('class', lang)}</option>
                                                    {createdClasses.map(c => <option key={c.classid} value={c.classid}>{t('class', lang)} {getField(c, 'classname', 'classname_en', lang) || c.classname || ''}</option>)}
                                                </select>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <select className={sel} value={newRow.sectionid || ''} onChange={e => setNewRow({ ...newRow, sectionid: e.target.value })}>
                                                    <option value="">{t('section', lang)}</option>
                                                    {filteredSectionsFor(newRow.classid, newRow.stageid).map(s => <option key={s.sectionid} value={s.sectionid}>{getField(s, 'sectionname', 'sectionname_en', lang) || s.sectionname}</option>)}
                                                </select>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <select className={sel} value={newRow.curriculumid || ''} onChange={e => setNewRow({ ...newRow, curriculumid: e.target.value })}>
                                                    <option value="">{t('curriculum', lang)}</option>
                                                    {curriculums.map(c => <option key={c.curriculumid} value={c.curriculumid}>{getField(c, 'curriculumname', 'curriculumname_en', lang) || c.curriculumname}</option>)}
                                                </select>
                                            </td>
                                        </>}
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex gap-2">
                                                <button onClick={activeTab === 'students' ? handleConfirmStudentAdd : handleConfirmAdd} disabled={isLoading} className="btn-primary h-9 px-4 text-sm font-bold flex items-center gap-1 disabled:opacity-60">
                                                    {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                                                    {t('save', lang)}
                                                </button>
                                                <button onClick={() => setAddingNew(false)} className="h-9 px-4 text-sm font-bold border border-[#e2e8f0] rounded-lg text-[#64748b] hover:bg-[#f8fafc]">
                                                    {t('cancel', lang)}
                                                </button>
                                            </div>
                                        </td>
                                    </motion.tr>
                                )}
                            </AnimatePresence>
                            {loading ? (
                                <tr><td colSpan={6} className="px-6 py-12 text-center text-[#94a3b8]">{t('loading', lang)}...</td></tr>
                            ) : currentData.length === 0 ? (
                                <tr><td colSpan={6} className="px-6 py-12 text-center text-[#94a3b8]">{t('noAssignments', lang)}</td></tr>
                            ) : currentData.map((row, i) => (
                                <tr key={i} className="hover:bg-blue-50/20 transition-all">
                                    {activeTab === 'students' && <>
                                        <td className="px-4 py-3 text-center text-sm font-bold text-[#0f172a]">{row.studentname}</td>
                                        {editingRow === i ? <>
                                            <td className="px-4 py-3 text-center">
                                                <select className={sel} value={editForm.stageid || ''} onChange={e => setEditForm({...editForm, stageid: e.target.value, sectionid: ''})}>
                                                    {stages.map(s => <option key={s.stageid} value={s.stageid}>{getField(s, 'stagename', 'stagename_en', lang)}</option>)}
                                                </select>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <select className={sel} value={editForm.classid || ''} onChange={e => setEditForm({...editForm, classid: e.target.value, sectionid: ''})}>
                                                    {createdClasses.map(c => <option key={c.classid} value={c.classid}>{t('class', lang)} {getField(c, 'classname', 'classname_en', lang) || c.classname || ''}</option>)}
                                                </select>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <select className={sel} value={editForm.sectionid || ''} onChange={e => setEditForm({...editForm, sectionid: e.target.value})}>
                                                    {filteredSectionsFor(editForm.classid, editForm.stageid).map(s => <option key={s.sectionid} value={s.sectionid}>{getField(s, 'sectionname', 'sectionname_en', lang) || s.sectionname}</option>)}
                                                </select>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <select className={sel} value={editForm.curriculumid || ''} onChange={e => setEditForm({...editForm, curriculumid: e.target.value})}>
                                                    <option value="">{t('curriculum', lang)}</option>
                                                    {curriculums.map(c => <option key={c.curriculumid} value={c.curriculumid}>{getField(c, 'curriculumname', 'curriculumname_en', lang) || c.curriculumname}</option>)}
                                                </select>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex gap-2">
                                                    <button onClick={() => setSaveConfirm({ open: true })} disabled={isLoading} className="btn-primary h-9 px-4 text-sm font-bold flex items-center gap-1 disabled:opacity-60">{isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}{t('save', lang)}</button><button onClick={() => setEditingRow(null)} className="h-9 px-4 text-sm font-bold border border-[#e2e8f0] rounded-lg text-[#64748b] hover:bg-[#f8fafc]">{t('cancel', lang)}</button>
                                                </div>
                                            </td>
                                        </> : <>
                                            <td className="px-4 py-3 text-center text-xs text-[#64748b]">{row.stagename || '—'}</td>
                                            <td className="px-4 py-3 text-center text-sm text-[#475569]">{t('class', lang)} {row.classname}</td>
                                            <td className="px-4 py-3 text-center"><span className="inline-flex items-center justify-center px-2 py-0.5 rounded bg-[#eff6ff] text-[#1d4ed8] text-xs font-bold border border-blue-100">{row.sectionname}</span></td>
                                            <td className="px-4 py-3 text-center text-xs text-[#64748b]">{row.curriculumname || '—'}</td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex gap-2">
                                                    <button title="Edit" onClick={() => { setEditingRow(i); setEditForm({ classid: String(row.classid), sectionid: String(row.sectionid), stageid: String(row.stageid), curriculumid: String(row.curriculumid || '') }); }} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg border border-blue-100"><Edit2 className="h-4 w-4" /></button>
                                                    <button title="Delete" onClick={() => handleDelete(row)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg border border-red-100"><Trash2 className="h-4 w-4" /></button>
                                                </div>
                                            </td>
                                        </>}
                                    </>}
                                    {activeTab === 'subjects' && <>
                                        <td className="px-4 py-3 text-center text-sm font-bold text-[#0f172a]">{row.subjectname}</td>
                                        {editingRow === i ? <>
                                            <td className="px-4 py-3 text-center"><select className={sel} value={editForm.stageid || ''} onChange={e => setEditForm({...editForm, stageid: e.target.value, sectionid: ''})}><option value="">{t('selectStage', lang)}</option>{stages.map(s => <option key={s.stageid} value={s.stageid}>{getField(s, 'stagename', 'stagename_en', lang)}</option>)}</select></td>
                                            <td className="px-4 py-3 text-center"><select className={sel} value={editForm.classid || ''} onChange={e => setEditForm({...editForm, classid: e.target.value, sectionid: ''})}><option value="">{t('class', lang)}</option>{createdClasses.map(c => <option key={c.classid} value={c.classid}>{t('class', lang)} {getField(c, 'classname', 'classname_en', lang) || c.classname}</option>)}</select></td>
                                            <td className="px-4 py-3 text-center"><select className={sel} value={editForm.sectionid || ''} onChange={e => setEditForm({...editForm, sectionid: e.target.value})}><option value="">{t('section', lang)}</option>{filteredSectionsFor(editForm.classid, editForm.stageid).map(s => <option key={s.sectionid} value={s.sectionid}>{getField(s, 'sectionname', 'sectionname_en', lang) || s.sectionname}</option>)}</select></td>
                                            <td className="px-4 py-3 text-center"><select className={sel} value={editForm.curriculumid || ''} onChange={e => setEditForm({...editForm, curriculumid: e.target.value})}><option value="">{t('curriculum', lang)}</option>{curriculums.map(c => <option key={c.curriculumid} value={c.curriculumid}>{getField(c, 'curriculumname', 'curriculumname_en', lang) || c.curriculumname}</option>)}</select></td>
                                            <td className="px-4 py-3 text-center"><div className="flex gap-2"><button onClick={() => setSaveConfirm({ open: true })} disabled={isLoading} className="btn-primary h-9 px-4 text-sm font-bold flex items-center gap-1 disabled:opacity-60">{isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}{t('save', lang)}</button><button onClick={() => setEditingRow(null)} className="h-9 px-4 text-sm font-bold border border-[#e2e8f0] rounded-lg text-[#64748b] hover:bg-[#f8fafc]">{t('cancel', lang)}</button></div></td>
                                        </> : <>
                                            <td className="px-4 py-3 text-center text-xs text-[#64748b]">{row.stagename || '—'}</td>
                                            <td className="px-4 py-3 text-center text-sm text-[#475569]">{t('class', lang)} {row.classname}</td>
                                            <td className="px-4 py-3 text-center"><span className="inline-flex items-center justify-center px-2 py-0.5 rounded bg-[#eff6ff] text-[#1d4ed8] text-xs font-bold border border-blue-100">{row.sectionname}</span></td>
                                            <td className="px-4 py-3 text-center text-xs text-[#64748b]">{row.curriculumname || '—'}</td>
                                            <td className="px-4 py-3 text-center"><div className="flex gap-2"><button title="Edit" onClick={() => { setEditingRow(i); setEditForm({ classid: String(row.classid), sectionid: String(row.sectionid), stageid: String(row.stageid || ''), curriculumid: String(row.curriculumid || '') }); }} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg border border-blue-100"><Edit2 className="h-4 w-4" /></button><button title="Delete" onClick={() => handleDelete(row)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg border border-red-100"><Trash2 className="h-4 w-4" /></button></div></td>
                                        </>}
                                    </>}
                                    {activeTab === 'supervisors' && <>
                                        <td className="px-4 py-3 text-center text-sm font-bold text-[#0f172a]">{row.supervisorname || "—"}</td>
                                        {editingRow === i ? <>
                                            <td className="px-4 py-3 text-center"><select className={sel} value={editForm.stageid || ''} onChange={e => setEditForm({...editForm, stageid: e.target.value})}>{stages.map(s => <option key={s.stageid} value={s.stageid}>{getField(s, 'stagename', 'stagename_en', lang)}</option>)}</select></td>
                                            <td className="px-4 py-3 text-center"><select className={sel} value={editForm.curriculumid || ''} onChange={e => setEditForm({...editForm, curriculumid: e.target.value})}><option value="">{t('curriculum', lang)}</option>{curriculums.map(c => <option key={c.curriculumid} value={c.curriculumid}>{getField(c, 'curriculumname', 'curriculumname_en', lang) || c.curriculumname}</option>)}</select></td>
                                            <td className="px-4 py-3 text-center"><div className="flex gap-2"><button onClick={() => setSaveConfirm({ open: true })} disabled={isLoading} className="btn-primary h-9 px-4 text-sm font-bold flex items-center gap-1 disabled:opacity-60">{isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}{t('save', lang)}</button><button onClick={() => setEditingRow(null)} className="h-9 px-4 text-sm font-bold border border-[#e2e8f0] rounded-lg text-[#64748b] hover:bg-[#f8fafc]">{t('cancel', lang)}</button></div></td>
                                        </> : <>
                                            <td className="px-4 py-3 text-center text-sm text-[#475569]">{row.stagename}</td>
                                            <td className="px-4 py-3 text-center text-xs text-[#64748b]">{row.curriculumname || '—'}</td>
                                            <td className="px-4 py-3 text-center"><div className="flex gap-2"><button title="Edit" onClick={() => { setEditingRow(i); setEditForm({ stageid: String(row.stageid), curriculumid: String(row.curriculumid || '') }); }} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg border border-blue-100"><Edit2 className="h-4 w-4" /></button><button title="Delete" onClick={() => handleDelete(row)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg border border-red-100"><Trash2 className="h-4 w-4" /></button></div></td>
                                        </>}
                                    </>}
                                    {activeTab === 'teachers' && <>
                                        <td className="px-4 py-3 text-center text-sm font-bold text-[#0f172a]">{row.teachername}</td>
                                        <td className="px-4 py-3 text-center text-sm text-[#475569]">{row.subjectname}</td>
                                        {editingRow === i ? <>
                                            <td className="px-4 py-3 text-center"><select className={sel} value={editForm.stageid || ''} onChange={e => setEditForm({...editForm, stageid: e.target.value, sectionid: ''})}><option value="">{t('stage', lang)}</option>{stages.map(s => <option key={s.stageid} value={s.stageid}>{getField(s, 'stagename', 'stagename_en', lang)}</option>)}</select></td>
                                            <td className="px-4 py-3 text-center"><select className={sel} value={editForm.classid || ''} onChange={e => setEditForm({...editForm, classid: e.target.value, sectionid: ''})}><option value="">{t('class', lang)}</option>{createdClasses.map(c => <option key={c.classid} value={c.classid}>{t('class', lang)} {getField(c, 'classname', 'classname_en', lang) || c.classname}</option>)}</select></td>
                                            <td className="px-4 py-3 text-center"><select className={sel} value={editForm.sectionid || ''} onChange={e => setEditForm({...editForm, sectionid: e.target.value})}><option value="">{t('section', lang)}</option>{filteredSectionsFor(editForm.classid, editForm.stageid).map(s => <option key={s.sectionid} value={s.sectionid}>{getField(s, 'sectionname', 'sectionname_en', lang) || s.sectionname}</option>)}</select></td>
                                            <td className="px-4 py-3 text-center"><select className={sel} value={editForm.curriculumid || ''} onChange={e => setEditForm({...editForm, curriculumid: e.target.value})}><option value="">{t('curriculum', lang)}</option>{curriculums.map(c => <option key={c.curriculumid} value={c.curriculumid}>{getField(c, 'curriculumname', 'curriculumname_en', lang) || c.curriculumname}</option>)}</select></td>
                                            <td className="px-4 py-3 text-center"><div className="flex gap-2"><button onClick={() => setSaveConfirm({ open: true })} disabled={isLoading} className="btn-primary h-9 px-4 text-sm font-bold flex items-center gap-1 disabled:opacity-60">{isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}{t('save', lang)}</button><button onClick={() => setEditingRow(null)} className="h-9 px-4 text-sm font-bold border border-[#e2e8f0] rounded-lg text-[#64748b] hover:bg-[#f8fafc]">{t('cancel', lang)}</button></div></td>
                                        </> : <>
                                            <td className="px-4 py-3 text-center text-xs text-[#64748b]">{row.stagename || '—'}</td>
                                            <td className="px-4 py-3 text-center text-sm text-[#475569]">{t('class', lang)} {row.classname}</td>
                                            <td className="px-4 py-3 text-center"><span className="inline-flex items-center justify-center px-2 py-0.5 rounded bg-[#eff6ff] text-[#1d4ed8] text-xs font-bold border border-blue-100">{row.sectionname}</span></td>
                                            <td className="px-4 py-3 text-center text-xs text-[#64748b]">{row.curriculumname || '—'}</td>
                                            <td className="px-4 py-3 text-center"><div className="flex gap-2"><button title="Edit" onClick={() => { setEditingRow(i); setEditForm({ classid: String(row.classid), sectionid: String(row.sectionid), stageid: String(row.stageid || ''), curriculumid: String(row.curriculumid || '') }); }} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg border border-blue-100"><Edit2 className="h-4 w-4" /></button><button title="Delete" onClick={() => handleDelete(row)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg border border-red-100"><Trash2 className="h-4 w-4" /></button></div></td>
                                        </>}
                                    </>}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="p-4 bg-slate-50/50 border-t border-[#e2e8f0] flex items-center">
                    <span className="text-xs font-bold text-[#64748b] uppercase tracking-wider mr-3">{t('total', lang)}</span>
                    <div className="px-3 py-1 bg-white rounded-lg border border-[#e2e8f0] text-xs font-black text-[#0f172a] shadow-sm">{currentData.length} {t('rows', lang)}</div>
                </div>
            </div>

            {deleteModal.show && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteModal({ show: false, row: null })} />
                    <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
                        <h3 className="text-base font-bold text-[#0f172a] mb-2">{isAr ? 'تأكيد الحذف' : 'Confirm Delete'}</h3>
                        <p className="text-sm text-[#64748b] mb-6">{isAr ? 'هل أنت متأكد من حذف هذا التعيين؟ لا يمكن التراجع عن هذا الإجراء.' : 'Are you sure you want to delete this assignment? This action cannot be undone.'}</p>
                        <div className="flex gap-3 justify-end">
                            <button onClick={() => setDeleteModal({ show: false, row: null })} className="px-4 py-2 rounded-lg border border-[#e2e8f0] text-sm font-semibold text-[#64748b] hover:bg-slate-50">{t('cancel', lang)}</button>
                            <button onClick={confirmDelete} className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-bold hover:bg-red-700">{t('delete', lang)}</button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmDialog
                open={saveConfirm.open}
                title={isAr ? 'تأكيد الحفظ' : 'Confirm Save'}
                message={isAr ? 'هل تريد حفظ التغييرات على هذا التعيين؟' : 'Save changes to this assignment?'}
                confirmLabel={isAr ? 'حفظ' : 'Save'}
                variant="primary"
                loading={isLoading}
                onCancel={() => setSaveConfirm({ open: false })}
                onConfirm={() => { setSaveConfirm({ open: false }); handleSaveEdit(); }}
            />
        </div>
    );
}
