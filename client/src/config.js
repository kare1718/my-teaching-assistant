// SaaS 버전 — 설정은 TenantContext에서 동적으로 로드
// 이 파일은 하위 호환성을 위해 유지 (import 에러 방지)

export const SCHOOLS = [];
export const SITE_TITLE = '나만의 조교';
export const MAIN_TITLE = '나만의 조교로 학원 운영을 더욱 편리하게';
export const EXAM_TYPES = [];
export const EXAM_CATEGORIES = [];

export function getSchoolConfig(schoolName) {
  return null;
}

export function getAllGrades(schoolName) {
  return [];
}
