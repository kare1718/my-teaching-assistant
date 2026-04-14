// client/src/components/PermissionGuard.jsx
// 권한이 있을 때만 children을 렌더링.
// 로딩 중(null)에는 아무것도 표시하지 않음.
//
// <PermissionGuard resource="tuition" action="delete">
//   <DeleteButton />
// </PermissionGuard>

import React from 'react';
import { usePermission } from '../hooks/usePermission';

export function PermissionGuard({ resource, action, children, fallback = null }) {
  const allowed = usePermission(resource, action);
  if (allowed === null) return null;
  return allowed ? children : fallback;
}

export default PermissionGuard;
