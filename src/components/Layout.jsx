import { useState } from 'react';
import { useLocation, Outlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Header from './Header';
import Sidebar from './Sidebar';
import ProfileDrawer from './ProfileDrawer';
import { useLang } from '../context/LanguageContext';

export default function Layout() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const location = useLocation();
    const { isAr } = useLang();

    const toggleSidebar = () => setIsSidebarOpen(prev => !prev);
    const closeSidebar = () => setIsSidebarOpen(false);
    const toggleProfile = () => setIsProfileOpen(prev => !prev);

    return (
        <div className="min-h-screen bg-[#f8fafc] flex text-gray-900 overflow-hidden">
            <Header toggleSidebar={toggleSidebar} isOpen={isSidebarOpen} openProfile={toggleProfile} />

            <Sidebar isOpen={isSidebarOpen} onClose={closeSidebar} />

            <ProfileDrawer isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />

            {/* Mobile backdrop — only shown on small screens when sidebar is open */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-30 lg:hidden top-16"
                    onClick={closeSidebar}
                />
            )}

            {/*
              Desktop: sidebar is always visible as an icon rail (64px) that expands to 240px.
              Mobile: sidebar overlays content (z-40), main takes full width.
            */}
            <main
                className={`
                    flex-1 pt-16 transition-all duration-300 overflow-x-hidden
                    ${isAr ? 'mr-0 sm:mr-16' : 'ml-0 sm:ml-16'}
                    ${isSidebarOpen ? (isAr ? 'lg:mr-60' : 'lg:ml-60') : ''}
                `}
            >
                <div className="p-4 sm:p-6 h-full">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={location.pathname}
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -16 }}
                            transition={{ duration: 0.3, ease: 'easeOut' }}
                            className="h-full"
                        >
                            <Outlet />
                        </motion.div>
                    </AnimatePresence>
                </div>
            </main>
        </div>
    );
}
