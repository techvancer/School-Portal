import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Mail, Phone, Shield, Camera, Trash2, Loader2, Save } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { t } from '../lib/langHelper';
import { supabase, update } from '../lib/supabaseClient';
import { useToast } from '../context/ToastContext';

export default function ProfileDrawer({ isOpen, onClose }) {
    const { user, refreshUser } = useAuth();
    const { lang, isAr } = useLang();
    const { addToast } = useToast();
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);

    // Form state for Admin
    const [formData, setFormData] = useState({
        employeename: '',
        employeename_en: '',
        employeeemail: '',
        employeemobile: ''
    });

    useEffect(() => {
        if (user) {
            setFormData({
                employeename: user.name_ar || '',
                employeename_en: user.name || '',
                employeeemail: user.email || '',
                employeemobile: user.mobile || ''
            });
        }
    }, [user, isOpen]);

    const isAdmin = user?.role === 'Admin';

    const handleSave = async () => {
        if (!isAdmin) return;
        setSaving(true);
        try {
            await update('employee_tbl', user.employeeid, 'employeeid', {
                employeename: formData.employeename,
                employeename_en: formData.employeename_en,
                employeeemail: formData.employeeemail,
                employeemobile: formData.employeemobile
            });
            await refreshUser();
            addToast(t('profileUpdated', lang), 'success');
        } catch (err) {
            addToast(err.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleAvatarUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validation
        if (!file.type.startsWith('image/')) {
            addToast('Please upload an image file.', 'warning');
            return;
        }
        if (file.size > 2 * 1024 * 1024) { // 2MB
            addToast('Image size should be less than 2MB.', 'warning');
            return;
        }

        setUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${user.employeeid}_${Math.random().toString(36).substring(2)}.${fileExt}`;
            const filePath = `profiles/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            await update('employee_tbl', user.employeeid, 'employeeid', {
                profile_image: publicUrl
            });

            await refreshUser();
            addToast(t('profileImageUpdated', lang), 'success');
        } catch (err) {
            addToast(err.message, 'error');
        } finally {
            setUploading(false);
        }
    };

    const handleRemoveAvatar = async () => {
        setUploading(true);
        try {
            await update('employee_tbl', user.employeeid, 'employeeid', {
                profile_image: null
            });
            await refreshUser();
            addToast(t('profileImageUpdated', lang), 'success');
        } catch (err) {
            addToast(err.message, 'error');
        } finally {
            setUploading(false);
        }
    };

    const avatarUrl = user?.profile_image || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'U')}&background=random`;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 z-[60] backdrop-blur-sm"
                    />

                    {/* Drawer Content */}
                    <motion.div
                        initial={{ x: isAr ? '-100%' : '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: isAr ? '-100%' : '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className={`fixed top-0 ${isAr ? 'left-0' : 'right-0'} h-full w-full max-w-md bg-white z-[70] shadow-2xl flex flex-col`}
                        dir={isAr ? 'rtl' : 'ltr'}
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-50 rounded-lg">
                                    <User className="h-5 w-5 text-blue-600" />
                                </div>
                                <h2 className="text-xl font-bold text-gray-900">{t('profile', lang)}</h2>
                            </div>
                            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                <X className="h-6 w-6 text-gray-500" />
                            </button>
                        </div>

                        {/* Content Scrollable */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-8">
                            {/* Avatar Section */}
                            <div className="flex flex-col items-center gap-4 py-4">
                                <div className="relative group">
                                    <div className="w-32 h-32 rounded-full border-4 border-white shadow-xl overflow-hidden bg-gray-100 ring-2 ring-blue-100">
                                        <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                                        {uploading && (
                                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                                <Loader2 className="h-8 w-8 text-white animate-spin" />
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={uploading}
                                        className="absolute bottom-1 right-1 p-2.5 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all border-2 border-white transform hover:scale-105 active:scale-95"
                                        title={t('uploadAvatar', lang)}
                                    >
                                        <Camera className="h-4 w-4" />
                                    </button>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleAvatarUpload}
                                        className="hidden"
                                        accept="image/*"
                                    />
                                </div>
                                
                                <div className="text-center space-y-1">
                                    <h3 className="text-xl font-bold text-gray-900">{isAr ? (user?.name_ar || user?.name) : (user?.name || user?.name_ar)}</h3>
                                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold uppercase tracking-wider">
                                        <Shield className="h-3.5 w-3.5" />
                                        {user?.subtitle_ar && isAr ? user.subtitle_ar : user?.subtitle}
                                    </div>
                                </div>

                                {user?.profile_image && (
                                    <button
                                        onClick={handleRemoveAvatar}
                                        disabled={uploading}
                                        className="text-xs font-medium text-red-500 hover:text-red-600 flex items-center gap-1 mt-1 transition-colors hover:underline"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                        {t('removeAvatar', lang)}
                                    </button>
                                )}
                            </div>

                            {/* Info Fields */}
                            <div className="space-y-6">
                                {/* Personal Section */}
                                <section className="space-y-4">
                                    <div className="flex items-center gap-2 text-sm font-bold text-gray-900 border-b border-gray-100 pb-2">
                                        <User className="h-4 w-4 text-blue-500" />
                                        <span>{t('personalInfo', lang)}</span>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{isAdmin ? t('fullNameAr', lang) : t('name', lang)}</label>
                                            {isAdmin ? (
                                                <input
                                                    type="text"
                                                    value={formData.employeename}
                                                    onChange={e => setFormData(p => ({ ...p, employeename: e.target.value }))}
                                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none text-sm font-medium"
                                                />
                                            ) : (
                                                <div className="px-4 py-2.5 bg-gray-50 border border-transparent rounded-xl text-sm font-semibold text-gray-900">
                                                    {isAr ? (user?.name_ar || user?.name || '—') : (user?.name || user?.name_ar || '—')}
                                                </div>
                                            )}
                                        </div>

                                        {isAdmin && (
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('fullNameEn', lang)}</label>
                                                <input
                                                    type="text"
                                                    value={formData.employeename_en}
                                                    onChange={e => setFormData(p => ({ ...p, employeename_en: e.target.value }))}
                                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none text-sm font-medium"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </section>

                                {/* Contact Section */}
                                <section className="space-y-4 pt-2">
                                    <div className="flex items-center gap-2 text-sm font-bold text-gray-900 border-b border-gray-100 pb-2">
                                        <Mail className="h-4 w-4 text-blue-500" />
                                        <span>{t('contactInfo', lang)}</span>
                                    </div>

                                    <div className="grid grid-cols-1 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('email', lang)}</label>
                                            {isAdmin ? (
                                                <input
                                                    type="email"
                                                    value={formData.employeeemail}
                                                    onChange={e => setFormData(p => ({ ...p, employeeemail: e.target.value }))}
                                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none text-sm font-medium"
                                                />
                                            ) : (
                                                <div className="px-4 py-2.5 bg-gray-50 border border-transparent rounded-xl text-sm font-semibold text-gray-900">
                                                    {user?.email || '—'}
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('mobile', lang)}</label>
                                            {isAdmin ? (
                                                <input
                                                    type="tel"
                                                    value={formData.employeemobile}
                                                    onChange={e => setFormData(p => ({ ...p, employeemobile: e.target.value }))}
                                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none text-sm font-medium"
                                                />
                                            ) : (
                                                <div className="px-4 py-2.5 bg-gray-50 border border-transparent rounded-xl text-sm font-semibold text-gray-900">
                                                    {user?.mobile || '—'}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </section>

                                {/* Role/Affiliation Section - READ ONLY FOR ALL */}
                                <section className="space-y-4 pt-2">
                                    <div className="flex items-center gap-2 text-sm font-bold text-gray-900 border-b border-gray-100 pb-2">
                                        <Shield className="h-4 w-4 text-blue-500" />
                                        <span>{t('roleInfo', lang)}</span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('school', lang)}</label>
                                            <div className="px-4 py-2 bg-gray-50 border border-transparent rounded-xl text-xs font-bold text-gray-700 truncate">
                                                {isAr ? user?.schoolName_ar : user?.schoolName}
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('branch', lang)}</label>
                                            <div className="px-4 py-2 bg-gray-50 border border-transparent rounded-xl text-xs font-bold text-gray-700 truncate">
                                                {isAr ? user?.branchName_ar : user?.branchName}
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            </div>
                        </div>

                        {/* Footer / Footer Actions */}
                        {isAdmin && (
                            <div className="p-6 border-t border-gray-100 bg-gray-50 sticky bottom-0">
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="w-full bg-blue-600 text-white rounded-xl py-3.5 px-6 font-bold text-sm shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-70 group"
                                >
                                    {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5 group-hover:scale-110 transition-transform" />}
                                    {t('saveChanges', lang)}
                                </button>
                            </div>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
