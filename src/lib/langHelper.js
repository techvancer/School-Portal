// Returns the correct field value based on current language
export function getField(obj, arField, enField, lang) {
    if (!obj) return '';
    return lang === 'ar' ? (obj[arField] || obj[enField] || '') : (obj[enField] || obj[arField] || '');
}

// Student full name
export function getStudentName(student, lang) {
    if (!student) return '';
    if (lang === 'ar') {
        return [student.studentfirstname_ar, student.studentfathersname_ar, student.studentgrandfathersname_ar, student.studentsurname_ar].filter(Boolean).join(' ') || student.studentname || '';
    }
    return [student.studentfirstname_en, student.studentfathersname_en, student.studentgrandfathersname_en, student.studentsurname_en].filter(Boolean).join(' ') || student.studentname || '';
}

// ── MCQ choice mapping ────────────────────────────────────────────────────────
// Letters displayed to the teacher/student, indexed by position (0-based).
// Position is what gets stored in the DB (as a 1-based string: "1","2",...).
export const CHOICE_LETTERS = {
    en: ['A', 'B', 'C', 'D', 'E', 'F'],
    ar: ['أ', 'ب', 'ج', 'د', 'هـ', 'و'],
};

// Convert a displayed letter ("A" or "أ") → stored position string ("1","2",...)
// Returns null if the letter is not recognised.
export function letterToPosition(letter, lang) {
    const letters = CHOICE_LETTERS[lang] || CHOICE_LETTERS.en;
    const idx = letters.indexOf(String(letter).trim());
    if (idx === -1) {
        // Try the other language as fallback
        const other = CHOICE_LETTERS[lang === 'ar' ? 'en' : 'ar'];
        const idx2 = other.indexOf(String(letter).trim());
        return idx2 === -1 ? null : String(idx2 + 1);
    }
    return String(idx + 1);
}

// Convert a stored position string ("1","2",...) → displayed letter ("A" or "أ")
export function positionToLetter(position, lang) {
    const idx = parseInt(position, 10) - 1;
    if (isNaN(idx) || idx < 0) return position; // fallback: return as-is
    const letters = CHOICE_LETTERS[lang] || CHOICE_LETTERS.en;
    return letters[idx] ?? position;
}

