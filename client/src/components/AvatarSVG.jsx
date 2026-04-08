// Avataaars 기반 아바타 컴포넌트
// avataaars.io API를 통한 SVG 이미지 렌더링 (React 19 호환)

const MASCOTS = {
  none: null,
  tiger: '\u{1F42F}',
  dragon: '\u{1F432}',
  eagle: '\u{1F985}',
  fox: '\u{1F98A}',
  wolf: '\u{1F43A}',
  lion: '\u{1F981}',
  phoenix: '\u{1F525}',
  unicorn: '\u{1F984}',
  panda: '\u{1F43C}',
  rabbit: '\u{1F430}',
  cat: '\u{1F431}',
  bear: '\u{1F43B}',
};

function buildAvatarUrl(cfg) {
  const params = new URLSearchParams({
    avatarStyle: 'Circle',
    topType: cfg.topType || 'ShortHairShortFlat',
    accessoriesType: cfg.accessoriesType || 'Blank',
    hairColor: cfg.hairColor || 'Black',
    facialHairType: cfg.facialHairType || 'Blank',
    clotheType: cfg.clotheType || 'Hoodie',
    clotheColor: cfg.clotheColor || 'Blue03',
    eyeType: cfg.eyeType || 'Default',
    eyebrowType: cfg.eyebrowType || 'Default',
    mouthType: cfg.mouthType || 'Smile',
    skinColor: cfg.skinColor || 'Light',
  });
  return `https://avataaars.io/?${params.toString()}`;
}

const MEDAL_COLORS = {
  gold: { border: 'oklch(80% 0.14 85)', glow: 'oklch(80% 0.14 85 / 0.6)', icon: '\u{1F947}' },
  silver: { border: 'var(--neutral-400)', glow: 'oklch(70% 0.01 250 / 0.5)', icon: '\u{1F948}' },
  bronze: { border: 'oklch(60% 0.10 55)', glow: 'oklch(60% 0.10 55 / 0.5)', icon: '\u{1F949}' },
};

