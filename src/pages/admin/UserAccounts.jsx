import { t } from '../../lib/langHelper';
import { useLang } from '../../context/LanguageContext';
import { useState, useEffect, useCallback } from 'react';
import { Search, Shield, Edit2, Trash2, Loader2 } from 'lucide-react';
import Breadcrumb from '../../components/Breadcrumb';
import FilterBar from '../../components/FilterBar';
import { motion } from 'framer-motion';
import { useToast } from '../../context/ToastContext';
import { useSortable } from '../../lib/useSortable';
import { useColumnSearch } from '../../lib/useColumnSearch';
import SortableTh from '../../components/SortableTh';
import { rest } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';

const TYPE_ROLE = { 1: 'Teacher', 2: 'Supervisor', 3: 'GM', 6: 'Admin' };

export default function AdminUserAccounts() {
    const { lang } = useLang();
    const { addToast } = useToast();
    const { user } = useAuth();

    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('All');

    const fetchData = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const [employees, empTypes] = await Promise.all([
                rest('employee_tbl', {
                    schoolid: `eq.${user.schoolid}`,
                    branchid: `eq.${user.branchid}`,
                    select: 'employeeid,employeename,employeename_en,employeeemail',
                }),
                rest('employees_types_tbl', { select: 'employeeid,typeid' }),
            ]);

            const typeMap = {};
            (empTypes || []).forEach(r => { typeMap[r.employeeid] = r.typeid; });

            const mapped = (employees || []).map(e => ({
                id: e.employeeid,
                name: lang === 'ar' ? (e.employeename || e.employeename_en) : (e.employeename_en || e.employeename),
                email: e.employeeemail || '—',
                role: TYPE_ROLE[typeMap[e.employeeid]] || 'Teacher',
            }));

            setUsers(mapped);
        } catch {
            addToast('Failed to load user accounts', 'error');
        } finally {
            setLoading(false);
        }
    }, [user, lang, addToast]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const { sorted, sortCol, sortDir, handleSort } = useSortable(users, 'id');
    const { columnSearch, activeSearch, setActiveSearch, setColumnSearch, applyColumnSearch } = useColumnSearch();

    const filtered = applyColumnSearch(sorted.filter(u => {
        const matchesSearch = u.name.toLowerCase().includes(search.toLowerCase()) ||
            u.email.toLowerCase().includes(search.toLowerCase());
        const matchesRole = roleFilter === 'All' || u.role === roleFilter;
        return matchesSearch && matchesRole;
    }));

    return (
        <div className="space-y-6 animate-fade-in pb-12">
            <div>
                <h1 className="text-xl sm:text-2xl font-bold text-[#0f172a]">{t('userAccounts', lang)}</h1>
                <p className="text-[#64748b] text-sm">{t('monitorUsersDesc', lang)}</p>
                <Breadcrumb />
            </div>

            <div className="bg-white rounded-xl border border-[#e2e8f0] p-4 flex items-center gap-3">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94a3b8]" />
                    <input
                        type="text"
                        placeholder={lang === 'ar' ? 'بحث عن المستخدمين...' : 'Search users...'}
                        className="input-field pl-10 h-10 w-full"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            <FilterBar
                filters={[
                    { key: 'role', label: t('role', lang), value: roleFilter, options: [{ value: 'All', label: t('allRoles', lang) }, { value: 'Admin', label: t('admin', lang) }, { value: 'Supervisor', label: t('supervisor', lang) }, { value: 'Teacher', label: t('teacher', lang) }] },
                ]}
                appliedFilters={{ role: roleFilter }}
                onApply={(vals) => setRoleFilter(vals.role)}
                onReset={() => setRoleFilter('All')}
            />

            <div className="card bg-white overflow-hidden rounded-xl border-[#e2e8f0]">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                                <tr>
                                    <SortableTh col="name" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-6" searchValue={columnSearch['name']} isSearchOpen={activeSearch === 'name'} onSearchOpen={() => setActiveSearch('name')} onSearchClose={() => { setActiveSearch(null); setColumnSearch('name', ''); }} onSearchChange={v => setColumnSearch('name', v)}>{t('user', lang)}</SortableTh>
                                    <SortableTh col="email" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-6" searchValue={columnSearch['email']} isSearchOpen={activeSearch === 'email'} onSearchOpen={() => setActiveSearch('email')} onSearchClose={() => { setActiveSearch(null); setColumnSearch('email', ''); }} onSearchChange={v => setColumnSearch('email', v)}>{t('email', lang)}</SortableTh>
                                    <SortableTh col="role" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-6" searchValue={columnSearch['role']} isSearchOpen={activeSearch === 'role'} onSearchOpen={() => setActiveSearch('role')} onSearchClose={() => { setActiveSearch(null); setColumnSearch('role', ''); }} onSearchChange={v => setColumnSearch('role', v)}>{t('role', lang)}</SortableTh>
                                    <th className="px-6 py-4 text-xs font-bold text-[#64748b] uppercase tracking-wider text-right">{t('actions', lang)}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#e2e8f0]">
                                {filtered.map((u, i) => (
                                    <motion.tr
                                        key={u.id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: i * 0.03 }}
                                        className="hover:bg-[#f8fafc] transition-colors"
                                    >
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm ${u.role === 'Admin' ? 'bg-red-500' : u.role === 'Supervisor' ? 'bg-teal-500' : 'bg-blue-500'}`}>
                                                    {u.name.charAt(0)}
                                                </div>
                                                <span className="text-sm font-bold text-[#0f172a]">{u.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-[#64748b]">{u.email}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 rounded-full text-[10px] uppercase font-bold tracking-tight border ${u.role === 'Admin' ? 'text-red-600 bg-red-50 border-red-100' : u.role === 'Supervisor' ? 'text-teal-600 bg-teal-50 border-teal-100' : 'text-blue-600 bg-blue-50 border-blue-100'}`}>
                                                {u.role}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button title="Edit" onClick={() => addToast('Edit user profile', 'info')} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg border border-blue-100 transition-colors"><Edit2 className="h-4 w-4" /></button>
                                                <button title="Delete" onClick={() => addToast('User account deleted', 'error')} className="p-2 text-red-500 hover:bg-red-50 rounded-lg border border-red-100 transition-colors"><Trash2 className="h-4 w-4" /></button>
                                            </div>
                                        </td>
                                    </motion.tr>
                                ))}
                                {filtered.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-12 text-center text-sm text-[#94a3b8]">
                                            {lang === 'ar' ? 'لا يوجد مستخدمون' : 'No users found'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
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
