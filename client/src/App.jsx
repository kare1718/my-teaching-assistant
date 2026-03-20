import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { getUser, logout, isLoggedIn } from './api';
import { TenantProvider, useTenantConfig } from './contexts/TenantContext';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import LandingPage from './pages/LandingPage';
import OnboardingPage from './pages/OnboardingPage';
import AdminDashboard from './pages/admin/Dashboard';
import SchoolPage from './pages/admin/SchoolPage';
import GradePage from './pages/admin/GradePage';
import StudentManage from './pages/admin/StudentManage';
import ScoreInput from './pages/admin/ScoreInput';
import NoticeCreate from './pages/admin/NoticeCreate';
import PendingUsers from './pages/admin/PendingUsers';
import EditRequests from './pages/admin/EditRequests';
import ReviewManage from './pages/admin/ReviewManage';
import QnAManage from './pages/admin/QnAManage';
import AdminStudentView from './pages/admin/AdminStudentView';
import AcademySettings from './pages/admin/AcademySettings';
import SubscriptionPage from './pages/admin/SubscriptionPage';
import MyPage from './pages/student/MyPage';
import Notices from './pages/student/Notices';
import ScoreView from './pages/student/ScoreView';
import Materials from './pages/student/Materials';
import Reviews from './pages/student/Reviews';
import QnA from './pages/student/QnA';
import GameHub from './pages/student/GameHub';
import VocabQuiz from './pages/student/VocabQuiz';
import KnowledgeQuiz from './pages/student/KnowledgeQuiz';
import ReadingQuiz from './pages/student/ReadingQuiz';
import Rankings from './pages/student/Rankings';
import Shop from './pages/student/Shop';
import AvatarCustomize from './pages/student/AvatarCustomize';
import GamificationManage from './pages/admin/GamificationManage';
import SmsManage from './pages/admin/SmsManage';
import ClinicManage from './pages/admin/ClinicManage';
import ScheduleManage from './pages/admin/ScheduleManage';
import ClinicApply from './pages/student/ClinicApply';
import HallOfFameManage from './pages/admin/HallOfFameManage';
import TAScheduleManage from './pages/admin/TAScheduleManage';
import HomeworkManage from './pages/admin/HomeworkManage';
import OXQuiz from './pages/student/OXQuiz';
import ReportManage from './pages/admin/ReportManage';
import SideNav from './components/SideNav';

function Navbar() {
  const navigate = useNavigate();
  const user = getUser();
  const { config } = useTenantConfig();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) return null;

  return (
    <nav className="navbar">
      <h1
        style={{ cursor: 'pointer' }}
        onClick={() => navigate((user.role === 'admin' || user.school === '조교' || user.school === '선생님') ? '/admin' : '/student')}
      >
        {config?.siteTitle || '나만의 조교'}
      </h1>
      <div className="nav-right">
        <span>{user.name}님 ({user.role === 'admin' ? '관리자' : user.school === '조교' ? '조교' : user.school === '선생님' ? '선생님' : '학생'})</span>
        <button onClick={handleLogout}>로그아웃</button>
      </div>
    </nav>
  );
}

function ProtectedRoute({ children, role }) {
  const user = getUser();
  if (!isLoggedIn() || !user) return <Navigate to="/login" />;
  const isAssistant = user.school === '조교';
  if (role && user.role !== role) {
    if (user.role === 'admin' && role === 'student') return children;
    if (isAssistant && (role === 'admin' || role === 'student')) return children;
    return <Navigate to={user.role === 'admin' ? '/admin' : (isAssistant ? '/admin' : '/student')} />;
  }
  return children;
}

function RedirectIfLoggedIn({ children }) {
  const user = getUser();
  if (isLoggedIn() && user) {
    const isAssistant = user.school === '조교';
    return <Navigate to={(user.role === 'admin' || isAssistant) ? '/admin' : '/student'} />;
  }
  return children;
}

