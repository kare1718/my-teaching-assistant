// XP → 레벨 계산 (레벨 100 캡, 완만한 커브)
export function getLevelInfo(totalXp) {
  let level = 1, acc = 0;
  while (true) {
    const next = Math.floor(40 * Math.pow(level + 1, 1.4));
    if (acc + next > totalXp) return { level, currentXp: totalXp - acc, xpForNext: next, totalXp };
    acc += next;
    level++;
    if (level >= 100) return { level: 100, currentXp: 0, xpForNext: 0, totalXp };
  }
}

// 레벨에 따른 단계 정보 (병맛 스토리텔링, 25단계)
export function getStageInfo(level) {
  if (level >= 100) return { stage: '강인쌤과 동급', desc: '최종 단계. 강인쌤의 모든 지식과 아우라를 흡수한 진정한 제자', color: '#ff00ff', glow: 'rainbow', label: '🌈 강인쌤과 동급' };
  if (level >= 95) return { stage: '언어의 빅뱅', desc: '입을 열면 새로운 문법이 탄생하는 경지', color: '#ff00cc', glow: 'rainbow', label: '💥 언어의 빅뱅' };
  if (level >= 90) return { stage: '훈민정음 원본', desc: '존재 자체가 국보 제70호. 몸에 글자가 새겨짐', color: '#ff1493', glow: 'rainbow', label: '📜 훈민정음 원본' };
  if (level >= 85) return { stage: '세종대왕 절친', desc: '주말마다 세종대왕님이랑 고기 구워 먹으러 가는 사이', color: '#e91e63', glow: 'rainbow', label: '👑 세종대왕 절친' };
  if (level >= 80) return { stage: '정철 술친구', desc: '관동별곡 부르면서 막걸리 마시는 사이', color: '#c2185b', glow: 'rainbow', label: '🍶 정철 술친구' };
  if (level >= 75) return { stage: '국어의 신', desc: '펜 끝에서 훈민정음의 번개가 침', color: '#d32f2f', glow: 'fire', label: '⚡ 국어의 신' };
  if (level >= 70) return { stage: '국어의 레전드', desc: '학원 복도에 이름 석 자 박힐 전설적 존재', color: '#ff4500', glow: 'fire', label: '🏆 국어의 레전드' };
  if (level >= 65) return { stage: '인간 국어사전', desc: '모르는 단어가 나오면 본인이 정의를 새로 내림', color: '#ff6b35', glow: 'fire', label: '📖 인간 국어사전' };
  if (level >= 60) return { stage: '국어의 지배자', desc: '시험 시간 20분 남기고 자는 포식자', color: '#ffd700', glow: 'crown', label: '🦁 국어의 지배자' };
  if (level >= 55) return { stage: '국립국어원 취직 예정', desc: '표준어 규정을 실시간으로 수정할 기세', color: '#e67e22', glow: 'crown', label: '🏛️ 국립국어원 취직 예정' };
  if (level >= 50) return { stage: '국어의 절대자', desc: '선지 5개 중 정답이 손들고 서 있는 경지', color: '#ab47bc', glow: 'star', label: '👊 국어의 절대자' };
  if (level >= 45) return { stage: '국어 마동석', desc: '지문이 안 읽히면 논리로 때려 부수는 피지컬', color: '#9333ea', glow: 'star', label: '💪 국어 마동석' };
  if (level >= 40) return { stage: '국어 먹는 하마', desc: '지문을 통째로 씹어 먹기 시작한 괴물', color: '#8b5cf6', glow: 'star', label: '🦛 국어 먹는 하마' };
  if (level >= 35) return { stage: '국어 대학생', desc: '이론은 빠삭한데 정작 문제는 못 푸는 지식인', color: '#5c6bc0', glow: 'glow', label: '🎓 국어 대학생' };
  if (level >= 30) return { stage: "맞춤법 빌런 '외않되?'", desc: '실력은 늘었는데 카톡 할 땐 뇌 빼놓고 하는 상태', color: '#3b82f6', glow: 'glow', label: "🦹 맞춤법 빌런 '외않되?'" };
  if (level >= 25) return { stage: '나 국어 좀 할지도?', desc: '모의고사 운 좋게 3등급 찍고 어깨 올라간 상태', color: '#06b6d4', glow: 'glow', label: '🤔 나 국어 좀 할지도?' };
  if (level >= 20) return { stage: '국어 중딩', desc: '접속문과 내포문을 구분하기 시작한 단계', color: '#0891b2', glow: 'sparkle', label: '📝 국어 중딩' };
  if (level >= 15) return { stage: '국어 초딩', desc: "'은/는/이/가'는 구분하지만 갈 길이 먼 상태", color: '#26a69a', glow: 'sparkle', label: '🧒 국어 초딩' };
  if (level >= 10) return { stage: '국어 걸음마', desc: '이제 막 비문학 문단 나누기 시작한 단계', color: '#22c55e', glow: 'sparkle', label: '🚶 국어 걸음마' };
  if (level >= 5)  return { stage: '국어 기어다니기', desc: '아직 지문이 글자가 아니라 그림으로 보이는 단계', color: '#84cc16', glow: 'none', label: '🐛 국어 기어다니기' };
  return { stage: '국어 응애', desc: '지문 읽다가 눈물부터 터지는 단계', color: '#94a3b8', glow: 'none', label: '👶 국어 응애' };
}

