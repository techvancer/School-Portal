import { t, getField, getStudentName as _getStudentName } from '../lib/langHelper';
import { useLang } from '../context/LanguageContext';
/*
 * ATTENDANCE MODULE - COMING SOON
 * This page is reserved for the Attendance module.
 * Full implementation will be added in a future release.
 *
 * Planned features:
 * - Daily attendance marking per class/section
 * - Absence tracking and reports
 * - Parent notifications for absences
 * - Monthly attendance statistics per student
 */

export default function Attendance() {
    const { lang, isAr } = useLang();

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4 animate-fade-in">
            <div className="text-7xl mb-2">🚧</div>
            <h1 className="text-3xl font-bold text-[#0f172a]">{t('Coming Soon', lang)}</h1>
            <p className="text-[#64748b] text-base max-w-sm">
                The Attendance module is currently under development and will be available soon.
            </p>
        </div>
    );
}
