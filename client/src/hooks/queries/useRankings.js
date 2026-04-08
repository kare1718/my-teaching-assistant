import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from '../../api';

export function useRankings(type, school) {
  const schoolParam = type === 'school' && school ? `&school=${encodeURIComponent(school)}` : '';
  return useQuery({
    queryKey: ['gamification', 'rankings', type, school || ''],
    queryFn: () => api(`/gamification/rankings?type=${type}${schoolParam}`),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useRewardSettings() {
  return useQuery({
    queryKey: ['gamification', 'reward-settings'],
    queryFn: async () => {
      const data = await api('/gamification/reward-settings');
      const w = {}, m = {};
      data.forEach(s => {
        if (s.type === 'weekly') w[s.rank] = s.amount;
        else m[s.rank] = s.amount;
      });
      return { weekly: w, monthly: m };
    },
    staleTime: 10 * 60_000,
  });
}
