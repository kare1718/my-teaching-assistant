import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, apiPut } from '../../api';
import AvatarSVG, { AVATAR_OPTIONS } from '../../components/AvatarSVG';
import { getLevelInfo } from '../../utils/gamification';
import BottomTabBar from '../../components/BottomTabBar';

export default function AvatarCustomize() {
  const navigate = useNavigate();
  const [charData, setCharData] = useState(null);
  const [gender, setGender] = useState('male');
  const [config, setConfig] = useState({
    topType: 'ShortHairShortFlat',
    accessoriesType: 'Blank',
    hairColor: 'Black',
    facialHairType: 'Blank',
    clotheType: 'Hoodie',
    clotheColor: 'Blue03',
    eyeType: 'Default',
    eyebrowType: 'Default',
    mouthType: 'Smile',
    skinColor: 'Light',
    mascot: 'none',
  });
  const [nickname, setNickname] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [activeSection, setActiveSection] = useState('topType');

  useEffect(() => {
    api('/gamification/my-character').then(data => {
      setCharData(data);
      if (data.avatarConfig && Object.keys(data.avatarConfig).length > 0) {
        setConfig(prev => ({ ...prev, ...data.avatarConfig }));
        // 기존 헤어로 성별 추측
        const savedTop = data.avatarConfig.topType;
        const maleOpts = AVATAR_OPTIONS.topType.filter(o => o.gender === 'male').map(o => o.id);
        if (savedTop && !maleOpts.includes(savedTop)) {
          const femaleOpts = AVATAR_OPTIONS.topType.filter(o => o.gender === 'female').map(o => o.id);
          if (femaleOpts.includes(savedTop)) setGender('female');
        }
      }
      setNickname(data.nickname || '');
    });
  }, []);

  const level = charData ? getLevelInfo(charData.xp).level : 1;

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiPut('/gamification/my-avatar', { avatarConfig: config, nickname });
      setMsg({ type: 'success', text: '✅ 아바타가 저장되었습니다!' });
      setTimeout(() => navigate('/student/game'), 1200);
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    }
    setSaving(false);
    setTimeout(() => setMsg(null), 3000);
  };

  const updateConfig = (key, value) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const allSections = [
    { id: 'topType', label: '💇 헤어' },
    { id: 'hairColor', label: '🖌 머리색' },
    { id: 'skinColor', label: '🎨 피부' },
    { id: 'eyeType', label: '👀 눈' },
    { id: 'eyebrowType', label: '🤨 눈썸' },
    { id: 'mouthType', label: '👄 입' },
    { id: 'clotheType', label: '👕 옷' },
    { id: 'clotheColor', label: '🌈 옷색' },
    { id: 'accessoriesType', label: '👓 액세' },
    { id: 'facialHairType', label: '🧔 수염', genderOnly: 'male' },
    { id: 'mascot', label: '🐾 마스코트' },
  ];
  const sections = allSections.filter(s => !s.genderOnly || s.genderOnly === gender);

  const renderOptionGrid = (optionKey, columns = 3) => {
    let options = AVATAR_OPTIONS[optionKey];
    if (!options) return null;
    // 헤어는 성별로 필터
    if (optionKey === 'topType') {
      options = options.filter(o => o.gender === gender || o.gender === 'all');
    }
    const hasIcon = options.some(o => o.icon);

    return (
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 8 }}>
        {options.map(opt => {
          const locked = (opt.unlockLevel || 1) > level;
          const selected = config[optionKey] === opt.id;
          return (
            <button key={opt.id} onClick={() => !locked && updateConfig(optionKey, opt.id)} style={{
              padding: '8px 4px', borderRadius: 10, cursor: locked ? 'not-allowed' : 'pointer',
              textAlign: 'center', opacity: locked ? 0.4 : 1,
              border: selected ? '3px solid var(--primary)' : '1px solid var(--border)',
              background: selected ? 'rgba(59,130,246,0.05)' : 'var(--card)'
            }}>
              {hasIcon && opt.icon ? (
                <div style={{ fontSize: 28 }}>{opt.icon}</div>
              ) : (
                <AvatarSVG config={{ ...config, [optionKey]: opt.id }} size={44} />
              )}
              <div style={{ fontSize: 11, fontWeight: 600, marginTop: 2 }}>{opt.label}</div>
              {locked && <div style={{ fontSize: 9, color: 'var(--destructive)' }}>Lv.{opt.unlockLevel}</div>}
            </button>
          );
        })}
      </div>
    );
  };

  const currentSection = sections.find(s => s.id === activeSection);
  const sectionLabel = currentSection ? currentSection.label : '';

  return (
    <div className="content" style={{ paddingBottom: 80 }}>
      <div className="card" style={{ textAlign: 'center', padding: '20px 16px' }}>
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <AvatarSVG config={config} size={120} />
          <div style={{
            position: 'absolute', bottom: -4, right: -4,
            background: 'var(--primary)', color: 'white', fontSize: 10,
            fontWeight: 700, padding: '2px 8px', borderRadius: 10
          }}>Lv.{level}</div>
        </div>
        <div style={{ marginTop: 10 }}>
          <input
            value={nickname}
            onChange={e => setNickname(e.target.value)}
            placeholder={"닉네임 입력 (최대 10자)"}
            maxLength={10}
            style={{
              textAlign: 'center', fontSize: 16, fontWeight: 700,
              border: '1px solid var(--border)', borderRadius: 8,
              padding: '8px 16px', width: '80%', maxWidth: 240
            }}
          />
          <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 4 }}>
            {`2~10자 · 한글, 영문, 숫자 사용 가능`}
          </div>
        </div>
      </div>

      {/* 성별 선택 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        {[
          { id: 'male', label: '🧑 남캐', color: 'var(--info)' },
          { id: 'female', label: '👩 여캐', color: 'oklch(60% 0.20 350)' },
        ].map(g => (
          <button key={g.id} onClick={() => {
            setGender(g.id);
            // 성별 바꾸면 기본 헤어로 변경
            const defaultHair = AVATAR_OPTIONS.topType.find(o => o.gender === g.id);
            if (defaultHair) updateConfig('topType', defaultHair.id);
            if (g.id === 'female') updateConfig('facialHairType', 'Blank');
          }} style={{
            flex: 1, padding: '10px 0', borderRadius: 10, cursor: 'pointer',
            border: gender === g.id ? `2px solid ${g.color}` : '1px solid var(--border)',
            background: gender === g.id ? `${g.color}15` : 'var(--card)',
            fontWeight: 700, fontSize: 14, color: gender === g.id ? g.color : 'var(--foreground)'
          }}>{g.label}</button>
        ))}
      </div>

      <div style={{
        display: 'flex', gap: 4, overflowX: 'auto', marginBottom: 8,
        paddingBottom: 2, WebkitOverflowScrolling: 'touch'
      }}>
        {sections.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            style={{
              flex: '0 0 auto', padding: '7px 12px', borderRadius: 8,
              border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 12,
              whiteSpace: 'nowrap',
              background: activeSection === s.id ? 'var(--primary)' : 'var(--muted)',
              color: activeSection === s.id ? 'white' : 'var(--foreground)'
            }}
          >{s.label}</button>
        ))}
      </div>

      <div className="card" style={{ padding: 16 }}>
        <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{sectionLabel}</h4>
        <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 12 }}>
          {"일부 옵션은 레벨 달성 시 해금됩니다"}
        </p>
        {activeSection === 'mascot' ? (
          renderOptionGrid('mascot', 4)
        ) : (
          renderOptionGrid(activeSection, activeSection === 'skinColor' ? 4 : 3)
        )}
      </div>

      {msg && (
        <div style={{
          padding: '10px 14px', borderRadius: 8, marginTop: 8, fontSize: 14, fontWeight: 600, textAlign: 'center',
          background: msg.type === 'success' ? 'var(--success-light)' : 'var(--destructive-light)',
          color: msg.type === 'success' ? 'oklch(30% 0.12 145)' : 'oklch(35% 0.15 25)'
        }}>
          {msg.text}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button className="btn btn-outline" onClick={() => navigate('/student/game')}
          style={{ flex: 1 }}>{"← 돌아가기"}</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}
          style={{ flex: 2, fontSize: 15, padding: 14 }}>
          {saving ? "저장 중..." : "💾 아바타 저장하기"}
        </button>
      </div>

      <BottomTabBar />
    </div>
  );
}
