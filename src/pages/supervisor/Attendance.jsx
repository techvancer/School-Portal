import { t, getField, getStudentName as _getStudentName } from '../../lib/langHelper';
import { useLang } from '../../context/LanguageContext';
export default function SupervisorAttendance() {
    const { lang, isAr } = useLang();

    return (
        <div className="space-y-6 animate-fade-in pb-12">
            <div>
                <h1 className="text-xl sm:text-2xl font-bold text-[#0f172a]">{t('attendance', lang)}</h1>
                <p className="text-[#64748b] text-sm">{t('attendanceOverview', lang)}</p>
            </div>
            <div className="card p-6 bg-white rounded-xl border border-[#e2e8f0]">
                <h3 className="font-bold text-base text-[#0f172a] mb-1">{t('attendanceByClass', lang)}</h3>
                <p className="text-xs text-[#64748b] mb-5">{t('attendanceRatePerSection', lang)}</p>
                <div style={{ height: '220px' }} className="flex flex-col items-center justify-center text-[#94a3b8] gap-2">
                    <span className="text-5xl">🚧</span>
                    <p className="text-sm font-semibold text-[#64748b]">{t('Coming Soon', lang)}</p>
                    <p className="text-xs text-center max-w-xs">{t('attendanceComingSoonDesc', lang)}</p>
                </div>
            </div>
        </div>
    );
}
