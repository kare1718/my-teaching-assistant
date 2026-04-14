// server/db/seedPermissions.js
// 역할별 기본 권한 매트릭스 시드
//
// 리소스 15종 × 역할 5종 × 액션 4종(view/create/edit/delete)
// - admin (원장): 전부 허용
// - assistant (부원장): settings 제외 전부 허용
// - counselor (상담 실장): 상담/영업 중심
// - teacher (강사): 수업/출결/과제 중심
// - staff (행정): 수납/SMS/공지 중심

const { runQuery, getOne } = require('./database');

const RESOURCES = [
  'students', 'parents', 'classes', 'attendance', 'tuition',
  'consultations', 'leads', 'sms', 'notices', 'reports',
  'automation', 'settings', 'gamification', 'ai', 'portfolio',
];

const ACTIONS = ['view', 'create', 'edit', 'delete'];

const ROLES = ['admin', 'assistant', 'counselor', 'teacher', 'staff'];

// 역할별 권한 규칙
// 반환값: true(전부) | false(없음) | ['view', 'create', ...] (허용 액션 배열)
function getAllowedActions(role, resource) {
  if (role === 'admin') return true;

  if (role === 'assistant') {
    if (resource === 'settings') return false;
    return true;
  }

  if (role === 'counselor') {
    switch (resource) {
      case 'students':
      case 'consultations':
      case 'leads':
      case 'parents':
        return true;
      case 'tuition':
        return ['view'];
      case 'sms':
        return ['view', 'create'];
      case 'notices':
      case 'reports':
      case 'portfolio':
        return ['view'];
      case 'automation':
      case 'settings':
      case 'gamification':
      case 'ai':
        return false;
      default:
        return ['view'];
    }
  }

  if (role === 'teacher') {
    switch (resource) {
      case 'students':
        return ['view'];
      case 'classes':
      case 'attendance':
        return true;
      case 'consultations':
        return ['view', 'create'];
      case 'tuition':
        return false;
      case 'notices':
      case 'reports':
      case 'portfolio':
      case 'gamification':
        return ['view'];
      case 'parents':
      case 'leads':
      case 'sms':
      case 'automation':
      case 'settings':
      case 'ai':
        return false;
      default:
        return ['view'];
    }
  }

  if (role === 'staff') {
    switch (resource) {
      case 'students':
      case 'tuition':
      case 'sms':
      case 'notices':
        return true;
      case 'consultations':
        return ['view'];
      case 'parents':
      case 'classes':
      case 'attendance':
      case 'reports':
        return ['view'];
      case 'leads':
      case 'automation':
      case 'settings':
      case 'gamification':
      case 'ai':
      case 'portfolio':
        return false;
      default:
        return false;
    }
  }

  return false;
}

/**
 * 특정 학원에 기본 권한 매트릭스 INSERT.
 * 학원 생성 직후 호출하면 모든 역할×리소스×액션 조합이 세팅됨.
 * 이미 존재하면 덮어쓰지 않음 (ON CONFLICT DO NOTHING).
 */
async function seedPermissionsForAcademy(academyId) {
  if (!academyId) throw new Error('academyId is required');

  for (const role of ROLES) {
    for (const resource of RESOURCES) {
      const allowed = getAllowedActions(role, resource);
      for (const action of ACTIONS) {
        let value = false;
        if (allowed === true) value = true;
        else if (Array.isArray(allowed)) value = allowed.includes(action);

        await runQuery(
          `INSERT INTO permissions (academy_id, role, resource, action, allowed)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT (academy_id, role, resource, action) DO NOTHING`,
          [academyId, role, resource, action, value]
        );
      }
    }
  }
}

/**
 * academies 테이블의 모든 학원에 대해 기본 권한을 백필.
 * 기존 운영 중인 학원에 RBAC을 적용할 때 1회 실행.
 */
async function backfillAllAcademies() {
  const { getAll } = require('./database');
  const rows = await getAll('SELECT id FROM academies');
  for (const row of rows) {
    await seedPermissionsForAcademy(row.id);
  }
  return rows.length;
}

module.exports = {
  RESOURCES,
  ACTIONS,
  ROLES,
  getAllowedActions,
  seedPermissionsForAcademy,
  backfillAllAcademies,
};

// CLI 실행: `node server/db/seedPermissions.js`
if (require.main === module) {
  (async () => {
    try {
      const count = await backfillAllAcademies();
      console.log(`[seedPermissions] ${count}개 학원에 기본 권한 매트릭스 적용 완료`);
      process.exit(0);
    } catch (err) {
      console.error('[seedPermissions] 실패:', err.message);
      process.exit(1);
    }
  })();
}
