import { createContext, useContext, useState, useEffect } from 'react';
import { supabase, rest, dbQuery } from '../lib/supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [firstLogin, setFirstLogin] = useState(false);

    useEffect(() => {
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            if (session) await loadEmployee(session.user, session.access_token);
            setLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (session) await loadEmployee(session.user, session.access_token);
            else { setUser(null); setFirstLogin(false); }
        });

        return () => subscription.unsubscribe();
    }, []);

    const loadEmployee = async (authUser, token = null) => {
        try {
            const employees = await rest('employee_tbl', { auth_user_id: `eq.${authUser.id}`, select: '*' }, token);
            if (!employees.length) return;
            const emp = employees[0];
            const types = await rest('employees_types_tbl', { employeeid: `eq.${emp.employeeid}`, select: 'typeid' }, token);
            const typeid = types[0]?.typeid;
            const roleMap = { 1: 'Teacher', 2: 'Supervisor', 3: 'GM', 6: 'Admin' };
            const role = roleMap[typeid] || 'Teacher';
            // Fetch Arabic role name from types_tbl
            let roleAr = '';
            try {
                const typeRows = await rest('types_tbl', { typeid: `eq.${typeid}`, select: 'typename,typename_en' }, token);
                roleAr = typeRows[0]?.typename || '';
            } catch {}
            let schoolName = '', schoolNameAr = '', branchName = '', branchNameAr = '';
            try {
                const schools = await rest('schools_tbl', { schoolid: `eq.${emp.schoolid}`, select: 'schoolname_en,schoolname' }, token);
                schoolName   = schools[0]?.schoolname_en || schools[0]?.schoolname || '';
                schoolNameAr = schools[0]?.schoolname    || schools[0]?.schoolname_en || '';
                const branches = await rest('branches_tbl', { branchid: `eq.${emp.branchid}`, schoolid: `eq.${emp.schoolid}`, select: 'branchname_en,branchname' }, token);
                branchName   = branches[0]?.branchname_en || branches[0]?.branchname || '';
                branchNameAr = branches[0]?.branchname    || branches[0]?.branchname_en || '';
            } catch {}
            setFirstLogin(emp.first_login === true);
            const displayNameEn = emp.employeename_en || emp.employeename || '';
            const displayNameAr = emp.employeename || emp.employeename_en || '';
            setUser({ 
                id: authUser.id, 
                employeeid: emp.employeeid, 
                name: displayNameEn, 
                name_ar: displayNameAr, 
                email: emp.employeeemail, 
                mobile: emp.employeemobile,
                profile_image: emp.profile_image,
                subtitle: role, 
                subtitle_ar: roleAr, 
                role, 
                typeid, 
                schoolid: emp.schoolid, 
                branchid: emp.branchid, 
                schoolName, 
                schoolName_ar: schoolNameAr, 
                branchName, 
                branchName_ar: branchNameAr, 
                first_login: emp.first_login 
            });
        } catch (e) { console.error('loadEmployee error:', e); }
    };

    const refreshUser = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) await loadEmployee(session.user, session.access_token);
    };

    const login = async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return data;
    };

    const logout = async () => {
        await supabase.auth.signOut();
        setUser(null);
        setFirstLogin(false);
    };

    const changePassword = async (newPassword) => {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
        await dbQuery(`employee_tbl?employeeid=eq.${user.employeeid}`, 'PATCH', { first_login: false });
        setFirstLogin(false);
        setUser(u => ({ ...u, first_login: false }));
    };

    return (
        <AuthContext.Provider value={{ user, loading, firstLogin, login, logout, changePassword, refreshUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
