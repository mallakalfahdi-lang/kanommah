import React from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth, ROLE_HOME } from './store.jsx';
import Shell from './Shell.jsx';
import Login from './pages/Login.jsx';
import {
  StudentHome, StudentHalqas, StudentAttendance, StudentGrades, StudentRecitation,
  StudentActivities, StudentAppointments, StudentRewards, StudentPayments, StudentRequests, StudentAlerts
} from './pages/student.jsx';
import {
  TeacherHome, TeacherHalqas, TeacherStudents, TeacherAttendance, TeacherGrades,
  TeacherRecitation, TeacherActivities, TeacherAppointments, TeacherRewards, TeacherEvaluations, TeacherRequests
} from './pages/teacher.jsx';
import {
  ManageHome, ManageStudents, ManageTeachers, ManageHalqas, ManageGrades, ManageAppointments,
  ManageRewards, ManageAlerts, ManageRequests, ManageEvaluations, ManagePayments, ManageReports, ManageUsers, ManageBranches
} from './pages/manage.jsx';
import { Messages, Notifications, Profile } from './pages/shared.jsx';

function Guard({ roles, children }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="loading" style={{ padding: 60, justifyContent: 'center' }}><Loader2 className="spin" size={22} /> جارٍ التحميل…</div>;
  if (!user) return <Navigate to="/" replace state={{ from: loc.pathname }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to={ROLE_HOME[user.role] || '/'} replace />;
  return <Shell>{children}</Shell>;
}

export default function App() {
  const { user, loading } = useAuth();
  const P = ({ roles, children }) => <Guard roles={roles}>{children}</Guard>;

  return (
    <Routes>
      <Route path="/" element={loading ? <div className="loading" style={{ padding: 60, justifyContent: 'center' }}><Loader2 className="spin" size={22} /> جارٍ التحميل…</div> : (user ? <Navigate to={ROLE_HOME[user.role] || '/'} replace /> : <Login />)} />

      <Route path="/student" element={<P roles={['student']}><StudentHome /></P>} />
      <Route path="/student/halqas" element={<P roles={['student']}><StudentHalqas /></P>} />
      <Route path="/student/attendance" element={<P roles={['student']}><StudentAttendance /></P>} />
      <Route path="/student/grades" element={<P roles={['student']}><StudentGrades /></P>} />
      <Route path="/student/recitation" element={<P roles={['student']}><StudentRecitation /></P>} />
      <Route path="/student/activities" element={<P roles={['student']}><StudentActivities /></P>} />
      <Route path="/student/appointments" element={<P roles={['student']}><StudentAppointments /></P>} />
      <Route path="/student/rewards" element={<P roles={['student']}><StudentRewards /></P>} />
      <Route path="/student/payments" element={<P roles={['student']}><StudentPayments /></P>} />
      <Route path="/student/requests" element={<P roles={['student']}><StudentRequests /></P>} />
      <Route path="/student/alerts" element={<P roles={['student']}><StudentAlerts /></P>} />

      <Route path="/teacher" element={<P roles={['teacher']}><TeacherHome /></P>} />
      <Route path="/teacher/halqas" element={<P roles={['teacher']}><TeacherHalqas /></P>} />
      <Route path="/teacher/students" element={<P roles={['teacher']}><TeacherStudents /></P>} />
      <Route path="/teacher/attendance" element={<P roles={['teacher']}><TeacherAttendance /></P>} />
      <Route path="/teacher/grades" element={<P roles={['teacher']}><TeacherGrades /></P>} />
      <Route path="/teacher/recitation" element={<P roles={['teacher']}><TeacherRecitation /></P>} />
      <Route path="/teacher/activities" element={<P roles={['teacher']}><TeacherActivities /></P>} />
      <Route path="/teacher/appointments" element={<P roles={['teacher']}><TeacherAppointments /></P>} />
      <Route path="/teacher/rewards" element={<P roles={['teacher']}><TeacherRewards /></P>} />
      <Route path="/teacher/evaluations" element={<P roles={['teacher']}><TeacherEvaluations /></P>} />
      <Route path="/teacher/requests" element={<P roles={['teacher']}><TeacherRequests /></P>} />
      <Route path="/teacher/profile" element={<P roles={['teacher']}><Profile /></P>} />

      <Route path="/manage" element={<P roles={['admin', 'supervisor']}><ManageHome /></P>} />
      <Route path="/manage/students" element={<P roles={['admin', 'supervisor']}><ManageStudents /></P>} />
      <Route path="/manage/teachers" element={<P roles={['admin', 'supervisor']}><ManageTeachers /></P>} />
      <Route path="/manage/halqas" element={<P roles={['admin', 'supervisor']}><ManageHalqas /></P>} />
      <Route path="/manage/grades" element={<P roles={['admin', 'supervisor']}><ManageGrades /></P>} />
      <Route path="/manage/appointments" element={<P roles={['admin', 'supervisor']}><ManageAppointments /></P>} />
      <Route path="/manage/rewards" element={<P roles={['admin', 'supervisor']}><ManageRewards /></P>} />
      <Route path="/manage/alerts" element={<P roles={['admin', 'supervisor']}><ManageAlerts /></P>} />
      <Route path="/manage/requests" element={<P roles={['admin', 'supervisor']}><ManageRequests /></P>} />
      <Route path="/manage/evaluations" element={<P roles={['admin', 'supervisor']}><ManageEvaluations /></P>} />
      <Route path="/manage/payments" element={<P roles={['admin', 'supervisor']}><ManagePayments /></P>} />
      <Route path="/manage/reports" element={<P roles={['admin', 'supervisor']}><ManageReports /></P>} />
      <Route path="/manage/users" element={<P roles={['admin', 'supervisor']}><ManageUsers /></P>} />
      <Route path="/manage/branches" element={<P roles={['admin']}><ManageBranches /></P>} />

      <Route path="/messages" element={<P><Messages /></P>} />
      <Route path="/notifications" element={<P><Notifications /></P>} />
      <Route path="/profile" element={<P><Profile /></P>} />

      <Route path="*" element={<Navigate to={user ? (ROLE_HOME[user.role] || '/') : '/'} replace />} />
    </Routes>
  );
}
