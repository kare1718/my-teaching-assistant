// 로그인 브루트포스 방지 미들웨어
//
// 전략 (two-layer):
//   1. IP 기반: 한 IP에서 15분간 10회 실패 → 차단
//   2. 계정 기반: 한 username으로 15분간 5회 실패 → 차단 (다른 IP에서 시도해도 차단)
//
// 메모리 기반 (프로세스 재시작 시 리셋).
// 멀티 인스턴스 배포 시에는 Redis 공유 카운터로 전환 권장 → 현재는 단일 인스턴스 전제.

const WINDOW_MS = 15 * 60 * 1000; // 15분
const MAX_FAILS_PER_IP = 10;
const MAX_FAILS_PER_ACCOUNT = 5;
const MAX_MAP_SIZE = 10000; // 메모리 보호

// key → { fails: [], lockedUntil: timestamp|null }
const ipAttempts = new Map();
const accountAttempts = new Map();

function now() { return Date.now(); }

// 만료된 entry 정리 (삽입 시마다 호출 → amortized O(1))
function pruneIfFull(map) {
  if (map.size <= MAX_MAP_SIZE) return;
  const t = now();
  for (const [k, v] of map.entries()) {
    if (v.fails.length === 0 || v.fails[v.fails.length - 1] < t - WINDOW_MS) {
      map.delete(k);
      if (map.size <= MAX_MAP_SIZE * 0.9) break;
    }
  }
}

function recordFailure(map, key, maxFails) {
  pruneIfFull(map);
  const entry = map.get(key) || { fails: [], lockedUntil: null };
  const t = now();
  entry.fails = entry.fails.filter(ts => ts > t - WINDOW_MS);
  entry.fails.push(t);
  if (entry.fails.length >= maxFails) {
    entry.lockedUntil = t + WINDOW_MS;
  }
  map.set(key, entry);
  return entry;
}

function clearFailures(map, key) {
  map.delete(key);
}

function checkLocked(map, key) {
  const entry = map.get(key);
  if (!entry) return { locked: false };
  const t = now();
  // 만료된 fails 제거
  entry.fails = entry.fails.filter(ts => ts > t - WINDOW_MS);
  if (entry.fails.length === 0 && (!entry.lockedUntil || entry.lockedUntil < t)) {
    map.delete(key);
    return { locked: false };
  }
  if (entry.lockedUntil && entry.lockedUntil > t) {
    return {
      locked: true,
      remainingSec: Math.ceil((entry.lockedUntil - t) / 1000),
      fails: entry.fails.length,
    };
  }
  return { locked: false, fails: entry.fails.length };
}

/**
 * Express 미들웨어 — 로그인 엔드포인트 앞에 배치
 * 검증 후 req.loginProtection = { ipKey, accountKey, markFailure, markSuccess } 를 세팅.
 * 실패/성공은 라우트 핸들러에서 명시적으로 호출.
 */
function loginProtection(req, res, next) {
  const ip = (req.ip || req.connection?.remoteAddress || 'unknown').slice(0, 64);
  const username = (req.body?.username || '').slice(0, 100).toLowerCase();
  const academySlug = (req.body?.academySlug || '').slice(0, 100).toLowerCase();
  const accountKey = academySlug ? `${academySlug}:${username}` : username;

  // 사전 차단 체크
  const ipCheck = checkLocked(ipAttempts, ip);
  if (ipCheck.locked) {
    return res.status(429).json({
      error: `너무 많은 로그인 시도가 있었습니다. ${Math.ceil(ipCheck.remainingSec / 60)}분 후 다시 시도해주세요.`,
      retryAfter: ipCheck.remainingSec,
    });
  }
  if (username) {
    const accCheck = checkLocked(accountAttempts, accountKey);
    if (accCheck.locked) {
      return res.status(429).json({
        error: `이 계정의 로그인이 일시 차단되었습니다. ${Math.ceil(accCheck.remainingSec / 60)}분 후 다시 시도해주세요.`,
        retryAfter: accCheck.remainingSec,
      });
    }
  }

  // 핸들러가 성공/실패를 표시할 수 있도록 헬퍼 주입
  req.loginProtection = {
    ip, accountKey,
    markFailure() {
      recordFailure(ipAttempts, ip, MAX_FAILS_PER_IP);
      if (username) recordFailure(accountAttempts, accountKey, MAX_FAILS_PER_ACCOUNT);
    },
    markSuccess() {
      clearFailures(ipAttempts, ip);
      if (username) clearFailures(accountAttempts, accountKey);
    },
  };

  next();
}

// 내부 테스트용 reset
function _reset() {
  ipAttempts.clear();
  accountAttempts.clear();
}

module.exports = { loginProtection, _reset };