// 전체 단계 목록 (정보 표시용)
export function getAllStages() {
  return [
    { level: 1, stage: '국어 응애', label: '👶 국어 응애', desc: '지문 읽다가 눈물부터 터지는 단계', color: '#94a3b8', range: 'Lv.1~4' },
    { level: 5, stage: '국어 기어다니기', label: '🐛 국어 기어다니기', desc: '아직 지문이 글자가 아니라 그림으로 보이는 단계', color: '#84cc16', range: 'Lv.5~9' },
    { level: 10, stage: '국어 걸음마', label: '🚶 국어 걸음마', desc: '이제 막 비문학 문단 나누기 시작한 단계', color: '#22c55e', range: 'Lv.10~14' },
    { level: 15, stage: '국어 초딩', label: '🧒 국어 초딩', desc: "'은/는/이/가'는 구분하지만 갈 길이 먼 상태", color: '#26a69a', range: 'Lv.15~19' },
    { level: 20, stage: '국어 중딩', label: '📝 국어 중딩', desc: '접속문과 내포문을 구분하기 시작한 단계', color: '#0891b2', range: 'Lv.20~24' },
    { level: 25, stage: '나 국어 좀 할지도?', label: '🤔 나 국어 좀 할지도?', desc: '모의고사 운 좋게 3등급 찍고 어깨 올라간 상태', color: '#06b6d4', range: 'Lv.25~29' },
    { level: 30, stage: "맞춤법 빌런 '외않되?'", label: "🦹 맞춤법 빌런 '외않되?'", desc: '실력은 늘었는데 카톡 할 땐 뇌 빼놓고 하는 상태', color: '#3b82f6', range: 'Lv.30~34' },
    { level: 35, stage: '국어 대학생', label: '🎓 국어 대학생', desc: '이론은 빠삭한데 정작 문제는 못 푸는 지식인', color: '#5c6bc0', range: 'Lv.35~39' },
    { level: 40, stage: '국어 먹는 하마', label: '🦛 국어 먹는 하마', desc: '지문을 통째로 씹어 먹기 시작한 괴물', color: '#8b5cf6', range: 'Lv.40~44' },
    { level: 45, stage: '국어 마동석', label: '💪 국어 마동석', desc: '지문이 안 읽히면 논리로 때려 부수는 피지컬', color: '#9333ea', range: 'Lv.45~49' },
    { level: 50, stage: '국어의 절대자', label: '👊 국어의 절대자', desc: '선지 5개 중 정답이 손들고 서 있는 경지', color: '#ab47bc', range: 'Lv.50~54' },
    { level: 55, stage: '국립국어원 취직 예정', label: '🏛️ 국립국어원 취직 예정', desc: '표준어 규정을 실시간으로 수정할 기세', color: '#e67e22', range: 'Lv.55~59' },
    { level: 60, stage: '국어의 지배자', label: '🦁 국어의 지배자', desc: '시험 시간 20분 남기고 자는 포식자', color: '#ffd700', range: 'Lv.60~64' },
    { level: 65, stage: '인간 국어사전', label: '📖 인간 국어사전', desc: '모르는 단어가 나오면 본인이 정의를 새로 내림', color: '#ff6b35', range: 'Lv.65~69' },
    { level: 70, stage: '국어의 레전드', label: '🏆 국어의 레전드', desc: '학원 복도에 이름 석 자 박힐 전설적 존재', color: '#ff4500', range: 'Lv.70~74' },
    { level: 75, stage: '국어의 신', label: '⚡ 국어의 신', desc: '펜 끝에서 훈민정음의 번개가 침', color: '#d32f2f', range: 'Lv.75~79' },
    { level: 80, stage: '정철 술친구', label: '🍶 정철 술친구', desc: '관동별곡 부르면서 막걸리 마시는 사이', color: '#c2185b', range: 'Lv.80~84' },
    { level: 85, stage: '세종대왕 절친', label: '👑 세종대왕 절친', desc: '주말마다 세종대왕님이랑 고기 구워 먹으러 가는 사이', color: '#e91e63', range: 'Lv.85~89' },
    { level: 90, stage: '훈민정음 원본', label: '📜 훈민정음 원본', desc: '존재 자체가 국보 제70호. 몸에 글자가 새겨짐', color: '#ff1493', range: 'Lv.90~94' },
    { level: 95, stage: '언어의 빅뱅', label: '💥 언어의 빅뱅', desc: '입을 열면 새로운 문법이 탄생하는 경지', color: '#ff00cc', range: 'Lv.95~99' },
    { level: 100, stage: '강인쌤과 동급', label: '🌈 강인쌤과 동급', desc: '최종 단계. 강인쌤의 모든 지식과 아우라를 흡수한 진정한 제자', color: '#ff00ff', range: 'Lv.100' },
  ];
}

// XP 바 퍼센트
export function getXpPercent(levelInfo) {
  if (levelInfo.xpForNext === 0) return 100;
  return Math.min(100, Math.floor((levelInfo.currentXp / levelInfo.xpForNext) * 100));
}
