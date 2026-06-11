// BullMQ 큐 통합 (SMS / AI 리포트 / 알림)
// REDIS_URL 미설정 시 → 인라인 실행 (개발/테스트 호환)
// REDIS_URL 설정 시 → Redis 기반 큐 사용
//
// 의도:
//   - HTTP 요청 경로에서 SMS 발송·AI 호출을 블로킹하지 않도록 분리
//   - Solapi API rate limit 대응 (초당 요청 수 제한)
//   - 실패 시 exponential backoff 자동 재시도
//   - 등하원 피크 시 수백 건 동시 적재 → 워커가 rate 조절해 배출

let Queue, Worker, QueueEvents, IORedis;
try {
  ({ Queue, Worker, QueueEvents } = require('bullmq'));
  IORedis = require('ioredis');
} catch (e) {
  console.warn('[queue] bullmq/ioredis 미설치 — 인라인 모드로 폴백');
}

const REDIS_URL = process.env.REDIS_URL || '';
const useQueue = !!(REDIS_URL && Queue && IORedis);

let connection = null;
const queues = new Map();
const workers = new Map();

if (useQueue) {
  connection = new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null, // BullMQ 요구사항
    enableReadyCheck: true,
  });
  connection.on('error', (err) => console.error('[Redis]', err.message));
  console.log('[queue] BullMQ 활성 — Redis 연결:', REDIS_URL.replace(/\/\/.*@/, '//***@'));
} else {
  console.log('[queue] 인라인 모드 (REDIS_URL 미설정)');
}

function getQueue(name) {
  if (!useQueue) return null;
  if (queues.has(name)) return queues.get(name);
  const q = new Queue(name, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 }, // 2s, 4s, 8s
      removeOnComplete: { age: 60 * 60, count: 1000 }, // 1시간 유지 최대 1000건
      removeOnFail: { age: 24 * 60 * 60 }, // 24시간 유지
    },
  });
  queues.set(name, q);
  return q;
}

// 큐에 작업 추가. useQueue=false 면 processor 즉시 실행.
async function enqueue(queueName, jobName, data, opts = {}, inlineProcessor = null) {
  if (useQueue) {
    const q = getQueue(queueName);
    return q.add(jobName, data, opts);
  }
  // 인라인 실행 — 실패해도 요청에 영향 없도록 try-catch
  if (inlineProcessor) {
    try {
      await inlineProcessor({ name: jobName, data });
    } catch (err) {
      console.error(`[queue inline ${queueName}/${jobName}]`, err.message);
    }
  }
  return null;
}

// 워커 등록 (서버 시작 시 1회). 인라인 모드에서는 no-op.
function registerWorker(queueName, processor, opts = {}) {
  if (!useQueue) return null;
  if (workers.has(queueName)) return workers.get(queueName);

  const w = new Worker(queueName, processor, {
    connection,
    concurrency: opts.concurrency || 5,
    limiter: opts.limiter, // { max: 10, duration: 1000 } = 초당 10건
    ...opts,
  });

  w.on('failed', (job, err) => {
    console.error(`[worker ${queueName}] 실패 job=${job?.id} attempt=${job?.attemptsMade}:`, err.message);
  });
  w.on('completed', (job) => {
    if (job.attemptsMade > 1) {
      console.log(`[worker ${queueName}] 재시도 성공 job=${job.id} attempts=${job.attemptsMade}`);
    }
  });

  workers.set(queueName, w);
  return w;
}

async function shutdown() {
  for (const w of workers.values()) await w.close();
  for (const q of queues.values()) await q.close();
  if (connection) await connection.quit();
}

module.exports = {
  useQueue,
  enqueue,
  registerWorker,
  getQueue,
  shutdown,
  // 큐 이름 상수 (오타 방지)
  QUEUES: {
    SMS: 'sms',
    AI_REPORT: 'ai_report',
    NOTIFICATION: 'notification',
  },
};
