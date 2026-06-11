// 네트워크 호출 재시도 유틸
// 일시적 에러(네트워크 끊김 등) 대응. 4xx는 즉시 실패 (재시도 무의미).

/**
 * fetchFn을 최대 N회 재시도. 각 시도 간 exponential backoff.
 * 4xx 응답은 즉시 reject (영속적 에러는 재시도 의미 없음).
 *
 * @param {() => Promise} fn - 실행할 비동기 함수
 * @param {object} opts
 * @param {number} opts.retries - 재시도 횟수 (기본 2, 총 3회 시도)
 * @param {number} opts.delay - 초기 딜레이 ms (기본 500)
 */
export async function withRetry(fn, { retries = 2, delay = 500 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      // 4xx는 즉시 중단 (영속적 클라이언트 에러)
      const status = err?.status || err?.response?.status;
      if (status >= 400 && status < 500) throw err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, delay * Math.pow(2, attempt)));
      }
    }
  }
  throw lastErr;
}
