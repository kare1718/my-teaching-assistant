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

// 과목별 단계명 프리셋
const STAGE_PRESETS = {
  국어: [
    { min: 100, stage: '선생님과 동급', desc: '최종 단계. 선생님의 모든 지식과 아우라를 흡수한 진정한 제자', label: '🌈 선생님과 동급' },
    { min: 95, stage: '언어의 빅뱅', desc: '입을 열면 새로운 문법이 탄생하는 경지', label: '💥 언어의 빅뱅' },
    { min: 90, stage: '훈민정음 원본', desc: '존재 자체가 국보 제70호. 몸에 글자가 새겨짐', label: '📜 훈민정음 원본' },
    { min: 85, stage: '세종대왕 절친', desc: '주말마다 세종대왕님이랑 고기 구워 먹으러 가는 사이', label: '👑 세종대왕 절친' },
    { min: 80, stage: '정철 술친구', desc: '관동별곡 부르면서 막걸리 마시는 사이', label: '🍶 정철 술친구' },
    { min: 75, stage: '국어의 신', desc: '펜 끝에서 훈민정음의 번개가 침', label: '⚡ 국어의 신' },
    { min: 70, stage: '국어의 레전드', desc: '학원 복도에 이름 석 자 박힐 전설적 존재', label: '🏆 국어의 레전드' },
    { min: 65, stage: '인간 국어사전', desc: '모르는 단어가 나오면 본인이 정의를 새로 내림', label: '📖 인간 국어사전' },
    { min: 60, stage: '국어의 지배자', desc: '시험 시간 20분 남기고 자는 포식자', label: '🦁 국어의 지배자' },
    { min: 55, stage: '국립국어원 취직 예정', desc: '표준어 규정을 실시간으로 수정할 기세', label: '🏛️ 국립국어원 취직 예정' },
    { min: 50, stage: '국어의 절대자', desc: '선지 5개 중 정답이 손들고 서 있는 경지', label: '👊 국어의 절대자' },
    { min: 45, stage: '국어 마동석', desc: '지문이 안 읽히면 논리로 때려 부수는 피지컬', label: '💪 국어 마동석' },
    { min: 40, stage: '국어 먹는 하마', desc: '지문을 통째로 씹어 먹기 시작한 괴물', label: '🦛 국어 먹는 하마' },
    { min: 35, stage: '국어 대학생', desc: '이론은 빠삭한데 정작 문제는 못 푸는 지식인', label: '🎓 국어 대학생' },
    { min: 30, stage: "맞춤법 빌런 '외않되?'", desc: '실력은 늘었는데 카톡 할 땐 뇌 빼놓고 하는 상태', label: "🦹 맞춤법 빌런 '외않되?'" },
    { min: 25, stage: '나 국어 좀 할지도?', desc: '모의고사 운 좋게 3등급 찍고 어깨 올라간 상태', label: '🤔 나 국어 좀 할지도?' },
    { min: 20, stage: '국어 중딩', desc: '접속문과 내포문을 구분하기 시작한 단계', label: '📝 국어 중딩' },
    { min: 15, stage: '국어 초딩', desc: "'은/는/이/가'는 구분하지만 갈 길이 먼 상태", label: '🧒 국어 초딩' },
    { min: 10, stage: '국어 걸음마', desc: '이제 막 비문학 문단 나누기 시작한 단계', label: '🚶 국어 걸음마' },
    { min: 5,  stage: '국어 기어다니기', desc: '아직 지문이 글자가 아니라 그림으로 보이는 단계', label: '🐛 국어 기어다니기' },
    { min: 1,  stage: '국어 응애', desc: '지문 읽다가 눈물부터 터지는 단계', label: '👶 국어 응애' },
  ],
  수학: [
    { min: 100, stage: '선생님과 동급', desc: '최종 단계. 선생님의 모든 지식과 아우라를 흡수한 진정한 제자', label: '🌈 선생님과 동급' },
    { min: 95, stage: '수학의 빅뱅', desc: '눈을 감으면 우주의 방정식이 보이는 경지', label: '💥 수학의 빅뱅' },
    { min: 90, stage: '가우스 환생', desc: '1부터 100까지 더하는 건 눈 깜짝할 새', label: '📜 가우스 환생' },
    { min: 85, stage: '오일러 절친', desc: 'e^(iπ)+1=0을 보며 감동의 눈물을 흘리는 사이', label: '👑 오일러 절친' },
    { min: 80, stage: '피타고라스 후예', desc: '직각삼각형만 보면 가슴이 뛴다', label: '🍶 피타고라스 후예' },
    { min: 75, stage: '수학의 신', desc: '펜 끝에서 증명의 번개가 침', label: '⚡ 수학의 신' },
    { min: 70, stage: '수학의 레전드', desc: '학원 복도에 이름 석 자 박힐 전설적 존재', label: '🏆 수학의 레전드' },
    { min: 65, stage: '인간 계산기', desc: '암산으로 미적분을 풀어버리는 괴물', label: '📖 인간 계산기' },
    { min: 60, stage: '수학의 지배자', desc: '시험지 받자마자 답이 보이는 경지', label: '🦁 수학의 지배자' },
    { min: 55, stage: '수학올림피아드 예정', desc: '문제를 풀다가 새로운 정리를 발견할 기세', label: '🏛️ 수학올림피아드 예정' },
    { min: 50, stage: '수학의 절대자', desc: '선지 5개 중 정답이 손들고 서 있는 경지', label: '👊 수학의 절대자' },
    { min: 45, stage: '수학 마동석', desc: '문제가 안 풀리면 공식으로 때려 부수는 피지컬', label: '💪 수학 마동석' },
    { min: 40, stage: '수학 먹는 하마', desc: '수식을 통째로 씹어 먹기 시작한 괴물', label: '🦛 수학 먹는 하마' },
    { min: 35, stage: '수학 대학생', desc: '이론은 빠삭한데 정작 계산 실수가 많은 지식인', label: '🎓 수학 대학생' },
    { min: 30, stage: '부호 빌런', desc: '실력은 늘었는데 부호 하나 잘못 써서 다 틀리는 상태', label: '🦹 부호 빌런' },
    { min: 25, stage: '나 수학 좀 할지도?', desc: '모의고사 운 좋게 3등급 찍고 어깨 올라간 상태', label: '🤔 나 수학 좀 할지도?' },
    { min: 20, stage: '수학 중딩', desc: '이차방정식을 풀기 시작한 단계', label: '📝 수학 중딩' },
    { min: 15, stage: '수학 초딩', desc: '분수는 알겠는데 갈 길이 먼 상태', label: '🧒 수학 초딩' },
    { min: 10, stage: '수학 걸음마', desc: '이제 막 방정식 세우기 시작한 단계', label: '🚶 수학 걸음마' },
    { min: 5,  stage: '수학 기어다니기', desc: '아직 숫자가 그림으로 보이는 단계', label: '🐛 수학 기어다니기' },
    { min: 1,  stage: '수학 응애', desc: '문제 읽다가 눈물부터 터지는 단계', label: '👶 수학 응애' },
  ],
  영어: [
    { min: 100, stage: '선생님과 동급', desc: '최종 단계. 선생님의 모든 지식과 아우라를 흡수한 진정한 제자', label: '🌈 선생님과 동급' },
    { min: 95, stage: '영어의 빅뱅', desc: '입을 열면 네이티브가 고개를 숙이는 경지', label: '💥 영어의 빅뱅' },
    { min: 90, stage: '셰익스피어 환생', desc: 'To be or not to be를 새로 쓸 수 있는 수준', label: '📜 셰익스피어 환생' },
    { min: 85, stage: '옥스퍼드 절친', desc: '영영사전에 본인 예문이 실릴 기세', label: '👑 옥스퍼드 절친' },
    { min: 80, stage: '원어민 친구', desc: '발음이 너무 좋아서 외국인이 한국어 물어보는 수준', label: '🍶 원어민 친구' },
    { min: 75, stage: '영어의 신', desc: '펜 끝에서 문법의 번개가 침', label: '⚡ 영어의 신' },
    { min: 70, stage: '영어의 레전드', desc: '학원 복도에 이름 석 자 박힐 전설적 존재', label: '🏆 영어의 레전드' },
    { min: 65, stage: '인간 영영사전', desc: '모르는 단어가 나오면 본인이 정의를 새로 내림', label: '📖 인간 영영사전' },
    { min: 60, stage: '영어의 지배자', desc: '시험 시간 20분 남기고 자는 포식자', label: '🦁 영어의 지배자' },
    { min: 55, stage: 'TOEFL 만점 예정', desc: '영어 시험은 이제 게임처럼 느껴지는 경지', label: '🏛️ TOEFL 만점 예정' },
    { min: 50, stage: '영어의 절대자', desc: '선지 5개 중 정답이 손들고 서 있는 경지', label: '👊 영어의 절대자' },
    { min: 45, stage: '영어 마동석', desc: '지문이 안 읽히면 문맥으로 때려 부수는 피지컬', label: '💪 영어 마동석' },
    { min: 40, stage: '영어 먹는 하마', desc: '지문을 통째로 씹어 먹기 시작한 괴물', label: '🦛 영어 먹는 하마' },
    { min: 35, stage: '영어 대학생', desc: '이론은 빠삭한데 정작 리스닝이 안 되는 지식인', label: '🎓 영어 대학생' },
    { min: 30, stage: '스펠링 빌런', desc: '실력은 늘었는데 철자 하나 틀려서 감점당하는 상태', label: '🦹 스펠링 빌런' },
    { min: 25, stage: '나 영어 좀 할지도?', desc: '모의고사 운 좋게 3등급 찍고 어깨 올라간 상태', label: '🤔 나 영어 좀 할지도?' },
    { min: 20, stage: '영어 중딩', desc: '관계대명사를 구분하기 시작한 단계', label: '📝 영어 중딩' },
    { min: 15, stage: '영어 초딩', desc: 'be동사는 알겠는데 갈 길이 먼 상태', label: '🧒 영어 초딩' },
    { min: 10, stage: '영어 걸음마', desc: '이제 막 영작 시작한 단계', label: '🚶 영어 걸음마' },
    { min: 5,  stage: '영어 기어다니기', desc: '아직 영어가 외계어로 보이는 단계', label: '🐛 영어 기어다니기' },
    { min: 1,  stage: '영어 응애', desc: '지문 읽다가 눈물부터 터지는 단계', label: '👶 영어 응애' },
  ],
  default: [
    { min: 100, stage: '선생님과 동급', desc: '최종 단계. 선생님의 모든 지식과 아우라를 흡수한 진정한 제자', label: '🌈 선생님과 동급' },
    { min: 95, stage: '지식의 빅뱅', desc: '입을 열면 새로운 이론이 탄생하는 경지', label: '💥 지식의 빅뱅' },
    { min: 90, stage: '살아있는 교과서', desc: '존재 자체가 참고서. 걸어다니는 백과사전', label: '📜 살아있는 교과서' },
    { min: 85, stage: '학문의 거장', desc: '교수님도 고개를 끄덕이게 만드는 실력', label: '👑 학문의 거장' },
    { min: 80, stage: '천재의 경지', desc: '문제를 보면 답이 먼저 보이는 수준', label: '🍶 천재의 경지' },
    { min: 75, stage: '공부의 신', desc: '펜 끝에서 지식의 번개가 침', label: '⚡ 공부의 신' },
    { min: 70, stage: '전설의 학생', desc: '학원 복도에 이름 석 자 박힐 전설적 존재', label: '🏆 전설의 학생' },
    { min: 65, stage: '인간 백과사전', desc: '모르는 게 나오면 본인이 정의를 새로 내림', label: '📖 인간 백과사전' },
    { min: 60, stage: '학습의 지배자', desc: '시험 시간 20분 남기고 자는 포식자', label: '🦁 학습의 지배자' },
    { min: 55, stage: '올림피아드 예정', desc: '문제를 풀다가 새로운 풀이를 발견할 기세', label: '🏛️ 올림피아드 예정' },
    { min: 50, stage: '공부의 절대자', desc: '선지 5개 중 정답이 손들고 서 있는 경지', label: '👊 공부의 절대자' },
    { min: 45, stage: '공부 마동석', desc: '문제가 안 풀리면 논리로 때려 부수는 피지컬', label: '💪 공부 마동석' },
    { min: 40, stage: '공부 먹는 하마', desc: '문제를 통째로 씹어 먹기 시작한 괴물', label: '🦛 공부 먹는 하마' },
    { min: 35, stage: '예비 대학생', desc: '이론은 빠삭한데 정작 문제는 못 푸는 지식인', label: '🎓 예비 대학생' },
    { min: 30, stage: '실수 빌런', desc: '실력은 늘었는데 사소한 실수가 발목 잡는 상태', label: '🦹 실수 빌런' },
    { min: 25, stage: '나 좀 할지도?', desc: '모의고사 운 좋게 3등급 찍고 어깨 올라간 상태', label: '🤔 나 좀 할지도?' },
    { min: 20, stage: '중급 학습자', desc: '기본기가 잡히기 시작한 단계', label: '📝 중급 학습자' },
    { min: 15, stage: '초급 학습자', desc: '기초는 알겠는데 갈 길이 먼 상태', label: '🧒 초급 학습자' },
    { min: 10, stage: '걸음마', desc: '이제 막 기본 개념을 잡기 시작한 단계', label: '🚶 걸음마' },
    { min: 5,  stage: '기어다니기', desc: '아직 문제가 글자가 아니라 그림으로 보이는 단계', label: '🐛 기어다니기' },
    { min: 1,  stage: '응애', desc: '문제 읽다가 눈물부터 터지는 단계', label: '👶 응애' },
  ],
};

