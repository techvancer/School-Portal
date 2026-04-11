import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export default function StatCard({ title, value, icon: Icon, color, delay, suffix = '' }) {
    const [count, setCount] = useState(0);

    useEffect(() => {
        let startTime;
        const duration = 1000;
        const finalValue = parseInt(value, 10);

        if (isNaN(finalValue)) {
            setCount(value);
            return;
        }

        const animateCount = (timestamp) => {
            if (!startTime) startTime = timestamp;
            const progress = timestamp - startTime;
            const current = Math.min(Math.floor((progress / duration) * finalValue), finalValue);
            setCount(current);
            if (progress < duration) requestAnimationFrame(animateCount);
            else setCount(finalValue);
        };

        const timer = setTimeout(() => {
            requestAnimationFrame(animateCount);
        }, delay * 1000);

        return () => clearTimeout(timer);
    }, [value, delay]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay, ease: 'easeOut' }}
            className="card card-hover p-3 sm:p-4 flex flex-col gap-2 bg-white border border-[#e2e8f0] rounded-xl h-full w-full"
        >
            <div className={`p-2.5 rounded-full self-start flex-shrink-0 ${color}`}>
                <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div>
                <h3 className="text-[#64748b] text-[11px] sm:text-xs font-medium leading-snug">{title}</h3>
                <p className="text-[#0f0f0f] text-lg sm:text-2xl font-bold mt-0.5 leading-tight">{count}{suffix}</p>
            </div>
        </motion.div>
    );
}
