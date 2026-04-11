import { useNavigate, NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { t } from '../lib/langHelper';
import {
    LayoutDashboard, UserCog, Users, BookOpen,
    ClipboardList, CalendarCheck, CalendarDays, LogOut,
    PlayCircle, Shield, Layers, BarChart, GraduationCap, Link, X, School
} from 'lucide-react';

const getNavItems = (role, lang) => {
    const base = [
        { icon: LayoutDashboard, label: t('dashboard', lang), path: role === 'Admin' ? '/admin/dashboard' : role === 'Supervisor' ? '/supervisor/dashboard' : '/dashboard' },
    ];

    if (role === 'Admin') {
        return [
            ...base,
            { icon: Users,         label: t('employees', lang),   path: '/admin/employees' },
            { icon: GraduationCap, label: t('students', lang),    path: '/admin/students' },
            { icon: BookOpen,      label: t('classes', lang),     path: '/admin/classes' },
            { icon: Layers,        label: t('subjects', lang),    path: '/admin/subjects' },
            { icon: Link,          label: t('assignments', lang), path: '/admin/assignments' },
            { icon: CalendarCheck, label: t('attendance', lang),  path: '/admin/attendance' },
            { icon: ClipboardList, label: t('exams', lang),       path: '/admin/exams' },
            { icon: BarChart,      label: t('reports', lang),     path: '/admin/reports' },
        ];
    }

    if (role === 'Supervisor') {
        return [
            ...base,
            { icon: Users,         label: t('teachers', lang),   path: '/supervisor/teachers' },
            { icon: GraduationCap, label: t('students', lang),   path: '/supervisor/students' },
            { icon: CalendarCheck, label: t('attendance', lang), path: '/supervisor/attendance' },
            { icon: ClipboardList, label: t('exams', lang),      path: '/supervisor/exams' },
            { icon: BarChart,      label: t('reports', lang),    path: '/supervisor/reports' },
        ];
    }

    // Teacher
    return [
        ...base,
        { icon: School,        label: t('myClasses', lang), path: '/classes' },
        { icon: Users,         label: t('students', lang),   path: '/students' },
        { icon: ClipboardList, label: t('exams', lang),      path: '/exams' },
        { icon: PlayCircle,    label: t('videos', lang),     path: '/videos' },
        { icon: CalendarCheck, label: t('attendance', lang), path: '/attendance' },
        { icon: CalendarDays,  label: t('schedule', lang),   path: '/schedule' },
    ];
};

export default function Sidebar({ isOpen, onClose }) {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const { lang, isAr } = useLang();
    const navItems = getNavItems(user?.role, lang);

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    return (
        <>
            {/* ── DESKTOP sidebar (always visible, collapses to icon rail) ── */}
            <motion.aside
                initial={false}
                animate={{ width: isOpen ? 240 : 64 }}
                transition={{ type: 'tween', duration: 0.25 }}
                className={`hidden sm:flex h-screen bg-white ${isAr ? 'border-l right-0' : 'border-r left-0'} border-[#e2e8f0] flex-col fixed top-16 z-40 overflow-hidden`}
            >
                {/* Profile strip */}
                <div className="relative p-4 flex flex-col items-center border-b border-[#e2e8f0]">
                    <div className="w-full h-8 absolute top-0 left-0 bg-gradient-to-r from-blue-600 to-blue-400" />
                    <div className="w-12 h-12 rounded-full border-2 border-white bg-blue-100 z-10 flex items-center justify-center overflow-hidden mb-2 shadow-sm">
                        <img
                            src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'U')}&background=random`}
                            alt="Avatar"
                            className="w-full h-full object-cover"
                        />
                    </div>
                    <div className={`flex flex-col items-center transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 h-0 hidden'}`}>
                        <span className="font-bold text-[#0f172a] text-sm text-center px-2">{user?.name}</span>
                        <span className="text-xs text-[#64748b]">{user?.subtitle || t(user?.role?.toLowerCase() || 'employee', lang)}</span>
                    </div>
                </div>

                {/* Nav */}
                <nav className="flex-1 py-4 flex flex-col gap-1 overflow-y-auto overflow-x-hidden">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            onClick={() => { if (isOpen) onClose?.(); }}
                            className={({ isActive }) => `
                                relative flex items-center px-4 py-3 mx-2 rounded-lg group transition-all duration-200
                                ${isActive ? 'bg-[#1d4ed8] text-white shadow-md' : 'text-[#475569] hover:bg-[#eff6ff] hover:text-[#1d4ed8]'}
                            `}
                            title={!isOpen ? item.label : ''}
                        >
                            {({ isActive }) => (
                                <>
                                    {isActive && (
                                        <motion.div
                                            layoutId="activeNavDesktop"
                                            className={`absolute ${isAr ? 'right-0 rounded-l-md mr-[-8px]' : 'left-0 rounded-r-md ml-[-8px]'} w-1 h-8 bg-white`}
                                        />
                                    )}
                                    <item.icon
                                        size={20}
                                        className={`shrink-0 transition-colors duration-200 ${isActive ? 'text-white' : 'text-[#475569] group-hover:text-[#1d4ed8]'}`}
                                    />
                                    <span className={`${isAr ? 'mr-3' : 'ml-3'} whitespace-nowrap font-medium text-sm transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>
                                        {item.label}
                                    </span>
                                </>
                            )}
                        </NavLink>
                    ))}
                </nav>

                {/* Logout */}
                <div className="p-4 border-t border-[#e2e8f0]">
                    <button
                        onClick={handleLogout}
                        className="flex items-center px-4 py-2 text-[#475569] hover:bg-red-50 hover:text-red-500 rounded-lg group transition-colors w-full"
                    >
                        <LogOut size={20} className={`shrink-0 ${isAr ? 'rotate-180' : ''}`} />
                        <span className={`${isAr ? 'mr-3' : 'ml-3'} whitespace-nowrap text-sm font-medium transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>
                            {t('logout', lang)}
                        </span>
                    </button>
                </div>
            </motion.aside>

            {/* ── MOBILE drawer (slides in from left/right, overlays content) ── */}
            <AnimatePresence>
                {isOpen && (
                    <motion.aside
                        key="mobile-sidebar"
                        initial={{ x: isAr ? '100%' : '-100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: isAr ? '100%' : '-100%' }}
                        transition={{ type: 'tween', duration: 0.25 }}
                        className={`sm:hidden fixed ${isAr ? 'right-0 border-l' : 'left-0 border-r'} top-16 bottom-0 w-64 bg-white border-[#e2e8f0] z-40 flex flex-col overflow-hidden shadow-2xl`}
                    >
                        {/* Profile strip */}
                        <div className="relative p-4 flex flex-col items-center border-b border-[#e2e8f0]">
                            <div className="w-full h-8 absolute top-0 left-0 bg-gradient-to-r from-blue-600 to-blue-400" />
                            <div className="w-12 h-12 rounded-full border-2 border-white bg-blue-100 z-10 flex items-center justify-center overflow-hidden mb-2 shadow-sm">
                                <img
                                    src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'U')}&background=random`}
                                    alt="Avatar"
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <span className="font-bold text-[#0f172a] text-sm text-center px-2">{user?.name}</span>
                            <span className="text-xs text-[#64748b]">{user?.subtitle || t(user?.role?.toLowerCase() || 'employee', lang)}</span>
                        </div>

                        {/* Nav */}
                        <nav className="flex-1 py-4 flex flex-col gap-1 overflow-y-auto">
                            {navItems.map((item) => (
                                <NavLink
                                    key={item.path}
                                    to={item.path}
                                    onClick={onClose}
                                    className={({ isActive }) => `
                                        relative flex items-center px-4 py-3 mx-2 rounded-lg transition-all duration-200
                                        ${isActive ? 'bg-[#1d4ed8] text-white shadow-md' : 'text-[#475569] hover:bg-[#eff6ff] hover:text-[#1d4ed8]'}
                                    `}
                                >
                                    {({ isActive }) => (
                                        <>
                                            <item.icon size={20} className={`shrink-0 ${isActive ? 'text-white' : 'text-[#475569]'}`} />
                                            <span className={`${isAr ? 'mr-3' : 'ml-3'} font-medium text-sm`}>{item.label}</span>
                                        </>
                                    )}
                                </NavLink>
                            ))}
                        </nav>

                        {/* Logout */}
                        <div className="p-4 border-t border-[#e2e8f0]">
                            <button
                                onClick={handleLogout}
                                className="flex items-center px-4 py-2 text-[#475569] hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors w-full"
                            >
                                <LogOut size={20} className={isAr ? 'rotate-180' : ''} />
                                <span className={`${isAr ? 'mr-3' : 'ml-3'} text-sm font-medium`}>{t('logout', lang)}</span>
                            </button>
                        </div>
                    </motion.aside>
                )}
            </AnimatePresence>
        </>
    );
}

