// 비밀번호 정책 검증 유틸
//
// 런칭 전 기준:
//   - 최소 8자
//   - 영문/숫자/특수문자 중 2종 이상 포함
//   - 흔한 패턴 차단 (연속 숫자, 같은 글자 반복, 잘 알려진 비번)
//
// 관리자 계정(admin/superadmin)은 더 엄격:
//   - 최소 10자 + 3종 이상
//
// Trial/Free 사용자 허들을 낮추기 위해 학생은 기본 정책 유지.

const COMMON_PASSWORDS = new Set([
  '12345678', '123456789', '1234567890', 'password', 'qwerty',
  'qwertyuiop', 'asdfghjkl', '11111111', '00000000', 'password1',
  'password123', 'admin1234', 'administrator', 'welcome123',
  'iloveyou', 'abc123456', 'letmein123', 'monkey1234',
]);

const MIN_LEN_STANDARD = 8;
const MIN_LEN_ADMIN = 10;

function countCharTypes(pw) {
  let types = 0;
  if (/[a-z]/.test(pw)) types++;
  if (/[A-Z]/.test(pw)) types++;
  if (/[0-9]/.test(pw)) types++;
  if (/[^a-zA-Z0-9]/.test(pw)) types++;
  return types;
}

function hasSequentialChars(pw) {
  const lower = pw.toLowerCase();
  // 4글자 이상 연속 (abcd, 1234, wxyz)
  for (let i = 0; i < lower.length - 3; i++) {
    const a = lower.charCodeAt(i);
    const b = lower.charCodeAt(i + 1);
    const c = lower.charCodeAt(i + 2);
    const d = lower.charCodeAt(i + 3);
    if (b === a + 1 && c === b + 1 && d === c + 1) return true;
    if (b === a - 1 && c === b - 1 && d === c - 1) return true;
  }
  return false;
}

function hasRepeatedChars(pw) {
  // 같은 글자 4번 이상 연속 (aaaa, 1111)
  return /(.)\1{3,}/.test(pw);
}

/**
 * 비밀번호 검증
 * @param {string} password
 * @param {object} opts
 * @param {boolean} opts.isAdmin - admin/superadmin 계정 여부 (더 엄격)
 * @returns {{ valid: boolean, error?: string, strength?: 'weak'|'medium'|'strong' }}
 */
function validatePassword(password, { isAdmin = false } = {}) {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: '비밀번호를 입력해주세요.' };
  }

  const minLen = isAdmin ? MIN_LEN_ADMIN : MIN_LEN_STANDARD;
  if (password.length < minLen) {
    return { valid: false, error: `비밀번호는 최소 ${minLen}자 이상이어야 합니다.` };
  }
  if (password.length > 128) {
    return { valid: false, error: '비밀번호가 너무 깁니다 (최대 128자).' };
  }

  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return { valid: false, error: '너무 흔한 비밀번호입니다. 다른 비밀번호를 사용해주세요.' };
  }

  if (hasRepeatedChars(password)) {
    return { valid: false, error: '같은 문자를 4번 이상 연속 사용할 수 없습니다.' };
  }

  if (hasSequentialChars(password)) {
    return { valid: false, error: '연속된 문자/숫자(예: 1234, abcd)는 사용할 수 없습니다.' };
  }

  const types = countCharTypes(password);
  const requiredTypes = isAdmin ? 3 : 2;
  if (types < requiredTypes) {
    return {
      valid: false,
      error: isAdmin
        ? '관리자 비밀번호는 영문 대/소문자, 숫자, 특수문자 중 3종 이상 포함해야 합니다.'
        : '영문, 숫자, 특수문자 중 2종 이상 포함해야 합니다.',
    };
  }

  // 강도 계산
  let strength = 'medium';
  if (password.length >= 12 && types >= 3) strength = 'strong';
  else if (password.length >= 10 && types >= 3) strength = 'strong';
  else if (password.length < 10 || types < 3) strength = 'medium';

  return { valid: true, strength };
}

module.exports = { validatePassword, MIN_LEN_STANDARD, MIN_LEN_ADMIN };
