// client/src/hooks/usePermission.js
// 특정 리소스/액션 권한을 서버에서 조회하는 훅.
// 반환값: null(로딩) | true(허용) | false(거부)

import { useEffect, useState } from 'react';
import { apiGet } from '../api';

// (role, resource, action) → boolean 결과를 세션 동안 캐시
const cache = new Map();

function cacheKey(resource, action) {
  return `${resource}:${action}`;
}

export function usePermission(resource, action) {
  const [allowed, setAllowed] = useState(() => {
    const k = cacheKey(resource, action);
    return cache.has(k) ? cache.get(k) : null;
  });

  useEffect(() => {
    let cancelled = false;
    const k = cacheKey(resource, action);

    if (cache.has(k)) {
      setAllowed(cache.get(k));
      return () => { cancelled = true; };
    }

    apiGet(`/permissions/check?resource=${encodeURIComponent(resource)}&action=${encodeURIComponent(action)}`)
      .then((r) => {
        const value = !!r?.allowed;
        cache.set(k, value);
        if (!cancelled) setAllowed(value);
      })
      .catch(() => {
        if (!cancelled) setAllowed(false);
      });

    return () => { cancelled = true; };
  }, [resource, action]);

  return allowed;
}

export function clearPermissionCache() {
  cache.clear();
}
