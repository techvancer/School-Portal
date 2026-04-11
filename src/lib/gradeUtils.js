/**
 * Fetch real grade distribution from studentanswers_tbl.
 * Computes per-student percentage (earned/possible × 100) then buckets by grade.
 * Responds to all active filters: examid, classid, sectionid, subjectid, semisterid.
 */

import { dbQuery, rest } from './supabaseClient';

export async function fetchGradeDistribution({
    schoolid, branchid, employeeid,
    curriculumid, divisionid, stageid,
    classid, sectionid, subjectid, examid, semisterid,
    classids,
    completedExamIds,
}) {
    try {
        // ── Build answer query params ──────────────────────────────────────
        const ansParams = new URLSearchParams({
            select: 'studentid,studentmark,questionid,classid,sectionid,examid',
            schoolid: `eq.${schoolid}`,
            branchid: `eq.${branchid}`,
        });
        if (employeeid)                                    ansParams.set('employeeid',   `eq.${employeeid}`);
        if (curriculumid && curriculumid !== 'All')        ansParams.set('curriculumid', `eq.${curriculumid}`);
        if (divisionid   && divisionid   !== 'All')        ansParams.set('divisionid',   `eq.${divisionid}`);
        if (stageid      && stageid      !== 'All')        ansParams.set('stageid',      `eq.${stageid}`);
        if (classid      && classid      !== 'All')        ansParams.set('classid',      `eq.${classid}`);
        if (sectionid    && sectionid    !== 'All')        ansParams.set('sectionid',    `eq.${sectionid}`);
        if (subjectid    && subjectid    !== 'All')        ansParams.set('subjectid',    `eq.${subjectid}`);
        if (examid       && examid       !== 'All')        ansParams.set('examid',       `eq.${examid}`);
        if (semisterid   && semisterid   !== 'All')        ansParams.set('semisterid',   `eq.${semisterid}`);

        // ── Build question_marks query params ─────────────────────────────
        const qParams = new URLSearchParams({
            select: 'questionid,question_marks,classid,sectionid,examid',
            schoolid: `eq.${schoolid}`,
            branchid: `eq.${branchid}`,
        });
        if (employeeid)                                    qParams.set('employeeid',   `eq.${employeeid}`);
        if (curriculumid && curriculumid !== 'All')        qParams.set('curriculumid', `eq.${curriculumid}`);
        if (divisionid   && divisionid   !== 'All')        qParams.set('divisionid',   `eq.${divisionid}`);
        if (stageid      && stageid      !== 'All')        qParams.set('stageid',      `eq.${stageid}`);
        if (classid      && classid      !== 'All')        qParams.set('classid',      `eq.${classid}`);
        if (sectionid    && sectionid    !== 'All')        qParams.set('sectionid',    `eq.${sectionid}`);
        if (subjectid    && subjectid    !== 'All')        qParams.set('subjectid',    `eq.${subjectid}`);
        if (examid       && examid       !== 'All')        qParams.set('examid',       `eq.${examid}`);

        const [rows, qRows] = await Promise.all([
            dbQuery(`studentanswers_tbl?${ansParams}`).catch(() => []),
            dbQuery(`questions_exams_employee_subjects_sections_tbl?${qParams}`).catch(() => []),
        ]);

        if (!rows || !Array.isArray(rows) || rows.length === 0) return [];

        // Legacy classids filter (used by supervisor)
        let filtered = classids?.length
            ? rows.filter(r => classids.includes(r.classid))
            : rows;

        // Filter to completed exams only when provided
        if (completedExamIds && completedExamIds.length > 0) {
            const completedSet = new Set(completedExamIds.map(String));
            filtered = filtered.filter(r => completedSet.has(String(r.examid)));
        }

        if (filtered.length === 0) return [];

        // question_marks lookup INCLUDING examid: "examid-classid-sectionid-questionid" → max mark
        const qMaxMap = {};
        (qRows || []).forEach(q => {
            const key = `${q.examid}-${q.classid}-${q.sectionid}-${q.questionid}`;
            qMaxMap[key] = parseFloat(q.question_marks) || 1;
        });

        // Per student per exam: accumulate earned and possible separately
        const studentExamData = {};
        filtered.forEach(r => {
            const sid = String(r.studentid);
            const eid = String(r.examid);
            if (!studentExamData[sid]) studentExamData[sid] = {};
            if (!studentExamData[sid][eid]) studentExamData[sid][eid] = { earned: 0, possible: 0 };
            const qKey = `${r.examid}-${r.classid}-${r.sectionid}-${r.questionid}`;
            studentExamData[sid][eid].earned   += parseFloat(r.studentmark) || 0;
            studentExamData[sid][eid].possible += qMaxMap[qKey] || 1;
        });

        // Fetch grades from DB using safe rest() (anon key)
        let gradeRows = [];
        try {
            gradeRows = await rest('Grades_tbl', { select: 'gradeid,gradename,frommark,tomark', order: 'tomark.desc' });
        } catch {}
        if (!Array.isArray(gradeRows) || gradeRows.length === 0) {
            gradeRows = [
                { gradename: 'A', frommark: 90, tomark: 100 },
                { gradename: 'B', frommark: 80, tomark: 89  },
                { gradename: 'C', frommark: 70, tomark: 79  },
                { gradename: 'D', frommark: 60, tomark: 69  },
                { gradename: 'E', frommark: 50, tomark: 59  },
                { gradename: 'F', frommark: 0,  tomark: 49  },
            ];
        }

        const GRADE_COLORS_PIE = ['#16a34a', '#1d4ed8', '#0891b2', '#7c3aed', '#ea580c', '#dc2626'];
        const gradeCounts = {};
        gradeRows.forEach(g => { gradeCounts[g.gradename] = 0; });

        // Each student's final % = average of their per-exam percentages
        Object.values(studentExamData).forEach(examMap => {
            const examPcts = Object.values(examMap)
                .filter(e => e.possible > 0)
                .map(e => (e.earned / e.possible) * 100);
            if (examPcts.length === 0) return;
            const pct = examPcts.reduce((a, b) => a + b, 0) / examPcts.length;
            const match = gradeRows.find(g => pct >= g.frommark && pct <= g.tomark);
            const label = match?.gradename || gradeRows[gradeRows.length - 1]?.gradename || 'F';
            gradeCounts[label] = (gradeCounts[label] || 0) + 1;
        });

        const total = Object.values(gradeCounts).reduce((a, b) => a + b, 0);
        if (total === 0) return [];

        const p = (n) => parseFloat((n / total * 100).toFixed(1));

        return gradeRows
            .map((g, i) => {
                const count = gradeCounts[g.gradename] || 0;
                if (count === 0) return null;
                return {
                    name:  `${g.gradename} (${g.frommark}–${g.tomark}%): ${count} (${p(count)}%)`,
                    pct: p(count),
                    value: count,
                    color: GRADE_COLORS_PIE[i % GRADE_COLORS_PIE.length],
                };
            })
            .filter(Boolean);

    } catch (e) {
        console.error('fetchGradeDistribution error:', e);
        return [];
    }
}
