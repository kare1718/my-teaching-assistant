const crypto = require('crypto');
const { runQuery, runInsert, getOne, getAll } = require('../../db/database');

// ========== 랭킹 캐시 (10분) ==========
const rankingCache = {
  data: {},      // { 'all': {...}, 'weekly': {...}, 'monthly': {...}, 'school_학교명': {...} }
  timestamps: {}, // { 'all': Date.now(), ... }
  TTL: 10 * 60 * 1000, // 10분
  get(key) {
    const ts = this.timestamps[key];
    if (ts && Date.now() - ts < this.TTL && this.data[key]) {
      return this.data[key];
    }
    return null;
  },
  set(key, data) {
    this.data[key] = data;
    this.timestamps[key] = Date.now();
  },
  invalidate() {
    this.data = {};
    this.timestamps = {};
  }
};

// === Gemini AI Helper ===
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

function parseGeminiJSON(text) {
  let cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  try { return JSON.parse(cleaned); } catch (e) {}
  const arrMatch = cleaned.match(/\[[\s\S]*\]/);
  if (arrMatch) { try { return JSON.parse(arrMatch[0]); } catch (e) {} }
  const objMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objMatch) { try { return JSON.parse(objMatch[0]); } catch (e) {} }
  return null;
}

async function callGemini(prompt, timeoutMs = 40000) {
  if (!GEMINI_API_KEY) throw new Error('Gemini API 키가 설정되지 않았습니다.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.8, maxOutputTokens: 8192 }
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) throw new Error(`Gemini API 오류: ${response.status}`);
    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Gemini 응답이 비어있습니다.');
    return text;
  } catch (e) {
    clearTimeout(timeout);
    if (e.name === 'AbortError') throw new Error('AI 응답 시간이 초과되었습니다.');
    throw e;
  }
}

// === Helper Functions ===

function getLevelInfo(totalXp) {
  let level = 1, acc = 0;
  while (true) {
    const next = Math.floor(40 * Math.pow(level + 1, 1.4));
    if (acc + next > totalXp) return { level, currentXp: totalXp - acc, xpForNext: next, totalXp };
    acc += next;
    level++;
    if (level >= 100) return { level: 100, currentXp: 0, xpForNext: 0, totalXp };
  }
}

async function checkAndGrantTitles(studentId, academyId) {
  const titles = await getAll("SELECT * FROM titles WHERE condition_type != 'manual' AND (academy_id = ? OR academy_id = 0)", [academyId]);
  const character = await getOne('SELECT * FROM student_characters WHERE student_id = ? AND academy_id = ?', [studentId, academyId]);
  if (!character) return;

  const [quizResult, codeResult, existingTitles] = await Promise.all([
    getOne('SELECT COALESCE(SUM(correct_count), 0) as total FROM vocab_game_logs WHERE student_id = ? AND academy_id = ?', [studentId, academyId]),
    getOne('SELECT COUNT(*) as total FROM code_redemptions WHERE student_id = ? AND academy_id = ?', [studentId, academyId]),
    getAll('SELECT title_id FROM student_titles WHERE student_id = ? AND academy_id = ?', [studentId, academyId]),
  ]);
  const existingSet = new Set(existingTitles.map(t => t.title_id));
  const levelInfo = getLevelInfo(character.xp);

  const toGrant = [];
  for (const title of titles) {
    if (existingSet.has(title.id)) continue; // 이미 보유
    let conditionMet = false;
    const val = title.condition_value;
    switch (title.condition_type) {
      case 'xp_total': conditionMet = character.xp >= val; break;
      case 'quiz_count': conditionMet = quizResult.total >= val; break;
      case 'code_count': conditionMet = codeResult.total >= val; break;
      case 'level': conditionMet = levelInfo.level >= val; break;
    }
    if (conditionMet) toGrant.push(title.id);
  }

  // 일괄 INSERT (N+1 → 1 쿼리)
  for (const titleId of toGrant) {
    await runInsert('INSERT INTO student_titles (student_id, title_id, academy_id) VALUES (?, ?, ?) ON CONFLICT DO NOTHING', [studentId, titleId, academyId]);
  }
}