// 레벨별 색상/효과 (과목 무관, 공통)
const STAGE_STYLES = [
  { min: 100, color: '#ff00ff', glow: 'rainbow' },
  { min: 95, color: '#ff00cc', glow: 'rainbow' },
  { min: 90, color: '#ff1493', glow: 'rainbow' },
  { min: 85, color: '#e91e63', glow: 'rainbow' },
  { min: 80, color: '#c2185b', glow: 'rainbow' },
  { min: 75, color: '#d32f2f', glow: 'fire' },
  { min: 70, color: '#ff4500', glow: 'fire' },
  { min: 65, color: '#ff6b35', glow: 'fire' },
  { min: 60, color: '#ffd700', glow: 'crown' },
  { min: 55, color: '#e67e22', glow: 'crown' },
  { min: 50, color: '#ab47bc', glow: 'star' },
  { min: 45, color: '#9333ea', glow: 'star' },
  { min: 40, color: '#8b5cf6', glow: 'star' },
  { min: 35, color: '#5c6bc0', glow: 'glow' },
  { min: 30, color: '#3b82f6', glow: 'glow' },
  { min: 25, color: '#06b6d4', glow: 'glow' },
  { min: 20, color: '#0891b2', glow: 'sparkle' },
  { min: 15, color: '#26a69a', glow: 'sparkle' },
  { min: 10, color: '#22c55e', glow: 'sparkle' },
  { min: 5, color: '#84cc16', glow: 'none' },
  { min: 1, color: '#94a3b8', glow: 'none' },
];

