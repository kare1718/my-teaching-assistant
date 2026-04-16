/**
 * 자동 결제 크론잡 스케줄러
 *
 * - 매일 03:00 KST: Trial 만료 체크 → Free Tier 다운그레이드
 * - 매일 06:00 KST: 자동 정기결제 (processAutoPayments)
 * - 매일 07:00 KST: 결제 실패 건 자동 재시도 (최대 3회, 3일간)
 */

const cron = require('node-cron');
const { getAll, getOne, runQuery, runInsert } = require('../db/database');
const { processAutoPayments, chargeByBillingKey } = require('./billing');
const { TIER_LIMITS, YEARLY_PRICES } = require('../middleware/subscription');
const { onTuitionOverdue, createTask } = require('./automation');

// ─────────────────────────────────────────────
// 1. Trial 만료 → Free Tier 자동 전환
// ─────────────────────────────────────────────
async function checkTrialExpiry() {
  const tag = '[크론/Trial만료]';
  console.log(`${tag} Trial 만료 체크 시작...`);

  try {
    // trial_ends_at이 지났고 status가 trial인 구독 조회
    const expired = await getAll(
      `SELECT s.*, a.name as academy_name, a.id as aid
       FROM subscriptions s
       JOIN academies a ON a.id = s.academy_id
       WHERE s.status = 'trial'
         AND s.trial_ends_at IS NOT NULL
         AND s.trial_ends_at < NOW()`,
      []
    );

    console.log(`${tag} 만료된 Trial: ${expired.length}건`);

    for (const sub of expired) {
      try {
        // 1) 구독을 free로 변경
        await runQuery(
          `UPDATE subscriptions SET status = 'active', plan_type = 'free' WHERE id = ?`,
          [sub.id]
        );

        // 2) 학원 tier를 free로, max_students를 15로 제한 (Free 플랜 기준)
        await runQuery(
          `UPDATE academies SET subscription_tier = 'free', max_students = 15 WHERE id = ?`,
          [sub.academy_id]
        );

        // 3) 플랫폼 알림 발송 (학원 관리자에게)
        await runInsert(
          `INSERT INTO platform_notifications (academy_id, type, title, message, created_at)
           VALUES (?, 'subscription', 'Trial 기간 만료', '30일 체험 기간이 종료되어 Free 플랜으로 전환되었습니다. 유료 플랜으로 업그레이드하면 더 많은 기능을 사용할 수 있습니다.', NOW())`,
          [sub.academy_id]
        );

        console.log(`${tag} ✅ 학원 "${sub.academy_name}" (ID:${sub.academy_id}): Free Tier로 전환 완료`);
      } catch (err) {
        console.error(`${tag} ❌ 학원 ${sub.academy_id} 처리 실패:`, err.message);
      }
    }

    console.log(`${tag} Trial 만료 체크 완료`);
  } catch (err) {
    console.error(`${tag} 전체 오류:`, err.message);
  }
}