// ── UI label translations ─────────────────────────────────────────────────────
// UI label translations
export const UI_LABELS = {
    dashboard: { en: 'Dashboard', ar: 'لوحة التحكم' },
    teachers: { en: 'Teachers', ar: 'المعلمون' },
    students: { en: 'Students', ar: 'الطلاب' },
    classes: { en: 'Classes', ar: 'الصفوف' },
    subjects: { en: 'Subjects', ar: 'المواد' },
    exams: { en: 'Exams', ar: 'الامتحانات' },
    attendance: { en: 'Attendance', ar: 'الحضور' },
    schedule: { en: 'Schedule', ar: 'الجدول' },
    notifications: { en: 'Notifications', ar: 'الإشعارات' },
    reports: { en: 'Reports', ar: 'التقارير' },
    employees: { en: 'Employees', ar: 'الموظفون' },
    supervisors: { en: 'Supervisors', ar: 'المشرفون' },
    assignments: { en: 'Assignments', ar: 'التعيينات' },
    myClasses: { en: 'My Classes', ar: 'صفوفي' },
    editMarks: { en: 'Edit Marks', ar: 'تعديل العلامات' },
    videos: { en: 'Videos', ar: 'الفيديوهات' },
    search: { en: 'Search...', ar: 'بحث...' },
    save: { en: 'Save', ar: 'حفظ' },
    cancel: { en: 'Cancel', ar: 'إلغاء' },
    delete: { en: 'Delete', ar: 'حذف' },
    add: { en: 'Add', ar: 'إضافة' },
    edit: { en: 'Edit', ar: 'تعديل' },
    upload: { en: 'Upload', ar: 'رفع' },
    download: { en: 'Download', ar: 'تحميل' },
    submit: { en: 'Submit', ar: 'إرسال' },
    loading: { en: 'Loading...', ar: 'جار التحميل...' },
    noData: { en: 'No data available', ar: 'لا توجد بيانات' },
    name: { en: 'Name', ar: 'الاسم' },
    email: { en: 'email', ar: 'البريد' },
    mobile: { en: 'Mobile', ar: 'الجوال' },
    type: { en: 'Type', ar: 'النوع' },
    class: { en: 'Class', ar: 'الصف' },
    section: { en: 'Section', ar: 'الشعبة' },
    subject: { en: 'Subject', ar: 'المادة' },
    exam: { en: 'Exam', ar: 'الامتحان' },
    semester: { en: 'Semester', ar: 'الفصل الدراسي' },
    stage: { en: 'Stage', ar: 'المرحلة' },
    division: { en: 'Division', ar: 'القسم' },
    curriculum: { en: 'Curriculum', ar: 'المنهج' },
    branch: { en: 'Branch', ar: 'الفرع' },
    school: { en: 'School', ar: 'المدرسة' },
    student: { en: 'Student', ar: 'طالب' },
    teacher: { en: 'Teacher', ar: 'معلم' },
    supervisor: { en: 'Supervisor', ar: 'مشرف' },
    admin: { en: 'Admin', ar: 'مسؤول' },
    actions: { en: 'Actions', ar: 'الإجراءات' },
    status: { en: 'Status', ar: 'الحالة' },
    total: { en: 'Total:', ar: 'الإجمالي:' },
    average: { en: 'Average', ar: 'المعدل' },
    grade: { en: 'Grade', ar: 'الصف' },
    mark: { en: 'Mark', ar: 'العلامة' },
    pass: { en: 'Pass', ar: 'ناجح' },
    fail: { en: 'Fail', ar: 'راسب' },
    completed: { en: 'Completed', ar: 'مكتمل' },
    marked: { en: 'Marked', ar: 'مرصود' },
    submitted: { en: 'Submitted', ar: 'مُرسل' },
    cancelled: { en: 'Cancelled', ar: 'ملغي' },
    inProgress: { en: 'In Progress', ar: 'قيد التنفيذ' },
    new: { en: 'New', ar: 'جديد' },
    logout: { en: 'Logout', ar: 'تسجيل الخروج' },
    welcome: { en: 'Welcome', ar: 'مرحباً' },
    password: { en: 'Password', ar: 'كلمة المرور' },
    login: { en: 'Login', ar: 'تسجيل الدخول' },
    allClasses: { en: 'All Classes', ar: 'كل الصفوف' },
    allSections: { en: 'All Sections', ar: 'جميع الشعب' },
    allSubjects: { en: 'All Subjects', ar: 'كل المواد' },
    allExams: { en: 'All Exams', ar: 'كل الامتحانات' },
    allSemesters: { en: 'All Semesters', ar: 'كل الفصول' },
    allStages: { en: 'All Stages', ar: 'كل المراحل' },
    allDivisions: { en: 'All Divisions', ar: 'جميع الأقسام' },
    allCurriculums: { en: 'All Curriculums', ar: 'جميع المناهج' },
    allEmployees: { en: 'All Employees', ar: 'كل الموظفين' },
    allStudents: { en: 'All Students', ar: 'كل الطلاب' },
    applyFilters: { en: 'Apply', ar: 'تطبيق' },
    resetFilters: { en: 'Reset', ar: 'إعادة تعيين' },
    markDistribution: { en: 'Marks Distribution', ar: 'توزيع الدرجات' },
    totalStudents: { en: 'Total Students', ar: 'إجمالي الطلاب' },
    mySections: { en: 'My Sections', ar: 'شعبي' },
    mySubjects: { en: 'My Subjects', ar: 'موادي' },
    parentName: { en: 'Parent Name', ar: 'اسم ولي الأمر' },
    parentMobile: { en: 'Parent Mobile', ar: 'جوال ولي الأمر' },
    position: { en: 'Position', ar: 'المهنة' },
    comingSoon: { en: 'Coming Soon', ar: 'قريباً' },
    uploadMarks: { en: 'Upload Marks', ar: 'رفع العلامات' },
    defineQuestions: { en: 'Define Questions', ar: 'تحديد الأسئلة' },
    enrollStudent: { en: 'Enroll Student', ar: 'تسجيل طالب' },
    previousMarks: { en: 'Previous Marks', ar: 'العلامات السابقة' },
    question: { en: 'Question', ar: 'السؤال' },
    maxMark: { en: 'Max Mark', ar: 'الدرجة القصوى' },
    videoUrl: { en: 'Video URL', ar: 'رابط الفيديو' },
    firstName: { en: 'First Name', ar: 'الاسم الأول' },
    fatherName: { en: "Father's Name", ar: 'اسم الأب' },
    grandfatherName: { en: "Grandfather's Name", ar: 'اسم الجد' },
    surname: { en: 'Surname', ar: 'اللقب' },
    selectAClass: { en: 'Select a class to view details, students, and marks.', ar: 'اختر صفا لعرض التفاصيل والطلاب والعلامات.' },
    myAssignedClasses: { en: 'My Assigned Classes', ar: 'السجلات المسندة لي' },
    examStatus: { en: 'Exam Status', ar: 'حالة الاختبار' },
    view: { en: 'View', ar: 'عرض' },
    totalMarks: { en: 'Total Marks', ar: 'إجمالي الدرجات' },
    classAverage: { en: 'Class Average', ar: 'متوسط الصف' },
    percentage: { en: 'Percentage', ar: 'النسبة المئوية' },
    selectExam: { en: '-- Select Exam --', ar: '-- اختر الامتحان --' },
    firstSemester: { en: 'First Semester', ar: 'الفصل الأول' },
    secondSemester: { en: 'Second Semester', ar: 'الفصل الثاني' },
    first: { en: 'First', ar: 'الأول' },
    second: { en: 'Second', ar: 'الثاني' },
    welcomeBack: { en: 'Welcome back', ar: 'مرحباً بعودتك' },
    dashboardOverview: { en: 'Here is your overview.', ar: 'إليك نظرة عامة.' },
    avgMark: { en: 'Avg Mark', ar: 'متوسط العلامة' },
    averageMarkByClasses: { en: 'Average Mark by Classes', ar: 'متوسط الدرجات حسب الصفوف' },
    markDistributionDetail: { en: 'Marks Distribution', ar: 'توزيع الدرجات' },
    attendanceByClasses: { en: 'Attendance by Classes', ar: 'الحضور حسب الصفوف' },
    weeklySchedule: { en: 'Weekly Schedule', ar: 'الجدول الأسبوعي' },
    noMarksRecorded: { en: 'No marks recorded yet', ar: 'لم يتم تسجيل درجات بعد' },
    filterBy: { en: 'Filter by', ar: 'تصفية حسب' },
    active: { en: 'active', ar: 'نشط' },
    requiredField: { en: 'Required field', ar: 'حقل مطلوب' },
    fillRequired: { en: 'Please fill in all required fields', ar: 'يرجى ملء جميع الحقول المطلوبة' },
    beforeApplying: { en: 'before applying the filter.', ar: 'قبل تطبيق الفلتر.' },
    required: { en: 'Required', ar: 'مطلوب' },
    thisFieldRequired: { en: 'This field is required', ar: 'هذا الحقل مطلوب' },
    studentsFilterPrompt: { en: 'Fill all filters and press Apply Filter to see students.', ar: 'املأ جميع الفلاتر واضغط على تطبيق لرؤية الطلاب.' },
    searchStudentPlaceholder: { en: 'Search student by name...', ar: 'بحث عن طالب بالاسم...' },
    studentFullName: { en: 'Student Full Name', ar: 'اسم الطالب كاملاً' },
    parentEmail: { en: 'Parent Email', ar: 'بريد ولي الأمر' },
    studentsEnrolledHeading: { en: 'Students enrolled in your classes', ar: 'الطلاب المسجلون في صفوفك' },
    allFieldsRequiredDesc: { en: 'All fields marked * are required', ar: 'جميع الحقول التي تحمل علامة * مطلوبة' },
    applyFilter: { en: 'Apply Filter', ar: 'تطبيق الفلتر' },
    filterStudents: { en: 'Filter Students', ar: 'فلترة الطلاب' },
    reset: { en: 'Reset', ar: 'إعادة تعيين' },
    manageExams: { en: 'Manage exams and grading submissions.', ar: 'إدارة الامتحانات وتسليم الدرجات.' },
    createNewExam: { en: 'Create New Exam', ar: 'إنشاء امتحان جديد' },
    studentScoresDistribution: { en: 'Student Exam Scores Distribution', ar: 'توزيع درجات الطلاب في الامتحان' },
    scoreFrequencyDesc: { en: 'Frequency of scores across all students in the filtered exams', ar: 'تكرار الدرجات عبر جميع الطلاب في الامتحانات المحددة' },
    examsDirectory: { en: 'Exams Directory', ar: 'دليل الامتحانات' },
    pressApplyToLoad: { en: 'Press Apply Filter to load data.', ar: 'اضغط على تطبيق الفلتر لتحميل البيانات.' },
    marksEntered: { en: 'Marks Entered', ar: 'الدرجات المدخلة' },
    startGrading: { en: 'Start Grading', ar: 'بدء التصحيح' },
    studentResults: { en: 'Student Results', ar: 'نتائج الطلاب' },
    marksBreakdownDesc: { en: 'Marks breakdown for the selected exam', ar: 'تفصيل الدرجات للامتحان المحدد' },
    passRate: { en: 'Pass Rate', ar: 'نسبة النجاح' },
    highest: { en: 'Highest', ar: 'الأعلى' },
    lowest: { en: 'Lowest', ar: 'الأدنى' },
    borderline: { en: 'Borderline', ar: 'درجة حرجة' },
    showing: { en: 'Showing', ar: 'عرض' },
    noExamsFound: { en: 'No exams found.', ar: 'لا توجد امتحانات.' },
    deleteExam: { en: 'Delete Exam', ar: 'حذف الامتحان' },
    deleteExamDesc: { en: 'This will delete the exam and all related data.', ar: 'سيؤدي هذا إلى حذف الامتحان وجميع البيانات المتعلقة به.' },
    noMarksEnteredYet: { en: 'No marks entered yet for this exam', ar: 'لم يتم إدخال درجات لهذا الامتحان بعد' },
    of: { en: 'of', ar: 'من' },
    loadingMarks: { en: 'Loading marks...', ar: 'جاري تحميل الدرجات...' },
    searchExamsPlaceholder: { en: 'Search by subject, teacher, exam...', ar: 'بحث بالمادة، المعلم، الامتحان...' },
    max: { en: 'Max', ar: 'الحد الأقصى' },
    questionShort: { en: 'Q', ar: 'س' },
    manageVideosDesc: { en: 'Manage videos attached to exam questions.', ar: 'إدارة الفيديوهات المرفقة لأسئلة الامتحان.' },
    allFieldsRequired: { en: 'All fields are required', ar: 'جميع الحقول مطلوبة' },
    choose: { en: '-- Choose --', ar: '-- اختر --' },
    showVideos: { en: 'Show Videos', ar: 'عرض الفيديوهات' },
    videosPrompt: { en: 'Fill all filters and click "Show Videos".', ar: 'املأ جميع الفلاتر واضغط على عرض الفيديوهات.' },
    searching: { en: 'Searching...', ar: 'جاري البحث...' },
    videosTable: { en: 'Questions & Videos', ar: 'الأسئلة والفيديوهات' },
    questionid: { en: 'Q#', ar: 'رقم السؤال' },
    noVideo: { en: 'No Video', ar: 'لا يوجد فيديو' },
    lock: { en: 'Lock', ar: 'قفل' },
    locked: { en: 'Locked', ar: 'مقفل' },
    unlock: { en: 'Unlock', ar: 'فتح' },
    url: { en: 'URL', ar: 'رابط' },
    uploadGrades: { en: 'Upload Grades', ar: 'رفع الدرجات' },
    mustBe0orAbove: { en: 'Must be 0 or above', ar: 'يجب أن يكون 0 أو أكثر' },
    maxIs: { en: 'Max is', ar: 'الحد الأقصى هو' },
    totalInClass: { en: 'Total in class', ar: 'الإجمالي في الصف' },
    inThisExam: { en: 'In this exam', ar: 'في هذا الامتحان' },
    inprogress: { en: 'In-progress', ar: 'قيد التنفيذ' },
    uploadStatus: { en: 'Upload status', ar: 'حالة الرفع' },
    dragAndDrop: { en: 'Drag and drop file here or click to browse', ar: 'اسحب وأفلت الملف هنا أو انقر للتصفح' },
    supportedFormat: { en: 'Supported format: .csv', ar: 'التنسيق المدعوم: .csv' },
    chooseCsv: { en: 'Choose CSV', ar: 'اختر ملف CSV' },
    downloadTemplate: { en: 'Download Template', ar: 'تحميل النموذج' },
    manualEntry: { en: 'Manual Entry', ar: 'إدخال يدوي' },
    manualEntryDesc: { en: 'Question columns match the records that will be saved in studentanswers_tbl.', ar: 'أعمدة الأسئلة تطابق السجلات التي سيتم حفظها في جدول إجابات الطلاب.' },
    studentId: { en: 'Student ID', ar: 'رقم الطالب' },
    saveAllChanges: { en: 'Save All Changes', ar: 'حفظ جميع التغييرات' },
    editMarksDesc: { en: 'Select a class, section, subject and exam to edit student marks.', ar: 'اختر الصف، الشعبة، المادة والامتحان لتعديل درجات الطلاب.' },
    searchStudentByName: { en: 'Search by student name...', ar: 'بحث باسم الطالب...' },
    pleaseFillAllRequired: { en: 'Please fill all required fields *', ar: 'يرجى ملء جميع الحقول المطلوبة *' },
    savedCountPart1: { en: 'Saved', ar: 'تم حفظ' },
    savedCountPart2: { en: 'records!', ar: 'سجل!' },
    createExamFirstError: { en: 'Error: Create the exam first before entering marks.', ar: 'خطأ: يجب إنشاء الامتحان أولاً قبل إدخال الدرجات.' },
    selectAllRequiredError: { en: 'Please select all required fields before loading marks.', ar: 'يرجى تحديد جميع الحقول المطلوبة قبل تحميل الدرجات.' },
    noStudentsEnrolled: { en: 'No students enrolled.', ar: 'لا يوجد طلاب مسجلون.' },
    noQuestionsFound: { en: 'No questions found. Please create questions first.', ar: 'لا توجد أسئلة. يرجى إنشاء الأسئلة أولاً.' },
    applying: { en: 'Applying...', ar: 'جاري التطبيق...' },
    selectClass: { en: 'Select Class', ar: 'اختر الصف' },
    selectSection: { en: 'Select Section', ar: 'اختر الشعبة' },
    selectDivision: { en: 'Select Division', ar: 'اختر القسم' },
    selectCurriculum: { en: 'Select Curriculum', ar: 'اختر المنهج' },
    selectSubject: { en: '-- Select Subject --', ar: '-- اختر المادة --' },
    selectExamDefault: { en: '-- Select Exam --', ar: '-- اختر الامتحان --' },
    saving: { en: 'Saving...', ar: 'جاري الحفظ...' },
    preview: { en: 'Preview', ar: 'معاينة' },
    uploading: { en: 'Uploading...', ar: 'جاري الرفع...' },
    progress: { en: 'Progress', ar: 'التقدم' },
    questions: { en: 'Questions', ar: 'الأسئلة' },
    myTeachers: { en: 'My Teachers', ar: 'معلميني' },
    totalClasses: { en: 'Total Classes', ar: 'إجمالي الصفوف' },
    totalSections: { en: 'Total Sections', ar: 'إجمالي الشعب' },
    totalSubjects: { en: 'Total Subjects', ar: 'إجمالي المواد' },
    topPerformingClasses: { en: 'Top Performing Classes', ar: 'الفصول الأعلى أداءً' },
    studentsPerClass: { en: 'Students per Class', ar: 'الطلاب لكل صف' },
    noClassData: { en: 'No class data', ar: 'لا توجد بيانات للفصول' },
    noExamData: { en: 'No exam data yet', ar: 'لا توجد بيانات امتحانات بعد' },
    avgMarks: { en: 'Avg Marks', ar: 'متوسط الدرجات' },
    passed: { en: 'Passed', ar: 'ناجح' },
    took: { en: 'Took', ar: 'تقدم' },
    studentsUnderSupervision: { en: 'All enrolled students in supervised sections', ar: 'جميع الطلاب المسجلين في الشعب التي تشرف عليها' },
    teachersUnderSupervision: { en: 'Teachers under your supervision', ar: 'المعلمون تحت إشرافك' },
    examsUnderSupervision: { en: 'All exams in supervised sections', ar: 'جميع الامتحانات في الشعب التي تشرف عليها' },
    searchStudentsPlaceholder: { en: 'Search student...', ar: 'بحث عن طالب...' },
    searchTeachersPlaceholder: { en: 'Search by name or subject...', ar: 'بحث بالاسم أو المادة...' },
    parent: { en: 'Parent', ar: 'ولي الأمر' },
    notAssigned: { en: 'Not assigned', ar: 'غير مسند' },
    id: { en: 'ID', ar: 'الرقم' },
    attendanceOverview: { en: 'Attendance overview across supervised classes', ar: 'نظرة عامة على الحضور عبر الصفوف الخاضعة للإشراف' },
    attendanceByClass: { en: 'Attendance by Class', ar: 'الحضور بحسب الصف' },
    attendanceRatePerSection: { en: 'Attendance rate per class section', ar: 'معدل الحضور لكل شعبة' },
    attendanceComingSoonDesc: { en: 'The Attendance module is currently under development.', ar: 'وحدة الحضور قيد التطوير حالياً.' },
    performance: { en: 'Performance', ar: 'الأداء' },
    details: { en: 'Details', ar: 'التفاصيل' },
    reportsDesc: { en: 'Performance analysis and comparisons', ar: 'تحليل الأداء والمقارنات' },
    studentEnrollmentByClass: { en: 'Student Enrollment by Class', ar: 'تسجيل الطلاب حسب الصف' },
    enrollmentSubtitle: { en: 'Number of enrolled students per class-section', ar: 'عدد الطلاب المسجلين لكل شعبة' },
    noEnrollmentData: { en: 'No enrollment data found to display', ar: 'لا توجد بيانات تسجيل لعرضها' },
    subjectsAssignedPerClass: { en: 'Subjects Assigned Per Class', ar: 'المواد المسندة لكل صف' },
    subjectsSubtitle: { en: 'How many subjects are linked to each class-section', ar: 'عدد المواد المرتبطة بكل شعبة' },
    noSubjectAssignments: { en: 'No subject assignments yet', ar: 'لا توجد تعيينات مواد بعد' },
    examsCentral: { en: 'Admin Exams Control', ar: 'التحكم في الامتحانات' },
    manageExamsDesc: { en: 'Oversee all exams created by teachers and system assignments', ar: 'الإشراف على جميع الامتحانات المنشأة من قبل المعلمين وتكليفات النظام' },
    examsCreatedByTeachers: { en: 'Exams listed here are created by Teachers for their respective classes.', ar: 'الامتحانات المدرجة هنا يتم إنشاؤها من قبل المعلمين لفصولهم المعنية.' },
    action: { en: 'Action', ar: 'إجراء' },
    deleteExamEntry: { en: 'Delete Exam Entry', ar: 'حذف مدخل الامتحان' },
    deleteExamConfirm: { en: 'Are you sure you want to delete this exam entry?', ar: 'هل أنت متأكد من حذف سجل هذا الامتحان؟' },
    examEntryDeleted: { en: 'Exam entry removed successfully', ar: 'تم حذف مدخل الامتحان بنجاح' },
    searchAdminExamsPlaceholder: { en: 'Search by subject, teacher, class...', ar: 'بحث بالمادة، المعلم، الصف...' },
    manageSupervisorsDesc: { en: 'Manage all school supervisors and stage assignments', ar: 'إدارة جميع مشرفي المدرسة وتكليفات المراحل' },
    uploadCsv: { en: 'Upload CSV', ar: 'رفع ملف CSV' },
    addSupervisor: { en: 'Add Supervisor', ar: 'إضافة مشرف' },
    searchSupervisorsPlaceholder: { en: 'Search by ID, name or email...', ar: 'بحث بالرقم أو الاسم أو البريد...' },
    supervisorCreated: { en: 'Supervisor created! Default password: Change@1234', ar: 'تم إنشاء المشرف! كلمة المرور الافتراضية: Change@1234' },
    supervisorUpdated: { en: 'Supervisor updated.', ar: 'تم تحديث المشرف.' },
    supervisorDeleted: { en: 'Supervisor deleted.', ar: 'تم حذف المشرف.' },
    deleteSupervisorConfirm: { en: 'Are you sure you want to delete this supervisor?', ar: 'هل أنت متأكد أنك تريد حذف هذا المشرف؟' },
    deleteSupervisorTitle: { en: 'Delete Supervisor', ar: 'حذف المشرف' },
    arabicName: { en: 'Arabic Name', ar: 'الاسم بالعربية' },
    englishName: { en: 'English Name', ar: 'الاسم بالإنجليزية' },
    fromAssignments: { en: 'From assignments', ar: 'من التكليفات' },
    invalidRows: { en: 'Invalid Row(s) — Nothing uploaded. Fix and re-upload.', ar: 'صفوف غير صالحة - لم يتم رفع شيء. صحح الأخطاء وأعد الرفع.' },
    dismiss: { en: 'Dismiss', ar: 'تجاهل' },
    row: { en: 'Row', ar: 'الصف' },
    assignedStage: { en: 'Assigned Stage', ar: 'المرحلة المعينة' },
    for: { en: 'for', ar: 'لـ' },
    manageTeachersDesc: { en: 'Manage all school teachers and their assignments', ar: 'إدارة جميع معلمي المدرسة وتكليفاتهم' },
    teacherCreated: { en: 'Teacher created! Default password: Change@1234', ar: 'تم إنشاء المعلم! كلمة المرور الافتراضية: Change@1234' },
    teacherUpdated: { en: 'Teacher updated!', ar: 'تم تحديث المعلم!' },
    teacherDeleted: { en: 'Teacher deleted.', ar: 'تم حذف المعلم.' },
    deleteTeacherTitle: { en: 'Delete Teacher', ar: 'حذف المعلم' },
    deleteTeacherConfirm: { en: 'Are you sure you want to delete this teacher?', ar: 'هل أنت متأكد أنك تريد حذف هذا المعلم؟' },
    createNewTeacher: { en: 'Create New Teacher', ar: 'إنشاء معلم جديد' },
    arabicNameLabel: { en: 'Arabic Name', ar: 'الاسم بالعربية' },
    englishNameLabel: { en: 'English Name', ar: 'الاسم بالإنجليزية' },
    emailAddressLabel: { en: 'Email Address', ar: 'البريد الإلكتروني' },
    mobileNumberLabel: { en: 'Mobile Number', ar: 'رقم الجوال' },
    areRequired: { en: 'are required', ar: 'مطلوبة' },
    defaultPasswordNote: { en: 'A password will be automatically generated and sent to this email.', ar: 'سيتم إنشاء كلمة مرور تلقائياً وإرسالها إلى هذا البريد.' },
    createTeacher: { en: 'Create Teacher', ar: 'إنشاء معلم' },
    searchTeachersAdminPlaceholder: { en: 'Search by ID, name or email...', ar: 'بحث بالرقم أو الاسم أو البريد...' },
    manageStudentsDesc: { en: 'Manage student enrollment and records', ar: 'إدارة تسجيل الطلاب والسجلات' },
    searchStudentsAdminPlaceholder: { en: 'Search student by name or ID...', ar: 'بحث عن طالب بالاسم أو الرقم...' },
    studentEnrolled: { en: 'Student enrolled.', ar: 'تم تسجيل الطالب.' },
    studentsCsvUploaded: { en: 'Students CSV uploaded.', ar: 'تم رفع ملف الطلاب CSV.' },
    studentNameFields: { en: 'Student Name Fields', ar: 'حقول اسم الطالب' },
    firstNameAr: { en: 'First Name (Arabic)', ar: 'الاسم الأول (بالعربية)' },
    firstNameEn: { en: 'First Name (English)', ar: 'الاسم الأول (بالإنجليزية)' },
    fatherNameAr: { en: "Father's Name (Arabic)", ar: 'اسم الأب (بالعربية)' },
    fatherNameEn: { en: "Father's Name (English)", ar: 'اسم الأب (بالإنجليزية)' },
    grandfatherNameAr: { en: "Grandfather's Name (Arabic)", ar: 'اسم الجد (بالعربية)' },
    grandfatherNameEn: { en: "Grandfather's Name (English)", ar: 'اسم الجد (بالإنجليزية)' },
    surnameAr: { en: 'Surname (Arabic)', ar: 'اللقب (بالعربية)' },
    surnameEn: { en: 'Surname (English)', ar: 'اللقب (بالإنجليزية)' },
    studentContact: { en: 'Student Contact Information', ar: 'معلومات اتصال الطالب' },
    parentGuardian: { en: 'Parent / Guardian details', ar: 'تفاصيل ولي الأمر / الوصي' },
    parentNameAr: { en: 'Parent Name (Arabic)', ar: 'اسم ولي الأمر (بالعربية)' },
    parentNameEn: { en: 'Parent Name (English)', ar: 'اسم ولي الأمر (بالإنجليزية)' },
    parentPosition: { en: 'Parent Position / Relationship', ar: 'صلة القرابة / الوظيفة' },
    classAssignment: { en: 'Class & Level Assignment', ar: 'تعيين الصف والمستوى' },
    selectStage: { en: 'Select Stage', ar: 'اختر المرحلة' },
    saveChanges: { en: 'Save Changes', ar: 'حفظ التغييرات' },
    editStudent: { en: 'Edit Student', ar: 'تعديل بيانات الطالب' },
    studentNameClassReq: { en: 'Student name, class, section, and stage are required.', ar: 'اسم الطالب والصف والشعبة والمرحلة مطلوبة.' },
    editingInSidePanel: { en: 'Editing in side panel →', ar: 'جاري التعديل في اللوحة الجانبية ←' },
    and: { en: 'and', ar: 'و' },
    enrollNewStudent: { en: 'Enroll New Student', ar: 'تسجيل طالب جديد' },
    backToStudents: { en: 'Back to Students', ar: 'العودة للطلاب' },
    fillStudentDetails: { en: 'Please fill in all the student and parent details accurately.', ar: 'يرجى ملء جميع تفاصيل الطالب ولي الأمر بدقة.' },
    studentEnrolledSuccess: { en: 'Student enrolled successfully.', ar: 'تم تسجيل الطالب بنجاح.' },
    failedToLoadForms: { en: 'Failed to load form data.', ar: 'فشل في تحميل بيانات النموذج.' },
    loadingFormData: { en: 'Loading form data...', ar: 'جاري تحميل بيانات النموذج...' },
    occupation: { en: 'Occupation', ar: 'المهنة' },
    studentFirstNameReq: { en: 'Student first name, class, section and stage are required.', ar: 'الاسم الأول والصف والشعبة والمرحلة مطلوبة.' },
    allGradesInBranch: { en: 'All grades and sections registered in this branch', ar: 'جميع الصفوف والشعب المسجلة في هذا الفرع' },
    classesTemplate: { en: 'school_classes_template.csv', ar: 'نموذج_صفوف_المدرسة.csv' },
    newClass: { en: 'New Class', ar: 'صف جديد' },
    searchClassesPlaceholder: { en: 'Search class by classes number...', ar: 'بحث بالصف أو الرقم...' },
    classAdded: { en: 'Class and section added successfully', ar: 'تم إضافة الصف والشعبة بنجاح' },
    classesCsvUploaded: { en: 'Classes imported successfully', ar: 'تم استيراد الصفوف بنجاح' },
    classRowDeleted: { en: 'Assignment removed', ar: 'تم حذف التكليف' },
    classHasStudents: { en: 'Cannot delete this class because it still has students enrolled. Please remove all students from this class first.', ar: 'لا يمكن حذف هذا الصف لأنه يحتوي على طلاب مسجلين. يرجى إزالة جميع الطلاب من هذا الصف أولاً.' },
    classNameReq: { en: 'Class name, section, and stage are required.', ar: 'اسم الصف والشعبة والمرحلة مطلوبة.' },
    studentsBadge: { en: 'Students', ar: 'الطلاب' },
    academicCurriculum: { en: 'Manage school subjects and curriculum details', ar: 'إدارة مواد المدرسة وتفاصيل المنهج' },
    subjectsTemplate: { en: 'school_subjects_template.csv', ar: 'نموذج_مواد_المدرسة.csv' },
    addSubject: { en: 'Add Subject', ar: 'إضافة مادة' },
    searchSubjectsPlaceholder: { en: 'Search by subject name...', ar: 'بحث باسم المادة...' },
    subjectsDirectory: { en: 'Subjects Directory', ar: 'دليل المواد' },
    subjectEn: { en: 'English Name', ar: 'الاسم بالإنجليزية' },
    subjectAr: { en: 'Arabic Name', ar: 'الاسم بالعربية' },
    subjectAdded: { en: 'Subject added successfully', ar: 'تم إضافة المادة بنجاح' },
    subjectsCsvUploaded: { en: 'Subjects imported successfully', ar: 'تم استيراد المواد بنجاح' },
    subjectUpdated: { en: 'Subject updated.', ar: 'تم تحديث المادة.' },
    subjectDeleted: { en: 'Subject removed', ar: 'تم حذف المادة' },
    subjectNamesReq: { en: 'Please enter both Arabic and English names', ar: 'يرجى إدخال الاسمين بالعربي والإنجليزي' },
    manageSchoolAssignments: { en: 'Manage all school assignments for students, subjects, and staff', ar: 'إدارة جميع تكليفات المدرسة للطلاب والمواد والموظفين' },
    addAssignment: { en: 'Add Assignment', ar: 'إضافة تكليف' },
    studentsToClasses: { en: 'Assign Students to Classes', ar: 'توزيع الطلاب على الصفوف' },
    subjectsToClasses: { en: 'Assign Subjects to Classes', ar: 'توزيع المواد على الصفوف' },
    supervisorsToStages: { en: 'Assign Supervisors to Stages', ar: 'توزيع المشرفين على المراحل' },
    teachersToClasses: { en: 'Assign Teachers to Classes', ar: 'توزيع المعلمين على الصفوف' },
    assignmentAdded: { en: 'Assignment added successfully', ar: 'تم إضافة التكليف بنجاح' },
    studentAssigned: { en: 'Student assigned successfully', ar: 'تم تعيين الطالب بنجاح' },
    assignmentUpdated: { en: 'Assignment updated successfully', ar: 'تم تحديث التكليف بنجاح' },
    pleaseFillAllFields: { en: 'Please fill all required fields', ar: 'يرجى ملء جميع الحقول المطلوبة' },
    selectStudent: { en: 'Select Student', ar: 'اختر الطالب' },
    noAssignments: { en: 'No assignments found in this category', ar: 'لا توجد تكليفات في هذه الفئة' },
    rows: { en: 'rows', ar: 'صفوف' },
    attendanceModuleUnderDevelopment: { en: 'The Attendance module is currently under development and will be available soon.', ar: 'وحدة الحضور حالياً قيد التطوير وستكون متاحة قريباً.' },
    stayUpdated: { en: 'Stay updated with school activities and alerts', ar: 'ابق على اطلاع بأنشطة المدرسة والتنبيهات' },
    noNotificationsYet: { en: 'No notifications yet', ar: 'لا توجد تنبيهات بعد' },
    allCaughtUp: { en: "You're all caught up! New notifications will appear here.", ar: 'لقد شاهدت كل شيء! ستظهر التنبيهات الجديدة هنا.' },
    performAnalysis: { en: 'Analyze school performance and student data', ar: 'تحليل أداء المدرسة وبيانات الطلاب' },
    numStudentsPerClass: { en: 'Number of active students per class section', ar: 'عدد الطلاب النشطين لكل شعبة' },
    numSubjectsLinked: { en: 'Count of subjects linked to each class section', ar: 'عدد المواد المرتبطة بكل شعبة' },
    noSubjectData: { en: 'No subject assignment data found', ar: 'لا توجد بيانات إسناد مواد' },
    sectionComparison: { en: 'Section Comparison', ar: 'مقارنة الشعب' },
    compareStudentsSubjects: { en: 'Compare student counts and subjects between two sections', ar: 'قارن أعداد الطلاب والمواد بين شعبتين' },
    needAtLeastTwo: { en: 'Need at least two sections to perform comparison', ar: 'تحتاج لشعبتين على الأقل لإجراء المقارنة' },
    exportEnrollmentReport: { en: 'Export Enrollment Report', ar: 'تصدير تقرير التسجيل' },
    exportSubjectReport: { en: 'Export Subject Report', ar: 'تصدير تقرير المواد' },
    studentCountsPdf: { en: 'Student counts across all classes in PDF', ar: 'أعداد الطلاب في جميع الصفوف بصيغة PDF' },
    subjectAssignmentsPdf: { en: 'Full subject assignments list in PDF', ar: 'قائمة إسناد المواد الكاملة بصيغة PDF' },
    manageStaffAccounts: { en: 'Manage all school staff accounts', ar: 'إدارة جميع حسابات موظفي المدرسة' },
    addEmployee: { en: 'Add Employee', ar: 'إضافة موظف' },
    totalEmployees: { en: 'Total Employees', ar: 'إجمالي الموظفين' },
    role: { en: 'Role', ar: 'الدور' },
    clickToAdd: { en: 'click to add', ar: 'اضغط للإضافة' },
    loadingSubjectDetails: { en: 'Loading subject details...', ar: 'جاري تحميل تفاصيل المادة...' },
    backToSubjects: { en: 'Back to Subjects', ar: 'العودة لمادة' },
    totalTeachers: { en: 'Total Teachers', ar: 'إجمالي المعلمين' },
    assignedTeachers: { en: 'Assigned Teachers', ar: 'المعلمون المكلفون' },
    assignedClasses: { en: 'Assigned Classes', ar: 'الصفوف المكلفة' },
    noTeachersAssigned: { en: 'No teachers assigned to this subject yet.', ar: 'لم يتم تكليف معلمين لهذه المادة بعد.' },
    noClassesAssigned: { en: 'No classes assigned to this subject.', ar: 'لا توجد صفوف مكلفة لـ هذه المادة.' },
    performanceByClass: { en: 'Performance by Class', ar: 'الأداء حسب الصف' },
    showingEnrollment: { en: 'Showing student enrollment counts per assigned section', ar: 'عرض أعداد الطلاب لكل شعبة مكلفة' },
    noDataToDisplay: { en: 'No enrollment data to display.', ar: 'لا توجد بيانات تسجيل لعرضها.' },
    backToClasses: { en: 'Back to Classes', ar: 'العودة للصفوف' },
    manageClassDetails: { en: 'Oversee sections, students, and curriculum for this grade', ar: 'الإشراف على الشعب والطلاب والمنهج لهذا الصف' },
    classSections: { en: 'Class Sections', ar: 'شعب الصف' },
    addSection: { en: 'Add Section', ar: 'إضافة شعبة' },
    viewStudents: { en: 'View Students', ar: 'عرض الطلاب' },
    searchStudent: { en: 'Search student...', ar: 'البحث عن طالب...' },
    curriculumForClass: { en: 'Curriculum for', ar: 'المنهج لـ' },
    default: { en: 'Default', ar: 'افتراضي' },
    vs: { en: 'vs', ar: 'مقابل' },
    userAccounts: { en: 'User Accounts', ar: 'حسابات المستخدمين' },
    back: { en: 'Back', ar: 'رجوع' },
    selectType: { en: 'Select Type', ar: 'اختر النوع' },
    searchByNameOrEmail: { en: 'Search by name or email', ar: 'بحث بالاسم أو البريد' },
    numRows: { en: 'Showing', ar: 'عرض' },
    monitorUsersDesc: { en: 'Monitor system users and security credentials', ar: 'مراقبة مستخدمي النظام وصلاحيات الأمان' },
    searchUsers: { en: 'Search users...', ar: 'البحث عن المستخدمين...' },
    allRoles: { en: 'All Roles', ar: 'جميع الأدوار' },
    adminNotePassword: { en: 'Administrative Note: Main admin passwords can only be changed via the security console.', ar: 'ملاحظة إدارية: يمكن تغيير كلمات مرور المسؤول الرئيسي فقط من خلال وحدة التحكم الأمنية.' },
    subjectNotFound: { en: 'Subject not found', ar: 'المادة غير موجودة' },
    studentCount: { en: 'Student Count', ar: 'عدد الطلاب' },
    Attendance:         { en: 'Attendance',           ar: 'الحضور' },
    Exams:              { en: 'Exams',                ar: 'الامتحانات' },
    Schedule:           { en: 'Schedule',             ar: 'الجدول' },
    allTypes:           { en: 'All Types',            ar: 'جميع الأنواع' },
    assignedTeacher:    { en: 'Assigned Teacher',     ar: 'المعلم المعيّن' },
    assignedTo:         { en: 'Assigned to',          ar: 'مسنَد إلى' },
    chooseExam:         { en: 'Choose Exam',          ar: 'اختر الامتحان' },
    className:          { en: 'Class Name',           ar: 'اسم الصف' },
    deleteSuccess:      { en: 'Deleted successfully', ar: 'تم الحذف بنجاح' },
    in:                 { en: 'in',                   ar: 'في' },
    pressApplyToFilter: { en: 'Press Apply to filter', ar: 'اضغط تطبيق للتصفية' },
    removed:            { en: 'Removed',              ar: 'تمت الإزالة' },
    savingChanges:      { en: 'Saving changes…',      ar: 'جار حفظ التغييرات…' },
    sections:           { en: 'Sections',             ar: 'الشعب' },
    studentsTable:      { en: 'Students Table',       ar: 'جدول الطلاب' },
    toLoadSupervisors:  { en: 'Failed to load supervisors', ar: 'فشل تحميل المشرفين' },
    updateSuccess:      { en: 'Updated successfully', ar: 'تم التحديث بنجاح' },
    user:               { en: 'User',                 ar: 'المستخدم' },
    examUploadLockedMsg: { en: 'This exam status is {status}. Upload and manual entry are locked here. Please use Edit Marks.', ar: 'حالة هذا الامتحان هي {status}. رفع الملفات والإدخال اليدوي مغلقان هنا. يرجى استخدام تعديل العلامات.' },
    manualEntryLockedMsg: { en: 'Manual entry is locked for marked, submitted, and cancelled exams. Please use Edit Marks.', ar: 'الإدخال اليدوي مغلق للامتحانات المرصودة والمقدمة والملغاة. يرجى استخدام تعديل العلامات.' },
    profile: { en: 'Profile', ar: 'الملف الشخصي' },
    personalInfo: { en: 'Personal Information', ar: 'المعلومات الشخصية' },
    contactInfo: { en: 'Contact Information', ar: 'معلومات الاتصال' },
    roleInfo: { en: 'Role Information', ar: 'معلومات الدور' },
    uploadAvatar: { en: 'Upload Avatar', ar: 'رفع الصورة الشخصية' },
    removeAvatar: { en: 'Remove avatar', ar: 'إزالة الصورة الشخصية' },
    fullNameAr: { en: 'Full Name (Arabic)', ar: 'الاسم الكامل (بالعربي)' },
    fullNameEn: { en: 'Full Name (English)', ar: 'الاسم الكامل (بإنجليزي)' },
    profileUpdated: { en: 'Profile updated successfully.', ar: 'تم تحديث الملف الشخصي بنجاح.' },
    profileImageUpdated: { en: 'Profile image updated.', ar: 'تم تحديث الصورة الشخصية.' },
};


