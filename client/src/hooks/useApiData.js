import { useState, useEffect } from 'react';
import { api } from '../api';

export function useApiData(url, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = () => {
    let alive = true;
    setLoading(true);
    setError(null);
    api(url)
      .then((d) => { if (alive) setData(d); })
      .catch((e) => { if (alive) setError(e); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  };

  useEffect(refresh, deps);

  return { data, loading, error, refresh };
}

export default useApiData;
