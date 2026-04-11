import { t, getField, getStudentName as _getStudentName } from '../lib/langHelper';
import { useLang } from '../context/LanguageContext';
/*
 * SCHEDULE MODULE - COMING SOON
 * This page is reserved for the Schedule module.
 * Full implementation will be added in a future release.
 *
 * Planned features:
 * - Weekly class timetable view
 * - Subject and room assignments
 * - Teacher schedule overview
 * - Conflict detection
 */

export default function Schedule() {
    const { lang, isAr } = useLang();

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4 animate-fade-in">
            <div className="text-7xl mb-2">🚧</div>
            <h1 className="text-3xl font-bold text-[#0f172a]">{t('Coming Soon', lang)}</h1>
            <p className="text-[#64748b] text-base max-w-sm">
                The Schedule module is currently under development and will be available soon.
            </p>
        </div>
    );
}
