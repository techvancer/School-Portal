import { createContext, useContext, useState } from 'react';

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
    const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'en');

    const toggleLang = (newLang) => {
        setLang(newLang);
        localStorage.setItem('lang', newLang);
        document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.lang = newLang;
        window.dispatchEvent(new CustomEvent('langChanged', { detail: { lang: newLang } }));
    };

    // Apply on initial load
    useState(() => {
        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.lang = lang;
    });

    return (
        <LanguageContext.Provider value={{ lang, toggleLang, isAr: lang === 'ar' }}>
            {children}
        </LanguageContext.Provider>
    );
}

export const useLang = () => useContext(LanguageContext);
