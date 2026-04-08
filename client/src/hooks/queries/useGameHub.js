import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiPost, apiPut } from '../../api';

export function useCharacter() {
  return useQuery({
    queryKey: ['gamification', 'my-character'],
    queryFn: () => api('/gamification/my-character'),
    staleTime: 2 * 60_000,
  });
}

export function useMyTitles() {
  return useQuery({
    queryKey: ['gamification', 'my-titles'],
    queryFn: () => api('/gamification/my-titles'),
    staleTime: 2 * 60_000,
  });
}

export function useTodayKnowledge() {
  return useQuery({
    queryKey: ['gamification', 'knowledge', 'today-count'],
    queryFn: () => api('/gamification/knowledge/today-count').then(d => d.count || 0),
    staleTime: 60_000,
  });
}

export function useTodayReading() {
  return useQuery({
    queryKey: ['gamification', 'reading', 'today-count'],
    queryFn: () => api('/gamification/reading/today-count').then(d => d.count || 0),
    staleTime: 60_000,
  });
}

export function useDailyBonus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost('/gamification/daily-bonus', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gamification'] });
    },
  });
}

export function useRedeemCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code) => apiPost('/gamification/redeem', { code }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gamification'] });
    },
  });
}

export function useUpdateNickname() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (nickname) => apiPut('/gamification/my-nickname', { nickname }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gamification'] });
    },
  });
}

export function useUpdateTitle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (titleId) => apiPut('/gamification/my-title', { titleId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gamification'] });
    },
  });
}
