import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Bell, Menu, X, Globe, ChevronDown, Check } from 'lucide-react';
import { useLang } from '../context/LanguageContext';
import { t } from '../lib/langHelper';
import { motion, AnimatePresence } from 'framer-motion';

export default function Header({ toggleSidebar, isOpen, openProfile }) {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const { lang, toggleLang, isAr } = useLang();
    const [langDropdownOpen, setLangDropdownOpen] = useState(false);
    const langRef = useRef(null);

    // Close language dropdown on outside click
    useEffect(() => {
        function handleClickOutside(event) {
            if (langRef.current && !langRef.current.contains(event.target)) {
                setLangDropdownOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const notificationsPath = user?.role === 'Admin'
        ? '/admin/notifications'
        : user?.role === 'Supervisor'
            ? '/supervisor/notifications'
            : '/notifications';

    const schoolName = isAr ? (user?.schoolName_ar || user?.schoolName || '') : (user?.schoolName || '');
    const branchName = isAr ? (user?.branchName_ar || user?.branchName || '') : (user?.branchName || '');
    const schoolBranchText = [schoolName, branchName].filter(Boolean).join(' · ');

    const roleText = user?.role === 'Admin' ? t('admin', lang) : user?.role === 'Supervisor' ? t('supervisor', lang) : t('teacher', lang);
    const userName = isAr ? (user?.name_ar || user?.name || t('user', lang)) : (user?.name || t('user', lang));
    const avatarUrl = user?.profile_image || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'U')}&background=random`;

    return (
        <header className="fixed top-0 left-0 w-full h-16 bg-[#1e3a8a] z-50 flex items-center justify-between px-3 sm:px-4 shadow-md">
            {/* Left: hamburger + branding */}
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                <button
                    onClick={toggleSidebar}
                    className="p-2 rounded-lg hover:bg-white/10 text-white transition-colors flex-shrink-0"
                >
                    {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                </button>
                <div className="flex flex-col min-w-0">
                    <h1 className="text-white font-bold text-sm sm:text-lg tracking-tight truncate">
                        TechVancer School Portal
                    </h1>
                    <span className="text-blue-200 text-[10px] sm:text-xs truncate">
                        {schoolBranchText || `${roleText} ${t('dashboard', lang)}`}
                    </span>
                </div>
            </div>

            {/* Right: name, lang, bell, avatar, logout */}
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                {/* Name + role — hidden on very small screens */}
                <div 
                    onClick={openProfile}
                    className="hidden sm:flex flex-col text-right cursor-pointer hover:opacity-80 transition-opacity" 
                    style={{ textAlign: isAr ? 'left' : 'right' }}
                >
                    <span className="text-white font-medium text-sm leading-tight">{userName}</span>
                    <span className="text-blue-200 text-xs">{user?.subtitle_ar && isAr ? user.subtitle_ar : (user?.subtitle || roleText)}</span>
                </div>

                {/* Notifications bell */}
                <button
                    onClick={() => navigate(notificationsPath)}
                    className="p-2 rounded-lg border border-white/30 text-white hover:bg-white/10 transition-colors"
                    title={t('notifications', lang)}
                >
                    <Bell className="h-5 w-5" />
                </button>

                {/* Language Toggle */}
                <div className="relative" ref={langRef}>
                    <button
                        onClick={() => setLangDropdownOpen(!langDropdownOpen)}
                        className="p-2 rounded-lg border border-white/30 text-white hover:bg-white/10 flex items-center gap-1 transition-colors"
                        title="Change Language"
                    >
                        <Globe className="h-5 w-5" />
                        <span className="text-sm font-semibold">{lang.toUpperCase()}</span>
                        <ChevronDown className="h-4 w-4" />
                    </button>

                    <AnimatePresence>
                        {langDropdownOpen && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 10 }}
                                className={`absolute top-12 ${isAr ? 'left-0' : 'right-0'} bg-white w-40 rounded-lg shadow-xl border border-gray-100 overflow-hidden text-gray-800 z-50`}
                            >
                                <button
                                    onClick={() => { toggleLang('en'); setLangDropdownOpen(false); }}
                                    className={`w-full px-4 py-2 text-left text-sm flex items-center justify-between transition-colors ${lang === 'en' ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-slate-50'}`}
                                >
                                    <span className="flex items-center gap-2">🇬🇧 English</span>
                                    {lang === 'en' && <Check className="h-4 w-4" />}
                                </button>
                                <button
                                    onClick={() => { toggleLang('ar'); setLangDropdownOpen(false); }}
                                    className={`w-full px-4 py-2 text-left text-sm flex items-center justify-between transition-colors ${lang === 'ar' ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-slate-50'}`}
                                >
                                    <span className="flex items-center gap-2">🇸🇦 العربية</span>
                                    {lang === 'ar' && <Check className="h-4 w-4" />}
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Avatar */}
                <div 
                  onClick={openProfile}
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border-2 border-white/40 overflow-hidden cursor-pointer flex-shrink-0 transition-transform hover:scale-105 active:scale-95"
                >
                    <img
                        src={avatarUrl}
                        alt="Avatar"
                        className="w-full h-full object-cover"
                    />
                </div>

                {/* Logout — hidden on xs, shown from sm */}
                <button
                    onClick={handleLogout}
                    className="hidden sm:block px-3 py-1.5 border border-white/40 text-white text-sm rounded-lg hover:bg-white/10 transition-colors whitespace-nowrap"
                >
                    {t('logout', lang)}
                </button>
            </div>
        </header>
    );
}