function App() {
  const [authKey, setAuthKey] = useState(0);

  useEffect(() => {
    const handler = () => setAuthKey(k => k + 1);
    window.addEventListener('auth-changed', handler);
    return () => window.removeEventListener('auth-changed', handler);
  }, []);

  return (
    <BrowserRouter key={authKey}>
      <TenantProvider>
        <div className="app">
          <Navbar />
          <SideNav />
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/login" element={<RedirectIfLoggedIn><LoginPage /></RedirectIfLoggedIn>} />
            <Route path="/register" element={<RedirectIfLoggedIn><RegisterPage /></RedirectIfLoggedIn>} />

            <Route path="/admin" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/school/:school" element={<ProtectedRoute role="admin"><SchoolPage /></ProtectedRoute>} />
            <Route path="/admin/school/:school/grade/:grade" element={<ProtectedRoute role="admin"><GradePage /></ProtectedRoute>} />
            <Route path="/admin/student/:id" element={<ProtectedRoute role="admin"><StudentManage /></ProtectedRoute>} />
            <Route path="/admin/scores" element={<ProtectedRoute role="admin"><ScoreInput /></ProtectedRoute>} />
            <Route path="/admin/notices" element={<ProtectedRoute role="admin"><NoticeCreate /></ProtectedRoute>} />
            <Route path="/admin/pending" element={<ProtectedRoute role="admin"><PendingUsers /></ProtectedRoute>} />
            <Route path="/admin/edit-requests" element={<ProtectedRoute role="admin"><EditRequests /></ProtectedRoute>} />
            <Route path="/admin/reviews" element={<ProtectedRoute role="admin"><ReviewManage /></ProtectedRoute>} />
            <Route path="/admin/qna" element={<ProtectedRoute role="admin"><QnAManage /></ProtectedRoute>} />
            <Route path="/admin/student-view/:id" element={<ProtectedRoute role="admin"><AdminStudentView /></ProtectedRoute>} />
            <Route path="/admin/gamification" element={<ProtectedRoute role="admin"><GamificationManage /></ProtectedRoute>} />
            <Route path="/admin/sms" element={<ProtectedRoute role="admin"><SmsManage /></ProtectedRoute>} />
            <Route path="/admin/clinic" element={<ProtectedRoute role="admin"><ClinicManage /></ProtectedRoute>} />
            <Route path="/admin/schedules" element={<ProtectedRoute role="admin"><ScheduleManage /></ProtectedRoute>} />
            <Route path="/admin/hall-of-fame" element={<ProtectedRoute role="admin"><HallOfFameManage /></ProtectedRoute>} />
            <Route path="/admin/ta-schedule" element={<ProtectedRoute role="admin"><TAScheduleManage /></ProtectedRoute>} />
            <Route path="/admin/homework" element={<ProtectedRoute role="admin"><HomeworkManage /></ProtectedRoute>} />
            <Route path="/admin/reports" element={<ProtectedRoute role="admin"><ReportManage /></ProtectedRoute>} />
            <Route path="/admin/settings" element={<ProtectedRoute role="admin"><AcademySettings /></ProtectedRoute>} />
            <Route path="/admin/subscription" element={<ProtectedRoute role="admin"><SubscriptionPage /></ProtectedRoute>} />

            <Route path="/student" element={<ProtectedRoute role="student"><MyPage /></ProtectedRoute>} />
            <Route path="/student/notices" element={<ProtectedRoute role="student"><Notices /></ProtectedRoute>} />
            <Route path="/student/scores" element={<ProtectedRoute role="student"><ScoreView /></ProtectedRoute>} />
            <Route path="/student/materials" element={<ProtectedRoute role="student"><Materials /></ProtectedRoute>} />
            <Route path="/student/reviews" element={<ProtectedRoute role="student"><Reviews /></ProtectedRoute>} />
            <Route path="/student/qna" element={<ProtectedRoute role="student"><QnA /></ProtectedRoute>} />
            <Route path="/student/game" element={<ProtectedRoute role="student"><GameHub /></ProtectedRoute>} />
            <Route path="/student/quiz" element={<ProtectedRoute role="student"><VocabQuiz /></ProtectedRoute>} />
            <Route path="/student/knowledge-quiz" element={<ProtectedRoute role="student"><KnowledgeQuiz /></ProtectedRoute>} />
            <Route path="/student/reading-quiz" element={<ProtectedRoute role="student"><ReadingQuiz /></ProtectedRoute>} />
            <Route path="/student/ox-quiz" element={<ProtectedRoute role="student"><OXQuiz /></ProtectedRoute>} />
            <Route path="/student/rankings" element={<ProtectedRoute role="student"><Rankings /></ProtectedRoute>} />
            <Route path="/student/shop" element={<ProtectedRoute role="student"><Shop /></ProtectedRoute>} />
            <Route path="/student/avatar" element={<ProtectedRoute role="student"><AvatarCustomize /></ProtectedRoute>} />
            <Route path="/student/clinic" element={<ProtectedRoute role="student"><ClinicApply /></ProtectedRoute>} />

            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </TenantProvider>
    </BrowserRouter>
  );
}

export default App;
