import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronRight, ArrowLeft } from 'lucide-react';
import { useLang } from '../context/LanguageContext';
import { t } from '../lib/langHelper';

// Bilingual route labels
const ROUTE_LABELS = {
    '/dashboard':              { en: 'Dashboard',         ar: 'لوحة التحكم' },
    '/classes':                { en: 'My Classes',         ar: 'صفوفي' },
    '/students':               { en: 'Students',           ar: 'الطلاب' },
    '/exams':                  { en: 'Exams',              ar: 'الامتحانات' },
    '/exams/create':           { en: 'Create Exam',        ar: 'إنشاء امتحان' },
    '/edit-marks':             { en: 'Edit Marks',         ar: 'تعديل العلامات' },
    '/videos':                 { en: 'Videos',             ar: 'الفيديوهات' },
    '/attendance':             { en: 'Attendance',         ar: 'الحضور' },
    '/schedule':               { en: 'Schedule',           ar: 'الجدول' },
    '/notifications':          { en: 'Notifications',      ar: 'الإشعارات' },
    '/supervisor/dashboard':   { en: 'Dashboard',          ar: 'لوحة التحكم' },
    '/supervisor/teachers':    { en: 'Teachers',           ar: 'المعلمون' },
    '/supervisor/students':    { en: 'Students',           ar: 'الطلاب' },
    '/supervisor/attendance':  { en: 'Attendance',         ar: 'الحضور' },
    '/supervisor/exams':       { en: 'Exams',             ar: 'الامتحانات' },
    '/supervisor/reports':     { en: 'Reports',            ar: 'التقارير' },
    '/admin/dashboard':        { en: 'Dashboard',          ar: 'لوحة التحكم' },
    '/admin/teachers':         { en: 'Teachers',           ar: 'المعلمون' },
    '/admin/employees':        { en: 'Employees',          ar: 'الموظفون' },
    '/admin/supervisors':      { en: 'Supervisors',        ar: 'المشرفون' },
    '/admin/students':         { en: 'Students',           ar: 'الطلاب' },
    '/admin/students/enroll':  { en: 'Enroll Student',     ar: 'تسجيل طالب' },
    '/admin/students/edit':    { en: 'Edit Student',       ar: 'تعديل بيانات الطالب' },
    '/admin/classes':          { en: 'Classes',            ar: 'الصفوف' },
    '/admin/subjects':         { en: 'Subjects',           ar: 'المواد' },
    '/admin/assignments':      { en: 'Assignments',        ar: 'التعيينات' },
    '/admin/attendance':       { en: 'Attendance',         ar: 'الحضور' },
    '/admin/exams':            { en: 'Exams',              ar: 'التحكم في الامتحانات' },
    '/admin/exams/create':     { en: 'Create Exam',        ar: 'إنشاء امتحان' },
    '/admin/exams/define':     { en: 'Define Questions',   ar: 'تحديد الأسئلة' },
    '/admin/reports':          { en: 'Reports',            ar: 'التقارير' },
};

function getRouteLabel(path, lang) {
    const entry = ROUTE_LABELS[path];
    if (!entry) return null;
    return lang === 'ar' ? entry.ar : entry.en;
}

function getDashboardPath(pathname) {
    if (pathname.startsWith('/admin/')) return '/admin/dashboard';
    if (pathname.startsWith('/supervisor/')) return '/supervisor/dashboard';
    return '/dashboard';
}

function getRole(pathname, lang) {
    if (pathname.startsWith('/admin/')) return lang === 'ar' ? 'مسؤول' : 'Admin';
    if (pathname.startsWith('/supervisor/')) return lang === 'ar' ? 'مشرف' : 'Supervisor';
    return lang === 'ar' ? 'معلم' : 'Teacher';
}

function buildCrumbs(pathname, lang) {
    const crumbs = [];
    const dashPath = getDashboardPath(pathname);

    // Always start with role label
    crumbs.push({ label: getRole(pathname, lang), path: dashPath });

    // Match dynamic routes first
    const uploadMarksMatch = pathname.match(/^\/exams\/(\d+)\/(\d+)\/(\d+)\/(\d+)\/(upload-marks|upload)$/);
    if (uploadMarksMatch) {
        crumbs.push({ label: getRouteLabel('/exams', lang) || 'Exams', path: '/exams' });
        crumbs.push({ label: uploadMarksMatch[5] === 'upload-marks' ? (lang === 'ar' ? 'رفع العلامات' : 'Upload Marks') : (lang === 'ar' ? 'تفاصيل الامتحان' : 'Exam Details'), path: null });
        return crumbs;
    }

    const adminClassMatch = pathname.match(/^\/admin\/classes\/(.+)$/);
    if (adminClassMatch) {
        crumbs.push({ label: getRouteLabel('/admin/classes', lang) || 'Classes', path: '/admin/classes' });
        crumbs.push({ label: lang === 'ar' ? 'تفاصيل الصف' : 'Class Details', path: null });
        return crumbs;
    }

    const adminSubjectMatch = pathname.match(/^\/admin\/subjects\/(.+)$/);
    if (adminSubjectMatch) {
        crumbs.push({ label: getRouteLabel('/admin/subjects', lang) || 'Subjects', path: '/admin/subjects' });
        crumbs.push({ label: lang === 'ar' ? 'تفاصيل المادة' : 'Subject Details', path: null });
        return crumbs;
    }

    // Static routes
    if (pathname === dashPath) return crumbs;

    const label = getRouteLabel(pathname, lang);
    if (label) {
        const parts = pathname.split('/').filter(Boolean);
        if (parts.length >= 3) {
            const parentPath = '/' + parts.slice(0, 2).join('/');
            const parentLabel = getRouteLabel(parentPath, lang);
            if (parentLabel && parentPath !== pathname) {
                crumbs.push({ label: parentLabel, path: parentPath });
            }
        }
        crumbs.push({ label, path: null });
    }

    return crumbs;
}

export default function Breadcrumb({ showBack = true } = {}) {
    const location = useLocation();
    const navigate = useNavigate();
    const { lang, isAr } = useLang();

    const crumbs = buildCrumbs(location.pathname, lang);
    const canGoBack = crumbs.length > 1;

    return (
        <div className={`flex items-center gap-3 mt-1 mb-0 flex-wrap`}>
            {/* Back button */}
            {showBack && canGoBack && (
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-[#1d4ed8] hover:text-[#1e40af] bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg border border-blue-100 transition-all shrink-0"
                >
                    <ArrowLeft className={`h-3.5 w-3.5 ${isAr ? 'rotate-180' : ''}`} />
                    {t('back', lang)}
                </button>
            )}

            {/* Breadcrumb trail */}
            <nav className="flex items-center gap-1 text-xs text-[#94a3b8] flex-wrap">
                {crumbs.map((crumb, i) => (
                    <span key={i} className="flex items-center gap-1">
                        {i > 0 && <ChevronRight className={`h-3 w-3 shrink-0 ${isAr ? 'rotate-180' : ''}`} />}
                        {crumb.path ? (
                            <button
                                onClick={() => navigate(crumb.path)}
                                className="hover:text-[#1d4ed8] transition-colors font-medium"
                            >
                                {crumb.label}
                            </button>
                        ) : (
                            <span className="text-[#475569] font-semibold">{crumb.label}</span>
                        )}
                    </span>
                ))}
            </nav>
        </div>
    );
}