export function t(key, lang) {
    // If the exact key exists, try to return the translated string
    if (UI_LABELS[key]) {
        return UI_LABELS[key][lang] || UI_LABELS[key].en || key;
    }
    // As a fallback, try to find a key matching the raw English string (case-insensitive)
    const foundEntry = Object.entries(UI_LABELS).find(([_, value]) => 
        (value.en || '').toLowerCase() === (key || '').toLowerCase()
    );
    if (foundEntry) {
        return foundEntry[1][lang] || foundEntry[1].en || key;
    }
    return key;
}

// User-friendly error messages
export const getErrorMessage = (error, context = 'general') => {
  const message = error?.message || String(error) || 'Unknown error';

  // Duplicate key errors (must be checked before foreign key, since unique violations also contain 'violates')
  if (message.includes('duplicate key') || (message.includes('unique') && !message.includes('foreign'))) {
    if (message.includes('email')) {
      return 'This email address is already registered. Please use a different email.';
    }
    return 'This record already exists. Please check your entries.';
  }

  // Foreign key constraint errors
  if (message.includes('foreign key') || message.includes('violates')) {
    switch(context) {
      case 'deleteSubject':
        return 'This subject is in use and cannot be deleted. Please remove it from all classes and exams first.';
      case 'deleteTeacher':
        return 'This teacher is assigned to classes and cannot be deleted. Please reassign them first.';
      case 'deleteEmployee':
        return 'This employee is in use and cannot be deleted. Please remove all assignments first.';
      case 'deleteClass':
        return 'This class has students enrolled and cannot be deleted. Please transfer students first.';
      case 'deleteStudent':
        return 'This student has exam records and cannot be deleted. Please archive instead.';
      default:
        return 'This record is in use and cannot be deleted. Please remove dependencies first.';
    }
  }
  
  // Generic errors
  if (message.includes('not found') || message.includes('404')) {
    return 'The record was not found. Please refresh and try again.';
  }
  
  if (message.includes('permission') || message.includes('forbidden')) {
    return 'You do not have permission to perform this action.';
  }
  
  // Default fallback
  return 'An error occurred. Please try again or contact support.';
};