function getPreset(subject) {
  if (!subject) return STAGE_PRESETS.default;
  return STAGE_PRESETS[subject] || STAGE_PRESETS.default;
}

// 레벨에 따른 단계 정보
export function getStageInfo(level, subject) {
  const preset = getPreset(subject);
  for (let i = 0; i < preset.length; i++) {
    if (level >= preset[i].min) {
      const style = STAGE_STYLES[i] || STAGE_STYLES[STAGE_STYLES.length - 1];
      return { stage: preset[i].stage, desc: preset[i].desc, color: style.color, glow: style.glow, label: preset[i].label };
    }
  }
  const last = preset[preset.length - 1];
  const lastStyle = STAGE_STYLES[STAGE_STYLES.length - 1];
  return { stage: last.stage, desc: last.desc, color: lastStyle.color, glow: lastStyle.glow, label: last.label };
}

// 전체 단계 목록 (정보 표시용)
export function getAllStages(subject) {
  const preset = getPreset(subject);
  const ranges = ['Lv.100', 'Lv.95~99', 'Lv.90~94', 'Lv.85~89', 'Lv.80~84', 'Lv.75~79', 'Lv.70~74', 'Lv.65~69', 'Lv.60~64', 'Lv.55~59', 'Lv.50~54', 'Lv.45~49', 'Lv.40~44', 'Lv.35~39', 'Lv.30~34', 'Lv.25~29', 'Lv.20~24', 'Lv.15~19', 'Lv.10~14', 'Lv.5~9', 'Lv.1~4'];
  return preset.map((s, i) => ({
    level: s.min,
    stage: s.stage,
    label: s.label,
    desc: s.desc,
    color: STAGE_STYLES[i]?.color || '#94a3b8',
    range: ranges[i] || `Lv.${s.min}+`,
  }));
}

// 사용 가능한 과목 목록
export function getAvailableSubjects() {
  return Object.keys(STAGE_PRESETS).filter(k => k !== 'default');
}

// XP 바 퍼센트
export function getXpPercent(levelInfo) {
  if (levelInfo.xpForNext === 0) return 100;
  return Math.min(100, Math.floor((levelInfo.currentXp / levelInfo.xpForNext) * 100));
}
