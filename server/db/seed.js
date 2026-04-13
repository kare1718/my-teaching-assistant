const { runQuery, runInsert, getOne, getAll } = require('./database');

async function runSeeds() {
  // === 캐릭터 시드 데이터 (공유, academy_id=0) ===
  try {
    const charCount = await getOne("SELECT COUNT(*) as cnt FROM characters");
    if (!charCount || charCount.cnt === 0) {
      const chars = [
        ['호랑이', '🐯', '용맹한 한국의 수호 동물', 1],
        ['용', '🐲', '하늘을 나는 지혜의 상징', 5],
        ['독수리', '🦅', '높이 나는 자유의 새', 1],
        ['여우', '🦊', '영리한 숲의 요정', 1],
        ['늑대', '🐺', '용맹한 달밤의 사냥꾼', 10],
        ['사자', '🦁', '당당한 초원의 왕', 15],
        ['불사조', '🔥', '전설의 불새', 30],
        ['유니콘', '🦄', '신비로운 마법의 존재', 40],
      ];
      for (const [name, emoji, desc, lvl] of chars) {
        await runQuery('INSERT INTO characters (name, emoji, description, unlock_level, academy_id) VALUES (?, ?, ?, ?, 0)', [name, emoji, desc, lvl]);
      }
      console.log('캐릭터 시드 데이터 생성됨');
    }
  } catch (e) { console.error('캐릭터 시드 오류:', e.message); }

  // === 칭호 시드 데이터 (공유, academy_id=0) ===
  try {
    const titleCount = await getOne("SELECT COUNT(*) as cnt FROM titles");
    if (!titleCount || titleCount.cnt === 0) {
      const titles = [
        ['천리길도 한걸음부터', '첫 퀴즈 도전!', 'xp_total', 100, '👣'],
        ['어휘 새싹', '어휘 퀴즈 50문제 정답', 'quiz_count', 50, '🌱'],
        ['어휘왕', '어휘 퀴즈 200문제 정답', 'quiz_count', 200, '👑'],
        ['퀴즈 광풍', '퀴즈 500문제 정답', 'quiz_count', 500, '🌪️'],
        ['퀴즈의 신', '퀴즈 1000문제 정답', 'quiz_count', 1000, '⚡'],
        ['출석의 달인', '코드 30회 입력', 'code_count', 30, '⭐'],
        ['코드 마니아', '코드 100회 입력', 'code_count', 100, '🎯'],
        ['학도의 길', '레벨 10 달성', 'level', 10, '📘'],
        ['고수의 경지', '레벨 25 달성', 'level', 25, '🏆'],
        ['전설의 시작', '레벨 40 달성', 'level', 40, '🌟'],
        ['국어의 신', '레벨 50 달성', 'level', 50, '🌈'],
        ['포인트 수집가', 'XP 3,000 달성', 'xp_total', 3000, '💰'],
        ['경험의 대가', 'XP 10,000 달성', 'xp_total', 10000, '💎'],
        ['만렙 도전자', 'XP 50,000 달성', 'xp_total', 50000, '🔥'],
        ['어휘 입문자', '어휘 퀴즈 50문제 정답', 'quiz_count', 50, '📖'],
        ['사자성어 달인', '퀴즈 200문제 정답', 'quiz_count', 200, '🐉'],
        ['문법 마스터', '퀴즈 300문제 정답', 'quiz_count', 300, '✍️'],
        ['꾸준한 학습자', '레벨 5 달성', 'level', 5, '🌱'],
        ['성장의 증표', '레벨 15 달성', 'level', 15, '🌿'],
        ['불굴의 의지', '레벨 30 달성', 'level', 30, '🔥'],
        ['학문의 정점', '레벨 60 달성', 'level', 60, '🏅'],
        ['첫 발걸음', 'XP 500 달성', 'xp_total', 500, '👣'],
        ['한 걸음 더', 'XP 1,000 달성', 'xp_total', 1000, '🚶'],
        ['열정의 불꽃', 'XP 5,000 달성', 'xp_total', 5000, '🔥'],
        ['무한 도전자', 'XP 20,000 달성', 'xp_total', 20000, '🚀'],
        ['전설의 학생', 'XP 100,000 달성', 'xp_total', 100000, '👑'],
        // 특별 부여 칭호 (관리자가 직접 부여)
        ['우리 학원 최고', '선생님이 직접 부여하는 특별 칭호', 'manual', 0, '💖'],
        ['모범 학생', '수업 태도가 우수한 학생', 'manual', 0, '🌟'],
        ['과제왕', '과제를 성실히 수행하는 학생', 'manual', 0, '📚'],
      ];
      for (const [name, desc, type, val, icon] of titles) {
        await runQuery('INSERT INTO titles (name, description, condition_type, condition_value, icon, academy_id) VALUES (?, ?, ?, ?, ?, 0)', [name, desc, type, val, icon]);
      }
      console.log('칭호 시드 데이터 생성됨');
    }
  } catch (e) { console.error('칭호 시드 오류:', e.message); }

  // === 어휘 문제 시드 데이터 ===
  try {
    const vocabCount = await getOne("SELECT COUNT(*) as cnt FROM vocab_words");
    if (!vocabCount || vocabCount.cnt === 0) {
      const vocabData = require('./vocabSeed');
      for (const [cat, q, correct, wrong, diff, exp] of vocabData) {
        await runQuery('INSERT INTO vocab_words (category, question_text, correct_answer, wrong_answers, difficulty, explanation, academy_id) VALUES (?, ?, ?, ?, ?, ?, 0)',
          [cat, q, correct, wrong, diff, exp]);
      }
      console.log(`어휘 문제 ${vocabData.length}개 시드 데이터 생성됨`);
    }
  } catch (e) { console.error('어휘 시드 데이터 오류:', e.message); }

  // === 지식 퀴즈 시드 데이터 ===
  try {
    const kqCount = await getOne("SELECT COUNT(*) as cnt FROM knowledge_questions");
    if (!kqCount || kqCount.cnt === 0) {
      const kqData = require('./knowledgeQuizSeed');
      for (const [cat, q, correct, wrong, diff, exp] of kqData) {
        await runQuery('INSERT INTO knowledge_questions (category, question_text, correct_answer, wrong_answers, difficulty, explanation, academy_id) VALUES (?, ?, ?, ?, ?, ?, 0)',
          [cat, q, correct, wrong, diff, exp]);
      }
      console.log(`지식 퀴즈 ${kqData.length}개 시드 데이터 생성됨`);
    }
  } catch (e) { console.error('지식 퀴즈 시드 오류:', e.message); }

  // === 비문학 독해 시드 데이터 ===
  try {
    const rpCount = await getOne("SELECT COUNT(*) as cnt FROM reading_passages");
    if (!rpCount || rpCount.cnt === 0) {
      const rpData = require('./readingPassageSeed');
      for (const p of rpData) {
        const pid = await runInsert('INSERT INTO reading_passages (category, title, content, difficulty, source_info, academy_id) VALUES (?, ?, ?, ?, ?, 0)',
          [p.category, p.title, p.content, p.difficulty, p.source_info || '']);
        for (const q of (p.questions || [])) {
          await runQuery('INSERT INTO reading_questions (passage_id, question_type, question_text, correct_answer, wrong_answers, explanation, academy_id) VALUES (?, ?, ?, ?, ?, ?, 0)',
            [pid, q.type, q.text, q.correct, JSON.stringify(q.wrongs), q.explanation || '']);
        }
      }
      console.log(`비문학 지문 ${rpData.length}개 시드 데이터 생성됨`);
    }
  } catch (e) { console.error('비문학 시드 오류:', e.message); }

  // === 랭킹 보상 기본 설정 시드 ===
  try {
    const rewardCount = await getOne("SELECT COUNT(*) as cnt FROM reward_settings");
    if (!rewardCount || rewardCount.cnt === 0) {
      const weeklyDefaults = { 1: 500, 2: 300, 3: 200, 4: 100, 5: 100, 6: 100, 7: 100, 8: 100, 9: 100, 10: 100 };
      const monthlyDefaults = { 1: 1000, 2: 600, 3: 400, 4: 200, 5: 200, 6: 200, 7: 200, 8: 200, 9: 200, 10: 200 };
      for (const [rank, amount] of Object.entries(weeklyDefaults)) {
        await runQuery('INSERT INTO reward_settings (type, rank, amount) VALUES (?, ?, ?)', ['weekly', parseInt(rank), amount]);
      }
      for (const [rank, amount] of Object.entries(monthlyDefaults)) {
        await runQuery('INSERT INTO reward_settings (type, rank, amount) VALUES (?, ?, ?)', ['monthly', parseInt(rank), amount]);
      }
      console.log('랭킹 보상 기본 설정 생성됨');
    }
  } catch (e) {}

  // === 레포트 템플릿 기본값 ===
  try {
    const rtCount = await getOne("SELECT COUNT(*) as cnt FROM report_templates");
    if (!rtCount || rtCount.cnt === 0) {
      const defaultFields = JSON.stringify([
        { key: 'attitude', label: '수업 태도', type: 'select', options: ['매우 좋음', '좋음', '보통', '노력 필요'] },
        { key: 'homework', label: '과제 수행', type: 'select', options: ['우수', '양호', '미흡', '미제출'] },
        { key: 'word_test', label: '단어 시험', type: 'score' },
        { key: 'retest', label: '재시험', type: 'score' },
        { key: 'exam_score', label: '시험 성적', type: 'auto_score' },
        { key: 'participation', label: '수업 참여도', type: 'select', options: ['매우 적극적', '적극적', '보통', '소극적'] },
        { key: 'special_note', label: '특이사항', type: 'text' },
        { key: 'feedback', label: '강사 코멘트', type: 'text' },
      ]);
      await runQuery("INSERT INTO report_templates (name, description, fields_json, is_default, academy_id) VALUES (?, ?, ?, 1, 0)",
        ['기본 수업 레포트', '수업 태도, 과제, 시험 등 종합 피드백', defaultFields]);
    }
  } catch (e) {}
}

module.exports = { runSeeds };
