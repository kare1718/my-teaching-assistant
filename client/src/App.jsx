import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { getUser, logout, isLoggedIn, checkTokenExpiry } from './api';
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
import RolePermissions from './pages/admin/RolePermissions';
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
import AttendanceManage from './pages/admin/AttendanceManage';
import TuitionManage from './pages/admin/TuitionManage';
import ConsultationLog from './pages/admin/ConsultationLog';
import LeadManage from './pages/admin/LeadManage';
import PortfolioManage from './pages/admin/PortfolioManage';
import SmsCredits from './pages/admin/SmsCredits';
import AIAssistant from './pages/admin/AIAssistant';
import BackupManage from './pages/admin/BackupManage';
import BackupSecurity from './pages/admin/BackupSecurity';
import ClassManage from './pages/admin/ClassManage';
import SuperDashboard from './pages/superadmin/Dashboard';
import AcademyDetail from './pages/superadmin/AcademyDetail';
import AcademyCreate from './pages/superadmin/AcademyCreate';
import SuperBackupSecurity from './pages/superadmin/BackupSecurity';
import PromotionsPage from './pages/superadmin/PromotionsPage';
import RevenuePage from './pages/superadmin/RevenuePage';
import PreRegistered from './pages/admin/PreRegistered';
import ParentManage from './pages/admin/ParentManage';
import ProfileManage from './pages/admin/ProfileManage';
import UserGuide from './pages/admin/UserGuide';
import AutomationManage from './pages/admin/AutomationManage';
import AttendanceCheck from './pages/student/AttendanceCheck';
import Portfolio from './pages/student/Portfolio';
import AIHub from './pages/student/AIHub';
import InfoHub from './pages/student/InfoHub';
import StudyTimer from './pages/student/StudyTimer';
import StudyRankings from './pages/student/StudyRankings';
import SideNav from './components/SideNav';
import PlatformNotificationBell from './components/PlatformNotificationBell';
import ParentBottomNav from './components/ParentBottomNav';
import PaymentPage from './pages/PaymentPage';
import NotFoundPage from './pages/NotFoundPage';
import ParentHome from './pages/parent/ParentHome';
import ParentAttendance from './pages/parent/ParentAttendance';
import ParentTuition from './pages/parent/ParentTuition';
import ParentNotices from './pages/parent/ParentNotices';
import ParentMore from './pages/parent/ParentMore';
import Terms from './pages/legal/Terms';
import Privacy from './pages/legal/Privacy';
import Refund from './pages/legal/Refund';
import BusinessInfo from './pages/legal/BusinessInfo';

function Navbar() {
  const navigate = useNavigate();
  const user = getUser();
  const { config } = useTenantConfig();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (!user) return null;

  return (
    <nav className="navbar">
      <h1
        style={{ cursor: 'pointer' }}
        onClick={() => navigate(user.role === 'superadmin' ? '/superadmin' : user.role === 'parent' ? '/parent' : (user.role === 'admin' || user.school === '조교' || user.school === '선생님') ? '/admin' : '/student')}
      >
        {config?.siteTitle || '나만의 조교'}
      </h1>
      <div className="nav-right" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {(user.role === 'admin' || user.school === '조교') && <PlatformNotificationBell />}
        <span>{user.name}님 ({user.role === 'superadmin' ? '플랫폼 관리자' : user.role === 'admin' ? '관리자' : user.role === 'parent' ? '보호자' : user.school === '조교' ? '조교' : user.school === '선생님' ? '선생님' : '학생'})</span>
        <button onClick={handleLogout}>로그아웃</button>
      </div>
    </nav>
  );
}

function ProtectedRoute({ children, role }) {
  const user = getUser();
  if (!isLoggedIn() || !user) return <Navigate to="/login" />;
  const isAssistant = user.school === '조교';
  if (user.role === 'superadmin') return children;
  if (role && user.role !== role) {
    if (user.role === 'admin' && role === 'student') return children;
    if (isAssistant && (role === 'admin' || role === 'student')) return children;
    if (user.role === 'parent') return <Navigate to="/parent" />;
    return <Navigate to={user.role === 'admin' ? '/admin' : (isAssistant ? '/admin' : '/student')} />;
  }
  return children;
}

function RedirectIfLoggedIn({ children }) {
  const user = getUser();
  if (isLoggedIn() && user) {
    if (user.role === 'superadmin') return <Navigate to="/superadmin" />;
    if (user.role === 'parent') return <Navigate to="/parent" />;
    const isAssistant = user.school === '조교';
    return <Navigate to={(user.role === 'admin' || isAssistant) ? '/admin' : '/student'} />;
  }
  return children;
}

function App() {
  const [authKey, setAuthKey] = useState(0);

  useEffect(() => {
    checkTokenExpiry();
  }, []);

  useEffect(() => {
    const handler = () => setAuthKey(k => k + 1);
    window.addEventListener('auth-changed', handler);
    return () => window.removeEventListener('auth-changed', handler);
  }, []);

  return (
    <BrowserRouter key={authKey}>
      <TenantProvider>
        <AppLayout />
      </TenantProvider>
    </BrowserRouter>
  );
}

