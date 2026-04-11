import { t, getField, getStudentName as _getStudentName } from '../lib/langHelper';
import { useLang } from '../context/LanguageContext';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import techvancerLogo from '../assets/techvancer-logo.png';

export default function Splash() {
    const { lang, isAr } = useLang();

    const navigate = useNavigate();
    const [isExiting, setIsExiting] = useState(false);

    useEffect(() => {
        document.documentElement.lang = 'en';
        document.documentElement.dir = 'ltr';
    }, []);

    const handleContinue = () => {
        setIsExiting(true);
        setTimeout(() => {
            navigate('/login');
        }, 400);
    };

    return (
        <div
            className={`fixed inset-0 w-full h-full flex items-center justify-center bg-gradient-to-br from-[#1e3a8a] via-[#1d4ed8] to-[#0ea5e9] overflow-hidden transition-opacity duration-400 ease-in-out z-50 ${
                isExiting ? 'opacity-0' : 'opacity-100 animate-fade-in'
            }`}
        >
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[10%] left-[20%] w-64 h-64 bg-white rounded-full mix-blend-overlay filter blur-[60px] opacity-15 animate-orb-1"></div>
                <div className="absolute top-[60%] left-[80%] w-96 h-96 bg-[#0ea5e9] rounded-full mix-blend-overlay filter blur-[80px] opacity-10 animate-orb-2"></div>
                <div className="absolute top-[40%] left-[50%] w-72 h-72 bg-white rounded-full mix-blend-overlay filter blur-[70px] opacity-10 animate-orb-3"></div>
            </div>

            <div className="relative z-10 flex flex-col items-center text-center px-4 max-w-md w-full">
                <div className="animate-icon-entrance">
                    <div className="relative">
                        <div className="absolute inset-0 bg-white rounded-full filter blur-[28px] opacity-20"></div>
                        <img
                            src={techvancerLogo}
                            alt="TechVancer"
                            className="relative w-40 md:w-48 h-auto animate-float drop-shadow-[0_12px_32px_rgba(255,255,255,0.22)]"
                        />
                    </div>
                </div>

                <h1
                    className="mt-8 text-white font-bold text-3xl md:text-5xl font-sans tracking-tight animate-title-entrance opacity-0"
                    style={{ animationFillMode: 'forwards' }}
                >
                    TechVancer School Portal
                </h1>

                <p
                    className="mt-4 text-white/80 text-base md:text-lg animate-subtitle-entrance opacity-0"
                    style={{ animationFillMode: 'forwards' }}
                >
                    Empowering educators. Inspiring students.
                </p>

                <div
                    className="w-20 h-[1px] bg-white/20 my-8 mx-auto animate-subtitle-entrance opacity-0"
                    style={{ animationDelay: '1s', animationFillMode: 'forwards' }}
                ></div>

                <button
                    onClick={handleContinue}
                    className="flex justify-between items-center group bg-white text-[#1e3a8a] font-bold rounded-full px-10 py-4 text-base min-w-[320px] w-auto shadow-[0_8px_32px_rgba(0,0,0,0.2)] hover:scale-104 hover:shadow-[0_12px_40px_rgba(0,0,0,0.3)] active:scale-97 transition-all duration-250 animate-btn-entrance opacity-0"
                    style={{ animationFillMode: 'forwards' }}
                >
                    <div className="flex flex-col items-start leading-tight">
                        <span className="text-xs text-[#1e3a8a]/70 font-semibold uppercase tracking-wider">
                            TechVancer
                        </span>
                        <span>School Portal</span>
                    </div>

                    <div className="bg-[#f0f4f8] rounded-full p-2 hover:bg-[#e2e8f0] transition-colors">
                        <ArrowRight className="w-5 h-5 text-[#1d4ed8]" />
                    </div>
                </button>
            </div>

            <div className="absolute bottom-6 w-full text-center pointer-events-none">
                <p
                    className="text-white/40 text-xs animate-fade-in"
                    style={{ animationDelay: '1.4s', animationFillMode: 'forwards', opacity: 0 }}
                >
                    © 2026 TechVancer School Portal. All rights reserved.
                </p>
            </div>
        </div>
    );
}