function generateCode(length = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = crypto.randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(bytes[i] % chars.length);
  }
  return result;
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 이름 마스킹 (가운데 글자 *)
function maskName(name) {
  if (!name) return '***';
  if (name.length <= 1) return name;
  if (name.length === 2) return name[0] + '*';
  return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1];
}

// 오늘 자정 기준 (KST)
function getTodayKST() {
  const now = new Date();
  // 일일 초기화 기준: KST 10시 (UTC 01시)
  // 10시 전이면 전날 날짜 반환, 10시 이후면 오늘 날짜 반환
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const kstHour = kst.getUTCHours();
  if (kstHour < 10) {
    // 10시 전이면 하루 빼기
    kst.setUTCDate(kst.getUTCDate() - 1);
  }
  return kst.toISOString().split('T')[0]; // YYYY-MM-DD
}

// === Ranking Helper Functions ===

// 가장 최근 금요일 오전 10시(KST) 기준 — getTodayKST()와 동일한 10시 기준
function getLastFridayMidnight() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  // 10시 전이면 하루 빼기 (getTodayKST와 동일 로직)
  if (kst.getUTCHours() < 10) {
    kst.setUTCDate(kst.getUTCDate() - 1);
  }
  const day = kst.getUTCDay(); // 0=일 ~ 6=토
  // 가장 최근 금요일 (금요일~목요일이 한 주)
  const diff = (day - 5 + 7) % 7;
  kst.setUTCDate(kst.getUTCDate() - diff);
  kst.setUTCHours(10, 0, 0, 0); // 10시 기준
  return new Date(kst.getTime() - 9 * 60 * 60 * 1000).toISOString();
}

// 이번 달 첫째 날 자정(KST) 계산
function getMonthStartMidnight() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  kst.setUTCDate(1);
  kst.setUTCHours(0, 0, 0, 0);
  return new Date(kst.getTime() - 9 * 60 * 60 * 1000).toISOString();
}

// 랭킹 행 파싱 공통 함수
function parseRankingRow(r) {
  let avatarConfig = {};
  try { avatarConfig = r.avatar_config ? JSON.parse(r.avatar_config) : {}; } catch(e) {}
  let rankingBadge = null;
  try { rankingBadge = r.ranking_badge ? JSON.parse(r.ranking_badge) : null; } catch(e) {}
  return {
    student_id: r.student_id,
    xp: r.xp || 0,
    character_id: r.character_id,
    selected_title_id: r.selected_title_id,
    avatarConfig,
    rankingBadge,
    nickname: r.nickname || null,
    displayName: r.nickname || maskName(r.name),
    realName: maskName(r.name),
    name: r.name,
    school: r.school,
    grade: r.grade,
    char_name: r.char_name,
    emoji: r.emoji,
    title_name: r.title_name,
    title_icon: r.title_icon,
  };
}

// 기간 랭킹 공통 쿼리 (weekly, monthly, school)
async function getPeriodRankings(academyId, since, extraWhere = '', extraParams = []) {
  const params = [academyId, since, academyId, ...extraParams];
  const rows = await getAll(
    `SELECT sc.student_id, COALESCE(xp_agg.total_xp, 0) as period_xp,
            sc.xp as total_xp, sc.avatar_config, sc.nickname, sc.selected_title_id, sc.character_id, sc.ranking_badge,
            u.name, s.school, s.grade, c.emoji, c.name as char_name, t.name as title_name, t.icon as title_icon
     FROM student_characters sc
     JOIN students s ON sc.student_id = s.id
     JOIN users u ON s.user_id = u.id
     LEFT JOIN characters c ON sc.character_id = c.id
     LEFT JOIN titles t ON sc.selected_title_id = t.id
     LEFT JOIN (
       SELECT student_id, SUM(amount) as total_xp FROM xp_logs WHERE academy_id = ? AND created_at >= ? AND amount > 0 AND source NOT IN ('admin_ranking_reward', 'admin_adjust', 'admin_ranking', 'admin_edit') GROUP BY student_id
     ) xp_agg ON xp_agg.student_id = sc.student_id
     WHERE sc.academy_id = ? AND u.role != 'admin' AND u.approved = 1 AND s.school NOT IN ('조교', '선생님')
       AND COALESCE(xp_agg.total_xp, 0) > 0
       ${extraWhere}
     ORDER BY period_xp DESC LIMIT 100`,
    params
  );

  return rows.map(r => {
    const parsed = parseRankingRow(r);
    const periodXp = Number(r.period_xp) || 0;
    const totalXp = Number(r.total_xp) || 0;
    parsed.xp = periodXp;
    parsed.totalXp = totalXp;
    return parsed;
  })
  .filter(r => r.xp > 0)
  .sort((a, b) => b.xp - a.xp)
  .map((r, idx) => ({ ...r, rank: idx + 1 }));
}

