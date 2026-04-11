import { t, getField, getStudentName as _getStudentName } from '../../lib/langHelper';
import { useLang } from '../../context/LanguageContext';
import { useSortable } from '../../lib/useSortable';
import { useColumnSearch } from '../../lib/useColumnSearch';
import SortableTh from '../../components/SortableTh';
export default function AdminAttendance() {
    const { lang, isAr } = useLang();

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4 animate-fade-in">
            <div className="text-7xl mb-2">🚧</div>
            <h1 className="text-3xl font-bold text-[#0f172a]">{t('comingSoon', lang)}</h1>
            <p className="text-[#64748b] text-base max-w-sm">
                {t('attendanceModuleUnderDevelopment', lang)}
            </p>
        </div>
    );
}
