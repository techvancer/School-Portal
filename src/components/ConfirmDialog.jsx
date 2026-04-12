/**
 * ConfirmDialog — shared confirmation modal.
 *
 * Props:
 *   open          : boolean
 *   title         : string
 *   message       : string | ReactNode
 *   confirmLabel  : string   (default "Confirm")
 *   cancelLabel   : string   (default "Cancel")
 *   variant       : 'primary' | 'danger'  (default 'primary')
 *   loading       : boolean  (shows spinner on confirm button)
 *   onConfirm     : () => void
 *   onCancel      : () => void
 */
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, HelpCircle, Loader2 } from 'lucide-react';

export default function ConfirmDialog({
    open = false,
    title = 'Are you sure?',
    message = '',
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    variant = 'primary',
    loading = false,
    onConfirm,
    onCancel,
}) {
    const isDanger = variant === 'danger';

    return (
        <AnimatePresence>
            {open && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center px-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.12 }}
                        className="absolute inset-0 bg-black/50"
                        onClick={onCancel}
                    />

                    {/* Dialog */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 8 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl p-7 text-center"
                    >
                        {/* Icon */}
                        <div className={`mx-auto mb-4 w-12 h-12 rounded-full flex items-center justify-center ${isDanger ? 'bg-red-50' : 'bg-blue-50'}`}>
                            {isDanger
                                ? <AlertTriangle className="h-6 w-6 text-red-500" />
                                : <HelpCircle className="h-6 w-6 text-blue-500" />}
                        </div>

                        {/* Title */}
                        <h2 className="text-lg font-bold text-[#0f172a] mb-2">{title}</h2>

                        {/* Message */}
                        {message && (
                            <p className="text-sm text-[#64748b] mb-6 leading-relaxed">{message}</p>
                        )}

                        {/* Buttons */}
                        <div className="flex gap-3">
                            <button
                                onClick={onCancel}
                                disabled={loading}
                                className="flex-1 py-2.5 rounded-xl border border-[#e2e8f0] text-sm font-bold text-[#64748b] hover:bg-slate-50 transition-colors disabled:opacity-50"
                            >
                                {cancelLabel}
                            </button>
                            <button
                                onClick={onConfirm}
                                disabled={loading}
                                className={`flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-colors disabled:opacity-60 flex items-center justify-center gap-2 ${
                                    isDanger
                                        ? 'bg-red-600 hover:bg-red-700'
                                        : 'bg-[#1d4ed8] hover:bg-[#1e40af]'
                                }`}
                            >
                                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                                {confirmLabel}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
