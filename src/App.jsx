import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import MyClasses from './pages/MyClasses';
import Students from './pages/Students';
import EditMarks from './pages/EditMarks';
import Exams from './pages/Exams';
import CreateExam from './pages/CreateExam';

import UploadMarks from './pages/UploadMarks';
import TeacherExamUpload from './pages/TeacherExamUpload';
import Videos from './pages/Videos';
import Attendance from './pages/Attendance';
import Schedule from './pages/Schedule';
import Notifications from './pages/Notifications';
import Splash from './pages/Splash';

import SupervisorDashboard from './pages/supervisor/Dashboard';
import SupervisorTeachers from './pages/supervisor/Teachers';
import SupervisorStudents from './pages/supervisor/Students';
import SupervisorAttendance from './pages/supervisor/Attendance';
import SupervisorExams from './pages/supervisor/Exams';
import SupervisorReports from './pages/supervisor/Reports';
import SupervisorNotifications from './pages/supervisor/Notifications';

import AdminDashboard from './pages/admin/Dashboard';
import AdminTeachers from './pages/admin/Teachers';
import AdminEmployees from './pages/admin/Employees';
import AdminStudents from './pages/admin/Students';
import AdminEnrollStudent from './pages/admin/EnrollStudent';
import AdminEditStudent from './pages/admin/EditStudent';
import AdminClasses from './pages/admin/Classes';
import AdminSubjects from './pages/admin/Subjects';
import AdminAssignments from './pages/admin/Assignments';
import AdminAttendance from './pages/admin/Attendance';
import AdminExams from './pages/admin/Exams';
import AdminReports from './pages/admin/Reports';
import AdminNotifications from './pages/admin/Notifications';
import SubjectDetail from './pages/admin/SubjectDetail';
import DefineQuestions from './pages/admin/DefineQuestions';

import { useAuth } from './context/AuthContext';

const ProtectedRoute = ({ children, allowedRoles }) => {
    const { user, loading } = useAuth();
    if (loading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1d4ed8]"></div></div>;
    if (!user) return <Navigate to="/login" replace />;
    if (allowedRoles && !allowedRoles.includes(user.role)) {
        const routes = { Admin: '/admin/dashboard', Supervisor: '/supervisor/dashboard' };
        return <Navigate to={routes[user.role] || '/dashboard'} replace />;
    }
    return children;
};

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Splash />} />
                <Route path="/login" element={<Login />} />

                <Route element={<ProtectedRoute allowedRoles={['Teacher']}><Layout /></ProtectedRoute>}>
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/classes/*" element={<MyClasses />} />
                    <Route path="/students" element={<Students />} />
                    <Route path="/edit-marks" element={<EditMarks />} />
                    <Route path="/exams" element={<Exams />} />
                    <Route path="/exams/create" element={<CreateExam />} />

                    <Route path="/exams/:examid/:classid/:sectionid/:subjectid/upload-marks" element={<UploadMarks />} />
                    <Route path="/exams/:examid/:classid/:sectionid/:subjectid/upload" element={<TeacherExamUpload />} />
                    <Route path="/videos" element={<Videos />} />
                    <Route path="/attendance" element={<Attendance />} />
                    <Route path="/schedule" element={<Schedule />} />
                    <Route path="/notifications" element={<Notifications />} />
                </Route>

                <Route element={<ProtectedRoute allowedRoles={['Supervisor']}><Layout /></ProtectedRoute>}>
                    <Route path="/supervisor/dashboard" element={<SupervisorDashboard />} />
                    <Route path="/supervisor/teachers" element={<SupervisorTeachers />} />
                    <Route path="/supervisor/students" element={<SupervisorStudents />} />
                    <Route path="/supervisor/attendance" element={<SupervisorAttendance />} />
                    <Route path="/supervisor/exams" element={<SupervisorExams />} />
                    <Route path="/supervisor/reports" element={<SupervisorReports />} />
                    <Route path="/supervisor/notifications" element={<SupervisorNotifications />} />
                </Route>

                <Route element={<ProtectedRoute allowedRoles={['Admin']}><Layout /></ProtectedRoute>}>
                    <Route path="/admin/dashboard" element={<AdminDashboard />} />
                    <Route path="/admin/teachers" element={<AdminTeachers />} />
                    <Route path="/admin/employees" element={<AdminEmployees />} />
                    <Route path="/admin/students" element={<AdminStudents />} />
                    <Route path="/admin/students/enroll" element={<AdminEnrollStudent />} />
                    <Route path="/admin/students/edit/:id" element={<AdminEditStudent />} />
                    <Route path="/admin/classes" element={<AdminClasses />} />
                    <Route path="/admin/subjects" element={<AdminSubjects />} />
                    <Route path="/admin/subjects/:id" element={<SubjectDetail />} />
                    <Route path="/admin/assignments" element={<AdminAssignments />} />
                    <Route path="/admin/attendance" element={<AdminAttendance />} />
                    <Route path="/admin/exams" element={<AdminExams />} />
                    <Route path="/admin/exams/create" element={<CreateExam />} />

                    <Route path="/admin/exams/define" element={<DefineQuestions />} />
                    <Route path="/admin/reports" element={<AdminReports />} />
                    <Route path="/admin/notifications" element={<AdminNotifications />} />
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
