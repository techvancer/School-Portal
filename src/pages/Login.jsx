import { t, getField, getStudentName as _getStudentName } from '../lib/langHelper';
import { useLang } from '../context/LanguageContext';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Mail, Lock, Eye, EyeOff, Loader2, CheckCircle2, KeyRound } from 'lucide-react';
import techvancerLogo from '../assets/techvancer-logo.png';

const ROLE_ROUTES = {
    Admin: '/admin/dashboard',
    Supervisor: '/supervisor/dashboard',
    Teacher: '/dashboard',
    GM: '/dashboard'
};

export default function Login() {
    const { lang, isAr } = useLang();

    const navigate = useNavigate();
    const { login, changePassword, firstLogin, user } = useAuth();
    const { addToast } = useToast();

    useEffect(() => {
        document.documentElement.lang = 'en';
        document.documentElement.dir = 'ltr';
    }, []);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [errors, setErrors] = useState({ email: '', password: '' });

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [changingPassword, setChangingPassword] = useState(false);

    useEffect(() => {
        if (user && !firstLogin) {
            setIsLoading(false);
            navigate(ROLE_ROUTES[user.role] || '/dashboard', { replace: true });
        }
    }, [user, firstLogin, navigate]);

    const handleLogin = async (e) => {
        e.preventDefault();

        let valid = true;
        const newErrors = { email: '', password: '' };

        if (!email) {
            newErrors.email = 'Email is required';
            valid = false;
        }

        if (!password) {
            newErrors.password = 'Password is required';
            valid = false;
        }

        setErrors(newErrors);
        if (!valid) return;

        setIsLoading(true);

        try {
            await login(email, password);
        } catch (e) {
            setIsLoading(false);
            setErrors({ email: 'Invalid email or password', password: ' ' });
            addToast('Invalid email or password. Please try again.', 'error');
        }
    };

    if (user && firstLogin) {
        return (
            <div className="flex w-full h-screen bg-[#f8fafc] items-center justify-center">
                <div className="w-full max-w-[400px] px-8 py-12 bg-white rounded-2xl shadow-lg border border-slate-100">
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                            <KeyRound className="h-8 w-8 text-blue-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-[#1e293b]">{isAr ? "تغيير كلمة المرور" : "Change Your Password"}</h2>
                        <p className="text-sm text-[#64748b] mt-2">
                            You must set a new password before continuing.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-[#374151] mb-2">
                                New Password
                            </label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="block w-full h-12 px-4 bg-white border border-[#e2e8f0] rounded-xl text-sm outline-none focus:border-[#1d4ed8] transition-all"
                                placeholder={isAr ? "أدخل كلمة المرور الجديدة" : "Enter new password"}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-[#374151] mb-2">
                                Confirm Password
                            </label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="block w-full h-12 px-4 bg-white border border-[#e2e8f0] rounded-xl text-sm outline-none focus:border-[#1d4ed8] transition-all"
                                placeholder={isAr ? "تأكيد كلمة المرور الجديدة" : "Confirm new password"}
                            />
                        </div>

                        <button
                            disabled={changingPassword}
                            onClick={async () => {
                                if (!newPassword || newPassword.length < 8) {
                                    addToast('Password must be at least 8 characters', 'error');
                                    return;
                                }

                                if (newPassword !== confirmPassword) {
                                    addToast('Passwords do not match', 'error');
                                    return;
                                }

                                setChangingPassword(true);

                                try {
                                    await changePassword(newPassword);
                                    addToast('Password changed successfully!', 'success');
                                    navigate(ROLE_ROUTES[user.role] || '/dashboard', { replace: true });
                                } catch (e) {
                                    addToast(e.message, 'error');
                                } finally {
                                    setChangingPassword(false);
                                }
                            }}
                            className="w-full h-12 bg-[#1d4ed8] text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-[#1e40af] transition-all disabled:opacity-70"
                        >
                            {changingPassword ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                            {changingPassword ? 'Changing...' : 'Set New Password'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            className="flex w-full h-screen bg-[#f8fafc] animate-fade-in-delayed opacity-0"
            style={{ animationFillMode: 'forwards', animationDelay: '0.1s' }}
        >
            <div className="hidden md:flex md:w-[40%] bg-[#1e3a8a] relative overflow-hidden flex-col justify-center items-start p-12 text-white animate-slide-in-left">
                <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                    <div className="absolute top-[10%] left-[20%] w-64 h-64 bg-white rounded-full mix-blend-overlay filter blur-[60px] opacity-15 animate-orb-1"></div>
                    <div className="absolute top-[60%] left-[80%] w-96 h-96 bg-[#0ea5e9] rounded-full mix-blend-overlay filter blur-[80px] opacity-10 animate-orb-2"></div>
                </div>

                <div className="relative z-10 space-y-8 max-w-sm">
                    <div className="animate-float">
                        <img
                            src={techvancerLogo}
                            alt="TechVancer"
                            className="h-24 w-auto object-contain drop-shadow-[0_10px_26px_rgba(255,255,255,0.2)]"
                        />
                    </div>

                    <div>
                        <h1 className="text-3xl font-bold leading-tight text-white">TechVancer School Portal</h1>
                        <p className="mt-4 text-[15px] opacity-75 font-medium text-white">
                            Empowering educators. Inspiring students.
                        </p>
                    </div>

                    <div className="space-y-4 pt-4">
                        {['Teacher Dashboard', 'Supervisor Controls', 'Admin Management'].map((t) => (
                            <div key={t} className="flex items-center space-x-3 text-[15px] opacity-85 text-white">
                                <CheckCircle2 className="h-5 w-5 text-blue-300" />
                                <span>{t}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="absolute bottom-6 left-12 opacity-40 text-xs font-medium z-10 text-white">
                    © 2026 TechVancer School Portal
                </div>
            </div>

            <div className="w-full md:w-[60%] flex items-center justify-center relative bg-white md:bg-[#f8fafc] animate-slide-in-right">
                <div className="w-full max-w-[400px] px-8 py-12 bg-white rounded-2xl md:shadow-[0_4px_24px_rgba(0,0,0,0.02)] md:border md:border-slate-100">
                    <div
                        className="text-center mb-8 animate-stagger"
                        style={{ animationDelay: '0.1s', opacity: 0, animationFillMode: 'forwards' }}
                    >
                        <div className="flex flex-col items-center justify-center mb-3">
                            <img
                                src={techvancerLogo}
                                alt="TechVancer"
                                className="h-14 w-auto object-contain mb-2"
                            />
                            <div className="text-[#1d4ed8] font-bold text-[14px]">
                                TECHVANCER SCHOOL PORTAL
                            </div>
                        </div>

                        <h2 className="text-[28px] font-bold text-[#1e293b] mb-2 tracking-tight">
                            Welcome
                        </h2>
                        <p className="text-[14px] text-[#64748b]">{isAr ? "تسجيل الدخول إلى حسابك" : "Sign in to your account"}</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-5">
                        <div
                            className="animate-stagger"
                            style={{ animationDelay: '0.2s', opacity: 0, animationFillMode: 'forwards' }}
                        >
                            <label className="block text-[14px] font-medium text-[#374151] mb-2">
                                Email Address
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                    <Mail className="h-5 w-5 text-[#94a3b8]" />
                                </div>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => {
                                        setEmail(e.target.value);
                                        if (errors.email) setErrors({ ...errors, email: '' });
                                    }}
                                    className={`block w-full h-[48px] pl-11 pr-4 bg-white border ${
                                        errors.email
                                            ? 'border-[#dc2626]'
                                            : 'border-[#e2e8f0] focus:border-[#1d4ed8]'
                                    } rounded-[10px] text-[15px] font-medium text-[#0f0f0f] placeholder:text-[#94a3b8] focus:outline-none focus:ring-4 focus:ring-[#1d4ed8]/12 transition-all duration-200 shadow-sm`}
                                    placeholder={isAr ? "أدخل بريدك الإلكتروني" : "Enter your email"}
                                />
                            </div>
                            {errors.email && (
                                <p className="mt-1.5 text-[12px] font-medium text-[#dc2626]">
                                    {errors.email}
                                </p>
                            )}
                        </div>

                        <div
                            className="animate-stagger"
                            style={{ animationDelay: '0.3s', opacity: 0, animationFillMode: 'forwards' }}
                        >
                            <label className="block text-[14px] font-medium text-[#374151] mb-2">
                                Password
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 text-[#94a3b8]" />
                                </div>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => {
                                        setPassword(e.target.value);
                                        if (errors.password) setErrors({ ...errors, password: '' });
                                    }}
                                    className={`block w-full h-[48px] pl-11 pr-11 bg-white border ${
                                        errors.password
                                            ? 'border-[#dc2626]'
                                            : 'border-[#e2e8f0] focus:border-[#1d4ed8]'
                                    } rounded-[10px] text-[15px] font-medium text-[#0f0f0f] placeholder:text-[#94a3b8] focus:outline-none focus:ring-4 transition-all duration-200 shadow-sm`}
                                    placeholder={isAr ? "أدخل كلمة المرور" : "Enter your password"}
                                    style={{ WebkitAppearance: 'none', MozAppearance: 'none' }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center hover:opacity-75 transition-opacity"
                                >
                                    {showPassword ? (
                                        <EyeOff className="h-5 w-5 text-[#94a3b8]" />
                                    ) : (
                                        <Eye className="h-5 w-5 text-[#94a3b8]" />
                                    )}
                                </button>
                            </div>
                            {errors.password && (
                                <p className="mt-1.5 text-[12px] font-medium text-[#dc2626]">
                                    {errors.password}
                                </p>
                            )}
                        </div>

                        <div
                            className="pt-2 animate-stagger"
                            style={{ animationDelay: '0.4s', opacity: 0, animationFillMode: 'forwards' }}
                        >
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full h-[48px] bg-[#1d4ed8] hover:bg-[#1e40af] active:scale-[0.98] text-white font-bold text-[16px] rounded-[10px] shadow-[0_4px_12px_rgba(29,78,216,0.15)] hover:shadow-[0_6px_16px_rgba(29,78,216,0.25)] transition-all duration-200 disabled:opacity-80 disabled:cursor-not-allowed flex items-center justify-center"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                        <span>Signing in...</span>
                                    </>
                                ) : (
                                    <span>{isAr ? "تسجيل الدخول" : "Sign In"}</span>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}