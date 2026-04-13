/**
 * 자동화 엔진 서비스
 *
 * - 출결/수납/퇴원 이벤트 트리거 처리
 * - 자동화 규칙 실행 (SMS, 태스크 생성, 알림)
 * - 업무 큐 관리
 */

const { getAll, getOne, runQuery, runInsert } = require('../db/database');
const { sendToParent } = require('./notification');

// ══════════════════════════════════════
// 트리거 핸들러
// ══════════════════════════════════════

/**
 * 출결 기록 후 자동화 트리거
 * - 결석 시 보호자 SMS 발송
 * - 연속 결석 체크 → 상담 태스크 생성
 */
async function onAttendanceMarked(academyId, attendance) {
  const tag = '[자동화/출결]';

  try {
    if (attendance.status !== 'absent') return;

    // 1. 결석 자동화 규칙 조회
    const rules = await getAll(
      "SELECT * FROM automation_rules WHERE academy_id = ? AND trigger_type = 'absence' AND is_active = true",
      [academyId]
    );

    // 학생 정보 조회
    const student = await getOne(
      'SELECT s.id, u.name as student_name FROM students s JOIN users u ON u.id = s.user_id WHERE s.id = ? AND s.academy_id = ?',
      [attendance.student_id, academyId]
    );
    const studentName = student?.student_name || '학생';

    // 2. 규칙이 있으면 실행
    for (const rule of rules) {
      try {
        await processAutomationRule(rule, {
          type: 'absence',
          student_id: attendance.student_id,
          student_name: studentName,
          date: attendance.date,
        });
      } catch (e) {
        console.error(`${tag} 규칙 ${rule.id} 실행 오류:`, e.message);
      }
    }

    // 규칙이 없어도 기본 결석 알림 발송
    if (rules.length === 0) {
      const message = `${studentName} 학생이 오늘 결석했습니다.`;
      await sendToParent(academyId, attendance.student_id, message, 'attendance').catch(e =>
        console.error(`${tag} 기본 SMS 발송 오류:`, e.message)
      );
    }

    // 3. 연속 결석 체크
    const attendanceRules = await getOne(
      'SELECT consecutive_absence_alert FROM attendance_rules WHERE academy_id = ?',
      [academyId]
    );
    const threshold = attendanceRules?.consecutive_absence_alert || 3;

    // 최근 N개 출결 기록 조회 (해당 학생)
    const recentRecords = await getAll(
      `SELECT status FROM attendance
       WHERE academy_id = ? AND student_id = ?
       ORDER BY date DESC LIMIT ?`,
      [academyId, attendance.student_id, threshold]
    );

    // 모두 결석(absent)이거나 기록이 없으면 연속 결석
    const consecutiveAbsences = recentRecords.filter(r => r.status === 'absent').length;
    if (consecutiveAbsences >= threshold) {
      // 이미 동일 태스크가 있는지 확인 (중복 방지)
      const existingTask = await getOne(
        "SELECT id FROM task_queue WHERE academy_id = ? AND task_type = 'absence_counseling' AND related_student_id = ? AND status = 'pending'",
        [academyId, attendance.student_id]
      );

      if (!existingTask) {
        await createTask(academyId, {
          task_type: 'absence_counseling',
          title: `${studentName} 연속 ${consecutiveAbsences}회 결석 — 상담 필요`,
          description: `${studentName} 학생이 연속 ${consecutiveAbsences}회 결석했습니다. 보호자 상담이 필요합니다.`,
          related_student_id: attendance.student_id,
          related_entity_type: 'attendance',
          priority: 'high',
        });
        console.log(`${tag} 연속 결석 상담 태스크 생성: ${studentName} (${consecutiveAbsences}회)`);
      }
    }
  } catch (err) {
    console.error(`${tag} 오류:`, err.message);
  }
}

/**
 * 미납 발생 시 자동화 트리거
 * - 보호자 SMS 발송
 * - 연락 태스크 생성
 */
async function onTuitionOverdue(academyId, record) {
  const tag = '[자동화/미납]';

  try {
    // 학생 정보 조회
    const student = await getOne(
      'SELECT s.id, u.name as student_name FROM students s JOIN users u ON u.id = s.user_id WHERE s.id = ? AND s.academy_id = ?',
      [record.student_id, academyId]
    );
    const studentName = student?.student_name || '학생';

    // 미납 자동화 규칙 조회
    const rules = await getAll(
      "SELECT * FROM automation_rules WHERE academy_id = ? AND trigger_type = 'overdue' AND is_active = true",
      [academyId]
    );

    for (const rule of rules) {
      try {
        await processAutomationRule(rule, {
          type: 'overdue',
          student_id: record.student_id,
          student_name: studentName,
          amount: record.amount,
          due_date: record.due_date,
        });
      } catch (e) {
        console.error(`${tag} 규칙 ${rule.id} 실행 오류:`, e.message);
      }
    }

    // 규칙이 없어도 기본 동작
    if (rules.length === 0) {
      const message = `${studentName} 학생의 수강료가 미납 상태입니다.`;
      await sendToParent(academyId, record.student_id, message, 'tuition').catch(e =>
        console.error(`${tag} 기본 SMS 발송 오류:`, e.message)
      );
    }

    // 연락 태스크 생성 (중복 방지)
    const existingTask = await getOne(
      "SELECT id FROM task_queue WHERE academy_id = ? AND task_type = 'overdue_contact' AND related_student_id = ? AND status = 'pending'",
      [academyId, record.student_id]
    );

    if (!existingTask) {
      await createTask(academyId, {
        task_type: 'overdue_contact',
        title: `${studentName} 수강료 미납 — 연락 필요`,
        description: `${studentName} 학생의 수강료(${record.amount?.toLocaleString?.() || record.amount}원)가 미납 상태입니다. 보호자에게 연락해주세요.`,
        related_student_id: record.student_id,
        related_entity_type: 'tuition_record',
        related_entity_id: record.id,
        priority: 'high',
      });
    }
  } catch (err) {
    console.error(`${tag} 오류:`, err.message);
  }
}