function ParentLayout() {
  return (
    <>
      <div style={{ paddingBottom: 60 }}>
        <Routes>
          <Route index element={<ParentHome />} />
          <Route path="attendance" element={<ParentAttendance />} />
          <Route path="tuition" element={<ParentTuition />} />
          <Route path="notices" element={<ParentNotices />} />
          <Route path="more" element={<ParentMore />} />
        </Routes>
      </div>
      <ParentBottomNav />
    </>
  );
}

function AppLayout() {
  const location = useLocation();
  const user = getUser();
  const isPublicPayment = location.pathname.startsWith('/pay/');
  const isParentRoute = location.pathname.startsWith('/parent');

  return (
    <div className="app">
      {!isPublicPayment && !isParentRoute && <Navbar />}
      {!isPublicPayment && !isParentRoute && <SideNav />}
      {isParentRoute && <Navbar />}
      <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/login" element={<RedirectIfLoggedIn><LoginPage /></RedirectIfLoggedIn>} />
            <Route path="/register" element={<RedirectIfLoggedIn><RegisterPage /></RedirectIfLoggedIn>} />
            <Route path="/pay/:token" element={<PaymentPage />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/refund" element={<Refund />} />
            <Route path="/business-info" element={<BusinessInfo />} />

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
            <Route path="/admin/settings/roles" element={<ProtectedRoute role="admin"><RolePermissions /></ProtectedRoute>} />
            <Route path="/admin/subscription" element={<ProtectedRoute role="admin"><SubscriptionPage /></ProtectedRoute>} />
            <Route path="/admin/attendance" element={<ProtectedRoute role="admin"><AttendanceManage /></ProtectedRoute>} />
            <Route path="/admin/tuition" element={<ProtectedRoute role="admin"><TuitionManage /></ProtectedRoute>} />
            <Route path="/admin/parents" element={<ProtectedRoute role="admin"><ParentManage /></ProtectedRoute>} />
            <Route path="/admin/consultations" element={<ProtectedRoute role="admin"><ConsultationLog /></ProtectedRoute>} />
            <Route path="/admin/leads" element={<ProtectedRoute role="admin"><LeadManage /></ProtectedRoute>} />
            <Route path="/admin/portfolios" element={<ProtectedRoute role="admin"><PortfolioManage /></ProtectedRoute>} />
            <Route path="/admin/sms-credits" element={<ProtectedRoute role="admin"><SmsCredits /></ProtectedRoute>} />
            <Route path="/admin/ai" element={<ProtectedRoute role="admin"><AIAssistant /></ProtectedRoute>} />
            <Route path="/admin/backup" element={<ProtectedRoute role="admin"><BackupManage /></ProtectedRoute>} />
            <Route path="/admin/backup-security" element={<ProtectedRoute role="admin"><BackupSecurity /></ProtectedRoute>} />
            <Route path="/admin/pre-registered" element={<ProtectedRoute role="admin"><PreRegistered /></ProtectedRoute>} />
            <Route path="/admin/profile" element={<ProtectedRoute role="admin"><ProfileManage /></ProtectedRoute>} />
            <Route path="/admin/classes" element={<ProtectedRoute role="admin"><ClassManage /></ProtectedRoute>} />
            <Route path="/admin/guide" element={<ProtectedRoute role="admin"><UserGuide /></ProtectedRoute>} />
            <Route path="/admin/automation" element={<ProtectedRoute role="admin"><AutomationManage /></ProtectedRoute>} />

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
            <Route path="/student/attendance" element={<ProtectedRoute role="student"><AttendanceCheck /></ProtectedRoute>} />
            <Route path="/student/portfolio" element={<ProtectedRoute role="student"><Portfolio /></ProtectedRoute>} />
            <Route path="/student/ai" element={<ProtectedRoute role="student"><AIHub /></ProtectedRoute>} />
            <Route path="/student/info" element={<ProtectedRoute role="student"><InfoHub /></ProtectedRoute>} />
            <Route path="/student/timer" element={<ProtectedRoute role="student"><StudyTimer /></ProtectedRoute>} />
            <Route path="/student/study-rankings" element={<ProtectedRoute role="student"><StudyRankings /></ProtectedRoute>} />

            <Route path="/parent/*" element={<ProtectedRoute role="parent"><ParentLayout /></ProtectedRoute>} />

            <Route path="/superadmin" element={<ProtectedRoute role="superadmin"><SuperDashboard /></ProtectedRoute>} />
            <Route path="/superadmin/academy/new" element={<ProtectedRoute role="superadmin"><AcademyCreate /></ProtectedRoute>} />
            <Route path="/superadmin/academy/:id" element={<ProtectedRoute role="superadmin"><AcademyDetail /></ProtectedRoute>} />
            <Route path="/superadmin/promotions" element={<ProtectedRoute role="superadmin"><PromotionsPage /></ProtectedRoute>} />
            <Route path="/superadmin/revenue" element={<ProtectedRoute role="superadmin"><RevenuePage /></ProtectedRoute>} />
            <Route path="/superadmin/backup-security" element={<ProtectedRoute role="superadmin"><SuperBackupSecurity /></ProtectedRoute>} />

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
    </div>
  );
}

export default App;
