// 입력 검증 헬퍼
// - 얇은 래퍼: 필수 필드, 타입 변환, 포맷 검증만 담당
// - 복잡한 검증은 각 라우트에서

function requireFields(body, fields) {
  if (!body || typeof body !== 'object') {
    return `요청 본문이 비어있습니다.`;
  }
  const missing = [];
  for (const f of fields) {
    const v = body[f];
    if (v === undefined || v === null || v === '' || (typeof v === 'string' && v.trim() === '')) {
      missing.push(f);
    }
  }
  if (missing.length > 0) {
    return `필수 필드 누락: ${missing.join(', ')}`;
  }
  return null;
}

function toInt(value, fieldName = 'value') {
  if (value === null || value === undefined || value === '') return null;
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) {
    throw new Error(`${fieldName}는(은) 숫자여야 합니다.`);
  }
  return n;
}

function toIntOrDefault(value, defaultValue) {
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? defaultValue : n;
}

function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizePhone(phone) {
  if (typeof phone !== 'string') return null;
  const cleaned = phone.replace(/[^0-9]/g, '');
  if (cleaned.length < 10 || cleaned.length > 11) return null;
  return cleaned;
}

function isValidDate(dateString) {
  if (!dateString) return false;
  const d = new Date(dateString);
  return d instanceof Date && !Number.isNaN(d.getTime());
}

function sanitizeString(str, maxLength = 1000) {
  if (typeof str !== 'string') return '';
  return str.trim().slice(0, maxLength);
}

module.exports = {
  requireFields,
  toInt,
  toIntOrDefault,
  isValidEmail,
  normalizePhone,
  isValidDate,
  sanitizeString,
};
