import { t, getField, getStudentName as _getStudentName } from '../../lib/langHelper';
import { useLang } from '../../context/LanguageContext';
import SupervisorNotifications from '../supervisor/Notifications';
import { useSortable } from '../../lib/useSortable';
import { useColumnSearch } from '../../lib/useColumnSearch';
import SortableTh from '../../components/SortableTh';

export default function AdminNotifications() {
    const { lang, isAr } = useLang();

    // Reusing the notifications management logic as it's consistent for both Admin and Supervisor roles
    return <SupervisorNotifications />;
}