// ─────────────────────────────────────────────
// 2. 결제 실패 자동 재시도 (최대 3회, 3일간)
// ─────────────────────────────────────────────
async function retryFailedPayments() {
  const tag = '[크론/결제재시도]';
  console.log(`${tag} 결제 실패 건 재시도 시작...`);

  try {
    // past_due 상태이고, 재시도 횟수 3회 미만, 빌링키가 있는 구독
    const targets = await getAll(
      `SELECT s.*, a.name as academy_name, a.is_active as academy_active
       FROM subscriptions s
       JOIN academies a ON a.id = s.academy_id
       WHERE s.status = 'past_due'
         AND s.portone_billing_key IS NOT NULL
         AND COALESCE(s.payment_retry_count, 0) < 3
         AND (s.last_payment_failed_at IS NULL
              OR s.last_payment_failed_at > NOW() - INTERVAL '3 days')`,
      []
    );

    console.log(`${tag} 재시도 대상: ${targets.length}건`);

    for (const sub of targets) {
      const retryNum = (sub.payment_retry_count || 0) + 1;

      try {
        const tier = sub.plan_type;
        const isYearly = sub.billing_cycle === 'yearly';
        const amount = isYearly
          ? (YEARLY_PRICES[tier] || 0)
          : (TIER_LIMITS[tier]?.price || 0);

        if (amount <= 0) {
          console.log(`${tag} 학원 "${sub.academy_name}": 결제 금액 0원, 스킵`);
          continue;
        }

        console.log(`${tag} 학원 "${sub.academy_name}": ${retryNum}/3회차 재시도 (${amount}원)`);

        const result = await chargeByBillingKey({
          billingKey: sub.portone_billing_key,
          amount,
          orderName: `나만의 조교 ${tier} 구독 (자동 재시도 ${retryNum}회차)`,
          academyId: sub.academy_id,
          subscriptionId: sub.id,
        });

        if (result.success) {
          // 결제 성공 → 구독 복구
          const nextEnd = new Date();
          if (isYearly) {
            nextEnd.setFullYear(nextEnd.getFullYear() + 1);
          } else {
            nextEnd.setMonth(nextEnd.getMonth() + 1);
          }

          await runQuery(
            `UPDATE subscriptions
             SET status = 'active',
                 payment_retry_count = 0,
                 last_payment_failed_at = NULL,
                 current_period_start = NOW(),
                 current_period_end = ?
             WHERE id = ?`,
            [nextEnd.toISOString(), sub.id]
          );

          await runQuery(`UPDATE academies SET is_active = 1 WHERE id = ?`, [sub.academy_id]);

          await runInsert(
            `INSERT INTO payments (academy_id, subscription_id, portone_payment_id, amount, status, paid_at)
             VALUES (?, ?, ?, ?, 'paid', NOW())`,
            [sub.academy_id, sub.id, result.paymentId, amount]
          );

          // 성공 알림
          await runInsert(
            `INSERT INTO platform_notifications (academy_id, type, title, message, created_at)
             VALUES (?, 'payment', '결제 성공', '자동 재결제가 성공했습니다. 구독이 정상 복구되었습니다.', NOW())`,
            [sub.academy_id]
          );

          console.log(`${tag} ✅ 학원 "${sub.academy_name}": 재결제 성공 (${retryNum}회차)`);
        } else {
          // 결제 실패 → 카운트 증가
          await runQuery(
            `UPDATE subscriptions
             SET payment_retry_count = ?,
                 last_payment_failed_at = NOW()
             WHERE id = ?`,
            [retryNum, sub.id]
          );

          await runInsert(
            `INSERT INTO payments (academy_id, subscription_id, portone_payment_id, amount, status, failed_reason, retry_count, created_at)
             VALUES (?, ?, ?, ?, 'failed', ?, ?, NOW())`,
            [sub.academy_id, sub.id, result.paymentId || `retry_${retryNum}_failed`, amount, result.error || '결제 실패', retryNum]
          );

          console.log(`${tag} ❌ 학원 "${sub.academy_name}": ${retryNum}/3회차 재시도 실패 — ${result.error}`);

          // 3회 초과 시 → 학원 비활성화 + 관리자 알림
          if (retryNum >= 3) {
            await runQuery(`UPDATE academies SET is_active = 0 WHERE id = ?`, [sub.academy_id]);
            await runQuery(`UPDATE subscriptions SET status = 'suspended' WHERE id = ?`, [sub.id]);

            await runInsert(
              `INSERT INTO platform_notifications (academy_id, type, title, message, created_at)
               VALUES (?, 'payment', '결제 실패 — 서비스 일시 중지', '3회 자동 결제 재시도가 모두 실패했습니다. 결제 수단을 확인하고 수동으로 재결제해주세요. 서비스가 일시 중지됩니다.', NOW())`,
              [sub.academy_id]
            );

            console.log(`${tag} 🚫 학원 "${sub.academy_name}": 3회 실패 → 서비스 중지, 관리자 알림 발송`);
          }
        }
      } catch (err) {
        console.error(`${tag} 학원 ${sub.academy_id} 처리 오류:`, err.message);
      }
    }

    console.log(`${tag} 결제 재시도 완료`);
  } catch (err) {
    console.error(`${tag} 전체 오류:`, err.message);
  }
}

