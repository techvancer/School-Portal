// n8n Webhook Integration for School Portal v36
// Handles communication with n8n for strategic grading workflow

const MARKS_WEBHOOK_URL = 'https://n8n.srv1133195.hstgr.cloud/webhook-test/strat_grading';

/**
 * Send marks data to n8n webhook for processing
 * @param {Object} data - Marks data from UploadMarks page
 * @returns {Promise<Object>} - Webhook response
 */
async function sendMarksWebhook(data) {
    try {
        const response = await fetch(MARKS_WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Webhook failed: ${response.status} - ${errorText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Marks webhook error:', error);
        throw error;
    }
}

/**
 * Send marks to workflow with complete context
 * Called from UploadMarks.jsx when teacher submits marks
 * @param {Object} marksData - Complete marks data with all context
 */
export async function sendMarksToWorkflow(marksData) {
    const payload = {
        eventType: 'exam-marks-submitted',
        timestamp: new Date().toISOString(),
        data: {
            // Exam Context
            examid: marksData.examid,
            examname: marksData.exam?.examname || '',
            examname_en: marksData.exam?.examname_en || '',

            // Class/Section/Subject Context
            classid: marksData.classid,
            sectionid: marksData.sectionid,
            subjectid: marksData.subjectid,

            // Teacher/Employee Info
            employeeid: marksData.employeeid,
            employeename: marksData.employeename,
            employeeemail: marksData.employeeemail,

            // School/Branch Context
            schoolid: marksData.schoolid,
            branchid: marksData.branchid,

            // Student Marks (array of mark records)
            marks: marksData.marks.map(mark => ({
                studentid: mark.studentid,
                studentname: mark.studentname,
                // Map all question marks (q1, q2, q3, etc.)
                answers: Object.keys(mark)
                    .filter(key => key.startsWith('q'))
                    .reduce((acc, key) => {
                        acc[key] = mark[key]; // '0', '1', or ''
                        return acc;
                    }, {}),
            })),

            // Metadata
            totalQuestions: marksData.questionCount,
            totalStudents: marksData.marks.length,
            submittedAt: marksData.timestamp,

            // Status (n8n should update exam status after processing)
            status: 'processing',
        },
    };

    return sendMarksWebhook(payload);
}

/**
 * Track exam grading start (legacy - kept for compatibility)
 * @param {Object} examData - Exam information
 */
export async function trackExamGradingStarted(examData) {
    const payload = {
        eventType: 'exam-grading-started',
        timestamp: new Date().toISOString(),
        data: examData,
    };

    return sendMarksWebhook(payload);
}