/**
 * 퇴원 시 자동화 트리거
 * - 퇴원 사유 기록 태스크 생성
 */
async function onStudentWithdrawal(academyId, student) {
  const tag = '[자동화/퇴원]';

  try {
    const studentName = student.name || '학생';

    await createTask(academyId, {
      task_type: 'withdrawal_reason',
      title: `${studentName} 퇴원 사유 기록`,
      description: `${studentName} 학생이 퇴원 처리되었습니다. 퇴원 사유를 기록해주세요.`,
      related_student_id: student.id,
      related_entity_type: 'student',
      related_entity_id: student.id,
      priority: 'normal',
    });

    console.log(`${tag} 퇴원 사유 기록 태스크 생성: ${studentName}`);
  } catch (err) {
    console.error(`${tag} 오류:`, err.message);
  }
}

// ══════════════════════════════════════
// 업무 큐
// ══════════════════════════════════════

/**
 * 업무 큐에 태스크 생성
 */
async function createTask(academyId, {
  task_type, title, description,
  related_student_id, related_entity_type, related_entity_id,
  assigned_to, priority, due_date,
}) {
  const id = await runInsert(
    `INSERT INTO task_queue
     (academy_id, task_type, title, description, related_student_id, related_entity_type, related_entity_id, assigned_to, priority, due_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      academyId,
      task_type,
      title,
      description || null,
      related_student_id || null,
      related_entity_type || null,
      related_entity_id || null,
      assigned_to || null,
      priority || 'normal',
      due_date || null,
    ]
  );
  return id;
}

// ══════════════════════════════════════
// 규칙 실행 엔진
// ══════════════════════════════════════

/**
 * 자동화 규칙 실행
 */
async function processAutomationRule(rule, triggerData) {
  const tag = '[자동화/규칙]';
  let status = 'success';
  let actionResult = {};

  try {
    const config = typeof rule.action_config === 'string'
      ? JSON.parse(rule.action_config) : rule.action_config;

    switch (rule.action_type) {
      case 'send_sms': {
        // 템플릿 메시지 치환
        let message = config.template || `{student_name} 학생 관련 알림입니다.`;
        message = message
          .replace('{student_name}', triggerData.student_name || '학생')
          .replace('{date}', triggerData.date || new Date().toISOString().slice(0, 10))
          .replace('{amount}', triggerData.amount?.toLocaleString?.() || triggerData.amount || '');

        const result = await sendToParent(
          rule.academy_id,
          triggerData.student_id,
          message,
          triggerData.type || 'automation'
        );
        actionResult = { message, sms_result: result };
        break;
      }

      case 'create_task': {
        const taskId = await createTask(rule.academy_id, {
          task_type: config.task_type || 'automation',
          title: (config.title || '자동 생성 태스크')
            .replace('{student_name}', triggerData.student_name || '학생'),
          description: (config.description || '')
            .replace('{student_name}', triggerData.student_name || '학생'),
          related_student_id: triggerData.student_id,
          related_entity_type: config.entity_type,
          priority: config.priority || 'normal',
          assigned_to: config.assigned_to,
        });
        actionResult = { task_id: taskId };
        break;
      }

      case 'send_notification': {
        let message = config.message || '자동화 알림';
        message = message
          .replace('{student_name}', triggerData.student_name || '학생')
          .replace('{date}', triggerData.date || '');

        await runInsert(
          `INSERT INTO platform_notifications (academy_id, type, title, message, created_at)
           VALUES (?, 'automation', ?, ?, NOW())`,
          [rule.academy_id, config.title || '자동화 알림', message]
        );
        actionResult = { notification_sent: true, message };
        break;
      }

      default:
        status = 'skipped';
        actionResult = { error: `알 수 없는 action_type: ${rule.action_type}` };
        console.warn(`${tag} 알 수 없는 action_type: ${rule.action_type}`);
    }
  } catch (err) {
    status = 'failed';
    actionResult = { error: err.message };
    console.error(`${tag} 규칙 ${rule.id} 실행 실패:`, err.message);
  }

  // 실행 이력 기록
  try {
    await runInsert(
      'INSERT INTO automation_logs (rule_id, academy_id, trigger_data, action_result, status) VALUES (?, ?, ?, ?, ?)',
      [rule.id, rule.academy_id, JSON.stringify(triggerData), JSON.stringify(actionResult), status]
    );

    // 규칙 실행 카운트 업데이트
    await runQuery(
      'UPDATE automation_rules SET trigger_count = trigger_count + 1, last_triggered_at = NOW(), updated_at = NOW() WHERE id = ?',
      [rule.id]
    );
  } catch (logErr) {
    console.error(`${tag} 이력 기록 실패:`, logErr.message);
  }

  return { status, actionResult };
}

module.exports = {
  onAttendanceMarked,
  onTuitionOverdue,
  onStudentWithdrawal,
  createTask,
  processAutomationRule,
};
