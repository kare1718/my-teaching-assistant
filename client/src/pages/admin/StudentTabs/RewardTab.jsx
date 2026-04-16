import { useEffect, useState } from 'react';
import { api } from '../../../api';
import { Card, Loading, Empty, Stat, Icon } from './_shared';

export default function RewardTab({ studentId, hasFeature }) {
  const [character, setCharacter] = useState(null);
  const [loading, setLoading] = useState(true);

  const gamificationEnabled = typeof hasFeature === 'function' ? hasFeature('gamification') : true;

  useEffect(() => {
    if (!gamificationEnabled) { setLoading(false); return; }
    let cancel = false;
    setLoading(true);
    api(`/gamification/student/${studentId}`)
      .then(d => { if (!cancel) setCharacter(d); })
      .catch(() => { if (!cancel) setCharacter(null); })
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, [studentId, gamificationEnabled]);

  if (!gamificationEnabled) {
    return (
      <Card className="text-center">
        <Icon name="workspace_premium" className="text-5xl text-slate-300 mb-3 block" />
        <div className="text-lg font-extrabold text-[var(--primary)] mb-1">Premium 전용 기능</div>
        <p className="text-sm text-slate-500">게이미피케이션은 First Class 플랜에서 이용 가능합니다.</p>
      </Card>
    );
  }

  if (loading) return <Loading />;

  if (!character) return <Empty icon="workspace_premium" text="리워드 데이터가 없습니다" />;

  return (
    <div className="space-y-6">
      <Card label="리워드 상태" title={character.char_name || '캐릭터'}>
        <div className="grid grid-cols-3 gap-2 md:gap-3">
          <Stat label="레벨" value={`Lv.${character.level || 1}`} accent="var(--cta)" />
          <Stat label="XP" value={(character.xp || 0).toLocaleString()} />
          <Stat label="포인트" value={(character.points || 0).toLocaleString()} accent="#f59e0b" />
        </div>
      </Card>
    </div>
  );
}