// ─────────────────────────────────────────────
// 3. 예약 메시지 발송 (매분 실행)
// ─────────────────────────────────────────────
async function processScheduledMessages() {
  const tag = '[크론/예약발송]';

  try {
    const pending = await getAll(
      `SELECT * FROM message_schedule
       WHERE status = 'pending' AND scheduled_at <= NOW()
       ORDER BY scheduled_at ASC LIMIT 20`,
      []
    );

    if (pending.length === 0) return;
    console.log(`${tag} 발송 대기: ${pending.length}건`);

    const { sendSMS } = require('../utils/smsHelper');
    const {
      getMessageType, calculateTotalCost, checkAndDeductCredits,
      logSentMessages, refundFailedMessages, getCredits,
    } = require('../utils/smsBilling');

    for (const schedule of pending) {
      try {
        const recipients = typeof schedule.recipients === 'string'
          ? JSON.parse(schedule.recipients) : schedule.recipients;
        const phones = recipients.phones || [];

        if (phones.length === 0) {
          await runQuery('UPDATE message_schedule SET status = ?, error_message = ? WHERE id = ?',
            ['failed', '수신자 없음', schedule.id]);
          continue;
        }

        // 비용 차감
        const msgs = phones.map(p => ({ phone: p, message: schedule.message }));
        const costResult = await calculateTotalCost(msgs, schedule.academy_id);
        const deductResult = await checkAndDeductCredits(
          schedule.academy_id, costResult.totalCost,
          `예약 발송 ${phones.length}건`, schedule.created_by
        );

        if (!deductResult.success) {
          await runQuery('UPDATE message_schedule SET status = ?, error_message = ? WHERE id = ?',
            ['failed', '크레딧 부족', schedule.id]);
          continue;
        }

        // 발송
        const batchId = require('crypto').randomUUID();
        const msgType = getMessageType(schedule.message);
        let success = 0, fail = 0;
        const logEntries = [];

        for (const phone of phones) {
          try {
            const result = await sendSMS(phone, schedule.message);
            success++;
            logEntries.push({ phone, message: schedule.message, messageType: msgType, status: 'sent',
              solapiMessageId: result?.messageId || null });
          } catch (e) {
            fail++;
            logEntries.push({ phone, message: schedule.message, messageType: msgType, status: 'failed', error: e.message });
          }
        }

        await logSentMessages(batchId, logEntries, schedule.created_by, schedule.academy_id);

        if (fail > 0) {
          const failedCost = logEntries.filter(l => l.status === 'failed').length *
            (costResult.breakdown[msgType]?.unitCost || 13);
          await refundFailedMessages(schedule.academy_id, fail, failedCost, schedule.created_by, batchId);
        }

        await runQuery(
          'UPDATE message_schedule SET status = ?, sent_at = NOW(), error_message = ? WHERE id = ?',
          ['sent', fail > 0 ? `성공 ${success}, 실패 ${fail}` : null, schedule.id]
        );

        console.log(`${tag} ✅ 예약 #${schedule.id}: 성공 ${success}, 실패 ${fail}`);
      } catch (err) {
        await runQuery('UPDATE message_schedule SET status = ?, error_message = ? WHERE id = ?',
          ['failed', err.message, schedule.id]);
        console.error(`${tag} ❌ 예약 #${schedule.id} 실패:`, err.message);
      }
    }
  } catch (err) {
    console.error(`${tag} 전체 오류:`, err.message);
  }
}

