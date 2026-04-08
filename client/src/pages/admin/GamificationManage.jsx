import { useState, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';

const RankingsTab = lazy(() => import('./gamification/RankingsTab'));
const CodesTab = lazy(() => import('./gamification/CodesTab'));
const XpTab = lazy(() => import('./gamification/XpTab'));
const TitlesTab = lazy(() => import('./gamification/TitlesTab'));
const KnowledgeTab = lazy(() => import('./gamification/KnowledgeTab'));
const ReadingTab = lazy(() => import('./gamification/ReadingTab'));
const VocabTab = lazy(() => import('./gamification/VocabTab'));
const ShopTab = lazy(() => import('./gamification/ShopTab'));
const XpLogTab = lazy(() => import('./gamification/XpLogTab'));
const BackupTab = lazy(() => import('./gamification/BackupTab'));
const RewardsTab = lazy(() => import('./gamification/RewardsTab'));
const StudyTimerActiveTab = lazy(() => import('./gamification/StudyTimerActiveTab'));
const StudyTimerStatsTab = lazy(() => import('./gamification/StudyTimerStatsTab'));

export default function GamificationManage() {
  const navigate = useNavigate();
  const [group, setGroup] = useState('students');
  const [subTab, setSubTab] = useState('');

  const groups = [
    { id: 'students', label: '👥 학생관리', subs: [
      { id: 'rankings', label: '랭킹' },
      { id: 'xp', label: 'XP 조정' },
      { id: 'titles', label: '칭호' },
      { id: 'xplog', label: '활동로그' },
    ]},
    { id: 'quiz', label: '📝 퀴즈관리', subs: [
      { id: 'vocab', label: '어휘' },
      { id: 'knowledge', label: '지식퀴즈' },
      { id: 'reading', label: '비문학' },
    ]},
    { id: 'shopReward', label: '🛒 상점/보상', subs: [
      { id: 'shop', label: '상점' },
      { id: 'codes', label: '히든코드' },
      { id: 'rewards', label: '보상설정' },
    ]},
    { id: 'studytimer', label: '⏱️ 공부타이머', subs: [
      { id: 'st_active', label: '활성 세션' },
      { id: 'st_stats', label: '학생 통계' },
    ]},
  ];

  // 그룹 변경 시 첫 번째 서브탭 자동 선택
  const currentGroup = groups.find(g => g.id === group) || groups[0];
  const activeSubTab = subTab && currentGroup.subs.find(s => s.id === subTab) ? subTab : currentGroup.subs[0]?.id;

  return (
    <div className="content">
      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <button className="btn btn-outline btn-sm" onClick={() => navigate('/admin')}>← 대시보드</button>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>🎮 게임 관리</h2>
        <div style={{ width: 80 }} />
      </div>

      {/* 메인 그룹 탭 (3개) */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {groups.map(g => (
          <button key={g.id} onClick={() => { setGroup(g.id); setSubTab(g.subs[0]?.id || ''); }}
            style={{
              flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontWeight: 700, fontSize: 13,
              background: group === g.id ? 'var(--primary)' : 'var(--muted)',
              color: group === g.id ? 'white' : 'var(--foreground)',
              transition: 'all 0.15s',
            }}>{g.label}</button>
        ))}
      </div>

      {/* 서브 탭 */}
      <div style={{ display: 'flex', gap: 3, marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
        {currentGroup.subs.map(s => (
          <button key={s.id} onClick={() => setSubTab(s.id)}
            style={{
              padding: '5px 14px', borderRadius: 20, cursor: 'pointer',
              fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap',
              border: activeSubTab === s.id ? '1px solid var(--primary)' : '1px solid var(--border)',
              background: activeSubTab === s.id ? 'var(--info-light)' : 'var(--card)',
              color: activeSubTab === s.id ? 'var(--primary)' : 'var(--muted-foreground)',
            }}>{s.label}</button>
        ))}
      </div>

      {/* 콘텐츠 */}
      <Suspense fallback={<div style={{ textAlign: 'center', padding: 40, color: 'var(--muted-foreground)' }}>로딩 중...</div>}>
        {activeSubTab === 'rankings' && <RankingsTab />}
        {activeSubTab === 'xp' && <XpTab />}
        {activeSubTab === 'titles' && <TitlesTab />}
        {activeSubTab === 'xplog' && <XpLogTab />}
        {activeSubTab === 'vocab' && <VocabTab />}
        {activeSubTab === 'knowledge' && <KnowledgeTab />}
        {activeSubTab === 'reading' && <ReadingTab />}
        {activeSubTab === 'shop' && <ShopTab />}
        {activeSubTab === 'codes' && <CodesTab />}
        {activeSubTab === 'rewards' && <RewardsTab />}
        {activeSubTab === 'st_active' && <StudyTimerActiveTab />}
        {activeSubTab === 'st_stats' && <StudyTimerStatsTab />}
      </Suspense>
    </div>
  );
}
