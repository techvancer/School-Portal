import { t, getField, getStudentName as _getStudentName } from '../../lib/langHelper';
import { useLang } from '../../context/LanguageContext';
import { Bell } from 'lucide-react';
import { motion } from 'framer-motion';

export default function SupervisorNotifications() {
    const { lang, isAr } = useLang();

    return (
        <div className="space-y-6 animate-fade-in pb-12">
            <div>
                <h1 className="text-xl sm:text-2xl font-bold text-[#0f172a]">{t('notifications', lang)}</h1>
                <p className="text-[#64748b] text-sm">{t('stayUpdated', lang)}</p>
            </div>

            <div className="card p-24 bg-white rounded-2xl shadow-sm border-[#e2e8f0] flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                    <Bell className="w-10 h-10 text-[#94a3b8]" />
                </div>
                <h2 className="text-xl font-bold text-[#0f172a] mb-2">{t('noNotificationsYet', lang)}</h2>
                <p className="text-[#64748b] max-w-[280px]">
                    {t('allCaughtUp', lang)}
                </p>
            </div>
        </div>
    );
}
