import { t, getField, getStudentName as _getStudentName } from '../../lib/langHelper';
import { useLang } from '../../context/LanguageContext';
import { useState } from 'react';
import { Search, User, Shield, GraduationCap, Key, Power, Loader2, CheckCircle, MoreVertical, Edit2, Trash2 } from 'lucide-react';
import Breadcrumb from '../../components/Breadcrumb';
import { motion } from 'framer-motion';
import { useToast } from '../../context/ToastContext';
import { useAppStore } from '../../data/store';
import { useSortable } from '../../lib/useSortable';
import { useColumnSearch } from '../../lib/useColumnSearch';
import SortableTh from '../../components/SortableTh';

export default function AdminUserAccounts() {
    const { lang, isAr } = useLang();

    const { addToast } = useToast();
    const { teachers, supervisors } = useAppStore();
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('All');
    const [isResetting, setIsResetting] = useState(null);

    // Hardcoded Admin for display
    const admins = [
        { id: 'A1', name: 'Admin User', email: 'admin@school.com', role: 'Admin' }
    ];

    const allUsers = [
        ...admins,
        ...supervisors.map(s => ({ ...s, role: 'Supervisor' })),
        ...teachers.map(t => ({ ...t, role: 'Teacher' }))
    ];

    const { sorted: sortedAccounts, sortCol, sortDir, handleSort } = useSortable(allUsers, 'id');
    const { columnSearch, activeSearch, setActiveSearch, setColumnSearch, applyColumnSearch } = useColumnSearch();
    const filtered = applyColumnSearch(sortedAccounts.filter(u => {
        const matchesSearch = u.name.toLowerCase().includes(search.toLowerCase()) ||
            u.email.toLowerCase().includes(search.toLowerCase());
        const matchesRole = roleFilter === 'All' || u.role === roleFilter;
        return matchesSearch && matchesRole;
    }));

    const handleResetPassword = (id) => {
        setIsResetting(id);
        setTimeout(() => {
            setIsResetting(null);
            addToast("Password reset link sent to user email.", "success");
        }, 1200);
    };

    return (
        <div className="space-y-6 animate-fade-in pb-12">
            <div>
                <h1 className="text-xl sm:text-2xl font-bold text-[#0f172a]">{t('userAccounts', lang)}</h1>
                <p className="text-[#64748b] text-sm">{t('monitorUsersDesc', lang)}</p>
                <Breadcrumb />
            </div>

            <div className="card bg-white p-6 rounded-xl flex flex-wrap gap-4 items-center border-[#e2e8f0]">
                <div className="flex-1 min-w-[240px] relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94a3b8]" />
                    <input
                        type="text"
                        placeholder={isAr ? "بحث عن المستخدمين..." : "Search users..."}
                        className="input-field pl-10 h-11"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="flex gap-3">
                    <select
                        className="input-field h-11 px-4 min-w-[150px]"
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                    >
                        <option value="All">{t('allRoles', lang)}</option>
                        <option value="Admin">{t('admin', lang)}</option>
                        <option value="Supervisor">{t('supervisor', lang)}</option>
                        <option value="Teacher">{t('teacher', lang)}</option>
                    </select>
                </div>
            </div>

            <div className="card bg-white overflow-hidden rounded-xl border-[#e2e8f0]">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                            <tr>
                                <SortableTh col="name" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-6" searchValue={columnSearch['name']} isSearchOpen={activeSearch==='name'} onSearchOpen={()=>setActiveSearch('name')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('name','');}} onSearchChange={v=>setColumnSearch('name',v)}>{t('user', lang)}</SortableTh>
                                <SortableTh col="email" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-6" searchValue={columnSearch['email']} isSearchOpen={activeSearch==='email'} onSearchOpen={()=>setActiveSearch('email')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('email','');}} onSearchChange={v=>setColumnSearch('email',v)}>{t('email', lang)}</SortableTh>
                                <SortableTh col="role" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-6" searchValue={columnSearch['role']} isSearchOpen={activeSearch==='role'} onSearchOpen={()=>setActiveSearch('role')} onSearchClose={()=>{setActiveSearch(null);setColumnSearch('role','');}} onSearchChange={v=>setColumnSearch('role',v)}>{t('role', lang)}</SortableTh>

                                <th className="px-6 py-4 text-xs font-bold text-[#64748b] uppercase tracking-wider text-right">{t('actions', lang)}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#e2e8f0]">
                            {filtered.map((u, i) => (
                                <tr key={i} className="hover:bg-[#f8fafc] transition-colors">
                                    <td className="px-4 py-3 text-center">
                                        <div className="flex items-center gap-3">
                                            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm ${u.role === 'Admin' ? 'bg-red-500' : u.role === 'Supervisor' ? 'bg-teal-500' : 'bg-blue-500'
                                                }`}>
                                                {u.name.charAt(0)}
                                            </div>
                                            <span className="text-sm font-bold text-[#0f172a]">{u.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-center text-sm text-[#64748b]">{u.email}</td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={`px-2 py-1 rounded-full text-[10px] uppercase font-bold tracking-tight border ${u.role === 'Admin' ? 'text-red-600 bg-red-50 border-red-100' :
                                            u.role === 'Supervisor' ? 'text-teal-600 bg-teal-50 border-teal-100' :
                                                'text-blue-600 bg-blue-50 border-blue-100'
                                            }`}>
                                            {u.role}
                                        </span>
                                    </td>

                                    <td className="px-4 py-3 text-center text-right">
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => addToast("Edit user profile", "info")} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg border border-blue-100 transition-colors"><Edit2 className="h-4 w-4" /></button>
                                            <button onClick={() => addToast("User account deleted", "error")} className="p-2 text-red-500 hover:bg-red-50 rounded-lg border border-red-100 transition-colors"><Trash2 className="h-4 w-4" /></button>

                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3">
                <Shield className="h-5 w-5 text-slate-500" />
                <p className="text-xs text-[#64748b] font-medium uppercase tracking-wider">
                    {t('adminNotePassword', lang)}
                </p>
            </div>
        </div>
    );
}