// ─────────────────────────────────────────────
// 크론잡 등록
// ─────────────────────────────────────────────
function initCronJobs() {
  console.log('[크론] 스케줄러 초기화...');

  // 매일 오전 3시 (KST) — Trial 만료 체크
  cron.schedule('0 3 * * *', async () => {
    console.log(`[크론] ${new Date().toISOString()} — Trial 만료 체크 시작`);
    try {
      await checkTrialExpiry();
    } catch (err) {
      console.error('[크론/Trial만료] 크론잡 실행 실패:', err.message);
    }
  }, { timezone: 'Asia/Seoul' });

  // 매일 오전 6시 (KST) — 자동 정기결제
  cron.schedule('0 6 * * *', async () => {
    console.log(`[크론] ${new Date().toISOString()} — 자동 정기결제 시작`);
    try {
      await processAutoPayments();
    } catch (err) {
      console.error('[크론/자동결제] 크론잡 실행 실패:', err.message);
    }
  }, { timezone: 'Asia/Seoul' });

  // 매일 오전 7시 (KST) — 결제 실패 재시도
  cron.schedule('0 7 * * *', async () => {
    console.log(`[크론] ${new Date().toISOString()} — 결제 실패 재시도 시작`);
    try {
      await retryFailedPayments();
    } catch (err) {
      console.error('[크론/결제재시도] 크론잡 실행 실패:', err.message);
    }
  }, { timezone: 'Asia/Seoul' });

  // 매분 — 예약 메시지 발송
  cron.schedule('* * * * *', async () => {
    try {
      await processScheduledMessages();
    } catch (err) {
      console.error('[크론/예약발송] 크론잡 실행 실패:', err.message);
    }
  }, { timezone: 'Asia/Seoul' });

  // ─────────────────────────────────────────────
  // 매일 08:00 KST — 미납 자동 리마인드
  // ─────────────────────────────────────────────
  cron.schedule('0 8 * * *', async () => {
    console.log(`[크론] ${new Date().toISOString()} — 미납 리마인드 시작`);
    try {
      const overdueRecords = await getAll(
        `SELECT tr.*, a.id as aid FROM tuition_records tr
         JOIN academies a ON a.id = tr.academy_id
         WHERE tr.status = 'overdue' AND tr.academy_id IN (
           SELECT academy_id FROM automation_rules WHERE trigger_type = 'overdue' AND is_active = true
         )`, []
      );
      for (const record of overdueRecords) {
        await onTuitionOverdue(record.academy_id, record).catch(e => console.error('[크론/미납] 오류:', e.message));
      }
      console.log(`[크론] 미납 리마인드 완료: ${overdueRecords.length}건`);
    } catch (err) { console.error('[크론/미납] 전체 오류:', err.message); }
  }, { timezone: 'Asia/Seoul' });

  // ─────────────────────────────────────────────
  // 매일 09:00 KST — 보강 미편성 경고
  // ─────────────────────────────────────────────
  cron.schedule('0 9 * * *', async () => {
    console.log(`[크론] ${new Date().toISOString()} — 보강 미편성 경고 시작`);
    try {
      const pendingMakeups = await getAll(
        `SELECT a.id as attendance_id, a.academy_id, a.student_id, a.date,
                u.name as student_name
         FROM attendance a
         JOIN students s ON s.id = a.student_id
         JOIN users u ON u.id = s.user_id
         LEFT JOIN attendance_rules ar ON ar.academy_id = a.academy_id
         WHERE a.makeup_status = 'pending'
           AND a.date <= CURRENT_DATE - INTERVAL '3 days'
           AND (s.status IS NULL OR s.status = 'active')`,
        []
      );

      for (const makeup of pendingMakeups) {
        const existingTask = await getOne(
          "SELECT id FROM task_queue WHERE academy_id = ? AND task_type = 'makeup_scheduling' AND related_entity_id = ? AND status = 'pending'",
          [makeup.academy_id, makeup.attendance_id]
        );
        if (!existingTask) {
          await createTask(makeup.academy_id, {
            task_type: 'makeup_scheduling',
            title: `${makeup.student_name} 보강 미편성 — 편성 필요`,
            description: `${makeup.student_name} 학생의 보강이 아직 편성되지 않았습니다. (결석일: ${typeof makeup.date === 'string' ? makeup.date.slice(0, 10) : new Date(makeup.date).toISOString().slice(0, 10)})`,
            related_student_id: makeup.student_id,
            related_entity_type: 'attendance',
            related_entity_id: makeup.attendance_id,
            priority: 'high',
          });
        }
      }
      console.log(`[크론] 보강 미편성 경고 완료: ${pendingMakeups.length}건 확인`);
    } catch (err) { console.error('[크론/보강] 전체 오류:', err.message); }
  }, { timezone: 'Asia/Seoul' });

  // ─────────────────────────────────────────────
  // 매일 10:00 KST — 상담 후속조치 미완료 알림
  // ─────────────────────────────────────────────
  cron.schedule('0 10 * * *', async () => {
    console.log(`[크론] ${new Date().toISOString()} — 상담 후속조치 체크 시작`);
    try {
      const pendingFollowups = await getAll(
        `SELECT cl.id as log_id, cl.academy_id, cl.student_id, cl.follow_up_date,
                u.name as student_name
         FROM consultation_logs cl
         JOIN students s ON s.id = cl.student_id
         JOIN users u ON u.id = s.user_id
         WHERE cl.follow_up_date <= CURRENT_DATE
           AND (cl.follow_up_done = false OR cl.follow_up_done IS NULL)
           AND (s.status IS NULL OR s.status = 'active')`,
        []
      );

      for (const followup of pendingFollowups) {
        const existingTask = await getOne(
          "SELECT id FROM task_queue WHERE academy_id = ? AND task_type = 'consultation_followup' AND related_entity_id = ? AND status = 'pending'",
          [followup.academy_id, followup.log_id]
        );
        if (!existingTask) {
          await createTask(followup.academy_id, {
            task_type: 'consultation_followup',
            title: `${followup.student_name} 상담 후속조치 미완료`,
            description: `${followup.student_name} 학생의 상담 후속조치가 예정일(${typeof followup.follow_up_date === 'string' ? followup.follow_up_date.slice(0, 10) : new Date(followup.follow_up_date).toISOString().slice(0, 10)})까지 완료되지 않았습니다.`,
            related_student_id: followup.student_id,
            related_entity_type: 'consultation_log',
            related_entity_id: followup.log_id,
            priority: 'normal',
          });
        }
      }
      console.log(`[크론] 상담 후속조치 체크 완료: ${pendingFollowups.length}건 확인`);
    } catch (err) { console.error('[크론/상담] 전체 오류:', err.message); }
  }, { timezone: 'Asia/Seoul' });

  // ─────────────────────────────────────────────
  // 매주 월요일 09:00 KST — 퇴원 위험 학생
  // ─────────────────────────────────────────────
  cron.schedule('0 9 * * 1', async () => {
    console.log(`[크론] ${new Date().toISOString()} — 퇴원 위험 학생 체크 시작`);
    try {
      // 연속 결석 3회 이상인 학생
      const absentStudents = await getAll(
        `SELECT s.id as student_id, s.academy_id, u.name as student_name
         FROM students s
         JOIN users u ON u.id = s.user_id
         WHERE (s.status IS NULL OR s.status = 'active')
           AND (
             -- 최근 3개 출결이 모두 결석
             (SELECT COUNT(*) FROM (
               SELECT status FROM attendance
               WHERE student_id = s.id AND academy_id = s.academy_id
               ORDER BY date DESC LIMIT 3
             ) recent WHERE status = 'absent') >= 3
           )`,
        []
      );

      for (const student of absentStudents) {
        const existingTask = await getOne(
          "SELECT id FROM task_queue WHERE academy_id = ? AND task_type = 'withdrawal_risk' AND related_student_id = ? AND status = 'pending'",
          [student.academy_id, student.student_id]
        );
        if (!existingTask) {
          await createTask(student.academy_id, {
            task_type: 'withdrawal_risk',
            title: `${student.student_name} 퇴원 위험 — 연속 결석`,
            description: `${student.student_name} 학생이 최근 연속 3회 이상 결석했습니다. 퇴원 위험 학생으로 분류됩니다.`,
            related_student_id: student.student_id,
            related_entity_type: 'student',
            related_entity_id: student.student_id,
            priority: 'urgent',
          });
        }
      }

      // 미납 2개월 이상인 학생
      const overdueStudents = await getAll(
        `SELECT DISTINCT tr.student_id, tr.academy_id, u.name as student_name
         FROM tuition_records tr
         JOIN students s ON s.id = tr.student_id
         JOIN users u ON u.id = s.user_id
         WHERE tr.status IN ('pending', 'overdue')
           AND tr.due_date < CURRENT_DATE - INTERVAL '60 days'
           AND (s.status IS NULL OR s.status = 'active')`,
        []
      );

      for (const student of overdueStudents) {
        const existingTask = await getOne(
          "SELECT id FROM task_queue WHERE academy_id = ? AND task_type = 'withdrawal_risk' AND related_student_id = ? AND status = 'pending'",
          [student.academy_id, student.student_id]
        );
        if (!existingTask) {
          await createTask(student.academy_id, {
            task_type: 'withdrawal_risk',
            title: `${student.student_name} 퇴원 위험 — 장기 미납`,
            description: `${student.student_name} 학생의 수강료가 2개월 이상 미납 상태입니다. 퇴원 위험 학생으로 분류됩니다.`,
            related_student_id: student.student_id,
            related_entity_type: 'tuition_record',
            priority: 'urgent',
          });
        }
      }

      console.log(`[크론] 퇴원 위험 체크 완료: 결석 ${absentStudents.length}명, 미납 ${overdueStudents.length}명`);
    } catch (err) { console.error('[크론/퇴원위험] 전체 오류:', err.message); }
  }, { timezone: 'Asia/Seoul' });

  // ─────────────────────────────────────────────
  // 매주 월요일 08:00 KST — KPI 주간 리포트 (SuperAdmin)
  // ─────────────────────────────────────────────
  cron.schedule('0 8 * * 1', async () => {
    console.log(`[크론] ${new Date().toISOString()} — 주간 KPI 리포트 생성`);
    try {
      const kpi = require('./kpi');
      const to = new Date().toISOString();
      const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const [northStar, funnel, warnings] = await Promise.all([
        kpi.getNorthStarMetrics(from, to),
        kpi.getFunnel(from, to),
        kpi.getWarnings(),
      ]);

      const summary = {
        period: { from, to },
        northStar,
        funnel,
        warnings,
        generated_at: new Date().toISOString(),
      };

      // SuperAdmin에게 플랫폼 알림 발송
      const admins = await getAll(
        `SELECT id FROM users WHERE role = 'superadmin'`,
        []
      );
      for (const admin of admins) {
        try {
          await runInsert(
            `INSERT INTO notifications (user_id, academy_id, type, title, message, data, created_at)
             VALUES (?, NULL, 'kpi_weekly', ?, ?, ?, NOW())`,
            [
              admin.id,
              '주간 KPI 리포트',
              `활성 학원 ${northStar.active_academies}곳 · 신규 가입 ${funnel.signups}건 · 결제 ${funnel.paid}건 · 경고 ${warnings.length}건`,
              JSON.stringify(summary),
            ]
          );
        } catch (e) { /* notifications 테이블이 없거나 스키마 다르면 무시 */ }
      }

      console.log(`[크론/KPI] 주간 리포트 발송 완료 (SuperAdmin ${admins.length}명)`);
    } catch (err) { console.error('[크론/KPI] 전체 오류:', err.message); }
  }, { timezone: 'Asia/Seoul' });

  console.log('[크론] 스케줄 등록 완료:');
  console.log('  - 매분: 예약 메시지 발송');
  console.log('  - 03:00 KST: Trial 만료 → Free Tier 전환');
  console.log('  - 06:00 KST: 자동 정기결제');
  console.log('  - 07:00 KST: 결제 실패 재시도 (최대 3회)');
  console.log('  - 08:00 KST: 미납 자동 리마인드');
  console.log('  - 09:00 KST: 보강 미편성 경고');
  console.log('  - 10:00 KST: 상담 후속조치 미완료 알림');
  console.log('  - 매주 월 09:00 KST: 퇴원 위험 학생 체크');
  console.log('  - 매주 월 08:00 KST: KPI 주간 리포트 (SuperAdmin)');
}

module.exports = { initCronJobs, checkTrialExpiry, retryFailedPayments, processScheduledMessages };