// 내 기간 XP & 등수 계산 공통 함수
async function getMyPeriodInfo(academyId, studentId, studentSchool, since) {
  const myPeriod = await getOne(
    `SELECT COALESCE(SUM(xl.amount), 0) as period_xp
     FROM xp_logs xl WHERE xl.academy_id = ? AND xl.student_id = ? AND xl.created_at >= ? AND xl.amount > 0 AND xl.source NOT IN ('admin_ranking_reward', 'admin_adjust', 'admin_ranking', 'admin_edit')`,
    [academyId, studentId, since]
  );
  const myChar = await getOne(
    `SELECT sc.student_id, sc.xp, sc.avatar_config, sc.nickname, sc.selected_title_id, sc.character_id, sc.ranking_badge,
            u.name, s.school, s.grade, c.emoji, c.name as char_name, t.name as title_name, t.icon as title_icon
     FROM student_characters sc JOIN students s ON sc.student_id = s.id JOIN users u ON s.user_id = u.id
     LEFT JOIN characters c ON sc.character_id = c.id LEFT JOIN titles t ON sc.selected_title_id = t.id
     WHERE sc.student_id = ? AND sc.academy_id = ?`, [studentId, academyId]
  );
  if (!myChar) return { myRank: null, myInfo: null };

  const periodXp = Number(myPeriod?.period_xp) || 0;
  const totalXp = Number(myChar.xp) || 0;

  // 내 등수: 나보다 기간 XP가 높은 학생 수 + 1
  const rankResult = await getOne(
    `SELECT COUNT(*) as cnt FROM (
      SELECT sc2.student_id, COALESCE(xp_agg.total_xp, 0) as pxp
      FROM student_characters sc2
      JOIN students s2 ON sc2.student_id = s2.id JOIN users u2 ON s2.user_id = u2.id
      LEFT JOIN (
        SELECT student_id, SUM(amount) as total_xp FROM xp_logs WHERE academy_id = ? AND created_at >= ? AND amount > 0 AND source NOT IN ('admin_ranking_reward', 'admin_adjust', 'admin_ranking', 'admin_edit') GROUP BY student_id
      ) xp_agg ON xp_agg.student_id = sc2.student_id
      WHERE sc2.academy_id = ? AND u2.role != 'admin' AND u2.approved = 1 AND s2.school NOT IN ('조교', '선생님')
        AND COALESCE(xp_agg.total_xp, 0) > ?
    ) sub`, [academyId, since, academyId, periodXp]
  );
  const myRank = (rankResult ? Number(rankResult.cnt) : 0) + 1;

  const parsed = parseRankingRow(myChar);
  parsed.xp = periodXp;
  parsed.totalXp = totalXp;
  parsed.school = studentSchool;
  parsed.rank = myRank;

  return { myRank, myInfo: parsed };
}

// 기간 키 생성 (중복 방지용): weekly → '2026-W14', monthly → '2026-04'
function getPeriodKey(type) {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  if (type === 'weekly') {
    // ISO week number 계산
    const d = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
  } else {
    const year = kst.getUTCFullYear();
    const month = String(kst.getUTCMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }
}

module.exports = {
  rankingCache,
  parseGeminiJSON,
  callGemini,
  getLevelInfo,
  checkAndGrantTitles,
  generateCode,
  shuffleArray,
  maskName,
  getTodayKST,
  getLastFridayMidnight,
  getMonthStartMidnight,
  parseRankingRow,
  getPeriodRankings,
  getMyPeriodInfo,
  getPeriodKey,
};
