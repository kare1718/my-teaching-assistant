const { getOne } = require('../db/database');

// 혼동 방지 문자셋 (0, O, 1, l, I 제외)
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateCode(len = 8) {
  let code = '';
  for (let i = 0; i < len; i += 1) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return code;
}

async function generateUniqueStudentCode() {
  for (let i = 0; i < 10; i += 1) {
    const code = 'S-' + generateCode();
    const exists = await getOne(
      'SELECT id FROM academies WHERE student_invite_code = ?',
      [code]
    );
    if (!exists) return code;
  }
  throw new Error('학생 초대 코드 생성 실패');
}

async function generateUniqueParentCode() {
  for (let i = 0; i < 10; i += 1) {
    const code = 'P-' + generateCode();
    const exists = await getOne(
      'SELECT id FROM academies WHERE parent_invite_code = ?',
      [code]
    );
    if (!exists) return code;
  }
  throw new Error('학부모 초대 코드 생성 실패');
}

module.exports = {
  generateUniqueStudentCode,
  generateUniqueParentCode,
};
