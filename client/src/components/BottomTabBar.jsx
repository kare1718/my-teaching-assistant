import { useNavigate, useLocation } from 'react-router-dom';

const HomeIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
const ChartIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
const BellIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;
const VideoIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>;
const GameIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><circle cx="15" cy="11" r="1"/><circle cx="18" cy="13" r="1"/></svg>;
const QuestionIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
const OXIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="7" cy="12" r="4.5"/><line x1="17" y1="7.5" x2="22" y2="16.5"/><line x1="22" y1="7.5" x2="17" y2="16.5"/></svg>;

const tabs = [
  { path: '/student', label: '홈', Icon: HomeIcon },
  { path: '/student/scores', label: '성적', Icon: ChartIcon },
  { path: '/student/qna', label: '질문', Icon: QuestionIcon },
  { path: '/student/ox-quiz', label: 'O/X', Icon: OXIcon },
  { path: '/student/notices', label: '안내', Icon: BellIcon },
  { path: '/student/materials', label: '자료', Icon: VideoIcon },
  { path: '/student/game', label: '게임', Icon: GameIcon },
];

export default function BottomTabBar() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="bottom-tab-bar">
      {tabs.map((tab) => {
        const isActive = location.pathname === tab.path;
        return (
          <button
            key={tab.path}
            className={`bottom-tab ${isActive ? 'active' : ''}`}
            onClick={() => navigate(tab.path)}
          >
            <tab.Icon />
            <span className="tab-label">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
