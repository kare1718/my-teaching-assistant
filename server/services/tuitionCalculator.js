// 수납 할인/환불/일할/보강차감 계산 서비스
const { getOne, getAll } = require('../db/database');

/**
 * 형제 할인 계산
 * 같은 부모(결제자)의 재원생 수 >= min_siblings 이면 규칙 적용
 */
async function calculateSiblingDiscount(academyId, parentId, baseAmount) {
  if (!parentId) return { discount: 0, applied: null };

  // 해당 부모에 연결된 활성 재원생 수
  const row = await getOne(
    `SELECT COUNT(DISTINCT sp.student_id) as cnt
     FROM student_parents sp
     JOIN students s ON s.id = sp.student_id
     WHERE sp.parent_id = ? AND s.academy_id = ? AND COALESCE(s.status,'active') = 'active'`,
    [parentId, academyId]
  );
  const siblingCount = Number(row?.cnt || 0);
  if (siblingCount < 2) return { discount: 0, applied: null, siblingCount };

  // 활성 형제 할인 규칙 중 조건 충족하는 것 중 가장 큰 할인
  const rules = await getAll(
    `SELECT * FROM discount_rules
     WHERE academy_id = ? AND rule_type = 'sibling' AND is_active = true`,
    [academyId]
  );

  let best = { discount: 0, applied: null };
  for (const r of rules) {
    let cond = {};
    try { cond = typeof r.condition === 'string' ? JSON.parse(r.condition) : (r.condition || {}); } catch { cond = {}; }
    const minSiblings = Number(cond.min_siblings || 2);
    if (siblingCount < minSiblings) continue;

    const discount = r.discount_type === 'percent'
      ? Math.floor((baseAmount * r.discount_value) / 100)
      : Number(r.discount_value);
    if (discount > best.discount) best = { discount, applied: r };
  }
  return { ...best, siblingCount };
}

/**
 * 일할 계산 — 월중 입반 시 남은 수업 횟수 기반 비례 청구
 * @param {Date|string} classStartDate 실제 수강 시작일
 * @param {Date|string} billingStart   청구 시작일 (보통 월초)
 * @param {Date|string} billingEnd     청구 종료일 (보통 월말)
 * @param {number} baseAmount          기본 월 수강료
 * @param {number} totalSessions       해당 월 총 수업 횟수
 */
function calculateProrated(classStartDate, billingStart, billingEnd, baseAmount, totalSessions) {
  const start = new Date(classStartDate);
  const bStart = new Date(billingStart);
  const bEnd = new Date(billingEnd);

  if (start <= bStart) {
    return { amount: baseAmount, remaining: totalSessions, total: totalSessions, ratio: 1 };
  }
  if (start > bEnd || !totalSessions) {
    return { amount: 0, remaining: 0, total: totalSessions, ratio: 0 };
  }

  const totalDays = Math.max(1, Math.round((bEnd - bStart) / 86400000) + 1);
  const remainingDays = Math.max(0, Math.round((bEnd - start) / 86400000) + 1);
  const remaining = Math.max(0, Math.round((totalSessions * remainingDays) / totalDays));

  const ratio = remaining / totalSessions;
  const amount = Math.floor(baseAmount * ratio);
  return { amount, remaining, total: totalSessions, ratio };
}

/**
 * 환불 금액 계산 — 중도 퇴원 시 남은 수업 기준
 * @param {number} recordId tuition_records.id
 * @param {Date|string} dropDate 퇴원일
 */
async function calculateRefund(recordId, dropDate) {
  const rec = await getOne(
    `SELECT tr.*, c.weekday, c.start_time
     FROM tuition_records tr
     LEFT JOIN classes c ON c.id = tr.class_id
     WHERE tr.id = ?`,
    [recordId]
  );
  if (!rec) return { refund: 0, error: '청구 기록을 찾을 수 없습니다.' };
  if (rec.status !== 'paid') return { refund: 0, error: '납부 완료된 건만 환불 계산이 가능합니다.' };

  const drop = new Date(dropDate);
  const due = new Date(rec.due_date);
  const monthStart = new Date(due.getFullYear(), due.getMonth(), 1);
  const monthEnd = new Date(due.getFullYear(), due.getMonth() + 1, 0);

  if (drop >= monthEnd) return { refund: 0, reason: '해당 월 전체 수강' };

  // 단순 일할: (잔여일 / 총일) * 납부액
  const totalDays = Math.max(1, Math.round((monthEnd - monthStart) / 86400000) + 1);
  const remainingDays = Math.max(0, Math.round((monthEnd - drop) / 86400000));
  const paid = Number(rec.amount || 0) - Number(rec.discount_amount || 0);
  const refund = Math.floor((paid * remainingDays) / totalDays);

  return {
    refund,
    reason: `${remainingDays}/${totalDays}일 환불`,
    detail: { paid, totalDays, remainingDays, dropDate, billingMonth: `${due.getFullYear()}-${String(due.getMonth()+1).padStart(2,'0')}` },
  };
}

/**
 * 학생에게 적용 가능한 모든 할인 일괄 계산
 */
async function applyDiscounts(academyId, studentId, baseAmount, month) {
  const applied = [];
  let total = 0;

  // 1. 학생 개별 할인 (유효기간 내)
  const individual = await getAll(
    `SELECT sd.*, dr.name as rule_name, dr.discount_type as rule_discount_type, dr.discount_value as rule_discount_value
     FROM student_discounts sd
     LEFT JOIN discount_rules dr ON dr.id = sd.rule_id
     WHERE sd.academy_id = ? AND sd.student_id = ?
       AND (sd.valid_from IS NULL OR sd.valid_from <= CURRENT_DATE)
       AND (sd.valid_until IS NULL OR sd.valid_until >= CURRENT_DATE)`,
    [academyId, studentId]
  );
  for (const d of individual) {
    const type = d.discount_type || d.rule_discount_type || 'fixed';
    const value = d.amount || d.rule_discount_value || 0;
    const amt = type === 'percent' ? Math.floor((baseAmount * value) / 100) : Number(value);
    if (amt > 0) {
      applied.push({ source: 'student_discount', name: d.rule_name || d.reason || '개별 할인', amount: amt });
      total += amt;
    }
  }

  // 2. 형제 할인 — 해당 학생의 결제자(parent) 찾아서 적용
  const payer = await getOne(
    `SELECT parent_id FROM student_parents
     WHERE student_id = ? AND is_payer = true LIMIT 1`,
    [studentId]
  );
  if (payer?.parent_id) {
    const sib = await calculateSiblingDiscount(academyId, payer.parent_id, baseAmount);
    if (sib.discount > 0) {
      applied.push({ source: 'sibling', name: sib.applied?.name || '형제 할인', amount: sib.discount });
      total += sib.discount;
    }
  }

  return {
    total_discount: Math.min(total, baseAmount),
    final_amount: Math.max(0, baseAmount - total),
    applied,
  };
}

/**
 * 학생의 사용 가능한 보강 크레딧 조회
 */
async function getMakeupCredits(academyId, studentId) {
  const rows = await getAll(
    `SELECT * FROM makeup_credits
     WHERE academy_id = ? AND student_id = ? AND status = 'pending'
     ORDER BY created_at ASC`,
    [academyId, studentId]
  );
  const total = rows.reduce((sum, r) => sum + Number(r.credit_amount || 0), 0);
  return { credits: rows, total };
}

module.exports = {
  calculateSiblingDiscount,
  calculateProrated,
  calculateRefund,
  applyDiscounts,
  getMakeupCredits,
};
