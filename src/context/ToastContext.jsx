import { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, AlertTriangle, X } from 'lucide-react';

const ToastContext = createContext();

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  // action: optional { label: string, onClick: () => void }
  const addToast = useCallback((message, type = 'success', action = null) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type, action }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, type === 'error' && action ? 8000 : 3000);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const iconFor = (type) => {
    if (type === 'success') return <CheckCircle className="text-green-500 h-5 w-5 shrink-0" />;
    if (type === 'warning') return <AlertTriangle className="text-amber-500 h-5 w-5 shrink-0" />;
    return <AlertCircle className="text-red-500 h-5 w-5 shrink-0" />;
  };

  const borderFor = (type) => {
    if (type === 'success') return 'border-green-500';
    if (type === 'warning') return 'border-amber-400';
    return 'border-red-500';
  };

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none" style={{ maxWidth: '420px' }}>
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 50, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className={`flex items-start justify-between p-4 rounded-lg shadow-lg pointer-events-auto bg-white border-l-4 ${borderFor(toast.type)}`}
            >
              <div className="flex items-start gap-3 flex-1 min-w-0">
                {iconFor(toast.type)}
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-slate-800 text-sm leading-snug block">{toast.message}</span>
                  {toast.action && (
                    <button
                      onClick={() => { toast.action.onClick(); removeToast(toast.id); }}
                      className="mt-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 underline underline-offset-2"
                    >
                      {toast.action.label}
                    </button>
                  )}
                </div>
              </div>
              <button onClick={() => removeToast(toast.id)} className="ml-3 text-slate-400 hover:text-slate-600 shrink-0">
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
