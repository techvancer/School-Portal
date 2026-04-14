// ─── CHANGE 7: English-only student full name ─────────────────────────────
import { t, getField, getStudentName as langGetStudentName } from './langHelper';
import { rest } from './supabaseClient';

export function getStudentFullName(s, lang) {
    if (lang) return langGetStudentName(s, lang);
    const parts = [
        s.studentfirstname_en,
        s.studentfathersname_en,
        s.studentsurname_en,
    ].filter(Boolean);
    return parts.length ? parts.join(' ') : (s.studentname || '—');
}

// ─── CHANGE 7: English-only class/section/subject name helpers ────────────
export function getClassName(c, lang)   { return lang ? getField(c, 'classname', 'classname_en', lang) : (c?.classname_en   || c?.classname   || ''); }
export function getSectionName(s, lang) { return lang ? getField(s, 'sectionname', 'sectionname_en', lang) : (s?.sectionname_en || s?.sectionname || ''); }
export function getSubjectName(s, lang) { return lang ? getField(s, 'subjectname', 'Subjectname_en', lang) : (s?.Subjectname_en || s?.subjectname_en || s?.subjectname || ''); }
export function getEmployeeName(e, lang){ return lang ? getField(e, 'employeename', 'employeename_en', lang) : (e?.employeename_en || e?.employeename || ''); }
export function getStageName(s, lang)   { return lang ? getField(s, 'stagename', 'stagename_en', lang) : (s?.stagename_en || ''); }
export function getDivisionName(d, lang){ return lang ? getField(d, 'divisionname', 'divisionname_en', lang) : (d?.divisionname_en || d?.divisionname || ''); }
export function getCurriculumName(c, lang){ return lang ? getField(c, 'curriculumname', 'curriculumname_en', lang) : (c?.curriculumname_en || c?.curriculumname || ''); }
export function getBranchName(b, lang)  { return lang ? getField(b, 'branchname', 'branchname_en', lang) : (b?.branchname_en || b?.branchname || ''); }

// ─── CHANGE 8/9: Professional grading scale ───────────────────────────────
// A+ (95–100%), A (90–94%), B+ (85–89%), B (80–84%), C+ (75–79%), C (70–74%)
// D+ (65–69%), D (60–64%), E (50–59%), F (below 50%)  Passing = 50%+
// Grade colors keyed by gradename from grades_tbl
const GRADE_COLORS = {
    'A': 'bg-green-100 text-green-800 border-green-300',
    'B': 'bg-blue-100 text-blue-800 border-blue-300',
    'C': 'bg-violet-100 text-violet-800 border-violet-300',
    'D': 'bg-amber-100 text-amber-800 border-amber-300',
    'E': 'bg-orange-100 text-orange-800 border-orange-300',
    'F': 'bg-red-100 text-red-800 border-red-300',
};

// Cached grades from DB — populated by loadGrades()
let _gradesCache = null;

export async function loadGrades() {
    if (_gradesCache) return _gradesCache;
    try {
        const rows = await rest('Grades_tbl', { select: 'gradeid,gradename,frommark,tomark', order: 'tomark.desc' });
        _gradesCache = Array.isArray(rows) && rows.length > 0 ? rows : [
            { gradeid: 1, gradename: 'A', frommark: 90, tomark: 100 },
            { gradeid: 2, gradename: 'B', frommark: 80, tomark: 89  },
            { gradeid: 3, gradename: 'C', frommark: 70, tomark: 79  },
            { gradeid: 4, gradename: 'D', frommark: 60, tomark: 69  },
            { gradeid: 5, gradename: 'E', frommark: 50, tomark: 59  },
            { gradeid: 6, gradename: 'F', frommark: 0,  tomark: 49  },
        ];
    } catch {
        _gradesCache = [
            { gradeid: 1, gradename: 'A', frommark: 90, tomark: 100 },
            { gradeid: 2, gradename: 'B', frommark: 80, tomark: 89  },
            { gradeid: 3, gradename: 'C', frommark: 70, tomark: 79  },
            { gradeid: 4, gradename: 'D', frommark: 60, tomark: 69  },
            { gradeid: 5, gradename: 'E', frommark: 50, tomark: 59  },
            { gradeid: 6, gradename: 'F', frommark: 0,  tomark: 49  },
        ];
    }
    return _gradesCache;
}

export function calcGradeFromList(pct, grades) {
    if (pct === null || pct === undefined || !grades?.length) return { label: '—', color: '', pass: false };
    const p = parseFloat(pct);
    const grade = grades.find(g => p >= g.frommark && p <= g.tomark);
    if (!grade) {
        // below lowest
        const lowest = grades[grades.length - 1];
        const label = lowest?.gradename || 'F';
        return { label, color: GRADE_COLORS[label] || 'bg-red-100 text-red-800 border-red-300', pass: false };
    }
    const label = grade.gradename;
    // Pass = not the lowest grade (F)
    const lowestGrade = grades[grades.length - 1]?.gradename;
    const pass = label !== lowestGrade;
    return { label, color: GRADE_COLORS[label] || 'bg-slate-100 text-slate-800 border-slate-300', pass };
}

// Sync grade calc — uses DB cache if loaded, otherwise returns placeholder
export function calcGrade(pct) {
    return calcGradeFromList(pct, _gradesCache || []);
}

// ─── CHANGE 2: Universal filter order helper ─────────────────────────────
// Returns filters array in mandatory order: Curriculum → Division → Branch → Stage → Class → Section → Subject → Exam → Semester
export function buildFilters(applied, filterData, extras = {}, lang = 'en') {
    // disabled is NOT set here — FilterBar computes it from its own draft state
    return [
        { key: 'curriculumid', label: t('curriculum', lang), value: applied.curriculumid ?? 'All', options: filterData.curriculums || [{ value: 'All', label: t('allCurriculums', lang) }], ...extras.curriculumid },
        { key: 'divisionid',   label: t('division', lang),   value: applied.divisionid   ?? 'All', options: filterData.divisions  || [{ value: 'All', label: t('allDivisions', lang) }],   ...extras.divisionid },
        { key: 'stageid',      label: t('stage', lang),      value: applied.stageid      ?? 'All', options: filterData.stages     || [{ value: 'All', label: t('allStages', lang) }],      ...extras.stageid },
        { key: 'classid',      label: t('class', lang),    value: applied.classid      ?? 'All', options: filterData.classes    || [{ value: 'All', label: t('allClasses', lang) }],     ...extras.classid },
        { key: 'sectionid',    label: t('section', lang),    value: applied.sectionid    ?? 'All', options: filterData.sections   || [{ value: 'All', label: t('allSections', lang) }],    ...extras.sectionid },
        { key: 'subjectid',    label: t('subject', lang),    value: applied.subjectid    ?? 'All', options: filterData.subjects   || [{ value: 'All', label: t('allSubjects', lang) }],    ...extras.subjectid },
        { key: 'examid',       label: t('exam', lang),       value: applied.examid       ?? 'All', options: filterData.exams      || [{ value: 'All', label: t('allExams', lang) }],       ...extras.examid },
        { key: 'semisterid',   label: t('semester', lang),   value: applied.semisterid   ?? 'All', options: filterData.semisters  || [{ value: 'All', label: t('allSemesters', lang) }],   ...extras.semisterid },
    ];
}

export const EMPTY_FILTER = {
    curriculumid: 'All', divisionid: 'All',
    stageid: 'All', classid: 'All', sectionid: 'All',
    subjectid: 'All', examid: 'All', semisterid: 'All',
};