export default function AvatarSVG({ config = {}, size = 100, style = {}, rankingBadge = null }) {
  const mascot = config.mascot || 'none';
  const mascotEmoji = MASCOTS[mascot];
  const bs = Math.max(20, size * 0.3);
  const bf = Math.max(12, size * 0.2);
  const url = buildAvatarUrl(config);

  // 랭킹 배지 만료 체크
  const activeBadge = rankingBadge && rankingBadge.expires && new Date(rankingBadge.expires) > new Date()
    ? rankingBadge : null;
  const medal = activeBadge ? MEDAL_COLORS[activeBadge.medal] : null;

  return (
    <div style={{ position: 'relative', display: 'inline-block', width: size, height: size, ...style }}>
      {medal && (
        <div style={{
          position: 'absolute', top: -3, left: -3, right: -3, bottom: -3,
          borderRadius: '50%',
          border: `3px solid ${medal.border}`,
          boxShadow: `0 0 10px ${medal.glow}, inset 0 0 6px ${medal.glow}`,
          animation: activeBadge.medal === 'gold' ? 'rankGlow 2s ease-in-out infinite' : 'none',
          zIndex: 0
        }} />
      )}
      <img
        src={url}
        alt="avatar"
        width={size}
        height={size}
        style={{ borderRadius: '50%', background: 'var(--muted)', position: 'relative', zIndex: 1 }}
      />
      {mascotEmoji && (
        <span style={{
          position: 'absolute', top: -2, right: -2,
          width: bs, height: bs, borderRadius: '50%',
          background: 'white', border: '2px solid oklch(80% 0.14 85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: bf, lineHeight: 1,
          boxShadow: '0 2px 6px rgba(251,191,36,0.4)',
          zIndex: 3
        }}>
          {mascotEmoji}
        </span>
      )}
      {medal && (
        <span style={{
          position: 'absolute', bottom: -4, left: -4,
          width: bs, height: bs, borderRadius: '50%',
          background: 'white', border: `2px solid ${medal.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: bf, lineHeight: 1,
          boxShadow: `0 2px 6px ${medal.glow}`,
          zIndex: 3
        }}>
          {medal.icon}
        </span>
      )}
    </div>
  );
}

export { buildAvatarUrl };

// avataaars 옵션 내보내기 (레벨 잠금 시스템 포함)
export const AVATAR_OPTIONS = {
  topType: [
    // 남캐 헤어
    { id: 'ShortHairShortFlat', label: '짧은 단정', unlockLevel: 1, gender: 'male' },
    { id: 'ShortHairShortCurly', label: '짧은 곱슬', unlockLevel: 1, gender: 'male' },
    { id: 'ShortHairShortWaved', label: '짧은 웨이브', unlockLevel: 1, gender: 'male' },
    { id: 'ShortHairShortRound', label: '짧은 둥근', unlockLevel: 3, gender: 'male' },
    { id: 'ShortHairTheCaesar', label: '시저컷', unlockLevel: 5, gender: 'male' },
    { id: 'ShortHairTheCaesarSidePart', label: '시저 사이드', unlockLevel: 5, gender: 'male' },
    { id: 'ShortHairDreads01', label: '드레드 1', unlockLevel: 8, gender: 'male' },
    { id: 'ShortHairDreads02', label: '드레드 2', unlockLevel: 8, gender: 'male' },
    { id: 'ShortHairFrizzle', label: '부스스', unlockLevel: 10, gender: 'male' },
    { id: 'ShortHairSides', label: '옆머리', unlockLevel: 10, gender: 'male' },
    { id: 'ShortHairOverEye', label: '눈 덮개', unlockLevel: 15, gender: 'male' },
    { id: 'NoHair', label: '민머리', unlockLevel: 20, gender: 'male' },
    // 여캐 헤어
    { id: 'LongHairBob', label: '단발', unlockLevel: 1, gender: 'female' },
    { id: 'LongHairStraight', label: '생머리', unlockLevel: 1, gender: 'female' },
    { id: 'LongHairStraight2', label: '긴 생머리', unlockLevel: 1, gender: 'female' },
    { id: 'LongHairCurly', label: '긴 곱슬', unlockLevel: 3, gender: 'female' },
    { id: 'LongHairCurvy', label: '긴 웨이브', unlockLevel: 5, gender: 'female' },
    { id: 'LongHairBun', label: '올림머리', unlockLevel: 8, gender: 'female' },
    { id: 'LongHairStraightStrand', label: '앞머리 가닥', unlockLevel: 10, gender: 'female' },
    { id: 'LongHairNotTooLong', label: '적당한 긴머리', unlockLevel: 12, gender: 'female' },
    { id: 'LongHairMiaWallace', label: '미아 월리스', unlockLevel: 15, gender: 'female' },
    { id: 'LongHairBigHair', label: '볼륨 헤어', unlockLevel: 18, gender: 'female' },
    { id: 'LongHairFrida', label: '프리다', unlockLevel: 22, gender: 'female' },
    { id: 'LongHairFro', label: '아프로', unlockLevel: 25, gender: 'female' },
    { id: 'LongHairFroBand', label: '아프로+밴드', unlockLevel: 28, gender: 'female' },
    // 공용 (모자/액세서리)
    { id: 'Hat', label: '모자', unlockLevel: 15, gender: 'all' },
    { id: 'Eyepatch', label: '안대', unlockLevel: 25, gender: 'all' },
    { id: 'WinterHat1', label: '겨울모자 1', unlockLevel: 30, gender: 'all' },
    { id: 'WinterHat2', label: '겨울모자 2', unlockLevel: 32, gender: 'all' },
    { id: 'WinterHat3', label: '겨울모자 3', unlockLevel: 38, gender: 'all' },
    { id: 'WinterHat4', label: '겨울모자 4', unlockLevel: 42, gender: 'all' },
    { id: 'Turban', label: '터번', unlockLevel: 45, gender: 'all' },
    { id: 'Hijab', label: '히잡', unlockLevel: 35, gender: 'all' },
    { id: 'LongHairDreads', label: '긴 드레드', unlockLevel: 20, gender: 'all' },
    { id: 'LongHairShavedSides', label: '사이드 밀기', unlockLevel: 28, gender: 'all' },
  ],
  accessoriesType: [
    { id: 'Blank', label: '없음', unlockLevel: 1 },
    { id: 'Kurt', label: '커트 안경', unlockLevel: 10 },
    { id: 'Prescription01', label: '안경 1', unlockLevel: 15 },
    { id: 'Prescription02', label: '안경 2', unlockLevel: 20 },
    { id: 'Round', label: '둥근 안경', unlockLevel: 25 },
    { id: 'Sunglasses', label: '선글라스', unlockLevel: 35 },
    { id: 'Wayfarers', label: '웨이퍼러', unlockLevel: 40 },
  ],
  hairColor: [
    { id: 'Black', label: '블랙', unlockLevel: 1 },
    { id: 'BrownDark', label: '다크브라운', unlockLevel: 1 },
    { id: 'Brown', label: '브라운', unlockLevel: 3 },
    { id: 'Auburn', label: '오번', unlockLevel: 8 },
    { id: 'Blonde', label: '금발', unlockLevel: 12 },
    { id: 'BlondeGolden', label: '골든블론드', unlockLevel: 18 },
    { id: 'Red', label: '레드', unlockLevel: 25 },
    { id: 'Platinum', label: '플래티넘', unlockLevel: 32 },
    { id: 'SilverGray', label: '실버그레이', unlockLevel: 40 },
    { id: 'PastelPink', label: '파스텔핑크', unlockLevel: 45 },
  ],
  facialHairType: [
    { id: 'Blank', label: '없음', unlockLevel: 1 },
    { id: 'BeardLight', label: '가벼운 수염', unlockLevel: 15 },
    { id: 'BeardMagestic', label: '멋진 수염', unlockLevel: 25 },
    { id: 'BeardMedium', label: '중간 수염', unlockLevel: 20 },
    { id: 'MoustacheFancy', label: '멋진 콧수염', unlockLevel: 35 },
    { id: 'MoustacheMagnum', label: '매그넘 콧수염', unlockLevel: 40 },
  ],
  clotheType: [
    { id: 'Hoodie', label: '후드', unlockLevel: 1 },
    { id: 'ShirtCrewNeck', label: '크루넥', unlockLevel: 1 },
    { id: 'ShirtVNeck', label: 'V넥', unlockLevel: 5 },
    { id: 'CollarSweater', label: '카라 스웨터', unlockLevel: 10 },
    { id: 'Overall', label: '오버올', unlockLevel: 18 },
    { id: 'GraphicShirt', label: '그래픽 티', unlockLevel: 22 },
    { id: 'ShirtScoopNeck', label: '스쿱넥', unlockLevel: 28 },
    { id: 'BlazerShirt', label: '블레이저', unlockLevel: 35 },
    { id: 'BlazerSweater', label: '블레이저+스웨터', unlockLevel: 40 },
  ],
  clotheColor: [
    { id: 'Blue03', label: '블루', unlockLevel: 1 },
    { id: 'Gray02', label: '그레이', unlockLevel: 1 },
    { id: 'Black', label: '블랙', unlockLevel: 3 },
    { id: 'White', label: '화이트', unlockLevel: 5 },
    { id: 'Blue01', label: '라이트블루', unlockLevel: 8 },
    { id: 'Blue02', label: '네이비', unlockLevel: 12 },
    { id: 'Gray01', label: '라이트그레이', unlockLevel: 15 },
    { id: 'Heather', label: '헤더', unlockLevel: 18 },
    { id: 'PastelBlue', label: '파스텔블루', unlockLevel: 22 },
    { id: 'PastelGreen', label: '파스텔그린', unlockLevel: 25 },
    { id: 'PastelOrange', label: '파스텔오렌지', unlockLevel: 28 },
    { id: 'PastelRed', label: '파스텔레드', unlockLevel: 32 },
    { id: 'PastelYellow', label: '파스텔옐로', unlockLevel: 38 },
    { id: 'Pink', label: '핑크', unlockLevel: 42 },
    { id: 'Red', label: '레드', unlockLevel: 45 },
  ],
  eyeType: [
    { id: 'Default', label: '기본', icon: '\u{1F440}', unlockLevel: 1 },
    { id: 'Happy', label: '행복', icon: '\u{1F60A}', unlockLevel: 1 },
    { id: 'Wink', label: '윙크', icon: '\u{1F609}', unlockLevel: 3 },
    { id: 'Squint', label: '찡긋', icon: '\u{1F60F}', unlockLevel: 8 },
    { id: 'Side', label: '곁눈질', icon: '\u{1F440}', unlockLevel: 12 },
    { id: 'Surprised', label: '놀람', icon: '\u{1F632}', unlockLevel: 15 },
    { id: 'WinkWacky', label: '재미윙크', icon: '\u{1F61C}', unlockLevel: 20 },
    { id: 'Hearts', label: '하트', icon: '\u{1F60D}', unlockLevel: 25 },
    { id: 'EyeRoll', label: '눈굴림', icon: '\u{1F644}', unlockLevel: 30 },
    { id: 'Dizzy', label: '어지러움', icon: '\u{1F635}', unlockLevel: 35 },
    { id: 'Close', label: '감은눈', icon: '\u{1F634}', unlockLevel: 38 },
    { id: 'Cry', label: '울음', icon: '\u{1F622}', unlockLevel: 42 },
  ],
  eyebrowType: [
    { id: 'Default', label: '기본', unlockLevel: 1 },
    { id: 'DefaultNatural', label: '자연스러운', unlockLevel: 1 },
    { id: 'FlatNatural', label: '평평한', unlockLevel: 5 },
    { id: 'RaisedExcited', label: '들뜬', unlockLevel: 8 },
    { id: 'RaisedExcitedNatural', label: '자연 들뜬', unlockLevel: 12 },
    { id: 'UnibrowNatural', label: '일자눈썹', unlockLevel: 15 },
    { id: 'UpDown', label: '위아래', unlockLevel: 18 },
    { id: 'UpDownNatural', label: '자연 위아래', unlockLevel: 22 },
    { id: 'SadConcerned', label: '슬픔', unlockLevel: 28 },
    { id: 'SadConcernedNatural', label: '자연 슬픔', unlockLevel: 30 },
    { id: 'Angry', label: '화남', unlockLevel: 35 },
    { id: 'AngryNatural', label: '자연 화남', unlockLevel: 40 },
    { id: 'FrownNatural', label: '찌푸린', unlockLevel: 45 },
  ],
  mouthType: [
    { id: 'Smile', label: '미소', icon: '\u{1F60A}', unlockLevel: 1 },
    { id: 'Default', label: '기본', icon: '\u{1F642}', unlockLevel: 1 },
    { id: 'Twinkle', label: '반짝', icon: '\u{2728}', unlockLevel: 5 },
    { id: 'Tongue', label: '메롱', icon: '\u{1F61B}', unlockLevel: 8 },
    { id: 'Eating', label: '냠냠', icon: '\u{1F60B}', unlockLevel: 12 },
    { id: 'Serious', label: '진지', icon: '\u{1F610}', unlockLevel: 15 },
    { id: 'Concerned', label: '걱정', icon: '\u{1F61F}', unlockLevel: 20 },
    { id: 'Disbelief', label: '불신', icon: '\u{1F612}', unlockLevel: 25 },
    { id: 'Sad', label: '슬픔', icon: '\u{1F61E}', unlockLevel: 30 },
    { id: 'Grimace', label: '찡그림', icon: '\u{1F62C}', unlockLevel: 35 },
    { id: 'ScreamOpen', label: '비명', icon: '\u{1F631}', unlockLevel: 38 },
    { id: 'Vomit', label: '우웩', icon: '\u{1F92E}', unlockLevel: 42 },
  ],
  skinColor: [
    { id: 'Light', label: '밝은 피부', unlockLevel: 1 },
    { id: 'Pale', label: '창백', unlockLevel: 1 },
    { id: 'Tanned', label: '태닝', unlockLevel: 5 },
    { id: 'Yellow', label: '옐로', unlockLevel: 10 },
    { id: 'Brown', label: '브라운', unlockLevel: 18 },
    { id: 'DarkBrown', label: '다크브라운', unlockLevel: 25 },
    { id: 'Black', label: '블랙', unlockLevel: 30 },
  ],
  mascot: [
    { id: 'none', label: '없음', icon: '\u{274C}' },
    { id: 'tiger', label: '호랑이', icon: '\u{1F42F}', unlockLevel: 5 },
    { id: 'fox', label: '여우', icon: '\u{1F98A}', unlockLevel: 8 },
    { id: 'rabbit', label: '토끼', icon: '\u{1F430}', unlockLevel: 10 },
    { id: 'cat', label: '고양이', icon: '\u{1F431}', unlockLevel: 12 },
    { id: 'panda', label: '판다', icon: '\u{1F43C}', unlockLevel: 15 },
    { id: 'eagle', label: '독수리', icon: '\u{1F985}', unlockLevel: 18 },
    { id: 'bear', label: '곰', icon: '\u{1F43B}', unlockLevel: 22 },
    { id: 'wolf', label: '늑대', icon: '\u{1F43A}', unlockLevel: 28 },
    { id: 'lion', label: '사자', icon: '\u{1F981}', unlockLevel: 35 },
    { id: 'dragon', label: '용', icon: '\u{1F432}', unlockLevel: 40 },
    { id: 'phoenix', label: '불사조', icon: '\u{1F525}', unlockLevel: 45 },
    { id: 'unicorn', label: '유니콘', icon: '\u{1F984}', unlockLevel: 50 },
  ],
};
