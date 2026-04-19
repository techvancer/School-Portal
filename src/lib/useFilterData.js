/**
 * useFilterData — role-scoped filter dropdown data.
 * Always returns data in hierarchy order
 */
import { useState, useEffect, useRef } from 'react';
import { rest } from './supabaseClient';
import { t, getField } from './langHelper';

// Module-level caches to deduplicate simultaneous or subsequent hook setups
const filterCacheMap = new Map();
const filterPromiseMap = new Map();
export function invalidateFilterCache() {
    filterCacheMap.clear();
    filterPromiseMap.clear();
}

export function useFilterData(user, lang) {
    const [data, setData] = useState({
        curriculums: [], divisions: [],
        stages: [], classes: [], sections: [], subjects: [],
        exams: [], semisters: [], types: [], employees: [], students: [], scRows: []
    });

    const rawDataRef = useRef(null);

    // Effect 1: Fetch raw data from DB (depends only on user identity)
    useEffect(() => {
        if (!user) return;
        const cacheKey = `${user.role}_${user.employeeid}_${user.schoolid}_${user.branchid}`;

        if (filterCacheMap.has(cacheKey)) {
            rawDataRef.current = filterCacheMap.get(cacheKey);
            window.dispatchEvent(new Event('filterDataReady'));
            return;
        }

        if (filterPromiseMap.has(cacheKey)) {
            filterPromiseMap.get(cacheKey).then(raw => {
                rawDataRef.current = raw;
                window.dispatchEvent(new Event('filterDataReady'));
            }).catch(e => console.error('useFilterData parallel fetch error:', e));
            return;
        }

        const fetchLogic = async () => {
            const role = user.role;
            const eid  = user.employeeid;
            const sid  = user.schoolid;
            const bid  = user.branchid;

            const uniq = (arr, key) => [...new Map((arr||[]).map(r => [r[key], r])).values()];

                // Always fetch shared lookup tables
                const [examTbl, semTbl, typesTbl, divTbl, curTbl] = await Promise.all([
                    rest('exams_tbl', { select: 'examid,examname_en,examname' }),
                    rest('semisters_tbl', { select: 'semisterid,semistername_en,semistername,yearid' }),
                    rest('types_tbl', { select: 'typeid,typename_en,typename' }),
                    rest('divisions_tbl', { schoolid: `eq.${sid}`, branchid: `eq.${bid}`, select: 'divisionid,divisionname_en,divisionname' }).catch(() => []),
                    rest('curriculums_tbl', { schoolid: `eq.${sid}`, branchid: `eq.${bid}`, select: 'curriculumid,curriculumname_en,curriculumname' }).catch(() => []),
                ]);

                let raw = { role, eid, examTbl, semTbl, typesTbl, divTbl, curTbl, stageRows: [], clRows: [], secRows: [], subRows: [], filteredSems: [], empNames: [], teacherExamIds: new Set(), teacherCurIds: [], teacherDivIds: [], activeStages: [], subTbl: [], empTbl: [], teacherTypes: [], scRows: [] };

                if (role === 'Teacher') {
                    const assignments = await rest('employees_sections_subjects_classes_semisters_curriculums_tbl', { employeeid: `eq.${eid}`, schoolid: `eq.${sid}`, branchid: `eq.${bid}`, select: 'classid,sectionid,subjectid,stageid,semisterid,curriculumid,divisionid' });
                    const classIds   = [...new Set(assignments.map(a => a.classid))];
                    const sectionIds = [...new Set(assignments.map(a => a.sectionid))];
                    const subjectIds = [...new Set(assignments.map(a => a.subjectid))];
                    const stageIds   = [...new Set(assignments.map(a => a.stageid))];
                    const semIds     = [...new Set(assignments.map(a => a.semisterid))];

                    const [clRows, secRows, subRows, stageRows] = await Promise.all([
                        classIds.length   ? rest('classes_tbl',  { classid:   `in.(${classIds})`,   select: 'classid,classname_en,classname' }) : [],
                        sectionIds.length ? rest('sections_tbl', { sectionid: `in.(${sectionIds})`, select: 'sectionid,sectionname_en,sectionname' }) : [],
                        subjectIds.length ? rest('subjects_tbl', { subjectid: `in.(${subjectIds})`, select: 'subjectid,Subjectname_en,subjectname' }) : [],
                        stageIds.length   ? rest('stages_tbl',   { stageid:   `in.(${stageIds})`,   select: 'stageid,stagename_en,stagename' }) : [],
                    ]);

                    const teacherExamRows = await rest('questions_exams_employee_subjects_sections_tbl', {
                        employeeid: `eq.${eid}`, schoolid: `eq.${sid}`, branchid: `eq.${bid}`,
                        status: `in.(marked,submitted,completed,inprogress)`, select: 'examid',
                    }).catch(() => []);

                    raw.filteredSems = semTbl.filter(s => semIds.includes(s.semisterid));
                    raw.teacherCurIds = [...new Set(assignments.map(a => a.curriculumid).filter(Boolean))];
                    raw.teacherDivIds = [...new Set(assignments.map(a => a.divisionid).filter(Boolean))];
                    raw.teacherExamIds = new Set((teacherExamRows || []).map(r => String(r.examid)));
                    raw.clRows = clRows; raw.secRows = secRows; raw.subRows = subRows; raw.stageRows = stageRows;
                    raw.scRows = assignments; // has classid,sectionid,stageid,curriculumid,divisionid
                }
                else if (role === 'Supervisor') {
                    const supStages = await rest('employees_types_stages_tbl', { employeeid: `eq.${eid}`, schoolid: `eq.${sid}`, branchid: `eq.${bid}`, select: 'stageid' });
                    const stageIds  = [...new Set((supStages || []).map(s => s.stageid))];

                    const classStages = stageIds.length ? await rest('classes_stages_tbl', { stageid: `in.(${stageIds})`, schoolid: `eq.${sid}`, branchid: `eq.${bid}`, select: 'classid,stageid' }) : [];
                    const classIds = [...new Set((classStages || []).map(r => r.classid))];

                    const assignedClasses = classIds.length ? await rest('employees_sections_subjects_classes_semisters_curriculums_tbl', { classid: `in.(${classIds})`, schoolid: `eq.${sid}`, branchid: `eq.${bid}`, select: 'classid,sectionid,subjectid,semisterid,employeeid,curriculumid,divisionid' }) : [];

                    // Use ALL supervised classIds (from stages) for the class dropdown,
                    // not just those with teacher assignments — newly created classes with
                    // no assignments yet must still be visible.
                    const activeSectionIds = [...new Set(assignedClasses.map(r => r.sectionid))];
                    const activeSubjectIds = [...new Set(assignedClasses.map(r => r.subjectid))];
                    const activeSemIds     = [...new Set(assignedClasses.map(r => r.semisterid))];
                    const activeEmpIds     = [...new Set(assignedClasses.map(r => r.employeeid))];

                    const [clRows, secRows, subNames, stageRows, empNames, scRows] = await Promise.all([
                        classIds.length         ? rest('classes_tbl',  { classid:   `in.(${classIds})`,         select: 'classid,classname_en,classname' }) : [],
                        activeSectionIds.length ? rest('sections_tbl', { sectionid: `in.(${activeSectionIds})`, select: 'sectionid,sectionname_en,sectionname' }) : [],
                        activeSubjectIds.length ? rest('subjects_tbl', { subjectid: `in.(${activeSubjectIds})`, select: 'subjectid,Subjectname_en,subjectname' }) : [],
                        stageIds.length         ? rest('stages_tbl',   { stageid:   `in.(${stageIds})`,         select: 'stageid,stagename_en,stagename' }) : [],
                        activeEmpIds.length     ? rest('employee_tbl', { employeeid:`in.(${activeEmpIds})`,     select: 'employeeid,employeename_en,employeename' }) : [],
                        classIds.length         ? rest('sections_classes_tbl', { classid: `in.(${classIds})`, schoolid: `eq.${sid}`, branchid: `eq.${bid}`, select: 'classid,sectionid,stageid,divisionid,curriculumid' }).catch(() => []) : Promise.resolve([]),
                    ]);

                    raw.filteredSems = semTbl.filter(s => activeSemIds.includes(s.semisterid));
                    raw.clRows = clRows; raw.secRows = secRows; raw.subRows = subNames; raw.stageRows = stageRows; raw.empNames = empNames;
                    raw.scRows = scRows;
                }
                else {
                    // ADMIN / GM
                    const [assignRows, stuScRows, stageTbl, subTbl, empTbl, teacherTypes, scRows] = await Promise.all([
                        rest('employees_sections_subjects_classes_semisters_curriculums_tbl', { schoolid: `eq.${sid}`, branchid: `eq.${bid}`, select: 'classid,sectionid,subjectid,stageid,semisterid,employeeid,curriculumid,divisionid' }),
                        rest('students_sections_classes_tbl', { schoolid: `eq.${sid}`, branchid: `eq.${bid}`, select: 'classid,sectionid,stageid' }),
                        rest('stages_tbl', { schoolid: `eq.${sid}`, branchid: `eq.${bid}`, select: 'stageid,stagename_en,stagename' }),
                        rest('subjects_tbl', { select: 'subjectid,Subjectname_en,subjectname' }),
                        rest('employee_tbl', { schoolid: `eq.${sid}`, branchid: `eq.${bid}`, select: 'employeeid,employeename_en,employeename' }),
                        rest('employees_types_tbl', { typeid: 'eq.1', select: 'employeeid' }),
                        rest('sections_classes_tbl', { schoolid: `eq.${sid}`, branchid: `eq.${bid}`, select: 'classid,sectionid,stageid,divisionid,curriculumid' }).catch(() => []),
                    ]);

                    const activeClassIds   = [...new Set([...assignRows.map(r => r.classid),   ...stuScRows.map(r => r.classid)])];
                    const activeSectionIds = [...new Set([...assignRows.map(r => r.sectionid), ...stuScRows.map(r => r.sectionid)])];
                    const activeStageIds   = [...new Set([...assignRows.map(r => r.stageid),   ...stuScRows.map(r => r.stageid)].filter(Boolean))];
                    const activeSemIds     = [...new Set(assignRows.map(r => r.semisterid).filter(Boolean))];

                    const [clRows, secRows] = await Promise.all([
                        activeClassIds.length   ? rest('classes_tbl',  { classid:   `in.(${activeClassIds})`,   select: 'classid,classname_en,classname' }) : [],
                        activeSectionIds.length ? rest('sections_tbl', { sectionid: `in.(${activeSectionIds})`, select: 'sectionid,sectionname_en,sectionname' }) : [],
                    ]);

                    raw.activeStages = uniq((stageTbl || []).filter(r => activeStageIds.includes(r.stageid)), 'stageid');
                    raw.filteredSems = semTbl.filter(s => activeSemIds.includes(s.semisterid));
                    raw.clRows = clRows; raw.secRows = secRows; raw.subTbl = subTbl; raw.empTbl = empTbl; raw.teacherTypes = teacherTypes;
                    raw.scRows = scRows;
                }
                
                return raw;
        };

        (async () => {
            try {
                const promise = fetchLogic();
                filterPromiseMap.set(cacheKey, promise);

                const raw = await promise;
                filterCacheMap.set(cacheKey, raw);
                filterPromiseMap.delete(cacheKey);

                rawDataRef.current = raw;
                window.dispatchEvent(new Event('filterDataReady'));
            } catch (e) {
                console.error('useFilterData error:', e);
                filterPromiseMap.delete(cacheKey);
            }
        })();
    }, [user?.employeeid, user?.role, user?.schoolid, user?.branchid]);

    // Effect 2: Build labels when raw data is ready OR when lang changes
    useEffect(() => {
        const buildLabels = () => {
            if (!rawDataRef.current || !user) return;
            const raw = rawDataRef.current;
            const opt = (label) => [{ value: 'All', label }];
            const uniq = (arr, key) => [...new Map((arr || []).map(r => [r[key], r])).values()];

            const divOptions = [...opt(t('allDivisions', lang)),   ...uniq(raw.divTbl, 'divisionid').map(r => ({ value: String(r.divisionid),   label: getField(r, 'divisionname', 'divisionname_en', lang)   || `Division ${r.divisionid}` }))];
            const curOptions = [...opt(t('allCurriculums', lang)), ...uniq(raw.curTbl, 'curriculumid').map(r => ({ value: String(r.curriculumid), label: getField(r, 'curriculumname', 'curriculumname_en', lang) || `Curriculum ${r.curriculumid}` }))];

            if (raw.role === 'Teacher') {
                const teacherCurOptions = [...opt(t('allCurriculums', lang)), ...(raw.curTbl || []).filter(r => raw.teacherCurIds.includes(r.curriculumid)).map(r => ({ value: String(r.curriculumid), label: getField(r, 'curriculumname', 'curriculumname_en', lang) || `Curriculum ${r.curriculumid}` }))];
                const teacherDivOptions = [...opt(t('allDivisions', lang)),   ...(raw.divTbl || []).filter(r => raw.teacherDivIds.includes(r.divisionid)).map(r => ({ value: String(r.divisionid),   label: getField(r, 'divisionname', 'divisionname_en', lang)   || `Division ${r.divisionid}` }))];
                setData({
                    curriculums: teacherCurOptions, divisions: teacherDivOptions,
                    stages:   [...opt(t('allStages', lang)),    ...uniq(raw.stageRows, 'stageid').map(r   => ({ value: String(r.stageid),   label: getField(r, 'stagename', 'stagename_en', lang) }))],
                    classes:  [...opt(t('allClasses', lang)),   ...uniq(raw.clRows,    'classid').map(r   => ({ value: String(r.classid),   label: getField(r, 'classname', 'classname_en', lang) }))],
                    sections: [...opt(t('allSections', lang)),  ...uniq(raw.secRows,   'sectionid').map(r => ({ value: String(r.sectionid), label: getField(r, 'sectionname', 'sectionname_en', lang) }))],
                    subjects: [...opt(t('allSubjects', lang)),  ...uniq(raw.subRows,   'subjectid').map(r => ({ value: String(r.subjectid), label: getField(r, 'subjectname', 'Subjectname_en', lang) }))],
                    exams:    [...opt(t('allExams', lang)),     ...raw.examTbl.filter(r => raw.teacherExamIds.has(String(r.examid))).map(r => ({ value: String(r.examid), label: getField(r, 'examname', 'examname_en', lang) }))],
                    semisters:[...opt(t('allSemesters', lang)), ...uniq(raw.filteredSems.length ? raw.filteredSems : raw.semTbl, 'semisterid').map(r => ({ value: String(r.semisterid), label: getField(r, 'semistername', 'semistername_en', lang) }))],
                    types:    [...opt(t('allTypes', lang) || 'All Types'),     ...raw.typesTbl.map(r => ({ value: String(r.typeid), label: getField(r, 'typename', 'typename_en', lang) }))],
                    employees:[{ value: 'All', label: t('allEmployees', lang) }, { value: String(raw.eid), label: user.name }],
                    students: [...opt(t('allStudents', lang))],
                    scRows:   raw.scRows || [],
                });
            } else if (raw.role === 'Supervisor') {
                setData({
                    curriculums: curOptions, divisions: divOptions,
                    stages:   [...opt(t('allStages', lang)),    ...uniq(raw.stageRows, 'stageid').map(r   => ({ value: String(r.stageid),   label: getField(r, 'stagename', 'stagename_en', lang) }))],
                    classes:  [...opt(t('allClasses', lang)),   ...uniq(raw.clRows,   'classid').map(r   => ({ value: String(r.classid),   label: getField(r, 'classname', 'classname_en', lang) }))],
                    sections: [...opt(t('allSections', lang)),  ...uniq(raw.secRows,  'sectionid').map(r => ({ value: String(r.sectionid), label: getField(r, 'sectionname', 'sectionname_en', lang) }))],
                    subjects: [...opt(t('allSubjects', lang)),  ...uniq(raw.subRows, 'subjectid').map(r => ({ value: String(r.subjectid), label: getField(r, 'subjectname', 'Subjectname_en', lang) }))],
                    employees:[...opt(t('allEmployees', lang)), ...uniq(raw.empNames, 'employeeid').map(r => ({ value: String(r.employeeid), label: getField(r, 'employeename', 'employeename_en', lang) }))],
                    exams:    [...opt(t('allExams', lang)),     ...raw.examTbl.map(r => ({ value: String(r.examid), label: getField(r, 'examname', 'examname_en', lang) }))],
                    semisters:[...opt(t('allSemesters', lang)), ...uniq(raw.filteredSems.length ? raw.filteredSems : raw.semTbl, 'semisterid').map(r => ({ value: String(r.semisterid), label: getField(r, 'semistername', 'semistername_en', lang) }))],
                    types:    [...opt(t('allTypes', lang) || 'All Types'),     ...raw.typesTbl.map(r => ({ value: String(r.typeid), label: getField(r, 'typename', 'typename_en', lang) }))],
                    students: [...opt(t('allStudents', lang))],
                    scRows:   raw.scRows || [],
                });
            } else {
                setData({
                    curriculums: curOptions, divisions: divOptions,
                    stages:   [...opt(t('allStages', lang)),    ...raw.activeStages.map(r               => ({ value: String(r.stageid),   label: getField(r, 'stagename', 'stagename_en', lang) }))],
                    classes:  [...opt(t('allClasses', lang)),   ...uniq(raw.clRows,  'classid').map(r   => ({ value: String(r.classid),   label: getField(r, 'classname', 'classname_en', lang) }))],
                    sections: [...opt(t('allSections', lang)),  ...uniq(raw.secRows, 'sectionid').map(r => ({ value: String(r.sectionid), label: getField(r, 'sectionname', 'sectionname_en', lang) }))],
                    subjects: [...opt(t('allSubjects', lang)),  ...raw.subTbl.map(r                    => ({ value: String(r.subjectid), label: getField(r, 'subjectname', 'Subjectname_en', lang) }))],
                    exams:    [...opt(t('allExams', lang)),     ...raw.examTbl.map(r                   => ({ value: String(r.examid),    label: getField(r, 'examname', 'examname_en', lang) }))],
                    semisters:[...opt(t('allSemesters', lang)), ...uniq(raw.filteredSems.length ? raw.filteredSems : raw.semTbl, 'semisterid').map(r => ({ value: String(r.semisterid), label: getField(r, 'semistername', 'semistername_en', lang) }))],
                    types:    [...opt(t('allTypes', lang) || 'All Types'),     ...raw.typesTbl.map(r                  => ({ value: String(r.typeid),    label: getField(r, 'typename', 'typename_en', lang) }))],
                    employees:[...opt(t('teachers', lang) || 'All Teachers'), ...raw.empTbl.filter(e => (raw.teacherTypes||[]).some(t => t.employeeid === e.employeeid)).map(r => ({ value: String(r.employeeid), label: getField(r, 'employeename', 'employeename_en', lang) }))],
                    students: [...opt(t('allStudents', lang))],
                    scRows:   raw.scRows || [],
                });
            }
        };

        buildLabels();
        window.addEventListener('filterDataReady', buildLabels);
        return () => window.removeEventListener('filterDataReady', buildLabels);
    }, [lang, user]);

    return data;
}
